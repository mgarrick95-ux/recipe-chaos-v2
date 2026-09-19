import assert from 'node:assert/strict';
import { it } from 'node:test';
import { derivePlanShoppingReview, type PlanIngredientOrigin, type ReviewInventoryItem, type ReviewShoppingItem } from './shopping-review.ts';
import type { RecipeMatchingContext } from '../recipes/ingredients.ts';

const ids = {
  household: '00000000-0000-4000-8000-000000000001',
  plan: '00000000-0000-4000-8000-000000000002',
  slot: '00000000-0000-4000-8000-000000000003',
  selection: '00000000-0000-4000-8000-000000000004',
  recipe: '00000000-0000-4000-8000-000000000005',
  ingredient: '00000000-0000-4000-8000-000000000006',
  garlic: '00000000-0000-4000-8000-000000000007',
};
const context: RecipeMatchingContext = {
  householdId: ids.household,
  canonicalIngredients: [{ id: ids.garlic, name: 'garlic', normalizedName: 'garlic' }],
  aliases: [],
  separationRules: [],
};

function ingredient(overrides: Partial<PlanIngredientOrigin> = {}): PlanIngredientOrigin {
  return {
    planId: ids.plan,
    slotId: ids.slot,
    selectionId: ids.selection,
    recipeId: ids.recipe,
    recipeTitle: 'Garlic soup',
    recipeIngredientId: ids.ingredient,
    originalText: 'garlic',
    ingredientText: 'garlic',
    canonicalIngredientId: ids.garlic,
    verificationState: 'verified',
    optional: false,
    ...overrides,
  };
}

function review(input: { ingredient?: Partial<PlanIngredientOrigin>; inventory?: ReviewInventoryItem[]; shopping?: ReviewShoppingItem[]; matchingContext?: RecipeMatchingContext } = {}) {
  return derivePlanShoppingReview({
    ingredients: [ingredient(input.ingredient)],
    inventory: input.inventory ?? [],
    shopping: input.shopping ?? [],
    matchingContext: input.matchingContext ?? context,
  })[0];
}

it('classifies verified canonical inventory as FrostPantry coverage', () => {
  assert.equal(review({ inventory: [{ id: 'i', displayName: 'Fresh garlic', canonicalIngredientId: ids.garlic, quantity: 1, isOutOfStock: false }] }).status, 'covered_by_pantry');
});

it('does not count out-of-stock or zero-quantity inventory as coverage', () => {
  assert.equal(review({ inventory: [{ id: 'i', displayName: 'garlic', canonicalIngredientId: ids.garlic, quantity: 1, isOutOfStock: true }] }).status, 'missing');
  assert.equal(review({ inventory: [{ id: 'i', displayName: 'garlic', canonicalIngredientId: ids.garlic, quantity: 0, isOutOfStock: false }] }).status, 'missing');
});

it('uses exact normalized text only for a verified unlinked ingredient', () => {
  assert.equal(review({
    ingredient: { canonicalIngredientId: null, ingredientText: '  Pearl   onions ' },
    inventory: [{ id: 'i', displayName: 'pearl onions', canonicalIngredientId: null, quantity: null, isOutOfStock: false }],
  }).status, 'covered_by_pantry');
});

it('does not let text fallback override conflicting canonical identities', () => {
  assert.equal(review({ inventory: [{
    id: 'i', displayName: 'garlic', canonicalIngredientId: '00000000-0000-4000-8000-000000000099', quantity: 1, isOutOfStock: false,
  }] }).status, 'missing');
});

it('respects keep-separate when exact text points at a blocked canonical item', () => {
  const blocked = { ...context, separationRules: [{
    id: 'rule', householdId: ids.household, normalizedInput: 'garlic cloves', blockedCanonicalIngredientId: ids.garlic,
  }] };
  assert.equal(review({
    ingredient: { canonicalIngredientId: null, originalText: 'garlic cloves', ingredientText: 'garlic cloves' },
    inventory: [{ id: 'i', displayName: 'garlic cloves', canonicalIngredientId: ids.garlic, quantity: 1, isOutOfStock: false }],
    matchingContext: blocked,
  }).status, 'missing');
});

it('keeps unreviewed and needs-review identities uncertain', () => {
  assert.equal(review({ ingredient: { canonicalIngredientId: null, verificationState: 'unreviewed' } }).status, 'uncertain');
  assert.equal(review({ ingredient: { verificationState: 'needs_review' } }).status, 'uncertain');
});

it('classifies an exact authored-text manual collision for an unreviewed ingredient', () => {
  const row = review({
    ingredient: { canonicalIngredientId: null, verificationState: 'unreviewed', originalText: 'garlic', ingredientText: 'garlic' },
    shopping: [{ id: 's', displayName: 'garlic', canonicalIngredientId: null, sourceType: 'manual', sourceId: null, sourceSlotId: null, sourceRecipeIngredientId: null, isChecked: false }],
  });
  assert.equal(row.status, 'already_manual');
  assert.equal(row.eligibleForAddition, false);
});

it('normalizes case and surrounding whitespace for exact authored-text manual collisions', () => {
  assert.equal(review({
    ingredient: { canonicalIngredientId: null, verificationState: 'unreviewed', originalText: 'Garlic', ingredientText: 'Garlic' },
    shopping: [{ id: 's', displayName: ' garlic ', canonicalIngredientId: null, sourceType: 'manual', sourceId: null, sourceSlotId: null, sourceRecipeIngredientId: null, isChecked: false }],
  }).status, 'already_manual');
});

