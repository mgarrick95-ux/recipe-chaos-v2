import assert from "node:assert/strict";
import { it } from "node:test";
import { buildManualInventory, inventoryToInput } from "./manual-entry.ts";
import type { InventoryItem } from "./types.ts";

it("accepts a minimal manual pantry item", () => {
  const result = buildManualInventory({
    ...inventoryToInput(),
    displayName: "  Rice  ",
  });
  assert.deepEqual(result, {
    displayName: "Rice",
    quantity: null,
    unit: null,
    location: "pantry",
    purchaseDate: null,
    storageDate: null,
    expiryDate: null,
    useSoonStatus: "normal",
    isOutOfStock: false,
    isStaple: false,
    notes: null,
  });
});

it("preserves useful manual inventory details", () => {
  const result = buildManualInventory({
    ...inventoryToInput(),
    displayName: "Chicken thighs",
    quantity: "2.5",
    unit: " kg ",
    location: "freezer",
    storageDate: "2026-09-12",
    expiryDate: "2026-12-01",
    useSoonStatus: "use_soon",
    isStaple: true,
    notes: "  Split into two bags.  ",
  });
  assert.equal(result.quantity, 2.5);
  assert.equal(result.unit, "kg");
  assert.equal(result.location, "freezer");
  assert.equal(result.useSoonStatus, "use_soon");
  assert.equal(result.notes, "Split into two bags.");
});

it("rejects invalid quantities, locations, blank names, and impossible dates", () => {
  const base = inventoryToInput();
  assert.throws(() => buildManualInventory({ ...base, displayName: " " }));
  assert.throws(() => buildManualInventory({ ...base, displayName: "Rice", quantity: "-1" }));
  assert.throws(() => buildManualInventory({ ...base, displayName: "Rice", quantity: "lots" }));
  assert.throws(() => buildManualInventory({ ...base, displayName: "Rice", location: "garage" as "pantry" }));
  assert.throws(() => buildManualInventory({ ...base, displayName: "Rice", expiryDate: "2026-02-30" }));
});

it("maps an existing record back to editable manual input", () => {
  const item: InventoryItem = {
    id: "00000000-0000-4000-8000-000000000001",
    householdId: "00000000-0000-4000-8000-000000000002",
    canonicalIngredientId: null,
    displayName: "Milk",
    quantity: 1,
    unit: "carton",
    location: "fridge",
    purchaseDate: "2026-09-10",
    storageDate: null,
    expiryDate: "2026-09-20",
    useSoonStatus: "normal",
    isOutOfStock: false,
    isStaple: true,
    sourceType: "manual",
    sourceId: null,
    userOverridden: true,
    notes: null,
    createdBy: "00000000-0000-4000-8000-000000000003",
    createdAt: "2026-09-12T00:00:00Z",
    updatedAt: "2026-09-12T00:00:00Z",
    deletedAt: null,
  };
  const input = inventoryToInput(item);
  assert.equal(input.displayName, "Milk");
  assert.equal(input.quantity, "1");
  assert.equal(input.location, "fridge");
  assert.equal(input.isStaple, true);
});
