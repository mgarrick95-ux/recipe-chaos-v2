import type { ParsedIngredient } from '../ingredients/types.ts';

export type VerificationState = 'unreviewed' | 'verified' | 'needs_review';
export type RecipeFields = {
  title: string;
  description: string | null;
  sourceUrl: string | null;
  servings: number | null;
  yieldText: string | null;
  isFavorite: boolean;
  notes: string | null;
};
export type RecipeIngredient = ParsedIngredient & {
  id?: string; // Omit for new rows; persistence generates IDs.
  position: number;
  canonicalIngredientId: string | null;
  verificationState: VerificationState;
};
export type RecipeStep = { id?: string; position: number; instruction: string };
export type RecipeDraft = RecipeFields & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};
export type RecipeAggregate = Omit<RecipeDraft, 'ingredients' | 'steps'> & {
  id: string;
  householdId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string; // Preserve the database timestamp string; do not round through Date.
  ingredients: (RecipeIngredient & { id: string; createdAt: string; updatedAt: string })[];
  steps: (RecipeStep & { id: string; createdAt: string; updatedAt: string })[];
};
export type SaveRecipeCommand =
  | { kind: 'create'; draft: RecipeDraft }
  | { kind: 'edit'; recipeId: string; expectedUpdatedAt: string; draft: RecipeDraft };
export type IngredientDraftInput = Pick<ParsedIngredient, 'originalText'> &
  Partial<Omit<ParsedIngredient, 'originalText'>>;