it('does not reduce a full authored ingredient line to a shorter manual Shopping name', () => {
  assert.equal(review({
    ingredient: { canonicalIngredientId: null, verificationState: 'unreviewed', originalText: '2 cloves garlic, minced', ingredientText: 'garlic' },
    shopping: [{ id: 's', displayName: 'garlic', canonicalIngredientId: null, sourceType: 'manual', sourceId: null, sourceSlotId: null, sourceRecipeIngredientId: null, isChecked: false }],
  }).status, 'uncertain');
});

it('counts a checked active exact-text manual row for an unreviewed ingredient', () => {
  assert.equal(review({
    ingredient: { canonicalIngredientId: null, verificationState: 'unreviewed' },
    shopping: [{ id: 's', displayName: 'garlic', canonicalIngredientId: null, sourceType: 'manual', sourceId: null, sourceSlotId: null, sourceRecipeIngredientId: null, isChecked: true, deletedAt: null }],
  }).status, 'already_manual');
});

it('ignores a soft-deleted exact-text manual row', () => {
  assert.equal(review({
    ingredient: { canonicalIngredientId: null, verificationState: 'unreviewed' },
    shopping: [{ id: 's', displayName: 'garlic', canonicalIngredientId: null, sourceType: 'manual', sourceId: null, sourceSlotId: null, sourceRecipeIngredientId: null, isChecked: false, deletedAt: '2026-09-19T12:00:00.000Z' }],
  }).status, 'uncertain');
});

it('does not mutate a manual Shopping row while checking an exact-text collision', () => {
  const manual: ReviewShoppingItem = { id: 's', displayName: ' garlic ', canonicalIngredientId: null, sourceType: 'manual', sourceId: null, sourceSlotId: null, sourceRecipeIngredientId: null, isChecked: true, deletedAt: null };
  const before = structuredClone(manual);
  review({ ingredient: { canonicalIngredientId: null, verificationState: 'unreviewed' }, shopping: [manual] });
  assert.deepEqual(manual, before);
});

it('shows optional ingredients separately and leaves them unchecked', () => {
  const row = review({ ingredient: { optional: true } });
  assert.equal(row.status, 'optional');
  assert.equal(row.eligibleForAddition, true);
  assert.equal(row.defaultSelected, false);
});

it('does not offer an optional ingredient that FrostPantry already covers', () => {
  const row = review({
    ingredient: { optional: true },
    inventory: [{ id: 'i', displayName: 'garlic', canonicalIngredientId: ids.garlic, quantity: 1, isOutOfStock: false }],
  });
  assert.equal(row.status, 'covered_by_pantry');
  assert.equal(row.eligibleForAddition, false);
});

it('classifies manual Shopping collisions without making them eligible', () => {
  const row = review({ shopping: [{ id: 's', displayName: 'garlic', canonicalIngredientId: ids.garlic, sourceType: 'manual', sourceId: null, sourceSlotId: null, sourceRecipeIngredientId: null, isChecked: false }] });
  assert.equal(row.status, 'already_manual');
  assert.equal(row.eligibleForAddition, false);
});

it('counts checked active Shopping items as already listed', () => {
  assert.equal(review({ shopping: [{ id: 's', displayName: 'garlic', canonicalIngredientId: ids.garlic, sourceType: 'manual', sourceId: null, sourceSlotId: null, sourceRecipeIngredientId: null, isChecked: true }] }).status, 'already_manual');
});

it('classifies an existing generated origin as an idempotent plan collision', () => {
  assert.equal(review({ shopping: [{ id: 's', displayName: 'garlic', canonicalIngredientId: ids.garlic, sourceType: 'plan', sourceId: ids.plan, sourceSlotId: ids.slot, sourceRecipeIngredientId: ids.ingredient, isChecked: false }] }).status, 'already_plan');
});

it('classifies an existing generated origin before uncertainty for repeat approval', () => {
  assert.equal(review({
    ingredient: { canonicalIngredientId: null, verificationState: 'unreviewed' },
    shopping: [{ id: 's', displayName: 'garlic', canonicalIngredientId: null, sourceType: 'plan', sourceId: ids.plan, sourceSlotId: ids.slot, sourceRecipeIngredientId: ids.ingredient, isChecked: true }],
  }).status, 'already_plan');
});

it('does not collapse a matching plan item from a different recipe origin', () => {
  assert.equal(review({ shopping: [{
    id: 's', displayName: 'garlic', canonicalIngredientId: ids.garlic, sourceType: 'plan', sourceId: ids.plan,
    sourceSlotId: '00000000-0000-4000-8000-000000000008', sourceRecipeIngredientId: '00000000-0000-4000-8000-000000000009', isChecked: false,
  }] }).status, 'missing');
});

it('keeps the same ingredient from separate recipe origins as separate proposal rows', () => {
  const rows = derivePlanShoppingReview({
    ingredients: [ingredient(), ingredient({ slotId: '00000000-0000-4000-8000-000000000008', recipeIngredientId: '00000000-0000-4000-8000-000000000009' })],
    inventory: [], shopping: [], matchingContext: context,
  });
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].originKey, rows[1].originKey);
  assert.deepEqual(rows.map((row) => row.status), ['missing', 'missing']);
});
