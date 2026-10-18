import assert from 'node:assert/strict';
import { it } from 'node:test';
import { parseRecipePage, previewFromRecipeObject } from './import-preview.ts';
import { validateRecipeImportUrl } from './import-urls.ts';
import { foundRecipeFromMeal } from './discovery.ts';

const url = 'https://www.allrecipes.com/recipe/123/soup/';
const structured = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Grandma &amp; Grimmy Soup',
  description: 'Cozy &amp; simple.',
  recipeIngredient: ['2 cloves garlic', '½ cup cream', 'A splash of lemon'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Stir the garlic.' },
    { '@type': 'HowToSection', itemListElement: [
      { '@type': 'HowToStep', text: 'Simmer carefully.' },
      { '@type': 'HowToStep', text: 'Season to taste.' },
    ] },
  ],
  recipeYield: '4 servings',
};
it('extracts a proper Schema.org Recipe as an editable manual draft', () => {
  const html = '<html><script type="application/ld+json">' +
    JSON.stringify({ '@graph': [{ '@type': 'WebSite', name: 'Site' }, structured] }) +
    '</script></html>';
  const draft = parseRecipePage(html, url);
  assert.ok(draft);
  assert.equal(draft.title, 'Grandma & Grimmy Soup');
  assert.equal(draft.description, 'Cozy & simple.');
  assert.equal(draft.sourceUrl, url);
  assert.equal(draft.servings, '4');
  assert.equal(draft.yieldText, '4 servings');
  assert.deepEqual(draft.ingredients.map(item => item.originalText),
    ['2 cloves garlic', '½ cup cream', 'A splash of lemon']);
  assert.deepEqual(draft.steps.map(item => item.instruction),
    ['Stir the garlic.', 'Simmer carefully.', 'Season to taste.']);
  assert.equal(draft.isFavorite, false);
});
it('preserves authored ingredient content instead of inventing canonical matches', () => {
  const draft = previewFromRecipeObject({
    '@type': 'Recipe', name: 'Savory pie',
    recipeIngredient: ['1 tsp garlic powder', 'Garlic, to taste'],
    recipeInstructions: 'Mix together.\n\nBake.',
  }, url);
  assert.ok(draft);
  assert.deepEqual(draft.ingredients, [
    { originalText: '1 tsp garlic powder' }, { originalText: 'Garlic, to taste' },
  ]);
  assert.deepEqual(draft.steps, [{ instruction: 'Mix together.' }, { instruction: 'Bake.' }]);
});
it('ignores unrelated JSON and refuses to guess a recipe from a generic page', () => {
  const html = '<script type="application/ld+json">' +
    JSON.stringify({ '@type': 'WebPage', name: 'Not a recipe', description: 'Chocolate' }) +
    '</script><h1>Pizza night</h1><div>Salt and pepper</div>';
  assert.equal(parseRecipePage(html, url), null);
});
it('tolerates malformed scripts and finds a later valid recipe', () => {
  const html = '<script type="application/ld+json">BROKEN</script><script type="application/ld+json">' +
    JSON.stringify(structured) + '</script>';
  assert.equal(parseRecipePage(html, url)?.title, 'Grandma & Grimmy Soup');
});
it('handles HowTo instructions, numeric entities and multiline markup', () => {
  const draft = previewFromRecipeObject({
    name: '&#x1F372; Soup', recipeIngredient: ['1 &frac12; cups water'],
    recipeInstructions: [{ text: '<p>Boil.</p><p>Serve &amp; enjoy.</p>' }],
  }, url);
  assert.ok(draft);
  assert.equal(draft.title, '🍲 Soup');
  assert.equal(draft.steps[0].instruction, 'Boil.\nServe & enjoy.');
});
it('rejects private, credentialed, non-HTTPS and unsafe addresses', () => {
  for (const value of [
    'http://www.allrecipes.com/recipe/123',
    'https://allrecipes.com.evil.test/',
    'https://localhost/',
    'https://127.0.0.1/',
    'https://192.168.1.1/',
    'https://allrecipes.com:8443/recipe/123',
    'https://someone:password@allrecipes.com/recipe/123',
    'file:///etc/passwd',
    'https://localhost.local/recipe',
    'not a URL',
  ]) {
    assert.equal(validateRecipeImportUrl(value).ok, false, value);
  }
  assert.equal(validateRecipeImportUrl('https://some-new-food-blog.com/soup').ok, true);
  const verified = validateRecipeImportUrl('https://www.budgetbytes.com/soup/#method');
  assert.equal(verified.ok, true);
  if (verified.ok) assert.equal(verified.url, 'https://www.budgetbytes.com/soup/');
});
it('maps catalogue meal ingredients and instructions without writing anything', () => {
  const result = foundRecipeFromMeal({
    idMeal: '12345', strMeal: 'Creamy chicken',
    strCategory: 'Chicken', strArea: 'Canadian',
    strIngredient1: 'Chicken breast', strMeasure1: '500 g',
    strIngredient2: 'Garlic', strMeasure2: '2 cloves',
    strInstructions: 'Season the chicken.\n\nCook in a pan.',
    strSource: 'https://example.com/chicken',
  });
  assert.ok(result);
  assert.equal(result.title, 'Creamy chicken');
  assert.deepEqual(result.draft.ingredients, [
    { originalText: '500 g Chicken breast' },
    { originalText: '2 cloves Garlic' },
  ]);
  assert.deepEqual(result.draft.steps, [
    { instruction: 'Season the chicken.' }, { instruction: 'Cook in a pan.' },
  ]);
  assert.equal(result.draft.sourceUrl, 'https://example.com/chicken');
  assert.equal(result.draft.isFavorite, false);
});
it('rejects invalid catalogue results and unsafe source URLs', () => {
  assert.equal(foundRecipeFromMeal({ idMeal: 'not-an-id', strMeal: 'Bad' }), null);
  assert.equal(foundRecipeFromMeal({ idMeal: '123', strMeal: '' }), null);
  const found = foundRecipeFromMeal({
    idMeal: '123', strMeal: 'Soup', strSource: 'javascript:alert(1)', strInstructions: 'Heat',
  });
  assert.ok(found);
  assert.equal(found.draft.sourceUrl, 'https://www.themealdb.com/');
});
