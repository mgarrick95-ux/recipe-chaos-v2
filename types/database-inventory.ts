import type { Database as BaseDatabase, Json } from "@/types/database";

type InventoryItemTable = {
  Row: {
    id: string;
    household_id: string;
    canonical_ingredient_id: string | null;
    display_name: string;
    quantity: number | null;
    unit: string | null;
    location: "pantry" | "fridge" | "freezer" | "leftovers";
    purchase_date: string | null;
    storage_date: string | null;
    expiry_date: string | null;
    use_soon_status: "normal" | "use_soon";
    is_out_of_stock: boolean;
    is_staple: boolean;
    source_type: "manual" | "intake" | "meal" | "system";
    source_id: string | null;
    user_overridden: boolean;
    notes: string | null;
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
    location?: "pantry" | "fridge" | "freezer" | "leftovers";
    purchase_date?: string | null;
    storage_date?: string | null;
    expiry_date?: string | null;
    use_soon_status?: "normal" | "use_soon";
    is_out_of_stock?: boolean;
    is_staple?: boolean;
    source_type?: "manual" | "intake" | "meal" | "system";
    source_id?: string | null;
    user_overridden?: boolean;
    notes?: string | null;
    created_by: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
  };
  Update: {
    id?: string;
    household_id?: string;
    canonical_ingredient_id?: string | null;
    display_name?: string;
    quantity?: number | null;
    unit?: string | null;
    location?: "pantry" | "fridge" | "freezer" | "leftovers";
    purchase_date?: string | null;
    storage_date?: string | null;
    expiry_date?: string | null;
    use_soon_status?: "normal" | "use_soon";
    is_out_of_stock?: boolean;
    is_staple?: boolean;
    source_type?: "manual" | "intake" | "meal" | "system";
    source_id?: string | null;
    user_overridden?: boolean;
    notes?: string | null;
    created_by?: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
  };
  Relationships: [
    {
      foreignKeyName: "inventory_items_household_id_fkey";
      columns: ["household_id"];
      isOneToOne: false;
      referencedRelation: "households";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "inventory_items_canonical_ingredient_id_fkey";
      columns: ["canonical_ingredient_id"];
      isOneToOne: false;
      referencedRelation: "canonical_ingredients";
      referencedColumns: ["id"];
    },
  ];
};

type InventoryEventTable = {
  Row: {
    id: string;
    household_id: string;
    inventory_item_id: string;
    event_type: "created" | "updated" | "deleted" | "restored";
    quantity_delta: number | null;
    previous_value: Json | null;
    new_value: Json | null;
    source_type: "manual" | "intake" | "meal" | "system";
    source_id: string | null;
    created_by: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    household_id: string;
    inventory_item_id: string;
    event_type: "created" | "updated" | "deleted" | "restored";
    quantity_delta?: number | null;
    previous_value?: Json | null;
    new_value?: Json | null;
    source_type?: "manual" | "intake" | "meal" | "system";
    source_id?: string | null;
    created_by?: string | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    household_id?: string;
    inventory_item_id?: string;
    event_type?: "created" | "updated" | "deleted" | "restored";
    quantity_delta?: number | null;
    previous_value?: Json | null;
    new_value?: Json | null;
    source_type?: "manual" | "intake" | "meal" | "system";
    source_id?: string | null;
    created_by?: string | null;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "inventory_events_household_id_fkey";
      columns: ["household_id"];
      isOneToOne: false;
      referencedRelation: "households";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "inventory_events_inventory_item_id_fkey";
      columns: ["inventory_item_id"];
      isOneToOne: false;
      referencedRelation: "inventory_items";
      referencedColumns: ["id"];
    },
  ];
};

export type Database = Omit<BaseDatabase, "public"> & {
  public: Omit<BaseDatabase["public"], "Tables"> & {
    Tables: BaseDatabase["public"]["Tables"] & {
      inventory_items: InventoryItemTable;
      inventory_events: InventoryEventTable;
    };
  };
};
