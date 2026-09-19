import { normalizeIngredientName } from '../ingredients/normalize.ts';
import { isKeptSeparate } from '../ingredients/match.ts';
import type { RecipeMatchingContext } from '../recipes/ingredients.ts';
import type { VerificationState } from '../recipes/types.ts';

export type PlanIngredientOrigin = {
  planId: string;
  slotId: string;
  selectionId: string;
  recipeId: string;
  recipeTitle: string;
  recipeIngredientId: string;
  originalText: string;
  ingredientText: string;
  canonicalIngredientId: string | null;
  verificationState: VerificationState;
  optional: boolean;
};

export type ReviewInventoryItem = {
  id: string;
  displayName: string;
  canonicalIngredientId: string | null;
  quantity: number | null;
  isOutOfStock: boolean;
};

export type ReviewShoppingItem = {
  id: string;
  displayName: string;
  canonicalIngredientId: string | null;
  sourceType: 'manual' | 'plan';
  sourceId: string | null;
  sourceSlotId: string | null;
  sourceRecipeIngredientId: string | null;
  isChecked: boolean;
  deletedAt?: string | null;
};

export type PlanShoppingReviewStatus =
  | 'covered_by_pantry'
  | 'already_manual'
  | 'already_plan'
  | 'missing'
  | 'uncertain'
  | 'optional';

export type PlanShoppingReviewRow = PlanIngredientOrigin & {
  originKey: string;
  status: PlanShoppingReviewStatus;
  explanation: string;
  matchingShoppingItemId: string | null;
  matchingShoppingSource: 'manual' | 'plan' | null;
  eligibleForAddition: boolean;
  defaultSelected: boolean;
};

export type PlanShoppingReviewInput = {
  ingredients: PlanIngredientOrigin[];
  inventory: ReviewInventoryItem[];
  shopping: ReviewShoppingItem[];
  matchingContext: RecipeMatchingContext;
};

export function planIngredientOriginKey(origin: Pick<PlanIngredientOrigin, 'slotId' | 'recipeIngredientId'>): string {
  return `${origin.slotId}:${origin.recipeIngredientId}`;
}

