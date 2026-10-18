import assert from 'node:assert/strict';
import { it, beforeEach } from 'node:test';
import { createRequire } from 'node:module';
import type { PlanContextInput } from './planning.ts';

type Row = Record<string, unknown>;
const rows: Record<string, Row[]> = {
  recipes: [],
  recipe_ingredients: [],
  recipe_steps: [],
  inventory_items: [],
  shopping_items: [],
};
const queries: { table: string; name: string; args: unknown[] }[] = [];
let signedIn = true;
let hasPlan = true;

const db = {
  from(table: string) {
    const query = {
      select(...args: unknown[]) { queries.push({ table, name: 'select', args }); return query; },
      eq(...args: unknown[]) { queries.push({ table, name: 'eq', args }); return query; },
      is(...args: unknown[]) { queries.push({ table, name: 'is', args }); return query; },
      order(...args: unknown[]) { queries.push({ table, name: 'order', args }); return query; },
      in(...args: unknown[]) { queries.push({ table, name: 'in', args }); return query; },
      then(resolve: (value: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
      },
    };
    return query;
  },
};
Object.assign(globalThis, {
  __brainTestDb: db,
  __brainTestPlanning: async () => signedIn
    ? { ok: true, data: { week: '2026-10-19', plan: hasPlan ? {
      id: 'plan', start: '2026-10-19', slots: [{ id: 'slot', locked: false, recipeId: 'selected' }],
    } : null } }
    : { ok: false, error: { code: 'unauthorized', message: 'Sign in required' } },
  __brainTestHousehold: async () => signedIn
    ? { ok: true, data: { householdId: 'household' } }
    : { ok: false, error: { code: 'unauthorized', message: 'Sign in required' } },
  __brainTestMatching: async () => ({ ok: true, data: {
    householdId: 'household', canonicalIngredients: [{ id: 'garlic', name: 'garlic', normalizedName: 'garlic' }],
    aliases: [], separationRules: [],
  } }),
});

const require = createRequire(import.meta.url);
type Resolution = { url: string; shortCircuit?: boolean };
type Context = { parentURL?: string };
const dataModule = (source: string): Resolution => ({ url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true });
const { registerHooks } = require('node:module') as { registerHooks(hooks: {
  resolve(specifier: string, context: Context, next: (specifier: string, context: Context) => Resolution): Resolution;
}): void };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return dataModule('export {}');
    if (specifier === '@/services/planning') return dataModule('export async function loadPlanningView(){return globalThis.__brainTestPlanning()}');
    if (specifier === '@/services/households') return dataModule('export async function getCurrentHousehold(){return globalThis.__brainTestHousehold()}');
    if (specifier === '@/lib/supabase/server') return dataModule('export async function createServerSupabaseClient(){return globalThis.__brainTestDb}');
    if (specifier === '@/services/ingredients') return dataModule('export async function getIngredientMatchingContext(){return globalThis.__brainTestMatching()}');
    if (specifier.startsWith('@/')) return next(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
    return next(specifier, context);
  },
});

const { suggestMealIdeas } = await import('./meal-brain.ts');
const week = '2026-10-19';
const context: PlanContextInput = {
  energyLevel: 'low', effortLevel: 'easy', budgetMode: 'tight',
  maxCookingTimeMinutes: '30', notes: '',
};
beforeEach(() => {
  signedIn = true;
  hasPlan = true;
  queries.length = 0;
  for (const key of Object.keys(rows)) rows[key] = [];
});

it('requires authentication and never queries a household when planning is unauthorized', async () => {
  signedIn = false;
  const result = await suggestMealIdeas(week, context);
  assert.equal(result.ok, false);
  assert.deepEqual(queries, []);
});
it('rejects invalid weeks or planning notes before any query', async () => {
  for (const [value, ctx] of [
    ['2026-10-20', context], ['bad-week', context],
    [week, { ...context, maxCookingTimeMinutes: 'not a number' }],
    [week, { ...context, notes: 'x'.repeat(1001) }],
  ] as const) {
    assert.equal((await suggestMealIdeas(value, ctx)).ok, false);
  }
  assert.deepEqual(queries, []);
});
it('does not generate recommendations before a real weekly plan exists', async () => {
  hasPlan = false;
  const result = await suggestMealIdeas(week, context);
  assert.equal(result.ok, false);
  assert.deepEqual(queries, []);
});
it('returns household-scoped, read-only ranked candidates without modifying saved choices', async () => {
  rows.recipes = [
    { id: 'selected', title: 'Already chosen', is_favorite: false },
    { id: 'another', title: 'Garlic dinner', is_favorite: true },
  ];
  rows.recipe_ingredients = [
    { recipe_id: 'another', ingredient_text: 'garlic', canonical_ingredient_id: 'garlic',
      verification_state: 'verified', optional: false },
  ];
  rows.recipe_steps = [{ id: 'step', recipe_id: 'another' }];
  rows.inventory_items = [
    { display_name: 'garlic', canonical_ingredient_id: 'garlic', quantity: 2,
      is_out_of_stock: false, use_soon_status: 'use_soon', expiry_date: null },
  ];
  const result = await suggestMealIdeas(week, context);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.map(recipe => recipe.recipeId), ['another']);
  assert.equal(result.data[0].pantryCount, 1);
  assert.equal(result.data[0].useSoonCount, 1);
  for (const table of ['recipes', 'inventory_items', 'shopping_items']) {
    assert.ok(queries.some(call => call.table === table && call.name === 'eq' &&
      call.args[0] === 'household_id' && call.args[1] === 'household'));
  }
  assert.ok(queries.some(call => call.table === 'recipe_ingredients' && call.name === 'in' &&
    call.args[0] === 'recipe_id'));
  assert.ok(queries.every(call => ['select', 'eq', 'is', 'order', 'in'].includes(call.name)));
});
it('quietly returns an empty suggestion set when the household has no saved recipes', async () => {
  const result = await suggestMealIdeas(week, context);
  assert.deepEqual(result, { ok: true, data: [] });
  assert.equal(queries.filter(call => call.table === 'recipe_ingredients').length, 0);
});
