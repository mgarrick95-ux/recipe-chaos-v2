import Link from 'next/link';
import type { RecipeSummary } from '@/services/recipe-mappers';

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return <Link href={`/recipes/${recipe.id}`} className="recipe-card group flex min-h-48 flex-col gap-3 p-5 sm:p-6">
    <span className="recipe-card-tag" aria-hidden="true">From the recipe box</span>
    <div className="flex items-start justify-between gap-3">
      <h2 className="section-title transition-colors group-hover:text-teal-200">{recipe.title}</h2>
      {recipe.isFavorite && <span className="recipe-keeper shrink-0" aria-label="Keeper recipe"><span aria-hidden="true">★ </span>Keeper</span>}
    </div>
    {recipe.description && <p className="muted line-clamp-2 whitespace-pre-wrap text-sm leading-6">{recipe.description}</p>}
    {(recipe.yieldText || recipe.servings) && <p className="muted text-xs">{recipe.yieldText || `Serves ${recipe.servings}`}</p>}
    <div className="mt-auto flex items-center justify-between gap-4 pt-2 text-sm font-semibold text-teal-200"><span>View recipe</span><span aria-hidden="true" className="text-lg transition-transform group-hover:translate-x-1">→</span></div>
  </Link>;
}
