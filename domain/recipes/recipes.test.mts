import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRecipeDraft, validateRecipe, validateIngredient } from './validation.ts';
import { createRecipeIngredient, suggestCanonical, editRecipeIngredient, selectCanonical,
  acceptCanonicalSuggestion, remainUnlinked, type RecipeMatchingContext } from './ingredients.ts';
import { assignPositions, validateOrdering } from './ordering.ts';

const garlic = '00000000-0000-4000-8000-000000000001';
const powder = '00000000-0000-4000-8000-000000000002';
const household = '00000000-0000-4000-8000-000000000003';
const context: RecipeMatchingContext = {
  householdId: household,
  canonicalIngredients: [
    { id: garlic, name: 'garlic', normalizedName: 'garlic' },
    { id: powder, name: 'garlic powder', normalizedName: 'garlic powder' },
  ],
  aliases: [{ id: 'alias', alias: 'cloves of garlic', normalizedAlias: 'cloves of garlic',
    canonicalIngredientId: garlic, householdId: null, source: 'app_seed' }],
};
const line = '  2 cloves garlic, minced — ½ optional?  ';
const ingredient = () => createRecipeIngredient({ originalText: line, ingredientText: 'garlic' }, 0);
const verified = () => acceptCanonicalSuggestion(ingredient(), context);
const blocked: RecipeMatchingContext = { ...context, separationRules: [{ id: 'rule', householdId: household,
  normalizedInput: 'garlic', blockedCanonicalIngredientId: garlic }] };

describe('recipe validation and text preservation', () => {
  it('allows a title-only recipe', () => assert.doesNotThrow(() => validateRecipe(createRecipeDraft('Soup'))));
  it('rejects blank titles', () => { for (const title of ['', ' ', '\t\n']) assert.throws(() => createRecipeDraft(title)); });
  it('rejects invalid servings and accepts positive fractions', () => {
    for (const servings of [0, -1, NaN, Infinity, -Infinity]) assert.throws(() => validateRecipe({ ...createRecipeDraft('Soup'), servings }));
    validateRecipe({ ...createRecipeDraft('Soup'), servings: 0.5 });
  });
  it('validates source URLs without fetching them', () => {
    for (const sourceUrl of ['bad url', 'javascript:alert(1)', 'file:///secret']) assert.throws(() => validateRecipe({ ...createRecipeDraft('Soup'), sourceUrl }));
    validateRecipe({ ...createRecipeDraft('Soup'), sourceUrl: 'https://example.com/recipe' });
  });
  it('allows one original line without duplicate entry or parsing', () => {
    const row = createRecipeIngredient({ originalText: line }, 0);
    assert.equal(row.originalText, line);
    assert.equal(row.ingredientText, line);
    assert.equal(row.quantity, null);
    assert.equal(row.preparation, null);
    assert.equal(suggestCanonical(row, context).status, 'no_match');
  });
  it('preserves authored whitespace and Unicode through validation and JSON roundtrip', () => {
    const draft = { ...createRecipeDraft('Soup'), ingredients: [ingredient()], steps: [{ position: 0, instruction: '  Stir gently.\nThen rest.  ' }] };
    const copy = structuredClone(draft);
    validateRecipe(draft);
    assert.deepEqual(draft, copy);
    assert.deepEqual(JSON.parse(JSON.stringify(draft)), copy);
  });
  it('rejects blank ingredient/step content and invalid verification shapes', () => {
    assert.throws(() => createRecipeIngredient({ originalText: '\n ' }, 0));
    assert.throws(() => validateRecipe({ ...createRecipeDraft('Soup'), steps: [{ position: 0, instruction: ' ' }] }));
    assert.throws(() => validateIngredient({ ...ingredient(), canonicalIngredientId: garlic }));
    assert.doesNotThrow(() => validateIngredient({ ...verified(), verificationState: 'needs_review' }));
    assert.doesNotThrow(() => validateIngredient({ ...remainUnlinked(ingredient()), verificationState: 'needs_review' }));
  });
});

