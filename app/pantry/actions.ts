'use server';

import { revalidatePath } from "next/cache";
import { buildManualInventory } from "@/domain/inventory/manual-entry";
import type { ManualInventoryInput } from "@/domain/inventory/types";
import { createInventoryItem, deleteInventoryItem, updateInventoryItem } from "@/services/inventory";
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

export async function deleteInventoryAction(itemId: string, expectedUpdatedAt: string, confirmed: boolean) {
  if (!confirmed) return err("validation_error", "Confirm removal first.");
  const result = await deleteInventoryItem(itemId, expectedUpdatedAt);
  if (result.ok) revalidatePath("/pantry");
  return result;
}
