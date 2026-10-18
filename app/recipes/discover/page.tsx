import Link from 'next/link';
import { RecipeFinder } from '@/components/domain/recipes/recipe-finder';

export default async function DiscoverRecipesPage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 80) : '';
  return <div className="recipe-world recipe-world-form mx-auto max-w-5xl space-y-7">
    <Link href="/recipes" className="text-link text-sm">← Recipes</Link>
    <header className="recipe-page-intro">
      <p className="eyebrow mb-3">A curious little creature</p>
      <h1 className="page-title">Grimmy, find me a recipe ✦</h1>
      <p className="muted mt-3 max-w-2xl leading-7">
        Tell Grimmy what you feel like eating, try a random idea, or search the wider web.
        Preview and edit anything you like before bringing it into your recipe box.
      </p>
    </header>
    <RecipeFinder initialQuery={query} />
  </div>;
}
