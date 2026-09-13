import { inventoryLocations, type InventoryItem, type ManualInventoryDraft, type ManualInventoryInput } from "./types.ts";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function inventoryToInput(item?: InventoryItem): ManualInventoryInput {
  return {
    displayName: item?.displayName ?? "",
    quantity: item?.quantity?.toString() ?? "",
    unit: item?.unit ?? "",
    location: item?.location ?? "pantry",
    purchaseDate: item?.purchaseDate ?? "",
    storageDate: item?.storageDate ?? "",
    expiryDate: item?.expiryDate ?? "",
    useSoonStatus: item?.useSoonStatus ?? "normal",
    isOutOfStock: item?.isOutOfStock ?? false,
    isStaple: item?.isStaple ?? false,
    notes: item?.notes ?? "",
  };
}

export function buildManualInventory(input: ManualInventoryInput): ManualInventoryDraft {
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 240) throw new Error("A food name is required.");
  if (!inventoryLocations.includes(input.location)) throw new Error("Choose a valid storage location.");
  if (input.useSoonStatus !== "normal" && input.useSoonStatus !== "use_soon") throw new Error("Choose a valid use-soon state.");

  let quantity: number | null = null;
  if (input.quantity.trim() !== "") {
    quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Quantity must be zero or greater.");
  }

  const unit = nullableText(input.unit, 80);
  const notes = nullableText(input.notes, 5000);
  const purchaseDate = nullableDate(input.purchaseDate);
  const storageDate = nullableDate(input.storageDate);
  const expiryDate = nullableDate(input.expiryDate);

  return {
    displayName,
    quantity,
    unit,
    location: input.location,
    purchaseDate,
    storageDate,
    expiryDate,
    useSoonStatus: input.useSoonStatus,
    isOutOfStock: input.isOutOfStock,
    isStaple: input.isStaple,
    notes,
  };
}

function nullableText(value: string, maxLength: number): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new Error("Text is too long.");
  return trimmed;
}

function nullableDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!datePattern.test(trimmed)) throw new Error("Dates must use YYYY-MM-DD.");
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) throw new Error("Enter a real calendar date.");
  return trimmed;
}
