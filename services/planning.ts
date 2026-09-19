import 'server-only';

import { isUuid } from '@/domain/recipes/validation';
import { validWeekStart } from '@/domain/planning/weeks';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentHousehold } from '@/services/households';
import { err, ok, type ServiceResult } from '@/services/result';

export type PlanContextInput = {
  energyLevel: string; budgetMode: string; effortLevel: string;
  maxCookingTimeMinutes: string; notes: string;
};
export type PlanSlot = { id: string; position: number; locked: boolean; updatedAt: string; recipeId: string | null };
export type WeeklyPlan = {
  id: string; start: string; mealCount: number; slots: PlanSlot[];
  context: PlanContextInput;
};
export type PlanningView = { plan: WeeklyPlan | null; recipes: { id: string; title: string }[]; week: string };

export async function loadPlanningView(week: string): Promise<ServiceResult<PlanningView>> {
  if (!validWeekStart(week)) return err('validation_error', 'Choose a valid Monday for the plan.');
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const [planResult, recipeResult] = await Promise.all([
    supabase.from('meal_plans').select('id,plan_start_date').eq('household_id', household.data.householdId).eq('plan_start_date', week).maybeSingle(),
    supabase.from('recipes').select('id,title').eq('household_id', household.data.householdId).order('title'),
  ]);
  if (planResult.error || recipeResult.error) return err('unexpected_error', 'The weekly plan could not be loaded.');
  const recipes = recipeResult.data ?? [];
  if (!planResult.data) return ok({ plan: null, recipes, week });
  const [slotResult, contextResult] = await Promise.all([
    supabase.from('meal_plan_slots').select('id,position,locked,updated_at').eq('meal_plan_id', planResult.data.id).order('position'),
    supabase.from('weekly_planning_contexts').select('*').eq('meal_plan_id', planResult.data.id).single(),
  ]);
  if (slotResult.error || contextResult.error || !contextResult.data) return err('unexpected_error', 'The weekly plan could not be loaded.');
  const slotIds = slotResult.data.map(s => s.id);
  const selections = slotIds.length
    ? await supabase.from('meal_plan_selections').select('meal_plan_slot_id,recipe_id').in('meal_plan_slot_id', slotIds)
    : { data: [], error: null };
  if (selections.error) return err('unexpected_error', 'The meals could not be loaded.');
  const recipeBySlot = new Map(selections.data?.map(s => [s.meal_plan_slot_id, s.recipe_id]));
  const c = contextResult.data;
  return ok({ week, recipes, plan: {
    id: planResult.data.id, start: week, mealCount: c.meal_count,
    slots: slotResult.data.map(s => ({ id: s.id, position: s.position, locked: s.locked, updatedAt: s.updated_at, recipeId: recipeBySlot.get(s.id) ?? null })),
    context: {
      energyLevel: c.energy_level ?? '', budgetMode: c.budget_mode ?? '', effortLevel: c.effort_level ?? '',
      maxCookingTimeMinutes: c.max_cooking_time_minutes?.toString() ?? '', notes: c.notes ?? '',
    },
  } });
}

export async function saveManualPlan(week: string, count: number): Promise<ServiceResult<{ id: string }>> {
  if (!validWeekStart(week) || !Number.isInteger(count) || count < 1 || count > 14)
    return err('validation_error', 'Choose a Monday and between 1 and 14 meals.');
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('save_manual_plan', {
    p_household_id: household.data.householdId, p_start: week, p_count: count,
  });
  if (error) return err(error.code === '22023' ? 'validation_error' : 'unexpected_error',
    error.code === '22023' ? 'Remove or unlock meals past the new count first.' : 'The meal count could not be saved.');
  return ok({ id: data });
}

export async function selectManualRecipe(slotId: string, recipeId: string | null): Promise<ServiceResult<{ changed: true }>> {
  if (!isUuid(slotId) || (recipeId !== null && !isUuid(recipeId)))
    return err('validation_error', 'Choose a valid meal and recipe.');
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('set_manual_plan_recipe', { p_slot_id: slotId, p_recipe_id: recipeId });
  if (error) return err(error.code === '22023' ? 'validation_error' : 'unexpected_error',
    error.code === '22023' ? 'This meal is locked or the recipe is unavailable.' : 'The meal could not be saved.');
  return ok({ changed: true });
}

export async function setManualSlotLock(slotId: string, updatedAt: string, locked: boolean): Promise<ServiceResult<{ changed: true }>> {
  if (!isUuid(slotId) || !updatedAt || typeof locked !== 'boolean')
    return err('validation_error', 'Choose a valid meal.');
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('meal_plan_slots').update({ locked })
    .eq('id', slotId).eq('updated_at', updatedAt)
    .in('meal_plan_id', (await supabase.from('meal_plans').select('id').eq('household_id', household.data.householdId)).data?.map(p => p.id) ?? [])
    .select('id').maybeSingle();
  if (error) return err('unexpected_error', 'The lock could not be changed.');
  if (!data) return err('conflict', 'This meal changed elsewhere. Reload and try again.');
  return ok({ changed: true });
}

export async function savePlanningContext(planId: string, input: PlanContextInput): Promise<ServiceResult<{ changed: true }>> {
  if (!isUuid(planId) || !input ||
    [input.energyLevel, input.budgetMode, input.effortLevel, input.maxCookingTimeMinutes, input.notes].some(value => typeof value !== 'string') ||
    input.notes.length > 1000 || [input.energyLevel, input.budgetMode, input.effortLevel].some(v => v.length > 80))
    return err('validation_error', 'Check your planning notes and choices.');
  const minutes = input.maxCookingTimeMinutes.trim();
  if (minutes !== '' && (!/^\d+$/.test(minutes) || Number(minutes) > 1440))
    return err('validation_error', 'Cooking time must be in minutes, up to 1440.');
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('weekly_planning_contexts').update({
    energy_level: input.energyLevel.trim() || null, budget_mode: input.budgetMode.trim() || null,
    effort_level: input.effortLevel.trim() || null, max_cooking_time_minutes: minutes ? Number(minutes) : null,
    notes: input.notes.trim() || null,
  }).eq('meal_plan_id', planId)
    .in('meal_plan_id', (await supabase.from('meal_plans').select('id').eq('household_id', household.data.householdId)).data?.map(p => p.id) ?? [])
    .select('meal_plan_id').maybeSingle();
  if (error || !data) return err('unexpected_error', 'Planning notes could not be saved.');
  return ok({ changed: true });
}