export function derivePlanShoppingReview({
  ingredients,
  inventory,
  shopping,
  matchingContext,
}: PlanShoppingReviewInput): PlanShoppingReviewRow[] {
  return ingredients.map((ingredient) => {
    const activeShopping = shopping.filter(isActiveShoppingItem);
    const base = {
      ...ingredient,
      originKey: planIngredientOriginKey(ingredient),
      matchingShoppingItemId: null,
      matchingShoppingSource: null,
      eligibleForAddition: false,
      defaultSelected: false,
    } satisfies Omit<PlanShoppingReviewRow, 'status' | 'explanation'>;

    const normalizedAuthoredText = normalizeIngredientName(ingredient.originalText);
    const exactManualTextMatch = activeShopping.find((item) => item.sourceType === 'manual'
      && normalizedAuthoredText.length > 0
      && normalizeIngredientName(item.displayName) === normalizedAuthoredText);
    if (ingredient.verificationState !== 'verified' && exactManualTextMatch) {
      return {
        ...base,
        status: 'already_manual',
        explanation: 'Already on your list. The manual item will stay separate and unchanged.',
        matchingShoppingItemId: exactManualTextMatch.id,
        matchingShoppingSource: 'manual',
      };
    }

    const exactOrigin = activeShopping.find((item) => item.sourceType === 'plan'
      && item.sourceId === ingredient.planId
      && item.sourceSlotId === ingredient.slotId
      && item.sourceRecipeIngredientId === ingredient.recipeIngredientId);
    if (exactOrigin) {
      return {
        ...base,
        status: 'already_plan',
        explanation: 'This planned ingredient was already added to Shopping.',
        matchingShoppingItemId: exactOrigin.id,
        matchingShoppingSource: 'plan',
      };
    }

    if (ingredient.verificationState !== 'verified') {
      return {
        ...base,
        status: ingredient.optional ? 'optional' : 'uncertain',
        explanation: ingredient.optional
          ? 'This ingredient is optional and its identity is uncertain. Add it only if you want it.'
          : ingredient.verificationState === 'needs_review'
            ? 'Its ingredient identity needs review, so Recipe Chaos cannot safely compare it yet.'
            : 'This authored ingredient has not been reviewed, so Recipe Chaos will not guess what it matches.',
        eligibleForAddition: true,
      };
    }

    const canonicalId = ingredient.canonicalIngredientId;
    if (canonicalId && !matchingContext.canonicalIngredients.some((candidate) => candidate.id === canonicalId)) {
      return {
        ...base,
        status: ingredient.optional ? 'optional' : 'uncertain',
        explanation: ingredient.optional
          ? 'This ingredient is optional and its saved identity is unavailable. Add it only if you want it.'
          : 'Its saved ingredient identity is unavailable, so it needs review before comparison.',
        eligibleForAddition: true,
      };
    }

    const normalizedText = normalizeIngredientName(ingredient.ingredientText);
    if (!canonicalId && !normalizedText) {
      return {
        ...base,
        status: ingredient.optional ? 'optional' : 'uncertain',
        explanation: ingredient.optional
          ? 'This optional ingredient cannot be identified safely. Add it only if you want it.'
          : 'Recipe Chaos cannot identify this ingredient safely.',
        eligibleForAddition: true,
      };
    }

    const inventoryMatch = inventory.find((item) => isAvailableInventory(item) && sameIngredient(
      canonicalId,
      normalizedText,
      item.canonicalIngredientId,
      item.displayName,
      matchingContext,
    ));
    if (inventoryMatch) {
      return {
        ...base,
        status: 'covered_by_pantry',
        explanation: `FrostPantry already has ${inventoryMatch.displayName}.`,
      };
    }

    const shoppingMatches = activeShopping.filter((item) => sameIngredient(
      canonicalId,
      normalizedText,
      item.canonicalIngredientId,
      item.displayName,
      matchingContext,
    ));
    const manualMatch = shoppingMatches.find((item) => item.sourceType === 'manual');
    if (manualMatch) {
      return {
        ...base,
        status: 'already_manual',
        explanation: 'Already on your list. The manual item will stay separate and unchanged.',
        matchingShoppingItemId: manualMatch.id,
        matchingShoppingSource: 'manual',
      };
    }

    if (ingredient.optional) {
      return {
        ...base,
        status: 'optional',
        explanation: 'This ingredient is marked optional and is not already covered. Add it only if you want it.',
        eligibleForAddition: true,
      };
    }

    return {
      ...base,
      status: 'missing',
      explanation: canonicalId
        ? 'No active FrostPantry or Shopping item has the same verified ingredient identity.'
        : 'No active FrostPantry or Shopping item has the same exact ingredient name.',
      eligibleForAddition: true,
      defaultSelected: true,
    };
  });
}

function isActiveShoppingItem(item: ReviewShoppingItem): boolean {
  return item.deletedAt === null || item.deletedAt === undefined;
}

function isAvailableInventory(item: ReviewInventoryItem): boolean {
  return !item.isOutOfStock && item.quantity !== 0;
}

function sameIngredient(
  recipeCanonicalId: string | null,
  normalizedRecipeText: string,
  candidateCanonicalId: string | null,
  candidateDisplayName: string,
  matchingContext: RecipeMatchingContext,
): boolean {
  if (recipeCanonicalId && candidateCanonicalId) return candidateCanonicalId === recipeCanonicalId;
  if (candidateCanonicalId && isKeptSeparate(
    normalizedRecipeText,
    candidateCanonicalId,
    matchingContext.separationRules ?? [],
    matchingContext.householdId,
  )) return false;
  return normalizedRecipeText.length > 0
    && normalizeIngredientName(candidateDisplayName) === normalizedRecipeText;
}
