import assert from 'node:assert/strict';
import { it } from 'node:test';
import { buildManualRecipe, moveRow, recipeToInput } from './manual-entry.ts';
import { createRecipeIngredient } from './ingredients.ts';
import { createRecipeDraft } from './validation.ts';
import type { RecipeAggregate } from './types.ts';
import { saveManualRecipe, type EntryServices } from '../../services/recipe-entry-core.ts';
import { err, ok } from '../../services/result.ts';
import { recipeErrorMessage } from '../../components/domain/recipes/messages.ts';

const id = '00000000-0000-4000-8000-000000000001';
const child = '00000000-0000-4000-8000-000000000002';
const second = '00000000-0000-4000-8000-000000000003';
const token = '2026-09-05T12:00:00.123456+00:00';
const original = '  ½ garlic, minced\n— optional  ';
function fixture(): RecipeAggregate {
  return { ...createRecipeDraft('Soup'), id, householdId: id, createdBy: id, createdAt: token, updatedAt: token,
    ingredients: [{ ...createRecipeIngredient({ originalText: original, ingredientText: 'garlic' }, 0), id: child, canonicalIngredientId: id, verificationState: 'verified', createdAt: token, updatedAt: token }],
    steps: [{ id: second, position: 0, instruction: '  Stir.\nRest.  ', createdAt: token, updatedAt: token }],
  };
}
it('manual form accepts title only without requiring ingredients or steps', () => {
  assert.deepEqual(buildManualRecipe({ ...recipeToInput(), title: 'Soup' }), createRecipeDraft('Soup'));
});
it('one authored line is preserved exactly and mirrored without parsing', () => {
  const result = buildManualRecipe({ ...recipeToInput(), title: 'Soup', ingredients: [{ originalText: original }] });
  assert.equal(result.ingredients[0].originalText, original);
  assert.equal(result.ingredients[0].ingredientText, original);
  assert.equal(result.ingredients[0].quantity, null);
  assert.equal(result.ingredients[0].canonicalIngredientId, null);
  assert.equal(result.ingredients[0].id, undefined);
});
it('unchanged edits retain IDs, authored whitespace, structured text, and canonical decisions', () => {
  const existing = fixture();
  const result = buildManualRecipe(recipeToInput(existing), existing);
  assert.deepEqual(result.ingredients, existing.ingredients);
  assert.deepEqual(result.steps, existing.steps);
});
it('authored identity changes use domain editing and retain mapping for review', () => {
  const existing = fixture();
  const input = recipeToInput(existing);
  input.ingredients[0].originalText = '  garlic powder  ';
  const result = buildManualRecipe(input, existing);
  assert.equal(result.ingredients[0].verificationState, 'needs_review');
  assert.equal(result.ingredients[0].canonicalIngredientId, id);
  assert.equal(result.ingredients[0].ingredientText, 'garlic');
  assert.equal(result.ingredients[0].id, child);
  assert.equal(existing.ingredients[0].originalText, original);
  existing.ingredients[0].verificationState = 'unreviewed';
  existing.ingredients[0].canonicalIngredientId = null;
  assert.equal(buildManualRecipe(input, existing).ingredients[0].verificationState, 'unreviewed');
});
it('adding, moving, and removing rows preserves surviving child identities', () => {
  const existing = fixture();
  const input = recipeToInput(existing);
  input.ingredients.push({ originalText: 'salt' });
  input.steps.push({ instruction: 'Serve.' });
  input.ingredients = moveRow(input.ingredients, 1, -1);
  input.steps = moveRow(input.steps, 0, 1);
  const moved = buildManualRecipe(input, existing);
  assert.deepEqual(moved.ingredients.map((row) => [row.id, row.position]), [[undefined, 0], [child, 1]]);
  assert.deepEqual(moved.steps.map((row) => [row.id, row.position]), [[undefined, 0], [second, 1]]);
  input.ingredients = input.ingredients.filter((row) => row.id);
  input.steps = input.steps.filter((row) => row.id);
  const removed = buildManualRecipe(input, existing);
  assert.equal(removed.ingredients[0].id, child);
  assert.equal(removed.steps[0].id, second);
  assert.equal(removed.ingredients[0].position, 0);
  assert.equal(removed.steps[0].position, 0);
  input.ingredients = []; input.steps = [];
  assert.deepEqual(buildManualRecipe(input, existing).ingredients, []);
});
it('rejects foreign and duplicate child IDs and invalid form content', () => {
  const existing = fixture();
  const input = recipeToInput(existing);
  assert.throws(() => buildManualRecipe({ ...input, title: ' ' }, existing));
  assert.throws(() => buildManualRecipe({ ...input, servings: '-1' }, existing));
  assert.throws(() => buildManualRecipe({ ...input, sourceUrl: 'javascript:alert(1)' }, existing));
  assert.throws(() => buildManualRecipe({ ...input, ingredients: [{ id, originalText: 'x' }] }, existing));
  assert.throws(() => buildManualRecipe({ ...input, ingredients: [input.ingredients[0], input.ingredients[0]] }, existing));
  assert.throws(() => buildManualRecipe({ ...input, steps: [{ instruction: ' ' }] }, existing));
});
it('the manual boundary ignores client-supplied canonical choices', () => {
  const existing = fixture();
  const input = recipeToInput(existing);
  Object.assign(input.ingredients[0], { canonicalIngredientId: second, verificationState: 'unreviewed', ingredientText: 'altered' });
  assert.deepEqual(buildManualRecipe(input, existing).ingredients, existing.ingredients);
});
it('save orchestration forwards the exact timestamp and authoritative edit', async () => {
  const existing = fixture();
  let updated = false;
  const services: EntryServices = {
    async getRecipe(recipeId) { assert.equal(recipeId, id); return ok(existing); },
    async createRecipe() { assert.fail('Must edit'); },
    async updateRecipe(recipeId, expected, draft) { updated = true; assert.equal(recipeId, id); assert.equal(expected, token); assert.deepEqual(draft.ingredients, existing.ingredients); return ok({ recipeId, updatedAt: token }); },
  };
  assert.ok((await saveManualRecipe(services, recipeToInput(existing), { recipeId: id, expectedUpdatedAt: token })).ok);
  assert.ok(updated);
});
it('stale or inaccessible edits do not write; RPC conflict remains a conflict', async () => {
  const existing = fixture();
  const services: EntryServices = {
    async getRecipe() { return ok(existing); },
    async createRecipe() { assert.fail('Must not create'); },
    async updateRecipe() { return err('conflict', 'PT412'); },
  };
  const stale = await saveManualRecipe(services, recipeToInput(existing), { recipeId: id, expectedUpdatedAt: 'old' });
  assert.equal(stale.ok ? 'success' : stale.error.code, 'conflict');
  const race = await saveManualRecipe(services, recipeToInput(existing), { recipeId: id, expectedUpdatedAt: token });
  assert.equal(race.ok ? 'success' : race.error.code, 'conflict');
  services.getRecipe = async () => err('unauthorized', 'Sign in');
  assert.equal((await saveManualRecipe(services, recipeToInput(existing), { recipeId: id, expectedUpdatedAt: token })).ok, false);
});
it('UI messages hide codes and internal details', () => {
  assert.equal(recipeErrorMessage({ code: 'conflict', message: 'PT412 raw error' }), 'This recipe changed somewhere else. Reload before saving again.');
  for (const code of ['unauthorized', 'unexpected_error', 'validation_error', 'not_found'] as const) assert.ok(!recipeErrorMessage({ code, message: 'SECRET' }).includes('SECRET'));
});
