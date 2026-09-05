import Link from 'next/link';
import { getRecipe } from '@/services/recipes';
import { RecipeForm } from '@/components/domain/recipes/recipe-form';
import { LoadError } from '@/components/domain/recipes/load-error';

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getRecipe(id);
  if (!result.ok) return <LoadError error={result.error} />;
  return <div className="mx-auto max-w-3xl"><Link href={`/recipes/${id}`} className="text-link text-sm">← Back to recipe</Link><div className="mb-8 mt-7"><p className="eyebrow mb-3">A little fine-tuning</p><h1 className="page-title">Edit recipe</h1></div><RecipeForm recipe={result.data} /></div>;
}
