import Link from 'next/link';
import { getRecipe } from '@/services/recipes';
import { RecipeActions } from '@/components/domain/recipes/recipe-actions';
import { LoadError } from '@/components/domain/recipes/load-error';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getRecipe(id);
  if (!result.ok) return <LoadError error={result.error} />;
  const recipe = result.data;
  const safeSource = recipe.sourceUrl && /^https?:\/\//i.test(recipe.sourceUrl) ? recipe.sourceUrl : null;
  return <article className="space-y-9">
    <Link href="/recipes" className="text-link text-sm">← All recipes</Link>
    <header className="space-y-5"><p className="eyebrow">{recipe.isFavorite ? '★ A favorite' : 'From your kitchen'}</p><h1 className="page-title max-w-4xl">{recipe.title}</h1>
      {recipe.description && <p className="authored muted max-w-2xl text-lg">{recipe.description}</p>}
      <div className="muted flex flex-wrap gap-x-5 gap-y-2 text-sm">{recipe.servings && <span>Serves {recipe.servings}</span>}{recipe.yieldText && <span className="authored">{recipe.yieldText}</span>}{safeSource && <a className="text-link" href={safeSource} target="_blank" rel="noopener noreferrer">Original source ↗</a>}</div>
      <RecipeActions id={id} isFavorite={recipe.isFavorite} updatedAt={recipe.updatedAt} />
    </header>
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="panel"><h2 className="section-title mb-5">Ingredients</h2>{recipe.ingredients.length ? <ul className="divide-y divide-white/10">{recipe.ingredients.map((ingredient) => <li key={ingredient.id} className="py-4 first:pt-0 last:pb-0"><p className="authored">{ingredient.originalText}</p>{ingredient.verificationState === 'needs_review' && <span className="mt-1 inline-block text-xs text-purple-200">Needs review</span>}</li>)}</ul> : <p className="muted leading-7">No ingredients added yet. Add them whenever you’re ready.</p>}</section>
      <section className="panel"><h2 className="section-title mb-5">Method</h2>{recipe.steps.length ? <ol className="space-y-7">{recipe.steps.map((step, index) => <li key={step.id} className="flex gap-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-300/10 text-sm text-teal-200" aria-hidden="true">{index + 1}</span><p className="authored">{step.instruction}</p></li>)}</ol> : <p className="muted leading-7">No steps added yet. Your recipe is saved all the same.</p>}</section>
    </div>
    {recipe.notes && <section className="panel border-purple-300/25"><h2 className="section-title mb-4">Notes for next time</h2><p className="authored muted">{recipe.notes}</p></section>}
  </article>;
}
