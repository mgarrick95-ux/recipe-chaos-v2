export type ShoppingIntention = 'general' | 'this_week' | 'staple';

export type ShoppingItem = {
  id: string;
  displayName: string;
  canonicalIngredientId: string | null;
  quantity: number | null;
  unit: string | null;
  intention: ShoppingIntention;
  sourceType: 'manual' | 'plan';
  sourceId: string | null;
  isChecked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingInput = {
  displayName: string;
  quantity: string;
  unit: string;
  intention: ShoppingIntention;
};

export type ShoppingDraft = {
  displayName: string;
  quantity: number | null;
  unit: string | null;
  intention: ShoppingIntention;
};
