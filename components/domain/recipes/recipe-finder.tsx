'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { FoundRecipe } from '@/domain/recipes/discovery';
import { RecipeForm } from './recipe-form';

async function fetchRecipes(term: string, random = false): Promise<FoundRecipe[]> {
  const queryString = random ? 'random=1' : 'q=' + encodeURIComponent(term.trim());
  const response = await fetch('/api/recipes/discover?' + queryString, { cache: 'no-store' });
  const data = await response.json() as { found?: FoundRecipe[]; error?: string };
  if (!response.ok) throw new Error(data.error || 'Grimmy could not look up those recipes.');
  return data.found ?? [];
}

export function RecipeFinder({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<FoundRecipe[]>([]);
  const [selected, setSelected] = useState<FoundRecipe | null>(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(() => initialQuery.trim().length >= 2);

  const search = useCallback(async (term: string, random = false) => {
    setError('');
    setSearched(false);
    setSelected(null);
    setBusy(true);
    try {
      setResults(await fetchRecipes(term, random));
      setSearched(true);
    } catch (error) {
      setResults([]);
      setError(error instanceof Error ? error.message
        : 'That recipe catalogue is not reachable right now. Try searching the wider web.');
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    if (initialQuery.trim().length < 2) return;
    let active = true;
    // Search begins asynchronously; effect setup never sets state synchronously.
    void fetchRecipes(initialQuery).then(found => {
      if (!active) return;
      setResults(found);
      setSearched(true);
    }).catch(error => {
      if (!active) return;
      setResults([]);
      setError(error instanceof Error ? error.message
        : 'That recipe catalogue is not reachable right now. Try searching the wider web.');
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [initialQuery]);

  const widerQuery = query.trim() || 'easy dinner recipes';
  const widerWeb = 'https://www.google.com/search?q=' + encodeURIComponent(widerQuery + ' recipe');

  return <div className="space-y-7">
    <section className="recipe-import-controls space-y-4">
      <form onSubmit={event => { event.preventDefault(); void search(query); }} className="space-y-3">
        <label htmlFor="grimmy-finder-query" className="field-label">What sounds good?</label>
        <input id="grimmy-finder-query" type="search" minLength={2} maxLength={80} required
          value={query} disabled={busy}
          onChange={event => setQuery(event.target.value)}
          placeholder="chicken, pasta, vegetable soup…" />
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary maker-btn" type="submit" disabled={busy}>
            {busy ? 'Searching the recipe shelves…' : '✦ Find recipes'}
          </button>
          <button type="button" className="btn maker-btn" disabled={busy}
            onClick={() => void search('', true)}>Surprise me</button>
        </div>
      </form>
      <p className="muted text-sm">
        Grimmy’s testing catalogue is supplied by <a className="text-link"
          href="https://www.themealdb.com/" target="_blank" rel="noopener noreferrer">TheMealDB ↗</a>.
        Results are ideas, not dietary or allergy-safe recommendations. Check ingredients yourself.
      </p>
      <p className="muted text-sm">
        Not finding what you want? <a className="text-link" href={widerWeb}
          target="_blank" rel="noopener noreferrer">Search the wider web ↗</a>
        {' '}and <Link href="/recipes/import" className="text-link">bring back a recipe link</Link>.
      </p>
    </section>

    {error && <p className="error-message" role="alert">{error}</p>}
    {searched && results.length === 0 && <div className="recipe-no-matches">
      <h2 className="section-title">Nothing turned up in this little recipe box.</h2>
      <p className="muted mt-2">Try a simpler food name or search the wider web.</p>
    </div>}

    {results.length > 0 && <section className="space-y-4" aria-label="Recipes found">
      <h2 className="section-title">{results.length} {results.length === 1 ? 'recipe' : 'recipes'} to explore</h2>
      <div className="recipe-finder-results">
        {results.map(recipe => <article key={recipe.id} className="recipe-finder-card">
          <p className="eyebrow">From TheMealDB</p>
          <h3 className="recipe-finder-title mt-2">{recipe.title}</h3>
          {(recipe.category || recipe.area) && <p className="muted mt-1 text-sm">
            {[recipe.category, recipe.area].filter(Boolean).join(' · ')}
          </p>}
          <p className="muted mt-2 text-sm">{recipe.draft.ingredients.length} ingredients · {recipe.draft.steps.length} instruction sections</p>
          <button type="button" className="btn btn-primary maker-btn mt-4"
            onClick={() => { setSelected(recipe); window.setTimeout(() =>
              document.getElementById('grimmy-recipe-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }}>
            Review this recipe
          </button>
        </article>)}
      </div>
    </section>}

    {selected && <section id="grimmy-recipe-review" aria-label="Review found recipe" className="space-y-5">
      <div className="recipe-import-ready">
        <p className="eyebrow mb-2">One last look</p>
        <h2 className="section-title">Make {selected.title} yours</h2>
        <p className="muted mt-2 text-sm">
          Review the ingredients and instructions, then click Save recipe.
          No recipe was added just by choosing this idea.
        </p>
      </div>
      <RecipeForm key={selected.id} initialDraft={selected.draft} />
    </section>}
  </div>;
}
