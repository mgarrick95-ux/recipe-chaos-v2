'use server';

import { revalidatePath } from "next/cache";
import { buildManualInventory } from "@/domain/inventory/manual-entry";
import type { ManualInventoryDraft, ManualInventoryInput } from "@/domain/inventory/types";
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItem,
  updateInventoryItem,
} from "@/services/inventory";
import { err } from "@/services/result";

export async function saveInventoryAction(
  input: ManualInventoryInput,
  edit?: { itemId: string; expectedUpdatedAt: string },
) {
  let draft;
  try {
    draft = buildManualInventory(input);
  } catch {
    return err("validation_error", "Check the item name, quantity, dates, and storage location before saving.");
  }
  const result = edit
    ? await updateInventoryItem(edit.itemId, edit.expectedUpdatedAt, draft)
    : await createInventoryItem(draft);
  if (result.ok) {
    revalidatePath("/pantry");
    revalidatePath(`/pantry/${result.data.id}/edit`);
  }
  return result;
}

export async function setInventoryStockAction(
  itemId: string,
  expectedUpdatedAt: string,
  isOutOfStock: boolean,
) {
  const current = await getInventoryItem(itemId);
  if (!current.ok) return current;
  if (current.data.updatedAt !== expectedUpdatedAt) {
    return err("conflict", "This FrostPantry item changed somewhere else. Reload before updating stock.");
  }

  const draft: ManualInventoryDraft = {
    displayName: current.data.displayName,
    quantity: current.data.quantity,
    unit: current.data.unit,
    location: current.data.location,
    purchaseDate: current.data.purchaseDate,
    storageDate: current.data.storageDate,
    expiryDate: current.data.expiryDate,
    useSoonStatus: current.data.useSoonStatus,
    isOutOfStock,
    isStaple: current.data.isStaple,
    notes: current.data.notes,
  };

  const result = await updateInventoryItem(itemId, expectedUpdatedAt, draft);
  if (result.ok) {
    revalidatePath("/pantry");
    revalidatePath(`/pantry/${result.data.id}/edit`);
  }
  return result;
}

export async function deleteInventoryAction(itemId: string, expectedUpdatedAt: string, confirmed: boolean) {
  if (!confirmed) return err("validation_error", "Confirm removal first.");
  const result = await deleteInventoryItem(itemId, expectedUpdatedAt);
  if (result.ok) revalidatePath("/pantry");
  return result;
}
