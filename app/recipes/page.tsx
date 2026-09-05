import Link from 'next/link';
import { listRecipes } from '@/services/recipes';
import { RecipeCard } from '@/components/domain/recipes/recipe-card';
import { LoadError } from '@/components/domain/recipes/load-error';

export default async function RecipesPage() {
  const result = await listRecipes();
  if (!result.ok) return <LoadError error={result.error} />;
  return <div className="space-y-10">
    <div className="flex flex-wrap items-end justify-between gap-6"><div><p className="eyebrow mb-4">Good food. Less mental load.</p><h1 className="page-title">Your recipes<span className="text-teal-300">.</span></h1><p className="muted mt-4">The regulars, the experiments, the keepers.</p></div><Link href="/recipes/new" className="btn btn-primary">+ Add recipe</Link></div>
    {result.data.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.data.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}</div> :
      <section className="panel flex min-h-80 flex-col items-center justify-center gap-5 text-center"><span aria-hidden="true" className="text-5xl text-purple-300">✳</span><h2 className="section-title">A little room for your favorites.</h2><p className="muted max-w-sm leading-7">No recipes yet. Add the ones you actually cook.</p><Link href="/recipes/new" className="text-link">Add your first recipe <span aria-hidden="true">→</span></Link></section>}
  </div>;
}
