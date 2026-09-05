import "server-only";

import type { RecipeDraft } from "@/domain/recipes/types";
import { isUuid } from "@/domain/recipes/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/services/households";
import { getIngredientMatchingContext } from "@/services/ingredients";
import { applyIngredientReview, createRecipeService, type RecipeGateway, type ReviewDecision } from "@/services/recipes-core";
import { err, type ServiceResult } from "@/services/result";
import type { RecipeAggregate } from "@/domain/recipes/types";

async function currentService(): Promise<ServiceResult<ReturnType<typeof createRecipeService>>> {
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const gateway: RecipeGateway = {
    async list(householdId) {
      const result = await supabase.from("recipes").select("*").eq("household_id", householdId).order("is_favorite", { ascending: false }).order("updated_at", { ascending: false }).order("title", { ascending: true });
      return { data: result.data ?? [], error: result.error };
    },
    async getRecipe(householdId, recipeId) {
      const result = await supabase.from("recipes").select("*").eq("household_id", householdId).eq("id", recipeId).maybeSingle();
      return { data: result.data, error: result.error };
    },
    async getIngredients(recipeId) {
      const result = await supabase.from("recipe_ingredients").select("*").eq("recipe_id", recipeId).order("position", { ascending: true });
      return { data: result.data ?? [], error: result.error };
    },
    async getSteps(recipeId) {
      const result = await supabase.from("recipe_steps").select("*").eq("recipe_id", recipeId).order("position", { ascending: true });
      return { data: result.data ?? [], error: result.error };
    },
    async save(args) {
      const result = await supabase.rpc("save_recipe", args);
      return { data: result.data ?? [], error: result.error };
    },
    async delete(householdId, recipeId) {
      const result = await supabase.from("recipes").delete().eq("household_id", householdId).eq("id", recipeId).select("id").maybeSingle();
      return { data: result.data?.id ?? null, error: result.error };
    },
  };
  return { ok: true, data: createRecipeService(gateway, household.data.householdId) };
}

export async function listRecipes() { const service = await currentService(); return service.ok ? service.data.listRecipes() : service; }
export async function getRecipe(recipeId: string) { const service = await currentService(); return service.ok ? service.data.getRecipe(recipeId) : service; }
export async function createRecipe(draft: RecipeDraft) { const service = await currentService(); return service.ok ? service.data.createRecipe(draft) : service; }
export async function updateRecipe(recipeId: string, expectedUpdatedAt: string, draft: RecipeDraft) { const service = await currentService(); return service.ok ? service.data.updateRecipe(recipeId, expectedUpdatedAt, draft) : service; }
export async function setRecipeFavorite(recipeId: string, isFavorite: boolean, expectedUpdatedAt: string) { const service = await currentService(); return service.ok ? service.data.setRecipeFavorite(recipeId, isFavorite, expectedUpdatedAt) : service; }
export async function deleteRecipe(recipeId: string) { const service = await currentService(); return service.ok ? service.data.deleteRecipe(recipeId) : service; }

export async function reviewRecipeIngredient(recipeId: string, ingredientId: string, expectedUpdatedAt: string, decision: ReviewDecision): Promise<ServiceResult<{ recipeId: string; updatedAt: string }>> {
  if (!isUuid(recipeId) || !isUuid(ingredientId)) return err("validation_error", "Valid recipe and ingredient IDs are required.");
  const loaded = await getRecipe(recipeId);
  if (!loaded.ok) return loaded;
  if (loaded.data.updatedAt !== expectedUpdatedAt) return err("conflict", "This recipe changed. Reload it before saving again.");
  const ingredientIndex = loaded.data.ingredients.findIndex((item) => item.id === ingredientId);
  if (ingredientIndex < 0) return err("not_found", "Recipe ingredient not found.");
  const context = await getIngredientMatchingContext();
  if (!context.ok) return context;
  let reviewed;
  try { reviewed = applyIngredientReview(loaded.data.ingredients[ingredientIndex], decision, context.data); }
  catch (error) { return err("validation_error", error instanceof Error ? error.message : "The ingredient decision is invalid."); }
  const draft: RecipeDraft = { ...loaded.data, ingredients: loaded.data.ingredients.map((item, index) => index === ingredientIndex ? reviewed : item) };
  return updateRecipe(recipeId, expectedUpdatedAt, draft);
}

export type { RecipeAggregate };
