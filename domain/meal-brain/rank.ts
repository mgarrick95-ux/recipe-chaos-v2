import { normalizeIngredientName } from '../ingredients/normalize.ts';
import { sameIngredient } from '../planning/shopping-review.ts';
import type { RecipeMatchingContext } from '../recipes/ingredients.ts';
import type { VerificationState } from '../recipes/types.ts';

export type BrainIngredient = {
  ingredientText: string;
  canonicalIngredientId: string | null;
  verificationState: VerificationState;
  optional: boolean;
};
export type BrainRecipe = {
  id: string;
  title: string;
  isFavorite: boolean;
  stepCount: number;
  ingredients: BrainIngredient[];
};
export type BrainInventory = {
  displayName: string;
  canonicalIngredientId: string | null;
  quantity: number | null;
  isOutOfStock: boolean;
  useSoonStatus: 'normal' | 'use_soon';
  expiryDate: string | null;
};
export type BrainShopping = {
  displayName: string;
  canonicalIngredientId: string | null;
};
export type BrainContext = {
  energyLevel: string;
  effortLevel: string;
  budgetMode: string;
  maxCookingTimeMinutes: string;
};
export type BrainSuggestion = {
  recipeId: string;
  title: string;
  score: number;
  pantryCount: number;
  useSoonCount: number;
  alreadyShoppingCount: number;
  missingCount: number;
  needsReviewCount: number;
  reasons: string[];
};
export type BrainSlot = { id: string; locked: boolean; recipeId: string | null };

export type RankMealInput = {
  recipes: readonly BrainRecipe[];
  inventory: readonly BrainInventory[];
  shopping: readonly BrainShopping[];
  matchingContext: RecipeMatchingContext;
  selectedRecipeIds: readonly string[];
  context: BrainContext;
  todayIso: string;
};

function ingredientKey(item: BrainIngredient): string | null {
  if (item.verificationState !== 'verified') return null;
  if (item.canonicalIngredientId) return 'canonical:' + item.canonicalIngredientId;
  const normalized = normalizeIngredientName(item.ingredientText);
  return normalized ? 'text:' + normalized : null;
}

function relevantWords(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US');
}

function isTightBudget(context: BrainContext): boolean {
  return /\b(tight|low|cheap|inexpensive|frugal|save|saving|stretch)\b|\bon a budget\b|\bbudget conscious\b/u.test(relevantWords(context.budgetMode));
}

function wantsEasy(context: BrainContext): boolean {
  return /\b(low|tired|exhausted|simple|easy|quick|minimal|light|short|busy|little)\b/u.test(
    relevantWords(context.energyLevel + ' ' + context.effortLevel),
  );
}

function soonWindow(todayIso: string): string {
  const date = new Date(todayIso + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + 3);
  return date.toISOString().slice(0, 10);
}

function wordCount(value: number, singular: string): string {
  return value + ' ' + singular + (value === 1 ? '' : 's');
}

/**
 * Pure, conservative suggestions. Ingredient presence is NOT quantity coverage;
 * unreviewed names are NEVER treated as verified pantry matches.
 * Recipe times and prices do not exist in the V2 recipe model: don't invent them.
 */
