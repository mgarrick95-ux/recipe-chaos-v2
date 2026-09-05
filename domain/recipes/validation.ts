import type { RecipeDraft, RecipeIngredient } from './types.ts';
import { validateOrdering } from './ordering.ts';

export function requireNonblank(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(field + ' is required.');
}
function nullableText(value: string | null, field: string): void {
  if (value !== null && typeof value !== 'string') throw new Error(field + ' must be text or null.');
}
export function validateIngredient(row: RecipeIngredient): void {
  requireNonblank(row.originalText, 'Original ingredient text');
  requireNonblank(row.ingredientText, 'Ingredient text');
  for (const key of ['quantity', 'unit', 'descriptor', 'preparation'] as const) nullableText(row[key], key);
  if (typeof row.optional !== 'boolean') throw new Error('Optional must be boolean.');
  if (!['unreviewed', 'verified', 'needs_review'].includes(row.verificationState)) throw new Error('Invalid verification state.');
  if (row.canonicalIngredientId !== null && !isUuid(row.canonicalIngredientId)) throw new Error('Invalid canonical UUID.');
  if (row.verificationState === 'unreviewed' && row.canonicalIngredientId !== null) throw new Error('Unreviewed ingredients cannot have an accepted link.');
  validateOrdering([row]);
  if (row.id !== undefined && !isUuid(row.id)) throw new Error('Invalid ingredient UUID.');
}
export function isUuid(value: string): boolean {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function validateRecipe(draft: RecipeDraft): void {
  requireNonblank(draft.title, 'Title');
  if (draft.servings !== null && (typeof draft.servings !== 'number' || !Number.isFinite(draft.servings) || draft.servings <= 0)) throw new Error('Servings must be positive and finite.');
  for (const key of ['description', 'sourceUrl', 'yieldText', 'notes'] as const) nullableText(draft[key], key);
  if (draft.sourceUrl !== null) {
    const url = new URL(draft.sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Source URL must use HTTP or HTTPS.');
  }
  if (typeof draft.isFavorite !== 'boolean') throw new Error('Favorite must be boolean.');
  if (!Array.isArray(draft.ingredients) || !Array.isArray(draft.steps)) throw new Error('Complete ingredient and step arrays are required.');
  validateOrdering(draft.ingredients);
  validateOrdering(draft.steps);
  draft.ingredients.forEach(validateIngredient);
  for (const step of draft.steps) {
    requireNonblank(step.instruction, 'Instruction');
    if (step.id !== undefined && !isUuid(step.id)) throw new Error('Invalid step UUID.');
  }
}

export function createRecipeDraft(title: string): RecipeDraft {
  const draft: RecipeDraft = { title, description: null, sourceUrl: null, servings: null,
    yieldText: null, isFavorite: false, notes: null, ingredients: [], steps: [] };
  validateRecipe(draft);
  return draft;
}
