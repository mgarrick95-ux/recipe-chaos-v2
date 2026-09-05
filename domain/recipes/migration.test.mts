// Static regression checks only. These do not substitute for executing PostgreSQL
// and two-household RLS/transaction/concurrency tests before remote application.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
const sql = readFileSync(new URL('../../supabase/migrations/20260905120000_recipes_foundation.sql', import.meta.url), 'utf8');
describe('recipe migration security contract (static)', () => {
  it('only cascades recipe deletion into ingredients and steps', () => {
    assert.equal((sql.match(/on delete cascade/g) ?? []).length, 2);
    assert.equal((sql.match(/references public.recipes\(id\) on delete cascade/g) ?? []).length, 2);
    assert.match(sql, /references public.canonical_ingredients\(id\) on delete restrict/);
    assert.match(sql, /references public.households\(id\) on delete restrict/);
    assert.match(sql, /references auth.users\(id\) on delete restrict/);
    assert.doesNotMatch(sql, /deleted_at|duration_minutes|create table public.recipe_tags/);
  });
  it('restricts every table with RLS, scoped CRUD, and limited grants', () => {
    for (const table of ['recipes', 'recipe_ingredients', 'recipe_steps']) {
      assert.ok(sql.includes('alter table public.' + table + ' enable row level security'));
      assert.ok(sql.includes('revoke all privileges on table public.' + table + ' from public, anon, authenticated'));
      for (const op of ['select', 'insert', 'update', 'delete']) assert.ok(sql.includes('create policy ' + table + '_' + op));
    }
    assert.doesNotMatch(sql, /(?:using|with check)\s*\(true\)/i);
    assert.doesNotMatch(sql, /grant\s+(?:all|truncate|references|trigger)/i);
    assert.match(sql, /created_by = \(select auth.uid\(\)\)/);
    assert.match(sql, /r.id = recipe_ingredients.recipe_id and public.is_household_member\(r.household_id\)/);
    assert.match(sql, /r.id = recipe_steps.recipe_id and public.is_household_member\(r.household_id\)/);
  });
  it('guards immutable ownership and excludes it from update grants', () => {
    for (const field of ['id','created_at','household_id','created_by','recipe_id']) assert.ok(sql.includes('new.' + field + ' is distinct from old.' + field));
    const updates = sql.match(/grant update \([^;]+/g) ?? [];
    assert.equal(updates.length, 3);
    for (const grant of updates) assert.doesNotMatch(grant, /\b(?:id|recipe_id|household_id|created_by|created_at|updated_at)\b/);
  });
  it('uses invoker functions with fixed paths and explicit RPC execution grants', () => {
    assert.doesNotMatch(sql, /security definer/i);
    assert.equal((sql.match(/security invoker set search_path = ''/g) ?? []).length, 3);
    assert.match(sql, /revoke all on function public.save_recipe[\s\S]+from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public.save_recipe[\s\S]+to authenticated/);
  });
  it('only initializes matching text from the raw line for new rows', () => {
    assert.ok(sql.includes("coalesce(item->>'ingredient_text', item->>'original_text')"));
    assert.ok(sql.includes("ingredient_text = coalesce(item->>'ingredient_text', recipe_ingredients.ingredient_text)"));
  });
  it('declares deferred ordering, verification, parent touch and stale-save checks', () => {
    assert.equal((sql.match(/unique \(recipe_id, position\) deferrable initially deferred/g) ?? []).length, 2);
    assert.match(sql, /verification_state <> 'unreviewed' or canonical_ingredient_id is null/);
    assert.match(sql, /current_updated_at <> p_expected_updated_at/);
    assert.match(sql, /for update;/);
    assert.match(sql, /Invalid ingredient ID/);
    assert.match(sql, /Invalid step ID/);
    assert.match(sql, /Duplicate child IDs/);
    assert.equal((sql.match(/before insert or update or delete/g) ?? []).length, 2);
  });
});

const staleConflictSql = readFileSync(new URL('../../supabase/migrations/20260905123000_fix_recipe_stale_conflict_http_status.sql', import.meta.url), 'utf8');
describe('recipe stale-conflict correction (static)', () => {
  it('changes only the stale SQLSTATE while preserving the full function contract', () => {
    const originalDefinition = sql.match(/create function public\.save_recipe\([\s\S]*?\$\$;/)?.[0];
    assert.ok(originalDefinition);
    const expected = originalDefinition
      .replace('create function public.save_recipe(', 'create or replace function public.save_recipe(')
      .replace("errcode = '40001'", "errcode = 'PT412'");
    const actual = staleConflictSql.replace(/^--[^\n]*\n/gm, '').trim();
    // Strip comments from both definitions; all executable SQL must match exactly.
    assert.equal(actual, expected.replace(/^--[^\n]*\n/gm, '').trim());
  });
  it('returns the intentional HTTP 412 code and preserves the conflict message', () => {
    assert.match(staleConflictSql, /raise exception 'Recipe changed; reload before saving' using errcode = 'PT412';/);
    assert.doesNotMatch(staleConflictSql, /40001/);
    assert.match(staleConflictSql, /language plpgsql security invoker set search_path = ''/);
    assert.doesNotMatch(staleConflictSql, /\b(?:grant|revoke|drop)\s/i);
  });
});
