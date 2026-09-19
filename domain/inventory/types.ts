export const inventoryLocations = ["pantry", "fridge", "freezer", "leftovers"] as const;
export type InventoryLocation = (typeof inventoryLocations)[number];

export type UseSoonStatus = "normal" | "use_soon";

export type InventoryItem = {
  id: string;
  householdId: string;
  canonicalIngredientId: string | null;
  displayName: string;
  quantity: number | null;
  unit: string | null;
  location: InventoryLocation;
  purchaseDate: string | null;
  storageDate: string | null;
  expiryDate: string | null;
  useSoonStatus: UseSoonStatus;
  isOutOfStock: boolean;
  isStaple: boolean;
  sourceType: "manual" | "intake" | "meal" | "system";
  sourceId: string | null;
  userOverridden: boolean;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ManualInventoryInput = {
  displayName: string;
  quantity: string;
  unit: string;
  location: InventoryLocation;
  purchaseDate: string;
  storageDate: string;
  expiryDate: string;
  useSoonStatus: UseSoonStatus;
  isOutOfStock: boolean;
  isStaple: boolean;
  notes: string;
};

export type ManualInventoryDraft = {
  displayName: string;
  quantity: number | null;
  unit: string | null;
  location: InventoryLocation;
  purchaseDate: string | null;
  storageDate: string | null;
  expiryDate: string | null;
  useSoonStatus: UseSoonStatus;
  isOutOfStock: boolean;
  isStaple: boolean;
  notes: string | null;
};