describe('recipe matching and explicit decisions', () => {
  it('suggests exact canonical without accepting or overwriting original text', () => {
    const row = ingredient();
    const before = structuredClone(row);
    const result = suggestCanonical(row, context);
    assert.equal(result.status, 'exact_canonical');
    assert.equal(result.input.originalText, 'garlic');
    assert.deepEqual(row, before);
    assert.equal(row.originalText, line);
    assert.equal(row.canonicalIngredientId, null);
    assert.equal(row.verificationState, 'unreviewed');
  });
  it('suggests an approved alias and only accepts explicitly', () => {
    const row = createRecipeIngredient({ originalText: line, ingredientText: 'cloves of garlic' }, 0);
    assert.equal(suggestCanonical(row, context).status, 'approved_alias');
    assert.equal(row.canonicalIngredientId, null);
    assert.equal(acceptCanonicalSuggestion(row, context).canonicalIngredientId, garlic);
  });
  it('preserves household alias precedence', () => {
    const ctx: RecipeMatchingContext = { ...context, aliases: [...context.aliases, {
      id: 'local', alias: 'garlic', normalizedAlias: 'garlic', householdId: household,
      canonicalIngredientId: powder, source: 'owner_approved',
    }] };
    assert.equal(suggestCanonical(ingredient(), ctx).match?.canonicalIngredientId, powder);
  });
  it('leaves unmatched and ambiguous suggestions unaccepted', () => {
    const unknown = createRecipeIngredient({ originalText: 'unknown' }, 0);
    assert.equal(suggestCanonical(unknown, context).status, 'no_match');
    assert.throws(() => acceptCanonicalSuggestion(unknown, context));
    const ctx = { ...context, canonicalIngredients: [] };
    const alias = createRecipeIngredient({ originalText: 'cloves of garlic' }, 0);
    assert.equal(suggestCanonical(alias, ctx).status, 'ambiguous');
    assert.throws(() => acceptCanonicalSuggestion(alias, ctx));
  });
  it('respects keep separate for canonical, alias, and manual selection', () => {
    assert.equal(suggestCanonical(ingredient(), blocked).status, 'keep_separate');
    assert.throws(() => acceptCanonicalSuggestion(ingredient(), blocked));
    assert.throws(() => selectCanonical(ingredient(), garlic, blocked));
    const alias = createRecipeIngredient({ originalText: 'cloves of garlic' }, 0);
    const aliasBlocked = { ...blocked, separationRules: [{ ...blocked.separationRules![0], normalizedInput: 'cloves of garlic' }] };
    assert.equal(suggestCanonical(alias, aliasBlocked).status, 'keep_separate');
    assert.equal(selectCanonical(ingredient(), powder, blocked).canonicalIngredientId, powder);
  });
  it('ignores another household separation rule', () => {
    const ctx = { ...blocked, separationRules: [{ ...blocked.separationRules![0], householdId: 'other' }] };
    assert.equal(suggestCanonical(ingredient(), ctx).status, 'exact_canonical');
  });
  it('supports explicit manual override without rewriting text or creating aliases', () => {
    const before = structuredClone(context);
    const next = selectCanonical(verified(), powder, context);
    assert.equal(next.canonicalIngredientId, powder);
    assert.equal(next.verificationState, 'verified');
    assert.equal(next.originalText, line);
    assert.deepEqual(context, before);
    assert.throws(() => selectCanonical(next, 'missing', context));
  });
  it('supports an explicit verified-unlinked decision', () => {
    const next = remainUnlinked(verified());
    assert.equal(next.canonicalIngredientId, null);
    assert.equal(next.verificationState, 'verified');
    assert.equal(next.originalText, line);
  });
  it('does not silently rematch accepted rows after catalogue changes', () => {
    const row = verified();
    suggestCanonical(row, { ...context, canonicalIngredients: [] });
    assert.equal(row.canonicalIngredientId, garlic);
    assert.equal(row.verificationState, 'verified');
  });
});

describe('ingredient editing and ordering', () => {
  it('quantity/unit/optional edits preserve original and verification', () => {
    const row = verified();
    const next = editRecipeIngredient(row, { quantity: '1–2', unit: 'cloves', optional: true });
    assert.equal(next.originalText, line);
    assert.equal(next.verificationState, 'verified');
    assert.equal(row.quantity, null);
  });
  it('identity edits retain an accepted link for review', () => {
    for (const patch of [{ ingredientText: 'garlic powder' }, { preparation: 'ground' }, { descriptor: 'dried' }]) {
      const next = editRecipeIngredient(verified(), patch);
      assert.equal(next.originalText, line);
      assert.equal(next.canonicalIngredientId, garlic);
      assert.equal(next.verificationState, 'needs_review');
    }
  });
  it('raw edit changes only authored field and verification', () => {
    const row = verified();
    const originalText = '  user replacement  ';
    assert.deepEqual(editRecipeIngredient(row, { originalText }), { ...row, originalText, verificationState: 'needs_review' });
    const unlinked = remainUnlinked(row);
    assert.deepEqual(editRecipeIngredient(unlinked, { originalText }), { ...unlinked, originalText, verificationState: 'needs_review' });
  });
  it('unreviewed rows stay unreviewed; unchanged input does not invalidate verification', () => {
    assert.equal(editRecipeIngredient(ingredient(), { originalText: 'new' }).verificationState, 'unreviewed');
    assert.equal(editRecipeIngredient(verified(), { originalText: line }).verificationState, 'verified');
  });
  it('allows saving a mapping awaiting review', () => {
    validateRecipe({ ...createRecipeDraft('Soup'), ingredients: [editRecipeIngredient(verified(), { ingredientText: 'different' })] });
  });
  it('orders ingredients and steps without changing IDs or content', () => {
    const a = { ...ingredient(), id: garlic, position: 0 };
    const b = { ...ingredient(), id: powder, position: 1, originalText: 'other' };
    assert.deepEqual(assignPositions([b, a]), [{ ...b, position: 0 }, { ...a, position: 1 }]);
    const steps = [{ id: garlic, position: 0, instruction: 'First' }, { id: powder, position: 1, instruction: 'Second' }];
    assert.deepEqual(assignPositions([...steps].reverse()), [{ ...steps[1], position: 0 }, { ...steps[0], position: 1 }]);
    assert.equal(a.position, 0);
    assert.equal(steps[1].position, 1);
  });
  it('rejects duplicate, negative, fractional, and overflowing positions and duplicate IDs', () => {
    for (const position of [-1, 0.5, NaN, 2147483648]) assert.throws(() => validateOrdering([{ position }]));
    assert.throws(() => validateOrdering([{ position: 0 }, { position: 0 }]));
    assert.throws(() => assignPositions([{ id: garlic, position: 0 }, { id: garlic, position: 1 }]));
  });
  it('metadata/favorite edits leave ingredient content intact', () => {
    const draft = { ...createRecipeDraft('Soup'), ingredients: [verified()] };
    const before = structuredClone(draft.ingredients);
    const edited = { ...draft, title: 'New title', notes: 'Note', isFavorite: true };
    validateRecipe(edited);
    assert.deepEqual(edited.ingredients, before);
    const unfavorited = { ...edited, isFavorite: false };
    validateRecipe(unfavorited);
    assert.equal(unfavorited.isFavorite, false);
    assert.deepEqual(unfavorited.ingredients, before);
  });
});
