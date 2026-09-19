'use server';

import { revalidatePath } from 'next/cache';
import { saveManualPlan, savePlanningContext, selectManualRecipe, setManualSlotLock, type PlanContextInput } from '@/services/planning';
import { approvePlanShoppingItems, getPlanShoppingReview, type PlanShoppingApprovalOrigin } from '@/services/plan-shopping';

export async function savePlanAction(week: string, count: number) {
  const result = await saveManualPlan(week, count);
  if (result.ok) revalidatePath('/plan');
  return result;
}
export async function selectMealAction(slotId: string, recipeId: string | null) {
  const result = await selectManualRecipe(slotId, recipeId);
  if (result.ok) revalidatePath('/plan');
  return result;
}
export async function lockMealAction(slotId: string, updatedAt: string, locked: boolean) {
  const result = await setManualSlotLock(slotId, updatedAt, locked);
  if (result.ok) revalidatePath('/plan');
  return result;
}
export async function saveContextAction(planId: string, input: PlanContextInput) {
  const result = await savePlanningContext(planId, input);
  if (result.ok) revalidatePath('/plan');
  return result;
}

export async function reviewPlanShoppingAction(planId: string) {
  return getPlanShoppingReview(planId);
}

export async function approvePlanShoppingAction(planId: string, origins: PlanShoppingApprovalOrigin[]) {
  const result = await approvePlanShoppingItems(planId, origins);
  if (result.ok && result.data.changed) {
    revalidatePath('/plan');
    revalidatePath('/shopping');
  }
  return result;
}
