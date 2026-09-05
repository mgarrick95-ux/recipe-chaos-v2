import type { Json } from "../types/database.ts";
import type { RecipeAggregate, RecipeDraft, RecipeIngredient, RecipeStep } from "../domain/recipes/types.ts";

export type RecipeRow = { id: string; household_id: string; title: string; description: string | null; source_url: string | null; servings: number | null; yield_text: string | null; is_favorite: boolean; notes: string | null; created_by: string; created_at: string; updated_at: string };
export type RecipeIngredientRow = { id: string; recipe_id: string; position: number; original_text: string; ingredient_text: string; quantity: string | null; unit: string | null; descriptor: string | null; preparation: string | null; optional: boolean; canonical_ingredient_id: string | null; verification_state: "unreviewed" | "verified" | "needs_review"; created_at: string; updated_at: string };
export type RecipeStepRow = { id: string; recipe_id: string; position: number; instruction: string; created_at: string; updated_at: string };
export type RecipeSummary = Pick<RecipeAggregate, "id" | "title" | "description" | "isFavorite" | "servings" | "yieldText" | "updatedAt">;
export type SaveRecipeRpcArgs = { p_household_id: string; p_recipe: Json; p_ingredients: Json; p_steps: Json; p_recipe_id?: string; p_expected_updated_at?: string };

export function mapRecipeSummary(row: RecipeRow): RecipeSummary {
  return { id: row.id, title: row.title, description: row.description, isFavorite: row.is_favorite, servings: row.servings, yieldText: row.yield_text, updatedAt: row.updated_at };
}

export function mapRecipeAggregate(row: RecipeRow, ingredientRows: RecipeIngredientRow[], stepRows: RecipeStepRow[]): RecipeAggregate {
  return { id: row.id, householdId: row.household_id, title: row.title, description: row.description, sourceUrl: row.source_url, servings: row.servings, yieldText: row.yield_text, isFavorite: row.is_favorite, notes: row.notes, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, ingredients: [...ingredientRows].sort(byPosition).map(mapRecipeIngredient), steps: [...stepRows].sort(byPosition).map(mapRecipeStep) };
}

export function toSaveRecipeRpcArgs(householdId: string, draft: RecipeDraft, edit?: { recipeId: string; expectedUpdatedAt: string }): SaveRecipeRpcArgs {
  return {
    p_household_id: householdId,
    p_recipe: { title: draft.title, description: draft.description, source_url: draft.sourceUrl, servings: draft.servings, yield_text: draft.yieldText, is_favorite: draft.isFavorite, notes: draft.notes },
    p_ingredients: draft.ingredients.map((i) => ({ ...(i.id === undefined ? {} : { id: i.id }), position: i.position, original_text: i.originalText, ingredient_text: i.ingredientText, quantity: i.quantity, unit: i.unit, descriptor: i.descriptor, preparation: i.preparation, optional: i.optional, canonical_ingredient_id: i.canonicalIngredientId, verification_state: i.verificationState })),
    p_steps: draft.steps.map((s) => ({ ...(s.id === undefined ? {} : { id: s.id }), position: s.position, instruction: s.instruction })),
    ...(edit === undefined ? {} : { p_recipe_id: edit.recipeId, p_expected_updated_at: edit.expectedUpdatedAt }),
  };
}

function mapRecipeIngredient(row: RecipeIngredientRow): RecipeIngredient & { id: string; createdAt: string; updatedAt: string } {
  return { id: row.id, position: row.position, originalText: row.original_text, ingredientText: row.ingredient_text, quantity: row.quantity, unit: row.unit, descriptor: row.descriptor, preparation: row.preparation, optional: row.optional, canonicalIngredientId: row.canonical_ingredient_id, verificationState: row.verification_state, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapRecipeStep(row: RecipeStepRow): RecipeStep & { id: string; createdAt: string; updatedAt: string } {
  return { id: row.id, position: row.position, instruction: row.instruction, createdAt: row.created_at, updatedAt: row.updated_at };
}
function byPosition(a: { position: number }, b: { position: number }): number { return a.position - b.position; }
