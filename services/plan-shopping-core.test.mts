import assert from 'node:assert/strict';
import { it } from 'node:test';
import type { PlanShoppingReviewRow } from '../domain/planning/shopping-review.ts';
import { approvePlanShoppingReview } from './plan-shopping-core.ts';

const slotId = '00000000-0000-4000-8000-000000000001';
const recipeIngredientId = '00000000-0000-4000-8000-000000000002';
const origin = { slotId, recipeIngredientId };

function row(status: PlanShoppingReviewRow['status']): PlanShoppingReviewRow {
  return {
    planId: 'p', slotId, selectionId: 's', recipeId: 'r', recipeTitle: 'Soup', recipeIngredientId,
    originalText: 'garlic', ingredientText: 'garlic', canonicalIngredientId: null,
    verificationState: 'verified', optional: false, originKey: `${slotId}:${recipeIngredientId}`,
    status, explanation: 'because', matchingShoppingItemId: null, matchingShoppingSource: null,
    eligibleForAddition: ['missing', 'uncertain', 'optional'].includes(status), defaultSelected: status === 'missing',
  };
}

it('persists an explicitly approved eligible item and reports the real change', async () => {
  const result = await approvePlanShoppingReview([row('missing')], [origin], async (eligible) => eligible.map((item) => ({ ...item, outcome: 'added' })));
  assert.equal(result.changed, true);
  assert.equal(result.counts.added, 1);
});

it('reports a repeated approval as an idempotent no-op', async () => {
  const result = await approvePlanShoppingReview([row('missing')], [origin], async (eligible) => eligible.map((item) => ({ ...item, outcome: 'already_plan' })));
  assert.equal(result.changed, false);
  assert.equal(result.counts.already_plan, 1);
});

it('never sends a manual collision to persistence', async () => {
  let called = false;
  const result = await approvePlanShoppingReview([row('already_manual')], [origin], async () => { called = true; return []; });
  assert.equal(called, false);
  assert.equal(result.counts.already_manual, 1);
  assert.equal(result.changed, false);
});

it('safely rejects a stale or forged ingredient identity without persistence', async () => {
  let called = false;
  const forged = { slotId, recipeIngredientId: '00000000-0000-4000-8000-000000000099' };
  const result = await approvePlanShoppingReview([row('missing')], [forged], async () => { called = true; return []; });
  assert.equal(called, false);
  assert.equal(result.counts.stale_or_invalid, 1);
});

it('deduplicates repeated browser identities before persistence', async () => {
  let persisted = 0;
  const result = await approvePlanShoppingReview([row('missing')], [origin, origin], async (eligible) => {
    persisted = eligible.length;
    return eligible.map((item) => ({ ...item, outcome: 'added' }));
  });
  assert.equal(persisted, 1);
  assert.equal(result.counts.added, 1);
});
