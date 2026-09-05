import { buildManualRecipe, type ManualRecipeInput } from '../domain/recipes/manual-entry.ts';
import type { RecipeAggregate, RecipeDraft } from '../domain/recipes/types.ts';
import { err, type ServiceResult } from './result.ts';

type Saved = { recipeId: string; updatedAt: string };
export type EditTarget = { recipeId: string; expectedUpdatedAt: string };
export type EntryServices = {
  getRecipe(id: string): Promise<ServiceResult<RecipeAggregate>>;
  createRecipe(draft: RecipeDraft): Promise<ServiceResult<Saved>>;
  updateRecipe(id: string, token: string, draft: RecipeDraft): Promise<ServiceResult<Saved>>;
};

export async function saveManualRecipe(services: EntryServices, input: ManualRecipeInput, edit?: EditTarget): Promise<ServiceResult<Saved>> {
  let existing: RecipeAggregate | undefined;
  if (edit) {
    const loaded = await services.getRecipe(edit.recipeId);
    if (!loaded.ok) return loaded;
    if (loaded.data.updatedAt !== edit.expectedUpdatedAt) return err('conflict', 'This recipe changed somewhere else. Reload before saving again.');
    existing = loaded.data;
  }
  let draft: RecipeDraft;
  try { draft = buildManualRecipe(input, existing); }
  catch { return err('validation_error', 'Check the title, ingredient lines, steps, source URL, and servings before saving.'); }
  return edit ? services.updateRecipe(edit.recipeId, edit.expectedUpdatedAt, draft) : services.createRecipe(draft);
}
