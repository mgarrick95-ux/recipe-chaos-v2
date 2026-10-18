import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  rankMealSuggestions, distributeMealSuggestions,
  type BrainRecipe, type BrainInventory, type BrainShopping, type BrainContext, type RankMealInput,
} from './rank.ts';
import type { RecipeMatchingContext } from '../recipes/ingredients.ts';

const garlic = 'garlic';
const powder = 'powder';
const onions = 'onions';
const milk = 'milk';
const matchingContext: RecipeMatchingContext = {
  householdId: 'household',
  canonicalIngredients: [
    { id: garlic, name: 'garlic', normalizedName: 'garlic' },
    { id: powder, name: 'garlic powder', normalizedName: 'garlic powder' },
    { id: onions, name: 'onion', normalizedName: 'onion' },
    { id: milk, name: 'milk', normalizedName: 'milk' },
  ],
  aliases: [], separationRules: [],
};
const context: BrainContext = { energyLevel: '', effortLevel: '', budgetMode: '', maxCookingTimeMinutes: '' };
function ingredient(name: string, id: string | null = null, options: {
  optional?: boolean; state?: 'verified' | 'unreviewed' | 'needs_review';
} = {}) {
  return {
    ingredientText: name, canonicalIngredientId: id,
    verificationState: options.state ?? 'verified', optional: options.optional ?? false,
  };
}
function recipe(id: string, ingredients: BrainRecipe['ingredients'], options: {
  favorite?: boolean; steps?: number;
} = {}): BrainRecipe {
  return { id, title: id, isFavorite: options.favorite ?? false,
    stepCount: options.steps ?? 3, ingredients };
}
function stock(name: string, canonicalId: string | null, overrides: Partial<BrainInventory> = {}): BrainInventory {
  return { displayName: name, canonicalIngredientId: canonicalId, quantity: 1,
    isOutOfStock: false, useSoonStatus: 'normal', expiryDate: null, ...overrides };
}
function input(overrides: Partial<RankMealInput> = {}): RankMealInput {
  return {
    recipes: [], inventory: [], shopping: [], matchingContext, selectedRecipeIds: [],
    context, todayIso: '2026-10-18', ...overrides,
  };
}
function rank(overrides: Partial<RankMealInput>) { return rankMealSuggestions(input(overrides)); }

it('counts verified FrostPantry matches, use-soon stock and existing Shopping without silently buying', () => {
  const items: BrainShopping[] = [{ displayName: 'onion', canonicalIngredientId: onions }];
  const result = rank({
    recipes: [recipe('Stew', [ingredient('garlic', garlic), ingredient('onion', onions), ingredient('milk', milk)])],
    inventory: [stock('garlic', garlic, { useSoonStatus: 'use_soon', quantity: null })],
    shopping: items,
  })[0];
  assert.equal(result.pantryCount, 1);
  assert.equal(result.useSoonCount, 1);
  assert.equal(result.alreadyShoppingCount, 1);
  assert.equal(result.missingCount, 1);
  assert.equal(result.needsReviewCount, 0);
  assert.ok(result.reasons.some(message => message.includes('amounts not checked')));
  assert.ok(result.reasons.some(message => message.includes('Shopping')));
});

it('does not count out-of-stock, zero-quantity or past-dated inventory as covered', () => {
  const result = rank({
    recipes: [recipe('Soup', [ingredient('garlic', garlic), ingredient('milk', milk), ingredient('onion', onions)])],
    inventory: [
      stock('garlic', garlic, { isOutOfStock: true }),
      stock('milk', milk, { quantity: 0 }),
      stock('onion', onions, { expiryDate: '2026-10-17' }),
    ],
  })[0];
  assert.equal(result.pantryCount, 0);
  assert.equal(result.missingCount, 3);
  assert.equal(result.useSoonCount, 0);
});

it('never treats unreviewed or uncertain identity as a confident pantry match or purchase', () => {
  const result = rank({
    recipes: [recipe('Pasta', [
      ingredient('garlic', garlic, { state: 'unreviewed' }),
      ingredient('milk', milk, { state: 'needs_review' }),
      ingredient('optional pepper', null, { optional: true }),
    ])],
    inventory: [stock('garlic', garlic), stock('milk', milk)],
  })[0];
  assert.equal(result.pantryCount, 0);
  assert.equal(result.missingCount, 0);
  assert.equal(result.needsReviewCount, 2);
});

it('respects separate garlic and garlic powder product families', () => {
  const result = rank({
    recipes: [recipe('Garlic dinner', [ingredient('garlic powder', powder)])],
    inventory: [stock('garlic', garlic)],
  })[0];
  assert.equal(result.pantryCount, 0);
  assert.equal(result.missingCount, 1);
});

