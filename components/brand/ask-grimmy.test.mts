import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFileSync } from 'node:fs';

const at = (file: string) => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');

it('Ask Grimmy is mounted once in the shared layout and offers page-aware paths', () => {
  const layout = at('app/layout.tsx');
  const helper = at('components/brand/ask-grimmy.tsx');
  assert.match(layout, /<AskGrimmy\s*\/>/);
  assert.match(helper, /path\.startsWith\('\/plan'\)/);
  assert.match(helper, /path\.startsWith\('\/pantry'\)/);
  assert.match(helper, /path\.startsWith\('\/shopping'\)/);
  assert.match(helper, /\/recipes\/discover/);
  assert.match(helper, /\/recipes\/import/);
  assert.match(helper, /\/plan#meal-brain-title/);
  assert.match(helper, /aria-expanded=\{open\}/);
  assert.match(helper, /aria-controls=\{panelId\}/);
});

it('recipe entry points expose both online importing and Grimmy discovery', () => {
  const library = at('app/recipes/page.tsx');
  const add = at('app/recipes/new/page.tsx');
  const importer = at('app/recipes/import/page.tsx');
  const finder = at('app/recipes/discover/page.tsx');
  for (const path of ['/recipes/import', '/recipes/discover']) {
    assert.ok(library.includes(path));
    assert.ok(add.includes(path));
  }
  assert.match(importer, /<RecipeImport\s*\/>/);
  assert.match(finder, /<RecipeFinder key=\{query\} initialQuery=\{query\}\s*\/>/);
});

it('import and discovery flows require review before saving with existing recipe actions', () => {
  const importer = at('components/domain/recipes/recipe-import.tsx');
  const finder = at('components/domain/recipes/recipe-finder.tsx');
  const form = at('components/domain/recipes/recipe-form.tsx');
  assert.match(importer, /<RecipeForm key=\{preview\.version\} initialDraft=\{preview\.draft\}/);
  assert.match(finder, /<RecipeForm key=\{selected\.id\} initialDraft=\{selected\.draft\}/);
  assert.match(form, /initialDraft \?\? recipeToInput\(recipe\)/);
  assert.match(form, /saveRecipeAction\(\{ \.\.\.fields/);
  assert.doesNotMatch(importer, /saveRecipeAction\(/);
  assert.doesNotMatch(finder, /saveRecipeAction\(/);
});

it('both preview APIs enforce authentication and avoid arbitrary network fetches', () => {
  const importRoute = at('app/api/recipes/import-preview/route.ts');
  const discoverRoute = at('app/api/recipes/discover/route.ts');
  const urls = at('domain/recipes/import-urls.ts');
  assert.match(importRoute, /getCurrentHousehold\(\)/);
  assert.match(importRoute, /redirect: 'manual'/);
  assert.match(importRoute, /validateRecipeImportUrl/);
  assert.match(importRoute, /loadPublicRecipePage/);
  assert.match(discoverRoute, /getCurrentHousehold\(\)/);
  assert.match(discoverRoute, /https:\/\/www\.themealdb\.com\/api\/json\/v1\//);
  assert.match(discoverRoute, /NODE_ENV === 'development'/);
  assert.match(urls, /validateRecipeImportUrl/);
  assert.match(urls, /isPublicRecipeIPv4/);
  const transport = at('services/recipe-web-fetch.ts');
  assert.match(transport, /MAX_RECIPE_HTML_BYTES/);
  assert.match(transport, /lookup:/);
});

it('the importer offers an editable pasted-text fallback for blocked websites', () => {
  const importer = at('components/domain/recipes/recipe-import.tsx');
  const parser = at('domain/recipes/pasted-import.ts');
  assert.match(importer, /parsePastedRecipe/);
  assert.match(importer, /Make editable draft/);
  assert.match(importer, /RecipeForm key=\{preview\.version\} initialDraft=\{preview\.draft\}/);
  assert.match(parser, /foundIngredients/);
  assert.match(parser, /foundSteps/);
});

it('the helper and importer use a readable enchanted style with mobile support', () => {
  const css = at('app/globals.css');
  assert.match(css, /\.grimmy-helper-dialog/);
  assert.match(css, /\.recipe-import-controls/);
  assert.match(css, /\.recipe-finder-results/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
