import assert from "node:assert/strict";
import { it } from "node:test";
import { isSameInventoryIdentity } from "./duplicates.ts";

it("treats normalized names in the same location as the same inventory identity", () => {
  assert.equal(
    isSameInventoryIdentity({ displayName: "  Milk ", location: "fridge" }, "milk", "fridge"),
    true,
  );
  assert.equal(
    isSameInventoryIdentity({ displayName: "Brown Sugar", location: "pantry" }, "brown   sugar", "pantry"),
    true,
  );
});

it("keeps the same name separate across storage locations", () => {
  assert.equal(
    isSameInventoryIdentity({ displayName: "Milk", location: "fridge" }, "milk", "freezer"),
    false,
  );
});

it("does not fuzzy-merge different products", () => {
  assert.equal(
    isSameInventoryIdentity({ displayName: "Garlic", location: "pantry" }, "garlic powder", "pantry"),
    false,
  );
  assert.equal(
    isSameInventoryIdentity({ displayName: "Red onion", location: "fridge" }, "green onion", "fridge"),
    false,
  );
});
