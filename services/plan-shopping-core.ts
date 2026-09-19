import { planIngredientOriginKey, type PlanShoppingReviewRow } from '../domain/planning/shopping-review.ts';

export type PlanShoppingApprovalOrigin = { slotId: string; recipeIngredientId: string };
export type PlanShoppingApprovalOutcome =
  | 'added'
  | 'already_in_pantry'
  | 'already_manual'
  | 'already_plan'
  | 'stale_or_invalid';
export type PlanShoppingApprovalResult = {
  changed: boolean;
  outcomes: Array<PlanShoppingApprovalOrigin & { outcome: PlanShoppingApprovalOutcome }>;
  counts: Record<PlanShoppingApprovalOutcome, number>;
};

export async function approvePlanShoppingReview(
  review: PlanShoppingReviewRow[],
  requested: PlanShoppingApprovalOrigin[],
  persist: (eligible: PlanShoppingApprovalOrigin[]) => Promise<Array<PlanShoppingApprovalOrigin & { outcome: 'added' | 'already_plan' | 'stale_or_invalid' }>>,
): Promise<PlanShoppingApprovalResult> {
  const rowsByOrigin = new Map(review.map((row) => [row.originKey, row]));
  const uniqueRequested = [...new Map(requested.map((origin) => [planIngredientOriginKey(origin), origin])).values()];
  const outcomes: PlanShoppingApprovalResult['outcomes'] = [];
  const eligible: PlanShoppingApprovalOrigin[] = [];

  for (const origin of uniqueRequested) {
    const row = rowsByOrigin.get(planIngredientOriginKey(origin));
    if (!row) outcomes.push({ ...origin, outcome: 'stale_or_invalid' });
    else if (row.status === 'covered_by_pantry') outcomes.push({ ...origin, outcome: 'already_in_pantry' });
    else if (row.status === 'already_manual') outcomes.push({ ...origin, outcome: 'already_manual' });
    else if (row.status === 'already_plan') outcomes.push({ ...origin, outcome: 'already_plan' });
    else eligible.push(origin);
  }

  if (eligible.length > 0) outcomes.push(...await persist(eligible));

  const counts: PlanShoppingApprovalResult['counts'] = {
    added: 0,
    already_in_pantry: 0,
    already_manual: 0,
    already_plan: 0,
    stale_or_invalid: 0,
  };
  for (const outcome of outcomes) counts[outcome.outcome] += 1;
  return { changed: counts.added > 0, outcomes, counts };
}
