import { createRecipeIngredient, editRecipeIngredient } from './ingredients.ts';
import { assignPositions } from './ordering.ts';
import type { RecipeAggregate, RecipeDraft } from './types.ts';
import { validateRecipe } from './validation.ts';

// Only authored fields cross the form boundary. Canonical decisions come from
// the authoritative saved aggregate, never from a hidden client input.
export type ManualRecipeInput = {
  title: string; description: string; sourceUrl: string; servings: string;
  yieldText: string; notes: string; isFavorite: boolean;
  ingredients: { id?: string; originalText: string }[];
  steps: { id?: string; instruction: string }[];
};

export function recipeToInput(recipe?: RecipeAggregate): ManualRecipeInput {
  return {
    title: recipe?.title ?? '', description: recipe?.description ?? '',
    sourceUrl: recipe?.sourceUrl ?? '', servings: recipe?.servings?.toString() ?? '',
    yieldText: recipe?.yieldText ?? '', notes: recipe?.notes ?? '',
    isFavorite: recipe?.isFavorite ?? false,
    ingredients: recipe?.ingredients.map(({ id, originalText }) => ({ id, originalText })) ?? [],
    steps: recipe?.steps.map(({ id, instruction }) => ({ id, instruction })) ?? [],
  };
}

export function buildManualRecipe(input: ManualRecipeInput, existing?: RecipeAggregate): RecipeDraft {
  const nullable = (value: string) => value === '' ? null : value;
  const draft: RecipeDraft = {
    title: input.title, description: nullable(input.description), sourceUrl: nullable(input.sourceUrl),
    servings: input.servings === '' ? null : Number(input.servings),
    yieldText: nullable(input.yieldText), notes: nullable(input.notes), isFavorite: input.isFavorite,
    ingredients: assignPositions(input.ingredients.map((row, position) => {
      if (row.id === undefined) return createRecipeIngredient({ originalText: row.originalText }, position);
      const saved = existing?.ingredients.find((item) => item.id === row.id);
      if (!saved) throw new Error('An ingredient is no longer available. Reload this recipe.');
      return editRecipeIngredient(saved, { originalText: row.originalText });
    })),
    steps: assignPositions(input.steps.map((row, position) => {
      if (row.id === undefined) return { instruction: row.instruction, position };
      const saved = existing?.steps.find((item) => item.id === row.id);
      if (!saved) throw new Error('A step is no longer available. Reload this recipe.');
      return { ...saved, instruction: row.instruction };
    })),
  };
  validateRecipe(draft);
  return draft;
}

export function moveRow<T>(rows: readonly T[], index: number, direction: -1 | 1): T[] {
  const next = [...rows];
  const target = index + direction;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
