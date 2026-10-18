import assert from 'node:assert/strict';
import { it } from 'node:test';
import { isPublicRecipeIPv4, validateRecipeImportUrl } from './import-urls.ts';
import { parsePastedRecipe } from './pasted-import.ts';

it('accepts ordinary public HTTPS recipe domains without a publisher allowlist', () => {
  for (const input of [
    'https://myfavouritecookingblog.com/potato-soup',
    'https://recipes.example.org/chicken?servings=4',
    'https://www.allrecipes.com/recipe/123/soup/',
    'https://xn--bcher-kva.de/rezepte/',
  ]) {
    assert.equal(validateRecipeImportUrl(input).ok, true, input);
  }
  const result = validateRecipeImportUrl('https://myfavouritecookingblog.com/dinner#ingredients');
  assert.deepEqual(result, { ok: true, url: 'https://myfavouritecookingblog.com/dinner' });
});

it('rejects local, IP-literal, credentials, custom ports and unsafe protocols', () => {
  for (const input of [
    'https://localhost/', 'https://localhost.local/', 'https://a.internal/a',
    'https://printer.lan/a', 'https://secret.home.arpa/',
    'https://127.0.0.1/a', 'https://192.168.1.5/a', 'https://[::1]/',
    'https://[::ffff:127.0.0.1]/', 'https://198.51.100.1/',
    'https://public-food.com:8443/',
    'https://user:password@public-food.com/',
    'http://public-food.com/', 'ftp://public-food.com/',
    'file:///etc/passwd', 'https://allrecipes.com.bad.test/',
    'https://oneword/', 'not a url',
  ]) assert.equal(validateRecipeImportUrl(input).ok, false, input);
});

it('fails closed for internal, non-public and special-use IPv4 ranges', () => {
  for (const ip of [
    '0.0.0.0', '10.0.0.1', '100.64.0.1', '100.127.255.255',
    '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.254',
    '192.0.0.10', '192.0.2.12', '192.168.4.2', '198.18.0.1',
    '198.19.255.3', '198.51.100.8', '203.0.113.7', '224.0.0.1',
    '240.1.2.3', '255.255.255.255', '::1', '::ffff:127.0.0.1',
    '127.0.0.1.evil.com', 'garbage',
  ]) assert.equal(isPublicRecipeIPv4(ip), false, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '76.76.21.21', '104.21.1.3']) {
    assert.equal(isPublicRecipeIPv4(ip), true, ip);
  }
});

const example = [
  "Grandma's mushroom soup", '',
  'Ingredients',
  '- 2 cloves garlic, minced',
  '- 1 cup mushrooms',
  '- ½ cup cream', '',
  'Instructions',
  '1. Mince the garlic.',
  '2. Cook mushrooms until golden.',
  '3. Add cream.', '',
  'Notes',
  'Serve with crusty bread.',
].join('\n');

it('builds an editable draft from pasted text with familiar headings', () => {
  const result = parsePastedRecipe(example);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.title, "Grandma's mushroom soup");
  assert.deepEqual(result.draft.ingredients, [
    { originalText: '2 cloves garlic, minced' },
    { originalText: '1 cup mushrooms' },
    { originalText: '½ cup cream' },
  ]);
  assert.deepEqual(result.draft.steps, [
    { instruction: 'Mince the garlic.' },
    { instruction: 'Cook mushrooms until golden.' },
    { instruction: 'Add cream.' },
  ]);
  assert.equal(result.draft.notes, 'Serve with crusty bread.');
  assert.equal(result.draft.sourceUrl, '');
  assert.equal(result.draft.isFavorite, false);
});

it('accepts an explicit title and Markdown headings without losing original ingredient text', () => {
  const result = parsePastedRecipe(
    '**Ingredients**\n* 1 tsp garlic powder\n* 2 tbsp brown sugar\n\n## Method\n1) Stir.\n2) Bake.',
    'Sunday supper',
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.title, 'Sunday supper');
  assert.equal(result.draft.ingredients[0].originalText, '1 tsp garlic powder');
  assert.equal(result.draft.ingredients[1].originalText, '2 tbsp brown sugar');
  assert.equal(result.draft.steps.length, 2);
});

it('refuses ambiguous paste content instead of mixing ingredients with steps', () => {
  for (const input of [
    '', 'Just a recipe title\n1 cup sugar\nMix everything',
    'Soup\nIngredients\n2 cups stock',
    'Soup\nInstructions\nSimmer until done',
    'Soup\nIngredients\n\nInstructions\nStir',
    'Soup\nIngredients\nSalt\nInstructions\n',
  ]) {
    assert.equal(parsePastedRecipe(input).ok, false, input);
  }
  assert.equal(parsePastedRecipe(example.repeat(2500)).ok, false);
});
