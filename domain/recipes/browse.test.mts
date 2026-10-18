import assert from 'node:assert/strict';
import { it } from 'node:test';
import { browseRecipes, type BrowseRecipe, type RecipeBrowseOptions } from './browse.ts';

const sample: BrowseRecipe[] = [
  { id: 'b', title: 'Spaghetti & Meat Sauce', description: 'Family dinner', isFavorite: true, updatedAt: '2026-09-02T00:00:00Z', searchText: 'beef tomato garlic brown meat simmer pasta' },
  { id: 'a', title: 'Apple crumble', description: null, isFavorite: false, updatedAt: '2026-10-02T00:00:00Z', searchText: 'apples cinnamon bake golden' },
  { id: 'c', title: 'Roasted carrots', description: 'Easy side dish', isFavorite: true, updatedAt: '2026-09-20T00:00:00Z', searchText: 'carrots olive oil roast in oven' },
];
function options(overrides: Partial<RecipeBrowseOptions> = {}): RecipeBrowseOptions {
  return { query: '', favoritesOnly: false, sort: 'keepers', ...overrides };
}
function ids(overrides: Partial<RecipeBrowseOptions> = {}) {
  return browseRecipes(sample, options(overrides)).map(recipe => recipe.id);
}

it('preserves the prior keepers-first order as the default, without mutating input', () => {
  const snapshot = structuredClone(sample);
  assert.deepEqual(ids(), ['c', 'b', 'a']);
  assert.deepEqual(sample, snapshot);
});
it('searches title, description, original ingredient text and directions, case-insensitively', () => {
  assert.deepEqual(ids({ query: 'SPAGHETTI' }), ['b']);
  assert.deepEqual(ids({ query: 'family DINNER' }), ['b']);
  assert.deepEqual(ids({ query: '  GARLIC   SIMMER ' }), ['b']);
  assert.deepEqual(ids({ query: 'bake' }), ['a']);
  assert.deepEqual(ids({ query: 'RoAsT oven' }), ['c']);
  assert.deepEqual(ids({ query: 'not-a-recipe' }), []);
});
it('combines search and favorites instead of ignoring one filter', () => {
  assert.deepEqual(ids({ query: 'garlic', favoritesOnly: true }), ['b']);
  assert.deepEqual(ids({ query: 'cinnamon', favoritesOnly: true }), []);
  assert.deepEqual(ids({ favoritesOnly: true }), ['c', 'b']);
});
it('sorts recently updated, oldest, A–Z and Z–A, with a stable tie break', () => {
  assert.deepEqual(ids({ sort: 'newest' }), ['a', 'c', 'b']);
  assert.deepEqual(ids({ sort: 'oldest' }), ['b', 'c', 'a']);
  assert.deepEqual(ids({ sort: 'az' }), ['a', 'c', 'b']);
  assert.deepEqual(ids({ sort: 'za' }), ['b', 'c', 'a']);
});
it('treats input as literal text; empty data and incomplete search index remain safe', () => {
  assert.deepEqual(ids({ query: '[garlic]?' }), []);
  assert.deepEqual(browseRecipes([], options()), []);
  const titleOnly = [{ id: 'x', title: 'Soup', description: null, isFavorite: false, updatedAt: 'not-a-date' }];
  assert.equal(browseRecipes(titleOnly, options({ query: 'soup' })).length, 1);
  assert.equal(browseRecipes(titleOnly, options({ query: 'garlic' })).length, 0);
});
