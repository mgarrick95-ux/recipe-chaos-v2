import Link from 'next/link';
import { RecipeImport } from '@/components/domain/recipes/recipe-import';

export default function ImportRecipePage() {
  return <div className="recipe-world recipe-world-form mx-auto max-w-4xl space-y-7">
    <Link href="/recipes" className="text-link text-sm">← Recipes</Link>
    <header className="recipe-page-intro">
      <p className="eyebrow mb-3">From the wider world</p>
      <h1 className="page-title">Bring a recipe home ✦</h1>
      <p className="muted mt-3 max-w-2xl leading-7">
        Paste a link from a supported recipe website. Grimmy will try to gather the ingredients
        and directions into an editable draft for your recipe box.
      </p>
    </header>
    <RecipeImport />
  </div>;
}
