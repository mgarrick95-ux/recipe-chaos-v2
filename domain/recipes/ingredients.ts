import { isKeptSeparate, matchIngredient } from '../ingredients/match.ts';
import { normalizeIngredientName } from '../ingredients/normalize.ts';
import type { ParsedIngredient } from '../ingredients/types.ts';
import type { IngredientDraftInput, RecipeIngredient } from './types.ts';
import { validateIngredient } from './validation.ts';

export type RecipeMatchingContext = Omit<Parameters<typeof matchIngredient>[0], 'originalText' | 'householdId'> & { householdId: string };

export function createRecipeIngredient(input: IngredientDraftInput, position: number): RecipeIngredient {
  const row: RecipeIngredient = {
    originalText: input.originalText,
    ingredientText: input.ingredientText ?? input.originalText,
    quantity: input.quantity ?? null, unit: input.unit ?? null,
    descriptor: input.descriptor ?? null, preparation: input.preparation ?? null,
    optional: input.optional ?? false, position,
    canonicalIngredientId: null, verificationState: 'unreviewed',
  };
  validateIngredient(row);
  return row;
}

export function suggestCanonical(row: RecipeIngredient, context: RecipeMatchingContext) {
  // Result.input.originalText is the matching name, NOT the recipe's authored line.
  return matchIngredient({ ...context, originalText: row.ingredientText });
}

export function editRecipeIngredient(row: RecipeIngredient, patch: Partial<ParsedIngredient>): RecipeIngredient {
  const next = { ...row };
  // Whitelist content keys: this operation cannot accept a canonical decision.
  const keys = ['originalText', 'ingredientText', 'quantity', 'unit', 'descriptor', 'preparation', 'optional'] as const;
  for (const key of keys) {
    if (patch[key] !== undefined) Object.assign(next, { [key]: patch[key] });
  }
  const identityChanged = (['originalText', 'ingredientText', 'descriptor', 'preparation'] as const)
    .some((key) => next[key] !== row[key]);
  if (identityChanged && row.verificationState === 'verified') next.verificationState = 'needs_review';
  validateIngredient(next);
  return next;
}

export function selectCanonical(row: RecipeIngredient, canonicalId: string, context: RecipeMatchingContext): RecipeIngredient {
  if (!context.canonicalIngredients.some((candidate) => candidate.id === canonicalId)) throw new Error('Canonical ingredient is unavailable.');
  const normalizedInput = normalizeIngredientName(row.ingredientText);
  if (isKeptSeparate(normalizedInput, canonicalId, context.separationRules ?? [], context.householdId)) {
    throw new Error('Change the keep-separate decision explicitly before selecting this ingredient.');
  }
  const next: RecipeIngredient = { ...row, canonicalIngredientId: canonicalId, verificationState: 'verified' };
  validateIngredient(next);
  return next;
}

export function acceptCanonicalSuggestion(row: RecipeIngredient, context: RecipeMatchingContext): RecipeIngredient {
  const result = suggestCanonical(row, context);
  if (!result.match || !['exact_canonical', 'approved_alias'].includes(result.status)) throw new Error('No deterministic suggestion is available to accept.');
  return selectCanonical(row, result.match.canonicalIngredientId, context);
}

export function remainUnlinked(row: RecipeIngredient): RecipeIngredient {
  const next: RecipeIngredient = { ...row, canonicalIngredientId: null, verificationState: 'verified' };
  validateIngredient(next);
  return next;
}
