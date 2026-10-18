import type { ManualRecipeInput } from '../recipes/manual-entry.ts';

export type FoundRecipe = {
  id: string;
  title: string;
  category: string;
  area: string;
  draft: ManualRecipeInput;
};

function plain(value: unknown, max = 2000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeSource(value: unknown): string {
  const raw = plain(value, 1800);
  if (!raw) return 'https://www.themealdb.com/';
  try {
    const url = new URL(raw);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.toString() : 'https://www.themealdb.com/';
  } catch { return 'https://www.themealdb.com/'; }
}

export function foundRecipeFromMeal(value: unknown): FoundRecipe | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const meal = value as Record<string, unknown>;
  const id = plain(meal.idMeal, 32);
  const title = plain(meal.strMeal, 180);
  if (!/^\d+$/u.test(id) || !title) return null;
  const lines: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = plain(meal['strIngredient' + i], 160);
    const amount = plain(meal['strMeasure' + i], 120);
    if (name) lines.push([amount, name].filter(Boolean).join(' ').trim());
  }
  const instructions = plain(meal.strInstructions, 15000)
    .split(/\n\s*\n/u)
    .map(value => value.trim()).filter(Boolean).slice(0, 60);
  const category = plain(meal.strCategory, 80);
  const area = plain(meal.strArea, 80);
  return {
    id, title, category, area,
    draft: {
      title, description: [category, area].filter(Boolean).join(' · '),
      sourceUrl: safeSource(meal.strSource),
      servings: '', yieldText: '', notes: '',
      isFavorite: false,
      ingredients: lines.map(originalText => ({ originalText })),
      steps: instructions.map(instruction => ({ instruction })),
    },
  };
}
