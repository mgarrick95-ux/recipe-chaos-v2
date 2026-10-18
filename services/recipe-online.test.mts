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
    if (specifier.startsWith('@/')) return next(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
    return next(specifier, context);
  },
});

const { POST } = await import('../app/api/recipes/import-preview/route.ts');
const { GET } = await import('../app/api/recipes/discover/route.ts');
const source = 'https://www.budgetbytes.com/test-soup/';
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
function authorize(value: boolean) { Object.assign(globalThis, { __onlineTestAuthorized: value }); }

it('does not fetch protected recipe websites or catalogue data before sign-in', async t => {
  authorize(false);
  const f = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Should never fetch'); });
  assert.equal((await POST(post(source))).status, 401);
  assert.equal((await GET(discovery('q=chicken'))).status, 401);
  assert.equal(f.mock.callCount(), 0);
});
it('blocks unapproved domains, internal targets and HTTP without making requests', async t => {
  authorize(true);
  const f = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Should never fetch'); });
  for (const url of ['https://localhost/a', 'https://allrecipes.com.attacker.test/a',
    'http://www.budgetbytes.com/a', 'https://example.com/a']) {
    const response = await POST(post(url));
    assert.equal(response.status, 400);
  }
  assert.equal(f.mock.callCount(), 0);
});
it('previews supported Schema.org recipes without saving, and never follows redirects', async t => {
  authorize(true);
  const f = t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.redirect, 'manual');
    assert.equal(init?.method, 'GET');
    return new Response(validPage, { headers: { 'content-type': 'text/html' } });
  });
  const response = await POST(post(source));
  assert.equal(response.status, 200);
  const json = await response.json() as { draft: { title: string; ingredients: { originalText: string }[] } };
  assert.equal(json.draft.title, 'Test Soup');
  assert.deepEqual(json.draft.ingredients, [
    { originalText: '2 carrots' }, { originalText: '3 potatoes' },
  ]);
  assert.equal(f.mock.callCount(), 1);
});
it('safely rejects redirects, oversized payloads and pages without structured recipes', async t => {
  authorize(true);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(null, {
    status: 302, headers: { location: 'http://localhost/internal' },
  }));
  assert.equal((await POST(post(source))).status, 422);
  fetchMock.mock.mockImplementation(async () => new Response('html', {
    headers: { 'content-type': 'text/html', 'content-length': '2000000' },
  }));
  assert.equal((await POST(post(source))).status, 422);
  fetchMock.mock.mockImplementation(async () => new Response('<h1>No structured data</h1>', {
    headers: { 'content-type': 'text/html' },
  }));
  assert.equal((await POST(post(source))).status, 422);
});
it('searches only the fixed recipe provider and returns editable draft data', async t => {
  authorize(true);
  const prior = process.env.MEALDB_API_KEY;
  process.env.MEALDB_API_KEY = 'localtestkey';
  t.after(() => { if (prior === undefined) delete process.env.MEALDB_API_KEY;
    else process.env.MEALDB_API_KEY = prior; });
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
it('rejects blank discovery queries without using the provider', async t => {
  authorize(true);
  const f = t.mock.method(globalThis, 'fetch', async () => { throw Error('No fetch expected'); });
  assert.equal((await GET(discovery('q='))).status, 400);
  assert.equal(f.mock.callCount(), 0);
});
