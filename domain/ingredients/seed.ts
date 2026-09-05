import { normalizeIngredientName } from "./normalize.ts";
import type { CanonicalIngredient, IngredientAlias } from "./types.ts";

const names = [
  "garlic",
  "garlic powder",
  "fresh ginger",
  "ground ginger",
  "brown sugar",
  "granulated sugar",
  "milk",
  "almond milk",
  "butter",
  "margarine",
  "salt",
  "black pepper",
  "olive oil",
  "onion",
  "egg",
] as const;

export const seedCanonicalIngredients: CanonicalIngredient[] = names.map(
  (name) => ({
    id: name,
    name,
    normalizedName: normalizeIngredientName(name),
  }),
);

export const seedIngredientAliases: IngredientAlias[] = [
  ["garlic cloves", "garlic"],
  ["cloves of garlic", "garlic"],
  ["white sugar", "granulated sugar"],
  ["dairy milk", "milk"],
  ["cow's milk", "milk"],
].map(([alias, canonicalName]) => ({
  id: alias,
  canonicalIngredientId: canonicalName,
  alias,
  normalizedAlias: normalizeIngredientName(alias),
  source: "app_seed",
  householdId: null,
}));