export function rankMealSuggestions(input: RankMealInput): BrainSuggestion[] {
  const selected = new Set(input.selectedRecipeIds);
  const available = input.inventory.filter(item =>
    !item.isOutOfStock && item.quantity !== 0 &&
    (!item.expiryDate || item.expiryDate >= input.todayIso));
  const selectedKeys = new Set(input.recipes.filter(recipe => selected.has(recipe.id))
    .flatMap(recipe => recipe.ingredients.map(ingredientKey))
    .filter((key): key is string => Boolean(key)));
  const easyWeek = wantsEasy(input.context);
  const tightBudget = isTightBudget(input.context);
  const soonThrough = soonWindow(input.todayIso);
  const canonicalIds = new Set(input.matchingContext.canonicalIngredients.map(item => item.id));

  return input.recipes.filter(recipe => !selected.has(recipe.id)).map(recipe => {
    let pantryCount = 0;
    let useSoonCount = 0;
    let alreadyShoppingCount = 0;
    let missingCount = 0;
    let needsReviewCount = 0;
    let overlapCount = 0;
    const required = recipe.ingredients.filter(item => !item.optional);

    for (const ingredient of required) {
      const key = ingredientKey(ingredient);
      if (!key || (ingredient.canonicalIngredientId && !canonicalIds.has(ingredient.canonicalIngredientId))) {
        needsReviewCount++;
        continue;
      }
      if (selectedKeys.has(key)) overlapCount++;
      const normalized = normalizeIngredientName(ingredient.ingredientText);
      const pantryMatches = available.filter(item => sameIngredient(
        ingredient.canonicalIngredientId, normalized, item.canonicalIngredientId,
        item.displayName, input.matchingContext,
      ));
      if (pantryMatches.length) {
        pantryCount++;
        if (pantryMatches.some(item =>
          item.useSoonStatus === 'use_soon' ||
          Boolean(item.expiryDate && item.expiryDate <= soonThrough))) {
          useSoonCount++;
        }
        continue;
      }
      if (input.shopping.some(item => sameIngredient(
        ingredient.canonicalIngredientId, normalized, item.canonicalIngredientId,
        item.displayName, input.matchingContext,
      ))) {
        alreadyShoppingCount++;
        continue;
      }
      missingCount++;
    }

    // A recipe with no ingredients is NOT a perfect pantry match.
    let score = recipe.isFavorite ? 10 : 0;
    score += pantryCount * 6 + useSoonCount * 9 + alreadyShoppingCount * 3;
    score -= missingCount * (tightBudget ? 9 : 5);
    score -= needsReviewCount * 3;
    score += overlapCount * 3;
    if (easyWeek) score -= Math.max(0, required.length - 5) * 2 + Math.max(0, recipe.stepCount - 3) * 3;
    if (required.length === 0) score -= 24;
    if (recipe.stepCount === 0) score -= 4;

    const reasons: string[] = [];
    if (useSoonCount) reasons.push('Uses ' + wordCount(useSoonCount, 'ingredient') + ' marked use soon.');
    if (pantryCount) reasons.push(wordCount(pantryCount, 'ingredient') + ' match FrostPantry (amounts not checked).');
    if (alreadyShoppingCount) reasons.push(wordCount(alreadyShoppingCount, 'ingredient') + ' already on Shopping.');
    if (overlapCount) reasons.push('Shares ' + wordCount(overlapCount, 'ingredient') + ' with selected meals.');
    if (recipe.isFavorite) reasons.push('One of your Keepers.');
    if (easyWeek && required.length <= 5 && recipe.stepCount <= 3 && recipe.stepCount > 0) {
      reasons.push('Fewer recorded steps for a lower-effort week.');
    }
    if (missingCount) reasons.push(wordCount(missingCount, 'ingredient') + ' not found in FrostPantry or Shopping.');
    if (needsReviewCount) reasons.push(wordCount(needsReviewCount, 'ingredient') + (needsReviewCount === 1 ? ' still needs identity review.' : ' still need identity review.'));
    if (!required.length) reasons.push('No required ingredients recorded yet.');
    if (!reasons.length) reasons.push('Another idea from your recipe box.');

    return {
      recipeId: recipe.id, title: recipe.title, score, pantryCount, useSoonCount,
      alreadyShoppingCount, missingCount, needsReviewCount, reasons,
    };
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.recipeId.localeCompare(b.recipeId));
}

/** Assign suggestions only to empty, unlocked slots. Nothing is persisted. */
export function distributeMealSuggestions(
  slots: readonly BrainSlot[],
  ranked: readonly BrainSuggestion[],
  skippedBySlot: Readonly<Record<string, readonly string[]>> = {},
  rotateBy = 0,
): Record<string, BrainSuggestion> {
  const occupied = new Set(slots.map(slot => slot.recipeId).filter((id): id is string => id !== null));
  const result: Record<string, BrainSuggestion> = {};
  if (!ranked.length) return result;
  const offset = ((Math.trunc(rotateBy) % ranked.length) + ranked.length) % ranked.length;
  const rotated = [...ranked.slice(offset), ...ranked.slice(0, offset)];
  for (const slot of slots) {
    if (slot.locked || slot.recipeId) continue;
    const skipped = new Set(skippedBySlot[slot.id] ?? []);
    const proposal = rotated.find(recipe => !occupied.has(recipe.recipeId) && !skipped.has(recipe.recipeId));
    if (!proposal) continue;
    result[slot.id] = proposal;
    occupied.add(proposal.recipeId);
  }
  return result;
}
