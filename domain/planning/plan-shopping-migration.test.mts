import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';

const sql = readFileSync(new URL('../../supabase/migrations/20260919210000_plan_shopping_review.sql', import.meta.url), 'utf8');

it('protects concurrent approvals with an active plan-origin uniqueness index', () => {
  assert.match(sql, /create unique index shopping_items_active_plan_origin_unique/i);
  assert.match(sql, /where source_type = 'plan' and deleted_at is null/i);
  assert.match(sql, /on conflict[\s\S]*do nothing/i);
});

it('keeps direct manual inserts separate from a narrow validated plan policy', () => {
  assert.match(sql, /create policy shopping_items_plan_insert/i);
  assert.match(sql, /join public\.meal_plan_selections/i);
  assert.match(sql, /join public\.recipe_ingredients/i);
  assert.match(sql, /created_by = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(sql, /drop policy shopping_items_insert/i);
});

it('revalidates every requested origin in the approval RPC', () => {
  assert.match(sql, /create function public\.add_plan_shopping_items/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /stale_or_invalid/i);
  assert.match(sql, /s\.meal_plan_id = p_plan_id/i);
  assert.match(sql, /ri\.id = requested_ingredient_id/i);
});

it('derives plan row content from authoritative recipe data and preserves manual source shape', () => {
  assert.match(sql, /create function public\.prepare_plan_shopping_item/i);
  assert.match(sql, /new\.display_name := resolved\.original_text/i);
  assert.match(sql, /source_type = 'manual' and source_id is null/i);
  assert.match(sql, /source_type = 'plan' and source_id is not null/i);
});
