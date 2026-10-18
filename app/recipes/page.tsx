import Link from 'next/link';
import { listRecipes } from '@/services/recipes';
import { RecipeLibrary } from '@/components/domain/recipes/recipe-library';
import { LoadError } from '@/components/domain/recipes/load-error';
import { LilGrimm } from '@/components/brand/lil-grimm';

export default async function RecipesPage() {
  const result = await listRecipes();
  if (!result.ok) return <LoadError error={result.error} />;
  const hasRecipes = result.data.length > 0;
  return <div className="recipe-world space-y-8 sm:space-y-10">
    <header className="recipe-hero">
      <div className={`recipe-hero-layout ${hasRecipes ? '' : 'recipe-hero-layout-solo'}`.trim()}>
        <div className="recipe-hero-copy max-w-3xl">
          <p className="eyebrow mb-4">A little magic for the everyday</p><h1 className="page-title">Your recipes<span aria-hidden="true" className="recipe-title-flourish">✦</span></h1><p className="muted mt-4 text-lg">The regulars, the experiments, the keepers.</p>
          <div className="recipe-hero-links mt-7 flex flex-wrap gap-3">
            <Link href="/recipes/new" className="btn btn-primary maker-btn">+ Add recipe</Link>
            <Link href="/recipes/import" className="btn maker-btn">Import from a website</Link>
            <Link href="/recipes/discover" className="btn maker-btn">✦ Grimmy, find me one</Link>
          </div>
        </div>
        {hasRecipes && <LilGrimm scene="library" />}
      </div>
    </header>
    {hasRecipes ? <RecipeLibrary recipes={result.data} /> :
      <section className="recipe-empty min-h-60 p-7 sm:min-h-64 sm:p-10">
        <div className="relative z-10 flex flex-col items-start gap-4"><h2 className="section-title">The shelf is suspiciously tidy.</h2><p className="muted max-w-sm leading-7">No recipes yet. Add the first one before dinner gets ideas.</p><div className="flex flex-wrap gap-3"><Link href="/recipes/new" className="btn btn-primary maker-btn mt-1">Add your first recipe</Link><Link href="/recipes/import" className="btn maker-btn mt-1">Import one from the web</Link><Link href="/recipes/discover" className="btn maker-btn mt-1">Ask Grimmy to find one</Link></div></div>
        <LilGrimm scene="empty" />
      </section>}
  </div>;
}
