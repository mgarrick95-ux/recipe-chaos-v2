import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
type Resolution = { url: string; shortCircuit?: boolean };
type Context = { parentURL?: string };
const dataModule = (source: string): Resolution => ({
  url: 'data:text/javascript,' + encodeURIComponent(source),
  shortCircuit: true,
});
const { registerHooks } = require('node:module') as { registerHooks(hooks: {
  resolve(specifier: string, context: Context, next: (specifier: string, context: Context) => Resolution): Resolution;
}): void };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/server') {
      return dataModule('export const NextResponse={json(data,init){return Response.json(data,init)}}');
    }
    if (specifier === '@/services/households') {
      return dataModule('export async function getCurrentHousehold(){return globalThis.__onlineTestAuthorized ? {ok:true,data:{householdId:"household",userId:"user"}} : {ok:false,error:{code:"unauthorized",message:"Sign in required."}};}');
    }
    if (specifier === '@/services/recipe-web-fetch') {
      return dataModule('export class RecipeWebsiteError extends Error{constructor(kind){super("Website preview unavailable");this.kind=kind;}};export async function loadPublicRecipePage(url){return globalThis.__onlineTestPage(url);}');
    }
    if (specifier.startsWith('@/')) return next(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
    return next(specifier, context);
  },
});

const { POST } = await import('../app/api/recipes/import-preview/route.ts');
const { GET } = await import('../app/api/recipes/discover/route.ts');
const source = 'https://my-public-food-blog.com/test-soup/';
const validPage = '<script type="application/ld+json">' + JSON.stringify({
  '@type': 'Recipe', name: 'Test Soup',
  recipeIngredient: ['2 carrots', '3 potatoes'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Simmer until tender.' }],
}) + '</script>';
const post = (url: string) => new Request('https://recipechaos.test/api/recipes/import-preview', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url }),
});
const discovery = (query: string) => new Request('https://recipechaos.test/api/recipes/discover?' + query);
function authorize(value: boolean) {
  Object.assign(globalThis, { __onlineTestAuthorized: value });
}
function previewWith(fn: (url: string) => Promise<{ html: string; finalUrl: string }>) {
  Object.assign(globalThis, { __onlineTestPage: fn });
}

it('does not read websites or catalogue data before signing in', async t => {
  authorize(false);
  let previews = 0;
  previewWith(async url => { previews++; return { html: validPage, finalUrl: url }; });
  const f = t.mock.method(globalThis, 'fetch', async () => { throw Error('Must not fetch'); });
  assert.equal((await POST(post(source))).status, 401);
  assert.equal((await GET(discovery('q=chicken'))).status, 401);
  assert.equal(f.mock.callCount(), 0);
  assert.equal(previews, 0);
});

it('rejects private, credentialed and non-HTTPS URLs without reading them', async () => {
  authorize(true);
  let reads = 0;
  previewWith(async url => { reads++; return { html: validPage, finalUrl: url }; });
  for (const url of [
    'https://localhost/a', 'https://allrecipes.com.attacker.test/a',
    'http://www.budgetbytes.com/a', 'https://127.0.0.1/a',
    'https://someuser:password@recipe-site.com/', 'https://food-site.com:8080/',
  ]) {
    assert.equal((await POST(post(url))).status, 400, url);
  }
  assert.equal(reads, 0);
});

it('previews any public recipe site without saving it', async () => {
  authorize(true);
  const seen: string[] = [];
  previewWith(async url => {
    seen.push(url);
    return { html: validPage, finalUrl: url };
  });
  const response = await POST(post(source));
  assert.equal(response.status, 200);
  const json = await response.json() as { draft: {
    title: string; sourceUrl: string; ingredients: { originalText: string }[];
  } };
  assert.equal(json.draft.title, 'Test Soup');
  assert.equal(json.draft.sourceUrl, source);
  assert.deepEqual(json.draft.ingredients, [
    { originalText: '2 carrots' }, { originalText: '3 potatoes' },
  ]);
  assert.deepEqual(seen, [source]);
});

it('fails clearly when a website redirects unsafely or has no structured recipe', async () => {
  authorize(true);
  previewWith(async () => { throw Error('Website blocked import'); });
  assert.equal((await POST(post(source))).status, 422);
  previewWith(async url => ({ html: '<h1>Recipe without JSON-LD</h1>', finalUrl: url }));
  const response = await POST(post(source));
  assert.equal(response.status, 422);
  const details = await response.json() as { error: string };
  assert.match(details.error, /Paste its recipe text/u);
});

it('searches only the fixed recipe provider and returns editable draft data', async t => {
  authorize(true);
  const prior = process.env.MEALDB_API_KEY;
  process.env.MEALDB_API_KEY = 'localtestkey';
  t.after(() => {
    if (prior === undefined) delete process.env.MEALDB_API_KEY;
    else process.env.MEALDB_API_KEY = prior;
  });
  const f = t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, 'https://www.themealdb.com');
    assert.equal(parsed.pathname, '/api/json/v1/localtestkey/search.php');
    assert.equal(parsed.searchParams.get('s'), 'garlic');
    return Response.json({ meals: [{
      idMeal: '1234', strMeal: 'Garlic Dinner',
      strIngredient1: 'Garlic', strMeasure1: '3 cloves', strInstructions: 'Cook it.',
    }] });
  });
  const response = await GET(discovery('q=garlic'));
  assert.equal(response.status, 200);
  const body = await response.json() as {
    found: { title: string; draft: { ingredients: { originalText: string }[] } }[];
  };
  assert.equal(body.found[0].title, 'Garlic Dinner');
  assert.deepEqual(body.found[0].draft.ingredients, [{ originalText: '3 cloves Garlic' }]);
  assert.equal(f.mock.callCount(), 1);
});

it('rejects invalid discovery queries before using the provider', async t => {
  authorize(true);
  const f = t.mock.method(globalThis, 'fetch', async () => { throw Error('No fetch expected'); });
  assert.equal((await GET(discovery('q='))).status, 400);
  assert.equal(f.mock.callCount(), 0);
});
