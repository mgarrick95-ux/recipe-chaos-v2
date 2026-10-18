'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ManualRecipeInput } from '@/domain/recipes/manual-entry';
import { RecipeForm } from './recipe-form';

export function RecipeImport() {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<{ draft: ManualRecipeInput; version: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function previewLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPreview(null);
    setBusy(true);
    try {
      const response = await fetch('/api/recipes/import-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json() as { draft?: ManualRecipeInput; error?: string };
      if (!response.ok || !data.draft) {
        setError(data.error || 'That recipe could not be previewed.');
        return;
      }
      setPreview({ draft: data.draft, version: Date.now() });
    } catch {
      setError('Grimmy could not reach that website. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-7">
    <form className="recipe-import-controls space-y-4" onSubmit={previewLink}>
      <label htmlFor="recipe-import-url" className="field-label">Recipe website link</label>
      <input id="recipe-import-url" type="url" required value={url} disabled={busy}
        placeholder="https://www.allrecipes.com/recipe/…"
        onChange={event => setUrl(event.target.value)} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary maker-btn" type="submit" disabled={busy}>
          {busy ? 'Looking for ingredients…' : '✦ Preview recipe'}
        </button>
        <Link className="text-link text-sm" href="/recipes/discover">Ask Grimmy to find one instead →</Link>
      </div>
      <p className="muted text-sm leading-6">
        Works with selected recipe sites, including Allrecipes, Budget Bytes, RecipeTin Eats,
        Simply Recipes and BBC Good Food. Some websites block previews.
        Nothing is saved until you review and click Save recipe.
      </p>
    </form>
    {error && <p className="error-message" role="alert">{error}</p>}
    {preview && <section className="space-y-5" aria-label="Review imported recipe">
      <div className="recipe-import-ready">
        <p className="eyebrow mb-2">Grimmy found something</p>
        <h2 className="section-title">Check the recipe before saving</h2>
        <p className="muted mt-2 text-sm">
          {preview.draft.ingredients.length} ingredient lines and {preview.draft.steps.length} directions.
          Imported text can be incomplete, so give it a quick look.
        </p>
      </div>
      <RecipeForm key={preview.version} initialDraft={preview.draft} />
    </section>}
  </div>;
}
