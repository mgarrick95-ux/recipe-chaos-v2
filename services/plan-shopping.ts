import 'server-only';

import { derivePlanShoppingReview, type PlanIngredientOrigin, type PlanShoppingReviewRow } from '@/domain/planning/shopping-review';
import { isUuid } from '@/domain/recipes/validation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentHousehold } from '@/services/households';
import { getIngredientMatchingContext } from '@/services/ingredients';
import { err, ok, type ServiceResult } from '@/services/result';
import { approvePlanShoppingReview, type PlanShoppingApprovalOrigin, type PlanShoppingApprovalResult } from '@/services/plan-shopping-core';
import type { Json } from '@/types/database';

export type { PlanShoppingApprovalOrigin, PlanShoppingApprovalResult } from '@/services/plan-shopping-core';

export async function getPlanShoppingReview(planId: string): Promise<ServiceResult<PlanShoppingReviewRow[]>> {
  if (!isUuid(planId)) return err('validation_error', 'A valid weekly plan is required.');
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();

  const plan = await supabase.from('meal_plans').select('id,household_id')
    .eq('id', planId).eq('household_id', household.data.householdId).maybeSingle();
  if (plan.error) return unexpected('The weekly plan ingredients could not be loaded.', plan.error);
  if (!plan.data) return err('not_found', 'Weekly plan not found.');

  const slots = await supabase.from('meal_plan_slots').select('id,position')
    .eq('meal_plan_id', planId).order('position');
  if (slots.error) return unexpected('The weekly plan ingredients could not be loaded.', slots.error);
  const slotIds = slots.data.map((slot) => slot.id);
  if (slotIds.length === 0) return ok([]);

  const selections = await supabase.from('meal_plan_selections')
    .select('id,meal_plan_slot_id,recipe_id').in('meal_plan_slot_id', slotIds);
  if (selections.error) return unexpected('The weekly plan ingredients could not be loaded.', selections.error);
  if (selections.data.length === 0) return ok([]);

  const recipeIds = [...new Set(selections.data.map((selection) => selection.recipe_id))];
  const [recipes, ingredients, inventory, shopping, matchingContext] = await Promise.all([
    supabase.from('recipes').select('id,title').eq('household_id', household.data.householdId).in('id', recipeIds),
    supabase.from('recipe_ingredients').select('id,recipe_id,original_text,ingredient_text,canonical_ingredient_id,verification_state,optional,position').in('recipe_id', recipeIds).order('position'),
    supabase.from('inventory_items').select('id,display_name,canonical_ingredient_id,quantity,is_out_of_stock')
      .eq('household_id', household.data.householdId).is('deleted_at', null),
    supabase.from('shopping_items').select('id,display_name,canonical_ingredient_id,source_type,source_id,source_slot_id,source_recipe_ingredient_id,is_checked')
      .eq('household_id', household.data.householdId).is('deleted_at', null),
    getIngredientMatchingContext(),
  ]);
  const failure = recipes.error ?? ingredients.error ?? inventory.error ?? shopping.error;
  if (failure) return unexpected('The weekly plan ingredients could not be loaded.', failure);
  if (!matchingContext.ok) return err(matchingContext.error.code, matchingContext.error.message);

  const recipeRows = recipes.data ?? [];
  const ingredientRows = ingredients.data ?? [];
  const inventoryRows = inventory.data ?? [];
  const shoppingRows = shopping.data ?? [];
  const recipeTitles = new Map(recipeRows.map((recipe) => [recipe.id, recipe.title]));
  const ingredientsByRecipe = new Map<string, typeof ingredientRows>();
  for (const ingredient of ingredientRows) {
    const rows = ingredientsByRecipe.get(ingredient.recipe_id) ?? [];
    rows.push(ingredient);
    ingredientsByRecipe.set(ingredient.recipe_id, rows);
  }
  const slotPositions = new Map(slots.data.map((slot) => [slot.id, slot.position]));
  const plannedIngredients: PlanIngredientOrigin[] = selections.data
    .sort((a, b) => (slotPositions.get(a.meal_plan_slot_id) ?? 0) - (slotPositions.get(b.meal_plan_slot_id) ?? 0))
    .flatMap((selection) => (ingredientsByRecipe.get(selection.recipe_id) ?? []).map((ingredient) => ({
      planId,
      slotId: selection.meal_plan_slot_id,
      selectionId: selection.id,
      recipeId: selection.recipe_id,
      recipeTitle: recipeTitles.get(selection.recipe_id) ?? 'Planned recipe',
      recipeIngredientId: ingredient.id,
      originalText: ingredient.original_text,
      ingredientText: ingredient.ingredient_text,
      canonicalIngredientId: ingredient.canonical_ingredient_id,
      verificationState: ingredient.verification_state,
      optional: ingredient.optional,
    })));

  return ok(derivePlanShoppingReview({
    ingredients: plannedIngredients,
    inventory: inventoryRows.map((item) => ({
      id: item.id,
      displayName: item.display_name,
      canonicalIngredientId: item.canonical_ingredient_id,
      quantity: item.quantity === null ? null : Number(item.quantity),
      isOutOfStock: item.is_out_of_stock,
    })),
    shopping: shoppingRows.map((item) => ({
      id: item.id,
      displayName: item.display_name,
      canonicalIngredientId: item.canonical_ingredient_id,
      sourceType: item.source_type,
      sourceId: item.source_id,
      sourceSlotId: item.source_slot_id,
      sourceRecipeIngredientId: item.source_recipe_ingredient_id,
      isChecked: item.is_checked,
      deletedAt: null,
    })),
    matchingContext: matchingContext.data,
  }));
}

