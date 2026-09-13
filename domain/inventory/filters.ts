import type { InventoryItem, InventoryLocation } from "./types.ts";

export type InventoryFilter = "all" | InventoryLocation | "soon" | "expired";

const soonishDaysByLocation: Record<InventoryLocation, number> = {
  pantry: 0,
  fridge: 2,
  freezer: 5,
  leftovers: 3,
};

export function filterInventory(
  items: InventoryItem[],
  filter: InventoryFilter,
  todayIso: string,
): InventoryItem[] {
  if (filter === "all") return items;
  if (filter === "soon") return items.filter((item) => isSoonish(item, todayIso));
  if (filter === "expired") return items.filter((item) => isExpired(item, todayIso));
  return items.filter((item) => item.location === filter);
}

export function isExpired(item: InventoryItem, todayIso: string): boolean {
  return item.expiryDate !== null && item.expiryDate < todayIso;
}

export function isSoonish(item: InventoryItem, todayIso: string): boolean {
  if (item.isOutOfStock || item.quantity === 0 || isExpired(item, todayIso)) return false;
  if (item.useSoonStatus === "use_soon") return true;
  if (!item.expiryDate) return false;

  const daysUntilExpiry = differenceInCalendarDays(todayIso, item.expiryDate);
  return daysUntilExpiry >= 0 && daysUntilExpiry <= soonishDaysByLocation[item.location];
}

function differenceInCalendarDays(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  return Math.round((to - from) / 86_400_000);
}

function parseIsoDate(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}
