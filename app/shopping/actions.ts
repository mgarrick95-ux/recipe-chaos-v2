'use server';

import { revalidatePath } from 'next/cache';
import { buildManualShopping } from '@/domain/shopping/manual-entry';
import type { ShoppingInput } from '@/domain/shopping/types';
import {
  clearCheckedShopping, createShoppingItem, removeShoppingItem,
  setShoppingChecked, updateShoppingItem,
} from '@/services/shopping';
import { err } from '@/services/result';

export async function addShoppingAction(input: ShoppingInput) {
  let draft;
  try { draft = buildManualShopping(input); }
  catch { return err('validation_error', 'Check the item name, quantity, and unit before adding.'); }
  const result = await createShoppingItem(draft);
  if (result.ok) revalidatePath('/shopping');
  return result;
}

export async function editShoppingAction(itemId: string, expectedUpdatedAt: string, input: ShoppingInput) {
  let draft;
  try { draft = buildManualShopping(input); }
  catch { return err('validation_error', 'Check the item name, quantity, and unit before saving.'); }
  const result = await updateShoppingItem(itemId, expectedUpdatedAt, draft);
  if (result.ok) revalidatePath('/shopping');
  return result;
}

export async function checkShoppingAction(itemId: string, expectedUpdatedAt: string, checked: boolean) {
  const result = await setShoppingChecked(itemId, expectedUpdatedAt, checked);
  if (result.ok) revalidatePath('/shopping');
  return result;
}

export async function removeShoppingAction(itemId: string, expectedUpdatedAt: string, confirmed: boolean) {
  if (!confirmed) return err('validation_error', 'Confirm removal first.');
  const result = await removeShoppingItem(itemId, expectedUpdatedAt);
  if (result.ok) revalidatePath('/shopping');
  return result;
}

export async function clearCheckedShoppingAction(confirmed: boolean) {
  if (!confirmed) return err('validation_error', 'Confirm clearing checked items first.');
  const result = await clearCheckedShopping();
  if (result.ok && result.data.count > 0) revalidatePath('/shopping');
  return result;
}
