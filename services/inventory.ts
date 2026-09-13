import "server-only";

import { isSameInventoryIdentity } from "@/domain/inventory/duplicates";
import type { InventoryItem, InventoryLocation, ManualInventoryDraft } from "@/domain/inventory/types";
import { isUuid } from "@/domain/recipes/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/services/households";
import { suggestIngredientMatch } from "@/services/ingredients";
import { err, ok, type ServiceResult } from "@/services/result";

type InventoryRow = {
  id: string;
  household_id: string;
  canonical_ingredient_id: string | null;
  display_name: string;
  quantity: number | string | null;
  unit: string | null;
  location: InventoryItem["location"];
  purchase_date: string | null;
  storage_date: string | null;
  expiry_date: string | null;
  use_soon_status: InventoryItem["useSoonStatus"];
  is_out_of_stock: boolean;
  is_staple: boolean;
  source_type: InventoryItem["sourceType"];
  source_id: string | null;
  user_overridden: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export async function listInventory(): Promise<ServiceResult<InventoryItem[]>> {
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("household_id", household.data.householdId)
    .is("deleted_at", null)
    .order("use_soon_status", { ascending: false })
    .order("location", { ascending: true })
    .order("display_name", { ascending: true });
  if (error) {
    reportInventoryError("list", error);
    return err("unexpected_error", "FrostPantry could not be loaded.");
  }
  return ok((data as InventoryRow[]).map(mapInventoryItem));
}

export async function findInventoryDuplicate(
  displayName: string,
  location: InventoryLocation,
): Promise<ServiceResult<InventoryItem | null>> {
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("household_id", household.data.householdId)
    .eq("location", location)
    .is("deleted_at", null)
    .order("display_name", { ascending: true });

  if (error) {
    reportInventoryError("find duplicate", error);
    return err("unexpected_error", "FrostPantry could not check for an existing item.");
  }

  const duplicate = (data as InventoryRow[])
    .map(mapInventoryItem)
    .find((item) => isSameInventoryIdentity(item, displayName, location)) ?? null;

  return ok(duplicate);
}

export async function getInventoryItem(itemId: string): Promise<ServiceResult<InventoryItem>> {
  if (!isUuid(itemId)) return err("validation_error", "A valid inventory item ID is required.");
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("household_id", household.data.householdId)
    .eq("id", itemId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    reportInventoryError("get", error);
    return err("unexpected_error", "That FrostPantry item could not be loaded.");
  }
  if (!data) return err("not_found", "Inventory item not found.");
  return ok(mapInventoryItem(data as InventoryRow));
}

export async function createInventoryItem(draft: ManualInventoryDraft): Promise<ServiceResult<InventoryItem>> {
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const canonicalIngredientId = await certainCanonicalId(draft.displayName);
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      household_id: household.data.householdId,
      canonical_ingredient_id: canonicalIngredientId,
      display_name: draft.displayName,
      quantity: draft.quantity,
      unit: draft.unit,
      location: draft.location,
      purchase_date: draft.purchaseDate,
      storage_date: draft.storageDate,
      expiry_date: draft.expiryDate,
      use_soon_status: draft.useSoonStatus,
      is_out_of_stock: draft.isOutOfStock,
      is_staple: draft.isStaple,
      source_type: "manual",
      source_id: null,
      user_overridden: true,
      notes: draft.notes,
      created_by: household.data.userId,
    })
    .select("*")
    .single();
  if (error || !data) {
    reportInventoryError("create", error ?? { message: "No created row returned." });
    return err("unexpected_error", "That item could not be added to FrostPantry.");
  }
  return ok(mapInventoryItem(data as InventoryRow));
}

export async function updateInventoryItem(
  itemId: string,
  expectedUpdatedAt: string,
  draft: ManualInventoryDraft,
): Promise<ServiceResult<InventoryItem>> {
  if (!isUuid(itemId) || !expectedUpdatedAt) return err("validation_error", "A valid inventory item and edit token are required.");
  const current = await getInventoryItem(itemId);
  if (!current.ok) return current;
  if (current.data.updatedAt !== expectedUpdatedAt) return err("conflict", "This FrostPantry item changed somewhere else. Reload before saving again.");

  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const canonicalIngredientId = current.data.displayName === draft.displayName
    ? current.data.canonicalIngredientId
    : await certainCanonicalId(draft.displayName);

  const { data, error } = await supabase
    .from("inventory_items")
    .update({
      canonical_ingredient_id: canonicalIngredientId,
      display_name: draft.displayName,
      quantity: draft.quantity,
      unit: draft.unit,
      location: draft.location,
      purchase_date: draft.purchaseDate,
      storage_date: draft.storageDate,
      expiry_date: draft.expiryDate,
      use_soon_status: draft.useSoonStatus,
      is_out_of_stock: draft.isOutOfStock,
      is_staple: draft.isStaple,
      source_type: "manual",
      source_id: null,
      user_overridden: true,
      notes: draft.notes,
    })
    .eq("household_id", household.data.householdId)
    .eq("id", itemId)
    .eq("updated_at", expectedUpdatedAt)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) {
    reportInventoryError("update", error);
    return err("unexpected_error", "That FrostPantry item could not be saved.");
  }
  if (!data) return err("conflict", "This FrostPantry item changed somewhere else. Reload before saving again.");
  return ok(mapInventoryItem(data as InventoryRow));
}

export async function deleteInventoryItem(itemId: string, expectedUpdatedAt: string): Promise<ServiceResult<{ id: string }>> {
  if (!isUuid(itemId) || !expectedUpdatedAt) return err("validation_error", "A valid inventory item and edit token are required.");
  const household = await getCurrentHousehold();
  if (!household.ok) return household;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("household_id", household.data.householdId)
    .eq("id", itemId)
    .eq("updated_at", expectedUpdatedAt)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    reportInventoryError("delete", error);
    return err("unexpected_error", "That FrostPantry item could not be removed.");
  }
  if (!data) return err("conflict", "This FrostPantry item changed somewhere else. Reload before removing it.");
  return ok({ id: data.id });
}

async function certainCanonicalId(displayName: string): Promise<string | null> {
  const suggestion = await suggestIngredientMatch(displayName);
  if (!suggestion.ok) return null;
  if (suggestion.data.confidence !== "certain" || !suggestion.data.match) return null;
  return suggestion.data.match.canonicalIngredientId;
}

function mapInventoryItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    householdId: row.household_id,
    canonicalIngredientId: row.canonical_ingredient_id,
    displayName: row.display_name,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    location: row.location,
    purchaseDate: row.purchase_date,
    storageDate: row.storage_date,
    expiryDate: row.expiry_date,
    useSoonStatus: row.use_soon_status,
    isOutOfStock: row.is_out_of_stock,
    isStaple: row.is_staple,
    sourceType: row.source_type,
    sourceId: row.source_id,
    userOverridden: row.user_overridden,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function reportInventoryError(operation: string, error: { code?: string; message?: string; details?: string | null; hint?: string | null }): void {
  console.error(`[inventory] ${operation} failed`, { code: error.code, message: error.message, details: error.details, hint: error.hint });
}
