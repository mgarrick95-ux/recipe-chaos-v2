'use client';

import { useMemo, useState } from 'react';
import type { RecipeSummary } from '@/services/recipe-mappers';
import { browseRecipes, type RecipeSort } from '@/domain/recipes/browse';
import { RecipeCard } from './recipe-card';

/** V1 recipe-discovery conveniences on top of V2's existing read-only library. */
export function RecipeLibrary({ recipes }: { recipes: RecipeSummary[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RecipeSort>('keepers');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const visible = useMemo(() => browseRecipes(recipes, { query, sort, favoritesOnly }), [recipes, query, sort, favoritesOnly]);
  const filtered = query.trim() !== '' || favoritesOnly;

  function reset() {
    setQuery('');
    setSort('keepers');
    setFavoritesOnly(false);
  }

  return <section className="recipe-collection" aria-label="Recipe collection">
    <div className="recipe-collection-heading">
      <div><p className="eyebrow">The collection</p><h2 className="section-title">From your kitchen</h2></div>
      <p className="recipe-count" role="status" aria-live="polite">
        {filtered
          ? `${visible.length} of ${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}`
          : `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'} tucked away`}
      </p>
    </div>

    <div className="recipe-filters" role="search" aria-label="Find recipes">
      <div className="recipe-filter-field">
        <label className="recipe-filter-label" htmlFor="recipe-search">Search your recipes</label>
        <input id="recipe-search" className="recipe-search-input" type="search" value={query}
          placeholder="Try garlic, pasta, or simmer…"
          onChange={event => setQuery(event.target.value)}
          aria-describedby="recipe-search-hint" />
        <p id="recipe-search-hint" className="recipe-filter-hint">Looks through titles, ingredients, and instructions.</p>
      </div>
      <div className="recipe-filter-field">
        <label className="recipe-filter-label" htmlFor="recipe-sort">Sort recipes</label>
        <select id="recipe-sort" className="recipe-sort-select" value={sort}
          onChange={event => setSort(event.target.value as RecipeSort)}>
          <option value="keepers">Keepers first</option>
          <option value="newest">Recently updated</option>
          <option value="oldest">Oldest updated</option>
          <option value="az">A to Z</option>
          <option value="za">Z to A</option>
        </select>
      </div>
      <div className="recipe-filter-actions">
        <button type="button" className="btn recipe-keeper-filter" aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly(current => !current)}>
          <span aria-hidden="true">★</span> Keepers only
        </button>
        {(filtered || sort !== 'keepers') && <button type="button" className="btn recipe-reset" onClick={reset}>Reset filters</button>}
      </div>
    </div>

    {visible.length ? <div className={visible.length === 1 ? 'recipe-grid recipe-grid-single' : 'recipe-grid'}>
      {visible.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}
    </div> : <div className="recipe-no-matches" role="status">
      <p className="section-title">No recipes in this little corner.</p>
      <p className="muted mt-2">Try another word or turn off the Keeper filter. Your recipes are still here.</p>
      <button type="button" className="btn mt-4" onClick={reset}>Show all recipes</button>
    </div>}
  </section>;
}
