import type { CanonicalIngredient, IngredientAlias, IngredientSeparationRule } from "../domain/ingredients/types.ts";

export type CanonicalIngredientRow = { id: string; name: string; normalized_name: string };
export type IngredientAliasRow = { id: string; canonical_ingredient_id: string; alias: string; normalized_alias: string; source: "app_seed" | "owner_approved"; household_id: string | null };
export type IngredientSeparationRuleRow = { id: string; household_id: string; normalized_input: string; blocked_canonical_ingredient_id: string };

export function mapCanonicalIngredient(row: CanonicalIngredientRow): CanonicalIngredient { return { id: row.id, name: row.name, normalizedName: row.normalized_name }; }
export function mapIngredientAlias(row: IngredientAliasRow): IngredientAlias { return { id: row.id, canonicalIngredientId: row.canonical_ingredient_id, alias: row.alias, normalizedAlias: row.normalized_alias, source: row.source, householdId: row.household_id }; }
export function mapIngredientSeparationRule(row: IngredientSeparationRuleRow): IngredientSeparationRule { return { id: row.id, householdId: row.household_id, normalizedInput: row.normalized_input, blockedCanonicalIngredientId: row.blocked_canonical_ingredient_id }; }
