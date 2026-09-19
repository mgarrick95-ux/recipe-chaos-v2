import type { Database as InventoryDatabase } from './database-inventory';

type ShoppingTable = {
  Row: {
    id: string;
    household_id: string;
    canonical_ingredient_id: string | null;
    display_name: string;
    quantity: number | null;
    unit: string | null;
    intention: 'general' | 'this_week' | 'staple';
    source_type: 'manual' | 'plan';
    source_id: string | null;
    source_slot_id: string | null;
    source_recipe_ingredient_id: string | null;
    is_checked: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
  Insert: {
    id?: string;
    household_id: string;
    canonical_ingredient_id?: string | null;
    display_name: string;
    quantity?: number | null;
    unit?: string | null;
    intention?: 'general' | 'this_week' | 'staple';
    source_type?: 'manual' | 'plan';
    source_id?: string | null;
    source_slot_id?: string | null;
    source_recipe_ingredient_id?: string | null;
    is_checked?: boolean;
    created_by: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
  };
  Update: Partial<ShoppingTable['Insert']>;
  Relationships: [
    {
      foreignKeyName: 'shopping_items_household_id_fkey';
      columns: ['household_id'];
      isOneToOne: false;
      referencedRelation: 'households';
      referencedColumns: ['id'];
    },
    {
      foreignKeyName: 'shopping_items_canonical_ingredient_id_fkey';
      columns: ['canonical_ingredient_id'];
      isOneToOne: false;
      referencedRelation: 'canonical_ingredients';
      referencedColumns: ['id'];
    },
  ];
};

export type Database = Omit<InventoryDatabase, 'public'> & {
  public: Omit<InventoryDatabase['public'], 'Tables'> & {
    Tables: InventoryDatabase['public']['Tables'] & { shopping_items: ShoppingTable };
  };
};
