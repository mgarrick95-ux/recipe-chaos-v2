import assert from 'node:assert/strict';
import { beforeEach, it } from 'node:test';
import { createRequire } from 'node:module';
import { createRecipeDraft } from '../domain/recipes/validation.ts';
import { createRecipeIngredient } from '../domain/recipes/ingredients.ts';

// Exercise the real server services and household resolver with a local transport.
// No credentials, network, or database writes are used by these runtime tests.
type Reply = { data: unknown; error: { code: string; message: string } | null };
const id = '00000000-0000-4000-8000-000000000001';
const householdId = '00000000-0000-4000-8000-000000000002';
const childId = '00000000-0000-4000-8000-000000000003';
const token = '2026-09-05T12:00:00.123456+00:00';
const original = '  ½ garlic, minced\n — optional  ';
let signedIn = true;
let replies: Reply[] = [];
let calls: { name: string; args: unknown[] }[] = [];
const reply = (data: unknown, error: Reply['error'] = null) => ({ data, error });
const client = {
  auth: { async getUser() { return { data: { user: signedIn ? { id } : null }, error: null }; } },
  rpc(name: string, args: unknown) {
    if (name === 'bootstrap_default_household') return Promise.resolve(reply([{ user_id: id, profile_id: id, household_id: householdId, household_name: 'Home', role: 'owner' }]));
    calls.push({ name, args: [args] });
    assert.ok(replies.length, 'Unexpected RPC');
    return Promise.resolve(replies.shift());
  },
  from(table: string) {
    calls.push({ name: 'from', args: [table] });
    const query = {
      then(resolve: (value: Reply) => unknown) {
        assert.ok(replies.length, 'Unexpected query');
        return Promise.resolve(replies.shift()!).then(resolve);
      },
    };
    for (const name of ['select', 'eq', 'or', 'order', 'insert', 'delete', 'single', 'maybeSingle']) {
      Object.assign(query, { [name]: (...args: unknown[]) => { calls.push({ name, args }); return query; } });
    }
    return query;
  },
};
Object.assign(globalThis, { phase3cClient: client });
// Node 24 runtime supports synchronous hooks; the project's Node 20 types do not.
type Resolution = { url: string; shortCircuit?: boolean };
type Resolve = (specifier: string, context: object, next: (specifier: string, context: object) => Resolution) => Resolution;
const { registerHooks } = createRequire(import.meta.url)('node:module') as { registerHooks: (hooks: { resolve: Resolve }) => void };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (specifier === '@/lib/supabase/server') return { url: 'data:text/javascript,export async function createServerSupabaseClient(){return globalThis.phase3cClient}', shortCircuit: true };
    if (specifier.startsWith('@/')) return next(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
    return next(specifier, context);
  },
});
const recipes = await import('./recipes.ts');
const ingredients = await import('./ingredients.ts');
const row = { id, household_id: householdId, title: 'Soup', description: null, source_url: null, servings: null, yield_text: null, is_favorite: false, notes: null, created_by: id, created_at: token, updated_at: token };
const ingredient = { id: childId, recipe_id: id, position: 0, original_text: original, ingredient_text: 'garlic', quantity: null, unit: null, descriptor: null, preparation: null, optional: false, canonical_ingredient_id: null, verification_state: 'unreviewed', created_at: token, updated_at: token };
const step = { id: householdId, recipe_id: id, position: 0, instruction: ' Stir. ', created_at: token, updated_at: token };
function load() { replies.push(reply(row), reply([ingredient]), reply([step])); }
function catalogue() { replies.push(reply([{ id, name: 'garlic', normalized_name: 'garlic' }]), reply([]), reply([])); }
function savedArgs() { return calls.find((c) => c.name === 'save_recipe')!.args[0] as { p_household_id: string; p_recipe_id?: string; p_expected_updated_at?: string; p_recipe: typeof row; p_ingredients: typeof ingredient[]; p_steps: typeof step[] }; }
beforeEach(() => { signedIn = true; replies = []; calls = []; });

