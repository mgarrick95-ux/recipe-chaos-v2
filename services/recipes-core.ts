import { acceptCanonicalSuggestion, leaveNeedsReview, remainUnlinked, selectCanonical, type RecipeMatchingContext } from "../domain/recipes/ingredients.ts";
import type { RecipeAggregate, RecipeDraft, RecipeIngredient } from "../domain/recipes/types.ts";
import { isUuid, validateRecipe } from "../domain/recipes/validation.ts";
import { err, ok, type ServiceResult } from "./result.ts";
import { mapRecipeAggregate, mapRecipeSummary, toSaveRecipeRpcArgs, type RecipeIngredientRow, type RecipeRow, type RecipeStepRow, type RecipeSummary, type SaveRecipeRpcArgs } from "./recipe-mappers.ts";

export type DatabaseError = { code?: string; message?: string; details?: string | null; hint?: string | null };
export type DatabaseResult<T> = Promise<{ data: T; error: DatabaseError | null }>;
export type RecipeGateway = {
  list(householdId: string): DatabaseResult<RecipeRow[]>;
  getRecipe(householdId: string, recipeId: string): DatabaseResult<RecipeRow | null>;
  getIngredients(recipeId: string): DatabaseResult<RecipeIngredientRow[]>;
  getSteps(recipeId: string): DatabaseResult<RecipeStepRow[]>;
  save(args: SaveRecipeRpcArgs): DatabaseResult<{ recipe_id: string; updated_at: string }[]>;
  delete(householdId: string, recipeId: string): DatabaseResult<string | null>;
};

export type ReviewDecision =
  | { kind: "accept_suggestion" }
  | { kind: "select_canonical"; canonicalIngredientId: string }
  | { kind: "remain_unlinked" }
  | { kind: "needs_review" };

export function createRecipeService(gateway: RecipeGateway, householdId: string, report: (operation: string, error: DatabaseError) => void = defaultReport) {
  async function listRecipes(): Promise<ServiceResult<RecipeSummary[]>> {
    const result = await gateway.list(householdId);
    if (result.error) return unexpected("list recipes", result.error, report);
    return ok(result.data.map(mapRecipeSummary));
  }

  async function getRecipe(recipeId: string): Promise<ServiceResult<RecipeAggregate>> {
    if (!isUuid(recipeId)) return err("validation_error", "A valid recipe ID is required.");
    const parent = await gateway.getRecipe(householdId, recipeId);
    if (parent.error) return unexpected("load recipe", parent.error, report);
    if (!parent.data) return err("not_found", "Recipe not found.");
    const [ingredients, steps] = await Promise.all([gateway.getIngredients(recipeId), gateway.getSteps(recipeId)]);
    if (ingredients.error) return unexpected("load recipe ingredients", ingredients.error, report);
    if (steps.error) return unexpected("load recipe steps", steps.error, report);
    return ok(mapRecipeAggregate(parent.data, ingredients.data, steps.data));
  }

  async function saveRecipe(draft: RecipeDraft, edit?: { recipeId: string; expectedUpdatedAt: string }): Promise<ServiceResult<{ recipeId: string; updatedAt: string }>> {
    try {
      validateRecipe(draft);
      if (edit && (!isUuid(edit.recipeId) || typeof edit.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(edit.expectedUpdatedAt)))) throw new Error("A valid recipe ID and update token are required.");
    } catch (error) {
      return err("validation_error", error instanceof Error ? error.message : "Recipe details are invalid.");
    }
    const result = await gateway.save(toSaveRecipeRpcArgs(householdId, draft, edit));
    if (result.error?.code === "PT412") return err("conflict", "This recipe changed. Reload it before saving again.");
    if (result.error?.code === "P0002") return err("not_found", "Recipe not found.");
    if (result.error) return unexpected(edit ? "update recipe" : "create recipe", result.error, report);
    const saved = result.data.at(0);
    if (!saved) return unexpected(edit ? "update recipe" : "create recipe", { message: "The save RPC returned no recipe." }, report);
    return ok({ recipeId: saved.recipe_id, updatedAt: saved.updated_at });
  }

  async function createRecipe(draft: RecipeDraft) { return saveRecipe(draft); }
  async function updateRecipe(recipeId: string, expectedUpdatedAt: string, draft: RecipeDraft) { return saveRecipe(draft, { recipeId, expectedUpdatedAt }); }

  async function setRecipeFavorite(recipeId: string, isFavorite: boolean, expectedUpdatedAt: string): Promise<ServiceResult<{ recipeId: string; updatedAt: string }>> {
    if (typeof isFavorite !== "boolean") return err("validation_error", "Favorite must be true or false.");
    const loaded = await getRecipe(recipeId);
    if (!loaded.ok) return loaded;
    if (loaded.data.updatedAt !== expectedUpdatedAt) return err("conflict", "This recipe changed. Reload it before saving again.");
    return updateRecipe(recipeId, expectedUpdatedAt, { ...loaded.data, isFavorite });
  }

  async function deleteRecipe(recipeId: string): Promise<ServiceResult<{ recipeId: string }>> {
    if (!isUuid(recipeId)) return err("validation_error", "A valid recipe ID is required.");
    const result = await gateway.delete(householdId, recipeId);
    if (result.error) return unexpected("delete recipe", result.error, report);
    if (!result.data) return err("not_found", "Recipe not found.");
    return ok({ recipeId: result.data });
  }

  return { listRecipes, getRecipe, createRecipe, updateRecipe, setRecipeFavorite, deleteRecipe };
}

export function applyIngredientReview(row: RecipeIngredient, decision: ReviewDecision, context: RecipeMatchingContext): RecipeIngredient {
  switch (decision.kind) {
    case "accept_suggestion": return acceptCanonicalSuggestion(row, context);
    case "select_canonical": return selectCanonical(row, decision.canonicalIngredientId, context);
    case "remain_unlinked": return remainUnlinked(row);
    case "needs_review": return leaveNeedsReview(row);
    default: throw new Error("The ingredient decision is invalid.");
  }
}

function unexpected<T>(operation: string, error: DatabaseError, report: (operation: string, error: DatabaseError) => void): ServiceResult<T> {
  report(operation, error);
  return err("unexpected_error", "Recipe data could not be updated. Please try again.");
}
function defaultReport(operation: string, error: DatabaseError): void {
  console.error(`[recipes] ${operation} failed`, { code: error.code, message: error.message, details: error.details, hint: error.hint });
}
