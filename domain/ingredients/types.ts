export type CanonicalIngredient = {
  id: string;
  name: string;
  normalizedName: string;
};

export type IngredientAlias = {
  id: string;
  canonicalIngredientId: string;
  alias: string;
  normalizedAlias: string;
  source: "app_seed" | "owner_approved";
  householdId: string | null;
};

export type ParsedIngredient = {
  originalText: string;
  ingredientText: string;
  quantity: string | null;
  unit: string | null;
  descriptor: string | null;
  preparation: string | null;
  optional: boolean;
};

export type IngredientSeparationRule = {
  id: string;
  householdId: string;
  normalizedInput: string;
  blockedCanonicalIngredientId: string;
};

export type IngredientMatchStatus =
  | "exact_canonical"
  | "approved_alias"
  | "no_match"
  | "ambiguous"
  | "keep_separate";

export type IngredientMatchConfidence = "certain" | "review_required" | "none";

export type IngredientMatchResult = {
  status: IngredientMatchStatus;
  input: {
    originalText: string;
    normalizedText: string;
  };
  match?: {
    canonicalIngredientId: string;
    canonicalName: string;
    matchedBy: "canonical_name" | "alias";
    aliasId?: string;
  };
  confidence: IngredientMatchConfidence;
  explanation: string;
};