it('gates all public operations behind authenticated household resolution', async () => {
  signedIn = false;
  const draft = createRecipeDraft('Soup');
  for (const result of await Promise.all([
    recipes.listRecipes(), recipes.getRecipe(id), recipes.createRecipe(draft), recipes.updateRecipe(id, token, draft),
    recipes.setRecipeFavorite(id, true, token), recipes.deleteRecipe(id),
    recipes.reviewRecipeIngredient(id, childId, token, { kind: 'remain_unlinked' }),
    ingredients.getIngredientMatchingContext(), ingredients.suggestIngredientMatch('garlic'),
    ingredients.createKeepSeparateRule('garlic', id), ingredients.removeKeepSeparateRule(id),
  ])) assert.equal(result.ok ? 'success' : result.error.code, 'unauthorized');
  assert.deepEqual(calls, []);
});
it('lists household summaries and scopes parent reads before ordered children', async () => {
  replies.push(reply([row]));
  const listed = await recipes.listRecipes();
  assert.ok(listed.ok);
  assert.equal(listed.data[0].title, 'Soup');
  assert.ok(!('createdBy' in listed.data[0]));
  load();
  const result = await recipes.getRecipe(id);
  assert.ok(result.ok);
  assert.equal(result.data.ingredients[0].originalText, original);
  assert.equal(result.data.ingredients[0].id, childId);
  assert.ok(calls.some((c) => c.name === 'eq' && c.args[0] === 'household_id' && c.args[1] === householdId));
  assert.equal(calls.filter((c) => c.name === 'order' && c.args[0] === 'position').length, 2);
});
it('does not read children of a hidden or missing recipe', async () => {
  replies.push(reply(null));
  assert.deepEqual(await recipes.getRecipe(id), { ok: false, error: { code: 'not_found', message: 'Recipe not found.' } });
  assert.deepEqual(calls.filter((c) => c.name === 'from').map((c) => c.args[0]), ['recipes']);
});
it('creates through save_recipe without accepting suggestions or rewriting text', async () => {
  replies.push(reply([{ recipe_id: id, updated_at: token }]));
  const draft = { ...createRecipeDraft('Soup'), ingredients: [createRecipeIngredient({ originalText: original }, 0)] };
  assert.ok((await recipes.createRecipe(draft)).ok);
  const args = savedArgs();
  assert.equal(args.p_household_id, householdId);
  assert.equal(args.p_recipe_id, undefined);
  assert.equal(args.p_ingredients[0].original_text, original);
  assert.equal(args.p_ingredients[0].canonical_ingredient_id, null);
  assert.equal(args.p_ingredients[0].verification_state, 'unreviewed');
  assert.ok(!('id' in args.p_ingredients[0]));
});
it('edits preserve child IDs and forward the exact optimistic concurrency token', async () => {
  load();
  const loaded = await recipes.getRecipe(id);
  assert.ok(loaded.ok);
  replies.push(reply([{ recipe_id: id, updated_at: token }]));
  assert.ok((await recipes.updateRecipe(id, token, loaded.data)).ok);
  const args = savedArgs();
  assert.equal(args.p_expected_updated_at, token);
  assert.equal(args.p_ingredients[0].id, childId);
  assert.equal(args.p_steps[0].id, householdId);
  assert.equal(args.p_ingredients[0].original_text, original);
});
it('maps PT412 to conflict and hides raw database errors', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const [code, expected] of [['PT412', 'conflict'], ['P0002', 'not_found'], ['42501', 'unexpected_error'], ['23514', 'unexpected_error']]) {
    replies.push(reply(null, { code, message: 'SECRET PostgREST internals' }));
    const result = await recipes.updateRecipe(id, token, createRecipeDraft('Soup'));
    assert.equal(result.ok ? 'success' : result.error.code, expected);
    assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
});
it('rejects invalid drafts, IDs, and update tokens before persistence', async () => {
  for (const result of [await recipes.createRecipe({ ...createRecipeDraft('Soup'), title: ' ' }), await recipes.getRecipe('bad'), await recipes.updateRecipe(id, 'bad', createRecipeDraft('Soup'))]) {
    assert.equal(result.ok ? 'success' : result.error.code, 'validation_error');
  }
  assert.deepEqual(calls, []);
});
it('favorites and unfavorites preserve the complete child snapshot', async () => {
  for (const favorite of [true, false]) {
    calls = []; load(); replies.push(reply([{ recipe_id: id, updated_at: token }]));
    assert.ok((await recipes.setRecipeFavorite(id, favorite, token)).ok);
    assert.equal(savedArgs().p_recipe.is_favorite, favorite);
    assert.equal(savedArgs().p_ingredients[0].original_text, original);
    assert.equal(savedArgs().p_steps[0].id, householdId);
  }
});
it('stale favorite and review actions never write', async () => {
  load();
  assert.equal((await recipes.setRecipeFavorite(id, true, 'old')).ok, false);
  load();
  assert.equal((await recipes.reviewRecipeIngredient(id, childId, 'old', { kind: 'remain_unlinked' })).ok, false);
  assert.ok(!calls.some((c) => c.name === 'save_recipe'));
});
it('hard deletes with household scope and reports missing rows', async () => {
  replies.push(reply({ id }), reply(null));
  assert.deepEqual(await recipes.deleteRecipe(id), { ok: true, data: { recipeId: id } });
  const missing = await recipes.deleteRecipe(id);
  assert.equal(missing.ok ? 'success' : missing.error.code, 'not_found');
  assert.equal(calls.filter((c) => c.name === 'delete').length, 2);
  assert.ok(calls.some((c) => c.name === 'eq' && c.args[0] === 'household_id'));
});
it('loads shared intelligence and returns transient suggestions without writes', async () => {
  catalogue();
  const result = await ingredients.suggestIngredientMatch('garlic');
  assert.ok(result.ok);
  assert.equal(result.data.status, 'exact_canonical');
  assert.ok(calls.some((c) => c.name === 'or' && String(c.args[0]).includes(householdId)));
  assert.ok(!calls.some((c) => ['insert', 'save_recipe', 'delete'].includes(c.name)));
});
it('persists only explicit canonical review decisions and retains text and IDs', async () => {
  for (const decision of [{ kind: 'accept_suggestion' }, { kind: 'select_canonical', canonicalIngredientId: id }, { kind: 'remain_unlinked' }, { kind: 'needs_review' }] as const) {
    calls = []; load(); catalogue(); replies.push(reply([{ recipe_id: id, updated_at: token }]));
    assert.ok((await recipes.reviewRecipeIngredient(id, childId, token, decision)).ok);
    const saved = savedArgs().p_ingredients[0];
    assert.equal(saved.original_text, original);
    assert.equal(saved.id, childId);
    assert.equal(saved.verification_state, decision.kind === 'needs_review' ? 'needs_review' : 'verified');
    assert.equal(saved.canonical_ingredient_id, ['accept_suggestion', 'select_canonical'].includes(decision.kind) ? id : null);
  }
});
it('keep separate blocks acceptance until explicitly removed', async () => {
  load(); catalogue();
  replies[5] = reply([{ id: childId, household_id: householdId, normalized_input: 'garlic', blocked_canonical_ingredient_id: id }]);
  const blocked = await recipes.reviewRecipeIngredient(id, childId, token, { kind: 'accept_suggestion' });
  assert.equal(blocked.ok ? 'success' : blocked.error.code, 'validation_error');
  assert.ok(!calls.some((c) => c.name === 'save_recipe'));
  catalogue(); replies.push(reply({ id: childId }));
  assert.ok((await ingredients.createKeepSeparateRule(' Garlic! ', id)).ok);
  const insert = calls.find((c) => c.name === 'insert')!.args[0] as Record<string, unknown>;
  assert.deepEqual(insert, { household_id: householdId, normalized_input: 'garlic', blocked_canonical_ingredient_id: id, created_by: id });
  replies.push(reply({ id: childId }));
  assert.ok((await ingredients.removeKeepSeparateRule(childId)).ok);
});
it('handles ingredient loader errors and duplicate or missing separation decisions', async (t) => {
  t.mock.method(console, 'error', () => {});
  replies.push(reply(null, { code: '42501', message: 'SECRET' }), reply([]), reply([]));
  const failed = await ingredients.getIngredientMatchingContext();
  assert.equal(failed.ok ? 'success' : failed.error.code, 'unexpected_error');
  assert.ok(!JSON.stringify(failed).includes('SECRET'));
  catalogue(); replies.push(reply(null, { code: '23505', message: 'SECRET' }));
  const duplicate = await ingredients.createKeepSeparateRule('garlic', id);
  assert.equal(duplicate.ok ? 'success' : duplicate.error.code, 'conflict');
  replies.push(reply(null));
  const missing = await ingredients.removeKeepSeparateRule(childId);
  assert.equal(missing.ok ? 'success' : missing.error.code, 'not_found');
});
it('orders loaded children explicitly and preserves IDs across reordering', async () => {
  replies.push(reply(row), reply([{ ...ingredient, id: householdId, position: 1 }, ingredient]), reply([{ ...step, id: childId, position: 1 }, step]));
  const loaded = await recipes.getRecipe(id);
  assert.ok(loaded.ok);
  assert.deepEqual(loaded.data.ingredients.map((item) => item.id), [childId, householdId]);
  assert.deepEqual(loaded.data.steps.map((item) => item.id), [householdId, childId]);
  const { assignPositions } = await import('../domain/recipes/ordering.ts');
  replies.push(reply([{ recipe_id: id, updated_at: token }]));
  assert.ok((await recipes.updateRecipe(id, token, { ...loaded.data, ingredients: assignPositions([...loaded.data.ingredients].reverse()), steps: assignPositions([...loaded.data.steps].reverse()) })).ok);
  assert.deepEqual(savedArgs().p_ingredients.map((item) => [item.id, item.position]), [[householdId, 0], [childId, 1]]);
});
it('rejects unknown review decisions and unavailable canonical choices without writes', async () => {
  for (const decision of [{ kind: 'unknown' }, { kind: 'select_canonical', canonicalIngredientId: childId }]) {
    load(); catalogue();
    const result = await recipes.reviewRecipeIngredient(id, childId, token, decision as Parameters<typeof recipes.reviewRecipeIngredient>[3]);
    assert.equal(result.ok ? 'success' : result.error.code, 'validation_error');
  }
  assert.ok(!calls.some((c) => c.name === 'save_recipe'));
});
it('does not report success on an empty save response or failed child read', async (t) => {
  t.mock.method(console, 'error', () => {});
  replies.push(reply([]));
  const saved = await recipes.createRecipe(createRecipeDraft('Soup'));
  assert.equal(saved.ok ? 'success' : saved.error.code, 'unexpected_error');
  replies.push(reply(row), reply(null, { code: '42501', message: 'SECRET' }), reply([]));
  const loaded = await recipes.getRecipe(id);
  assert.equal(loaded.ok ? 'success' : loaded.error.code, 'unexpected_error');
  assert.ok(!JSON.stringify(loaded).includes('SECRET'));
});
