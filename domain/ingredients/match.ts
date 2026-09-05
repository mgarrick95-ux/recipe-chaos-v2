import { normalizeIngredientName } from "./normalize.ts";
import type {
  CanonicalIngredient,
  IngredientAlias,
  IngredientMatchResult,
  IngredientSeparationRule,
} from "./types.ts";

type MatchIngredientsInput = {
  originalText: string;
  householdId?: string;
  canonicalIngredients: CanonicalIngredient[];
  aliases: IngredientAlias[];
  separationRules?: IngredientSeparationRule[];
};

export function matchIngredient({
  originalText,
  householdId,
  canonicalIngredients,
  aliases,
  separationRules = [],
}: MatchIngredientsInput): IngredientMatchResult {
  const normalizedText = normalizeIngredientName(originalText);
  const baseInput = { originalText, normalizedText };

  const householdAlias = aliases.find(
    (alias) =>
      alias.householdId === householdId &&
      alias.normalizedAlias === normalizedText,
  );
  const householdAliasMatch = matchAlias(
    householdAlias,
    canonicalIngredients,
    baseInput,
    separationRules,
    householdId,
  );
  if (householdAliasMatch) {
    return householdAliasMatch;
  }

  const canonical = canonicalIngredients.find(
    (ingredient) => ingredient.normalizedName === normalizedText,
  );
  if (canonical) {
    if (isKeptSeparate(normalizedText, canonical.id, separationRules, householdId)) {
      return keepSeparateResult(baseInput, canonical.name);
    }

    return {
      status: "exact_canonical",
      input: baseInput,
      match: {
        canonicalIngredientId: canonical.id,
        canonicalName: canonical.name,
        matchedBy: "canonical_name",
      },
      confidence: "certain",
      explanation: "Matched an exact canonical ingredient name.",
    };
  }

  const globalAlias = aliases.find(
    (alias) =>
      alias.householdId === null && alias.normalizedAlias === normalizedText,
  );
  const globalAliasMatch = matchAlias(
    globalAlias,
    canonicalIngredients,
    baseInput,
    separationRules,
    householdId,
  );
  if (globalAliasMatch) {
    return globalAliasMatch;
  }

  return {
    status: "no_match",
    input: baseInput,
    confidence: "none",
    explanation: "No deterministic canonical ingredient or approved alias matched.",
  };
}

function matchAlias(
  alias: IngredientAlias | undefined,
  canonicalIngredients: CanonicalIngredient[],
  input: IngredientMatchResult["input"],
  separationRules: IngredientSeparationRule[],
  householdId: string | undefined,
): IngredientMatchResult | undefined {
  if (!alias) {
    return undefined;
  }

  const canonical = canonicalIngredients.find(
    (ingredient) => ingredient.id === alias.canonicalIngredientId,
  );

  if (!canonical) {
    return {
      status: "ambiguous",
      input,
      confidence: "review_required",
      explanation: "Approved alias exists but its canonical ingredient is unavailable.",
    };
  }

  if (
    isKeptSeparate(input.normalizedText, canonical.id, separationRules, householdId)
  ) {
    return keepSeparateResult(input, canonical.name);
  }

  return {
    status: "approved_alias",
    input,
    match: {
      canonicalIngredientId: canonical.id,
      canonicalName: canonical.name,
      matchedBy: "alias",
      aliasId: alias.id,
    },
    confidence: "certain",
    explanation: "Matched an approved ingredient alias.",
  };
}

function isKeptSeparate(
  normalizedInput: string,
  canonicalIngredientId: string,
  separationRules: IngredientSeparationRule[],
  householdId: string | undefined,
): boolean {
  return separationRules.some(
    (rule) =>
      rule.householdId === householdId &&
      rule.normalizedInput === normalizedInput &&
      rule.blockedCanonicalIngredientId === canonicalIngredientId,
  );
}

function keepSeparateResult(
  input: IngredientMatchResult["input"],
  canonicalName: string,
): IngredientMatchResult {
  return {
    status: "keep_separate",
    input,
    confidence: "review_required",
    explanation: `A household keep-separate rule blocks matching this input to ${canonicalName}.`,
  };
}
