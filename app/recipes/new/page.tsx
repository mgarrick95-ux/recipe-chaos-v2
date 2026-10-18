import Link from 'next/link';
import { getCurrentHousehold } from '@/services/households';
import { RecipeForm } from '@/components/domain/recipes/recipe-form';
import { LoadError } from '@/components/domain/recipes/load-error';

export default async function NewRecipePage() {
  const household = await getCurrentHousehold();
  if (!household.ok) return <LoadError error={household.error} />;
  return <div className="recipe-world recipe-world-form mx-auto max-w-4xl"><Link className="text-link text-sm" href="/recipes">← Recipes</Link><header className="recipe-page-intro"><p className="eyebrow mb-3">Make room for a keeper</p><h1 className="page-title">Add a recipe</h1><p className="muted mt-3 max-w-2xl leading-7">Start with what you know. Half-finished notes and sauce-splattered wisdom are welcome here.</p></header><div className="recipe-other-ways flex flex-wrap gap-4"><Link href="/recipes/import" className="text-link text-sm">Import from a website ↗</Link><Link href="/recipes/discover" className="text-link text-sm">Let Grimmy find one ↗</Link></div><RecipeForm /></div>;
}