export async function approvePlanShoppingItems(
  planId: string,
  requested: PlanShoppingApprovalOrigin[],
): Promise<ServiceResult<PlanShoppingApprovalResult>> {
  if (!isUuid(planId) || !Array.isArray(requested) || requested.length > 200
    || requested.some((origin) => !origin || !isUuid(origin.slotId) || !isUuid(origin.recipeIngredientId))) {
    return err('validation_error', 'Choose valid planned ingredients to add.');
  }

  const review = await getPlanShoppingReview(planId);
  if (!review.ok) return review;
  try {
    const approval = await approvePlanShoppingReview(review.data, requested, async (eligible) => {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.rpc('add_plan_shopping_items', {
        p_plan_id: planId,
        p_origins: eligible.map((origin) => ({
          slot_id: origin.slotId,
          recipe_ingredient_id: origin.recipeIngredientId,
        })) as Json,
      });
      if (error) throw new PlanShoppingPersistenceError(error);
      const returned = new Map<string, 'added' | 'already_plan' | 'stale_or_invalid'>((data ?? []).map((item) => [
        `${item.slot_id}:${item.recipe_ingredient_id}`,
        item.outcome === 'added' || item.outcome === 'already_plan' ? item.outcome : 'stale_or_invalid',
      ]));
      return eligible.map((origin) => ({
        ...origin,
        outcome: returned.get(`${origin.slotId}:${origin.recipeIngredientId}`) ?? 'stale_or_invalid',
      }));
    });
    return ok(approval);
  } catch (error) {
    if (error instanceof PlanShoppingPersistenceError) {
      return unexpected('The selected ingredients could not be added to Shopping.', error.databaseError);
    }
    throw error;
  }
}

function unexpected<T>(message: string, error: { code?: string; message?: string }): ServiceResult<T> {
  console.error('[plan-shopping] operation failed', { code: error.code, message: error.message });
  return err('unexpected_error', message);
}

class PlanShoppingPersistenceError extends Error {
  constructor(readonly databaseError: { code?: string; message?: string }) {
    super('Plan shopping persistence failed.');
  }
}
