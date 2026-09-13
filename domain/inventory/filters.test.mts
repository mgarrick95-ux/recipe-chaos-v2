import assert from "node:assert/strict";
import { it } from "node:test";
import { filterInventory, isExpired, isSoonish, sortInventory } from "./filters.ts";
import type { InventoryItem, InventoryLocation } from "./types.ts";

const today = "2026-09-13";

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    householdId: "00000000-0000-4000-8000-000000000002",
    canonicalIngredientId: null,
    displayName: "Test item",
    quantity: 1,
    unit: "each",
    location: "pantry",
    purchaseDate: null,
    storageDate: null,
    expiryDate: null,
    useSoonStatus: "normal",
    isOutOfStock: false,
    isStaple: false,
    sourceType: "manual",
    sourceId: null,
    userOverridden: true,
    notes: null,
    createdBy: "00000000-0000-4000-8000-000000000003",
    createdAt: "2026-09-12T00:00:00Z",
    updatedAt: "2026-09-12T00:00:00Z",
    deletedAt: null,
    ...overrides,
  };
}

it("uses the locked Soon-ish window for each storage location", () => {
  const cases: Array<[InventoryLocation, string, boolean]> = [
    ["pantry", "2026-09-13", true],
    ["pantry", "2026-09-14", false],
    ["fridge", "2026-09-15", true],
    ["fridge", "2026-09-16", false],
    ["freezer", "2026-09-18", true],
    ["freezer", "2026-09-19", false],
    ["leftovers", "2026-09-16", true],
    ["leftovers", "2026-09-17", false],
  ];

  for (const [location, expiryDate, expected] of cases) {
    assert.equal(isSoonish(item({ location, expiryDate }), today), expected);
  }
});

it("includes manually flagged items in Soon-ish but excludes out-of-stock, zero, and expired items", () => {
  assert.equal(isSoonish(item({ useSoonStatus: "use_soon" }), today), true);
  assert.equal(isSoonish(item({ useSoonStatus: "use_soon", isOutOfStock: true }), today), false);
  assert.equal(isSoonish(item({ useSoonStatus: "use_soon", quantity: 0 }), today), false);
  assert.equal(isSoonish(item({ useSoonStatus: "use_soon", expiryDate: "2026-09-12" }), today), false);
});

it("detects expired inventory by calendar date", () => {
  assert.equal(isExpired(item({ expiryDate: "2026-09-12" }), today), true);
  assert.equal(isExpired(item({ expiryDate: "2026-09-13" }), today), false);
  assert.equal(isExpired(item({ expiryDate: null }), today), false);
});

it("filters by location, Soon-ish, and expired state", () => {
  const items = [
    item({ id: "00000000-0000-4000-8000-000000000011", displayName: "Rice", location: "pantry" }),
    item({ id: "00000000-0000-4000-8000-000000000012", displayName: "Milk", location: "fridge", expiryDate: "2026-09-14" }),
    item({ id: "00000000-0000-4000-8000-000000000013", displayName: "Old leftovers", location: "leftovers", expiryDate: "2026-09-12" }),
  ];

  assert.deepEqual(filterInventory(items, "fridge", today).map((entry) => entry.displayName), ["Milk"]);
  assert.deepEqual(filterInventory(items, "soon", today).map((entry) => entry.displayName), ["Milk"]);
  assert.deepEqual(filterInventory(items, "expired", today).map((entry) => entry.displayName), ["Old leftovers"]);
});

it("sorts alphabetically without mutating the source list", () => {
  const items = [
    item({ displayName: "zucchini" }),
    item({ displayName: "Apples" }),
    item({ displayName: "Milk" }),
  ];

  const sorted = sortInventory(items, "name");
  assert.deepEqual(sorted.map((entry) => entry.displayName), ["Apples", "Milk", "zucchini"]);
  assert.deepEqual(items.map((entry) => entry.displayName), ["zucchini", "Apples", "Milk"]);
});

it("sorts dated items by earliest expiry and leaves undated items last", () => {
  const items = [
    item({ displayName: "Rice", expiryDate: null }),
    item({ displayName: "Milk", expiryDate: "2026-09-15" }),
    item({ displayName: "Leftovers", expiryDate: "2026-09-13" }),
    item({ displayName: "Apples", expiryDate: "2026-09-15" }),
  ];

  assert.deepEqual(
    sortInventory(items, "expiry").map((entry) => entry.displayName),
    ["Leftovers", "Apples", "Milk", "Rice"],
  );
});
