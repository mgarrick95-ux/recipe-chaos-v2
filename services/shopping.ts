import 'server-only';

import type { ShoppingDraft, ShoppingItem } from '@/domain/shopping/types';
import { isUuid } from '@/domain/recipes/validation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentHousehold } from '@/services/households';
import { suggestIngredientMatch } from '@/services/ingredients';
import { err, ok, type ServiceResult } from '@/services/result';

type ShoppingRow = {
  id: string;
  canonical_ingredient_id: string | null;
  display_name: string;
  quantity: number | string | null;
  unit: string | null;
  intention: ShoppingItem['intention'];
  source_type: ShoppingItem['sourceType'];
  source_id: string | null;
  source_slot_id: string | null;
  source_recipe_ingredient_id: string | null;
  is_checked: boolean;
  created_at: string;
  updated_at: string;
};

function mapShoppingItem(row: ShoppingRow): ShoppingItem {
  return {
    id: row.id,
    canonicalIngredientId: row.canonical_ingredient_id,
    displayName: row.display_name,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    intention: row.intention,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceSlotId: row.source_slot_id,
    sourceRecipeIngredientId: row.source_recipe_ingredient_id,
    isChecked: row.is_checked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function reportShoppingError(operation: string, error: { code?: string; message?: string } | null): void {
  console.error(`[shopping] ${operation} failed`, { code: error?.code, message: error?.message });
}

async function certainCanonicalId(displayName: string): Promise<string | null> {
  const suggestion = await suggestIngredientMatch(displayName);
  if (!suggestion.ok || suggestion.data.confidence !== 'certain' || !suggestion.data.match) return null;
  return suggestion.data.match.canonicalIngredientId;
}

export async function listShoppingItems(): Promise<ServiceResult<ShoppingItem[]>> {
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('shopping_items').select('*')
    .eq('household_id', household.data.householdId)
    .is('deleted_at', null)
    .order('is_checked', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    reportShoppingError('list', error);
    return err('unexpected_error', 'Your shopping list could not be loaded.');
  }
  return ok((data as ShoppingRow[]).map(mapShoppingItem));
}

export async function createShoppingItem(draft: ShoppingDraft): Promise<ServiceResult<ShoppingItem>> {
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('shopping_items').insert({
    household_id: household.data.householdId,
    canonical_ingredient_id: await certainCanonicalId(draft.displayName),
    display_name: draft.displayName,
    quantity: draft.quantity,
    unit: draft.unit,
    intention: draft.intention,
    source_type: 'manual',
    source_id: null,
    created_by: household.data.userId,
  }).select('*').single();
  if (error || !data) {
    reportShoppingError('create', error);
    return err('unexpected_error', 'That item could not be added to your shopping list.');
  }
  return ok(mapShoppingItem(data as ShoppingRow));
}

export async function updateShoppingItem(
  itemId: string, expectedUpdatedAt: string, draft: ShoppingDraft,
): Promise<ServiceResult<ShoppingItem>> {
  if (!isUuid(itemId) || !expectedUpdatedAt) return err('validation_error', 'A valid item and edit token are required.');
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('shopping_items').update({
    canonical_ingredient_id: await certainCanonicalId(draft.displayName),
    display_name: draft.displayName,
    quantity: draft.quantity,
    unit: draft.unit,
    intention: draft.intention,
  }).eq('household_id', household.data.householdId)
    .eq('id', itemId).eq('updated_at', expectedUpdatedAt).is('deleted_at', null)
    .select('*').maybeSingle();
  if (error) {
    reportShoppingError('update', error);
    return err('unexpected_error', 'That shopping item could not be saved.');
  }
  if (!data) return err('conflict', 'This shopping item changed somewhere else. Reload and try again.');
  return ok(mapShoppingItem(data as ShoppingRow));
}

export async function setShoppingChecked(
  itemId: string, expectedUpdatedAt: string, checked: boolean,
): Promise<ServiceResult<ShoppingItem>> {
  if (!isUuid(itemId) || !expectedUpdatedAt || typeof checked !== 'boolean') {
    return err('validation_error', 'A valid item and checked state are required.');
  }
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('shopping_items').update({ is_checked: checked })
    .eq('household_id', household.data.householdId).eq('id', itemId)
    .eq('updated_at', expectedUpdatedAt).is('deleted_at', null)
    .select('*').maybeSingle();
  if (error) {
    reportShoppingError('check', error);
    return err('unexpected_error', 'That shopping item could not be updated.');
  }
  if (!data) return err('conflict', 'This shopping item changed somewhere else. Reload and try again.');
  return ok(mapShoppingItem(data as ShoppingRow));
}

export async function removeShoppingItem(
  itemId: string, expectedUpdatedAt: string,
): Promise<ServiceResult<{ id: string }>> {
  if (!isUuid(itemId) || !expectedUpdatedAt) return err('validation_error', 'A valid item and edit token are required.');
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('shopping_items').update({ deleted_at: new Date().toISOString() })
    .eq('household_id', household.data.householdId).eq('id', itemId)
    .eq('updated_at', expectedUpdatedAt).is('deleted_at', null)
    .select('id').maybeSingle();
  if (error) {
    reportShoppingError('remove', error);
    return err('unexpected_error', 'That shopping item could not be removed.');
  }
  if (!data) return err('conflict', 'This shopping item changed somewhere else. Reload and try again.');
  return ok({ id: data.id });
}

export async function clearCheckedShopping(): Promise<ServiceResult<{ count: number }>> {
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('shopping_items').update({ deleted_at: new Date().toISOString() })
    .eq('household_id', household.data.householdId).eq('is_checked', true).is('deleted_at', null)
    .select('id');
  if (error) {
    reportShoppingError('clear checked', error);
    return err('unexpected_error', 'Checked shopping items could not be cleared.');
  }
  return ok({ count: data?.length ?? 0 });
}
