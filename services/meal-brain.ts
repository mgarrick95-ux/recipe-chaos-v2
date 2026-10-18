import 'server-only';

import { rankMealSuggestions, type BrainIngredient, type BrainRecipe, type BrainSuggestion } from '@/domain/meal-brain/rank';
import { validWeekStart } from '@/domain/planning/weeks';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentHousehold } from '@/services/households';
import { getIngredientMatchingContext } from '@/services/ingredients';
import { loadPlanningView, type PlanContextInput } from '@/services/planning';
import { err, ok, type ServiceResult } from '@/services/result';

/**
 * Reads the current household's kitchen on demand. No LLM, no data writes,
 * no separate Smart Plan. Returned suggestions are transient.
 */
export async function suggestMealIdeas(
  week: string, context: PlanContextInput,
): Promise<ServiceResult<BrainSuggestion[]>> {
  if (!validWeekStart(week) || !context || (
    ['energyLevel', 'budgetMode', 'effortLevel', 'maxCookingTimeMinutes', 'notes'] as const
  ).some(key => typeof context[key] !== 'string') ||
    [context.energyLevel, context.budgetMode, context.effortLevel].some(value => value.length > 80) ||
    context.notes.length > 1000 ||
    (context.maxCookingTimeMinutes.trim() !== '' &&
      (!/^\d+$/u.test(context.maxCookingTimeMinutes.trim()) ||
       Number(context.maxCookingTimeMinutes.trim()) > 1440))) {
    return err('validation_error', 'Check the week and planning notes before requesting suggestions.');
  }

  const planning = await loadPlanningView(week);
  if (!planning.ok) return planning;
  if (!planning.data.plan) return err('not_found', 'Create this week’s meal plan first.');

  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();

  const [recipesResult, inventoryResult, shoppingResult, matchResult] = await Promise.all([
    supabase.from('recipes').select('id,title,is_favorite')
      .eq('household_id', household.data.householdId).order('title'),
    supabase.from('inventory_items').select(
      'display_name,canonical_ingredient_id,quantity,is_out_of_stock,use_soon_status,expiry_date',
    ).eq('household_id', household.data.householdId).is('deleted_at', null),
    supabase.from('shopping_items').select('display_name,canonical_ingredient_id')
      .eq('household_id', household.data.householdId).is('deleted_at', null),
    getIngredientMatchingContext(),
  ]);

  if (recipesResult.error || inventoryResult.error || shoppingResult.error) {
    console.error('[meal-brain] candidate read failed');
    return err('unexpected_error', 'Grimmy could not read the kitchen right now. Try again.');
  }
  if (!matchResult.ok) return err(matchResult.error.code, matchResult.error.message);

  const recipeRows = recipesResult.data ?? [];
  if (!recipeRows.length) return ok([]);
  const recipeIds = recipeRows.map(item => item.id);
  const [ingredientsResult, stepsResult] = await Promise.all([
    supabase.from('recipe_ingredients').select(
      'recipe_id,ingredient_text,canonical_ingredient_id,verification_state,optional',
    ).in('recipe_id', recipeIds),
    supabase.from('recipe_steps').select('recipe_id,id').in('recipe_id', recipeIds),
  ]);

  if (ingredientsResult.error || stepsResult.error) {
    console.error('[meal-brain] recipe details read failed');
    return err('unexpected_error', 'Recipe details could not be loaded for suggestions.');
  }

  const ingredientsByRecipe = new Map<string, BrainIngredient[]>();
  for (const ingredient of ingredientsResult.data ?? []) {
    const rows = ingredientsByRecipe.get(ingredient.recipe_id) ?? [];
    rows.push({
      ingredientText: ingredient.ingredient_text,
      canonicalIngredientId: ingredient.canonical_ingredient_id,
      verificationState: ingredient.verification_state,
      optional: ingredient.optional,
    });
    ingredientsByRecipe.set(ingredient.recipe_id, rows);
  }
  const stepCountByRecipe = new Map<string, number>();
  for (const step of stepsResult.data ?? []) {
    stepCountByRecipe.set(step.recipe_id, (stepCountByRecipe.get(step.recipe_id) ?? 0) + 1);
  }

  const candidates: BrainRecipe[] = recipeRows.map(item => ({
    id: item.id, title: item.title, isFavorite: item.is_favorite,
    stepCount: stepCountByRecipe.get(item.id) ?? 0,
    ingredients: ingredientsByRecipe.get(item.id) ?? [],
  }));

  return ok(rankMealSuggestions({
    recipes: candidates,
    inventory: (inventoryResult.data ?? []).map(item => ({
      displayName: item.display_name,
      canonicalIngredientId: item.canonical_ingredient_id,
      quantity: item.quantity === null ? null : Number(item.quantity),
      isOutOfStock: item.is_out_of_stock,
      useSoonStatus: item.use_soon_status,
      expiryDate: item.expiry_date,
    })),
    shopping: (shoppingResult.data ?? []).map(item => ({
      displayName: item.display_name,
      canonicalIngredientId: item.canonical_ingredient_id,
    })),
    matchingContext: matchResult.data,
    selectedRecipeIds: planning.data.plan.slots
      .map(slot => slot.recipeId).filter((id): id is string => id !== null),
    context,
    todayIso: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
  }).slice(0, 60));
}
