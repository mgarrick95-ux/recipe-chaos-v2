import Link from 'next/link';
import { getCurrentHousehold } from '@/services/households';
import { RecipeForm } from '@/components/domain/recipes/recipe-form';
import { LoadError } from '@/components/domain/recipes/load-error';

export default async function NewRecipePage() {
  const household = await getCurrentHousehold();
  if (!household.ok) return <LoadError error={household.error} />;
  return <div className="mx-auto max-w-3xl"><Link className="text-link text-sm" href="/recipes">← Recipes</Link><div className="mb-8 mt-7"><p className="eyebrow mb-3">Make room for a keeper</p><h1 className="page-title">Add a recipe</h1><p className="muted mt-4">As much or as little as you have. Nothing needs to be perfect.</p></div><RecipeForm /></div>;
}
