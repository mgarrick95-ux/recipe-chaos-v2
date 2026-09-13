import { normalizeIngredientName } from "../ingredients/normalize.ts";
import type { InventoryItem, InventoryLocation } from "./types.ts";

export function isSameInventoryIdentity(
  item: Pick<InventoryItem, "displayName" | "location">,
  displayName: string,
  location: InventoryLocation,
): boolean {
  return item.location === location
    && normalizeIngredientName(item.displayName) === normalizeIngredientName(displayName);
}
