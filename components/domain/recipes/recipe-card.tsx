import Link from 'next/link';
import type { RecipeSummary } from '@/services/recipe-mappers';

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return <Link href={`/recipes/${recipe.id}`} className="panel group flex min-h-52 flex-col gap-4 transition-colors hover:border-teal-400/60">
    <div className="flex items-start justify-between gap-3"><h2 className="section-title group-hover:text-teal-200">{recipe.title}</h2>{recipe.isFavorite && <span className="text-teal-300" aria-label="Favorite">★</span>}</div>
    {recipe.description && <p className="muted line-clamp-3 whitespace-pre-wrap text-sm leading-7">{recipe.description}</p>}
    <div className="muted mt-auto flex items-center justify-between gap-4 text-sm"><span className="break-words">{recipe.yieldText || (recipe.servings ? `Serves ${recipe.servings}` : 'Your recipe, your way')}</span><span aria-hidden="true" className="text-xl text-teal-300">↗</span></div>
  </Link>;
}
