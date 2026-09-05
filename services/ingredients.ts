import "server-only";

import { createRecipeIngredient, suggestCanonical, type RecipeMatchingContext } from "@/domain/recipes/ingredients";
import { normalizeIngredientName } from "@/domain/ingredients/normalize";
import type { IngredientMatchResult } from "@/domain/ingredients/types";
import { isUuid } from "@/domain/recipes/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/services/households";
import { mapCanonicalIngredient, mapIngredientAlias, mapIngredientSeparationRule } from "@/services/ingredient-mappers";
import { err, ok, type ServiceResult } from "@/services/result";

export async function getIngredientMatchingContext(): Promise<ServiceResult<RecipeMatchingContext>> {
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const [canonical, aliases, separationRules] = await Promise.all([
    supabase.from("canonical_ingredients").select("id,name,normalized_name").order("normalized_name"),
    supabase.from("ingredient_aliases").select("id,canonical_ingredient_id,alias,normalized_alias,source,household_id").or(`household_id.is.null,household_id.eq.${household.data.householdId}`).order("normalized_alias"),
    supabase.from("ingredient_separation_rules").select("id,household_id,normalized_input,blocked_canonical_ingredient_id").eq("household_id", household.data.householdId).order("normalized_input"),
  ]);
  const failure = canonical.error ?? aliases.error ?? separationRules.error;
  if (failure || !canonical.data || !aliases.data || !separationRules.data) {
    reportIngredientError("load matching context", failure ?? { message: "Missing ingredient catalogue data." });
    return err("unexpected_error", "Ingredient matching information could not be loaded.");
  }
  return ok({
    householdId: household.data.householdId,
    canonicalIngredients: canonical.data.map(mapCanonicalIngredient),
    aliases: aliases.data.map(mapIngredientAlias),
    separationRules: separationRules.data.map(mapIngredientSeparationRule),
  });
}

export async function suggestIngredientMatch(ingredientText: string): Promise<ServiceResult<IngredientMatchResult>> {
  if (typeof ingredientText !== "string" || !ingredientText.trim()) return err("validation_error", "Ingredient text is required.");
  const context = await getIngredientMatchingContext();
  if (!context.ok) return context;
  const transient = createRecipeIngredient({ originalText: ingredientText, ingredientText }, 0);
  return ok(suggestCanonical(transient, context.data));
}

export async function createKeepSeparateRule(input: string, canonicalIngredientId: string): Promise<ServiceResult<{ id: string }>> {
  if (typeof input !== "string" || !normalizeIngredientName(input) || !isUuid(canonicalIngredientId)) return err("validation_error", "Ingredient text and a valid canonical ingredient are required.");
  const context = await getIngredientMatchingContext();
  if (!context.ok) return context;
  if (!context.data.canonicalIngredients.some((item) => item.id === canonicalIngredientId)) return err("validation_error", "That canonical ingredient is unavailable.");
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("ingredient_separation_rules").insert({ household_id: household.data.householdId, normalized_input: normalizeIngredientName(input), blocked_canonical_ingredient_id: canonicalIngredientId, created_by: household.data.userId }).select("id").single();
  if (error?.code === "23505") return err("conflict", "This keep-separate decision already exists.");
  if (error) {
    reportIngredientError("create keep-separate rule", error);
    return err("unexpected_error", "The keep-separate decision could not be saved.");
  }
  return ok({ id: data.id });
}

export async function removeKeepSeparateRule(ruleId: string): Promise<ServiceResult<{ id: string }>> {
  if (!isUuid(ruleId)) return err("validation_error", "A valid keep-separate decision ID is required.");
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("ingredient_separation_rules").delete().eq("id", ruleId).eq("household_id", household.data.householdId).select("id").maybeSingle();
  if (error) {
    reportIngredientError("remove keep-separate rule", error);
    return err("unexpected_error", "The keep-separate decision could not be removed.");
  }
  if (!data) return err("not_found", "Keep-separate decision not found.");
  return ok({ id: data.id });
}

function reportIngredientError(operation: string, error: { code?: string; message?: string; details?: string | null; hint?: string | null }): void {
  console.error(`[ingredients] ${operation} failed`, { code: error.code, message: error.message, details: error.details, hint: error.hint });
}
