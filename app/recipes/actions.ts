'use server';

import { revalidatePath } from 'next/cache';
import type { ManualRecipeInput } from '@/domain/recipes/manual-entry';
import * as recipes from '@/services/recipes';
import { saveManualRecipe, type EditTarget } from '@/services/recipe-entry-core';
import { err } from '@/services/result';

export async function saveRecipeAction(input: ManualRecipeInput, edit?: EditTarget) {
  const result = await saveManualRecipe(recipes, input, edit);
  if (result.ok) {
    revalidatePath('/recipes');
    revalidatePath(`/recipes/${result.data.recipeId}`);
  }
  return result;
}

export async function favoriteRecipeAction(id: string, favorite: boolean, token: string) {
  const result = await recipes.setRecipeFavorite(id, favorite, token);
  if (result.ok) { revalidatePath('/recipes'); revalidatePath(`/recipes/${id}`); }
  return result;
}

export async function deleteRecipeAction(id: string, confirmed: boolean) {
  if (confirmed !== true) return err('validation_error', 'Confirm deletion first.');
  const result = await recipes.deleteRecipe(id);
  if (result.ok) revalidatePath('/recipes');
  return result;
}