it('reuses keep-separate rules for verified unlinked recipe ingredients', () => {
  const matching: RecipeMatchingContext = {
    ...matchingContext,
    separationRules: [{ id: 'rule', householdId: 'household', normalizedInput: 'garlic',
      blockedCanonicalIngredientId: garlic }],
  };
  const result = rank({
    recipes: [recipe('Garlic dish', [ingredient('garlic')])],
    inventory: [stock('garlic', garlic)],
    matchingContext: matching,
  })[0];
  assert.equal(result.pantryCount, 0);
  assert.equal(result.missingCount, 1);
});

it('keeps empty or incomplete recipes below meaningful candidates and avoids made-up time estimates', () => {
  const result = rank({
    recipes: [
      recipe('Empty recipe', [], { favorite: true, steps: 0 }),
      recipe('Fully stocked', [ingredient('garlic', garlic)], { steps: 3 }),
    ],
    inventory: [stock('garlic', garlic)],
    context: { ...context, maxCookingTimeMinutes: '15' },
  });
  assert.equal(result[0].recipeId, 'Fully stocked');
  assert.ok(result[1].reasons.some(reason => reason.includes('No required ingredients')));
  assert.ok(result.every(suggestion => !suggestion.reasons.some(reason => /\b15 minutes\b/u.test(reason))));
});

it('responds to low energy and tight budget through heuristics, not invented prep times or prices', () => {
  const hard = recipe('Big project', [ingredient('garlic', garlic),
    ingredient('onion', onions), ingredient('milk', milk),
    ingredient('beans'), ingredient('rice'), ingredient('bread')], { steps: 9 });
  const easy = recipe('Simple project', [ingredient('garlic', garlic)], { steps: 2 });
  const base = rank({ recipes: [hard, easy] });
  const modified = rank({
    recipes: [hard, easy],
    context: { ...context, energyLevel: 'Very low and tired', budgetMode: 'tight budget' },
  });
  const byId = (list: typeof base, id: string) => list.find(item => item.recipeId === id)!.score;
  assert.ok(byId(modified, 'Big project') < byId(base, 'Big project'));
  assert.ok(byId(modified, 'Simple project') < byId(base, 'Simple project'));
});

it('does not recommend meals already selected and rewards shared ingredients', () => {
  const recipes = [
    recipe('Saved dinner', [ingredient('garlic', garlic)]),
    recipe('Overlap', [ingredient('garlic', garlic)]),
    recipe('Different', [ingredient('milk', milk)]),
  ];
  const result = rank({ recipes, selectedRecipeIds: ['Saved dinner'] });
  assert.equal(result.length, 2);
  assert.ok(result.every(item => item.recipeId !== 'Saved dinner'));
  assert.ok(result.find(item => item.recipeId === 'Overlap')!.reasons.some(reason => reason.includes('Shares 1 ingredient')));
});

it('distributes only into empty unlocked slots, prevents duplicates, and supports asking for another', () => {
  const sorted = rank({
    recipes: [
      recipe('Alpha', [ingredient('garlic', garlic)]),
      recipe('Beta', [ingredient('onion', onions)]),
      recipe('Gamma', [ingredient('milk', milk)]),
    ],
  });
  const slots = [
    { id: 'locked', locked: true, recipeId: null },
    { id: 'selected', locked: false, recipeId: 'Alpha' },
    { id: 'open1', locked: false, recipeId: null },
    { id: 'open2', locked: false, recipeId: null },
  ];
  const original = structuredClone(slots);
  const picks = distributeMealSuggestions(slots, sorted);
  assert.equal(picks.locked, undefined);
  assert.equal(picks.selected, undefined);
  assert.equal(picks.open1.recipeId, 'Beta');
  assert.equal(picks.open2.recipeId, 'Gamma');
  const skipped = distributeMealSuggestions(slots, sorted, { open1: ['Beta'] });
  assert.equal(skipped.open1.recipeId, 'Gamma');
  assert.equal(skipped.open2.recipeId, 'Beta');
  const rotated = distributeMealSuggestions(slots, sorted, {}, 2);
  assert.notEqual(rotated.open1.recipeId, picks.open1.recipeId);
  assert.deepEqual(slots, original);
});

it('handles an empty library or no distinct suggestions without invented placeholders', () => {
  assert.deepEqual(rank({}), []);
  assert.deepEqual(distributeMealSuggestions([{ id: 'slot', locked: false, recipeId: null }], []), {});
  const suggestions = rank({ recipes: [recipe('One', [])] });
  assert.deepEqual(distributeMealSuggestions([{ id: 'slot', locked: false, recipeId: null }],
    suggestions, { slot: ['One'] }), {});
});
