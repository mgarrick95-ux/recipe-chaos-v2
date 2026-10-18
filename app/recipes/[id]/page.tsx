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
  return <article className="space-y-8 sm:space-y-10">
    <Link href="/recipes" className="text-link text-sm">← All recipes</Link>
    <header className="recipe-hero">
      <div className="relative z-10 space-y-5">
        <div className="flex flex-wrap items-center gap-3"><p className="eyebrow">From your kitchen</p>{recipe.isFavorite && <span className="recipe-keeper"><span aria-hidden="true">★ </span>Keeper</span>}</div>
        <h1 className="page-title max-w-4xl">{recipe.title}</h1>
        {recipe.description && <p className="authored muted max-w-2xl text-lg">{recipe.description}</p>}
        <div className="muted flex flex-wrap gap-x-5 gap-y-2 text-sm">{recipe.servings && <span>Serves {recipe.servings}</span>}{recipe.yieldText && <span className="authored">{recipe.yieldText}</span>}{safeSource && <a className="text-link" href={safeSource} target="_blank" rel="noopener noreferrer">Original source ↗</a>}</div>
        <RecipeActions id={id} isFavorite={recipe.isFavorite} updatedAt={recipe.updatedAt} />
      </div>
    </header>
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="recipe-sheet"><p className="recipe-kicker">What goes in</p><h2 className="section-title mb-5">Ingredients</h2>{recipe.ingredients.length ? <ul className="divide-y divide-white/10">{recipe.ingredients.map((ingredient) => <li key={ingredient.id} className="py-4 first:pt-0 last:pb-0"><p className="authored">{ingredient.originalText}</p>{ingredient.verificationState === 'needs_review' && <span className="mt-1 inline-block text-xs text-purple-200">Needs review</span>}</li>)}</ul> : <p className="muted leading-7">No ingredients added yet. Add them whenever you’re ready.</p>}</section>
      <section className="recipe-sheet"><p className="recipe-kicker">What happens next</p><h2 className="section-title mb-5">How we make it</h2>{recipe.steps.length ? <ol className="space-y-7">{recipe.steps.map((step, index) => <li key={step.id} className="flex gap-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-[45%_35%_48%_38%] border border-teal-300/25 text-sm text-teal-200" aria-hidden="true">{index + 1}</span><p className="authored min-w-0">{step.instruction}</p></li>)}</ol> : <p className="muted leading-7">No steps yet. Apparently we’re cooking on instinct.</p>}</section>
    </div>
    {recipe.notes && <section className="recipe-sheet border-l-2 border-l-purple-300/40"><p className="recipe-kicker">Kitchen margin</p><h2 className="section-title mb-4">Notes for next time</h2><p className="authored muted">{recipe.notes}</p></section>}
  </article>;
}
