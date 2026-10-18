'use client';

import Link from 'next/link';
import { useState } from 'react';
import { parsePastedRecipe } from '@/domain/recipes/pasted-import';
import { parseRecipePage } from '@/domain/recipes/import-preview';
import type { ManualRecipeInput } from '@/domain/recipes/manual-entry';
import { RecipeForm } from './recipe-form';

export function RecipeImport() {
  const [url, setUrl] = useState('');
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [preview, setPreview] = useState<{ draft: ManualRecipeInput; version: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pastedError, setPastedError] = useState('');

  async function previewLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPastedError('');
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
        setError(data.error || 'That recipe could not be previewed. Try pasting its text below.');
        return;
      }
      setPreview({ draft: data.draft, version: Date.now() });
    } catch {
      setError('Grimmy could not reach that website. Try pasting the recipe text below.');
    } finally {
      setBusy(false);
    }
  }

  function previewPasted(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPastedError('');
    setError('');
    setPreview(null);
    const result = parsePastedRecipe(pastedText, pastedTitle);
    if (!result.ok) {
      setPastedError(result.message);
      return;
    }
    setPreview({ draft: result.draft, version: Date.now() });
  }

  function pasteRecipeCard(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData('text/html');
    if (!html || html.length > 6_000_000) return;
    // Source metadata is advisory only; never fetch the clipboard URL.
    const sourceUrl = /^https:\/\//iu.test(url.trim()) ? url.trim() : '';
    const draft = parseRecipePage(html, sourceUrl);
    if (!draft || !draft.ingredients.length || !draft.steps.length) return;
    // The browser can copy the recipe card's DOM even if the publisher refuses
    // our server's network request. We extract text only; scripts never run.
    event.preventDefault();
    setError('');
    setPastedError('');
    setPreview({ draft, version: Date.now() });
  }

  return <div className="space-y-7">
    <form className="recipe-import-controls space-y-4" onSubmit={previewLink}>
      <h2 className="section-title">Import from a website</h2>
      <label htmlFor="recipe-import-url" className="field-label">Recipe webpage link</label>
      <input id="recipe-import-url" type="url" required value={url} disabled={busy}
        placeholder="https://example-recipe-site.com/your-favourite-dinner"
        onChange={event => setUrl(event.target.value)} />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary maker-btn" type="submit" disabled={busy}>
          {busy ? 'Looking for ingredients…' : '✦ Preview website recipe'}
        </button>
        <Link className="text-link text-sm" href="/recipes/discover">Ask Grimmy to find one instead →</Link>
      </div>
      <p className="muted text-sm leading-6">
        Try a public HTTPS recipe page from any website. Some sites block automated reading
        or hide their ingredients. Grimmy will tell you when a link cannot be previewed.
        Nothing is saved until you review the recipe and click Save recipe.
      </p>
      {error && <p className="error-message" role="alert">{error}</p>}
    </form>

    <section className="recipe-import-controls space-y-4" aria-labelledby="paste-recipe-title">
      <h2 id="paste-recipe-title" className="section-title">Or paste a recipe</h2>
      <p className="muted text-sm leading-6">
        Website refusing to cooperate? Open its <strong>Print Recipe</strong> page,
        select and copy the recipe (Ctrl+A, Ctrl+C), then paste it here.
        Grimmy can recognize some copied recipe cards automatically.
        Otherwise, keep the Ingredients and Instructions headings.
        Everything stays editable before saving.
      </p>
      <form className="space-y-4" onSubmit={previewPasted}>
        <div>
          <label htmlFor="paste-recipe-name" className="field-label">Recipe title (optional if included in your text)</label>
          <input id="paste-recipe-name" value={pastedTitle} maxLength={180} disabled={busy}
            onChange={event => setPastedTitle(event.target.value)}
            placeholder="Grandma’s chicken soup" />
        </div>
        <div>
          <label htmlFor="paste-recipe-text" className="field-label">Recipe text</label>
          <textarea id="paste-recipe-text" required rows={10} maxLength={25000} disabled={busy}
            value={pastedText} onPaste={pasteRecipeCard}
            onChange={event => setPastedText(event.target.value)}
            placeholder={'Chicken Soup\n\nIngredients\n2 cups chicken stock\n1 carrot, chopped\n\nInstructions\n1. Add ingredients to the pot.\n2. Simmer until tender.'} />
        </div>
        <button type="submit" className="btn btn-primary maker-btn" disabled={busy}>✦ Make editable draft</button>
        {pastedError && <p role="alert" className="error-message">{pastedError}</p>}
      </form>
    </section>

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
