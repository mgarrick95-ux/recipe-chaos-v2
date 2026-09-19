import type { Database as ShoppingDatabase } from './database-shopping';

type Plan = {
  Row: { id: string; household_id: string; plan_start_date: string; plan_end_date: string; status: 'active' | 'archived'; created_by: string; created_at: string; updated_at: string };
  Insert: { id?: string; household_id: string; plan_start_date: string; plan_end_date: string; status?: 'active' | 'archived'; created_by: string; created_at?: string; updated_at?: string };
  Update: Partial<Plan['Insert']>;
  Relationships: [{ foreignKeyName: 'meal_plans_household_id_fkey'; columns: ['household_id']; isOneToOne: false; referencedRelation: 'households'; referencedColumns: ['id'] }];
};
type Context = {
  Row: { meal_plan_id: string; meal_count: number; energy_level: string | null; budget_mode: string | null; max_cooking_time_minutes: number | null; effort_level: string | null; notes: string | null; created_at: string; updated_at: string };
  Insert: { meal_plan_id: string; meal_count: number; energy_level?: string | null; budget_mode?: string | null; max_cooking_time_minutes?: number | null; effort_level?: string | null; notes?: string | null };
  Update: Partial<Context['Insert']>;
  Relationships: [{ foreignKeyName: 'weekly_planning_contexts_meal_plan_id_fkey'; columns: ['meal_plan_id']; isOneToOne: true; referencedRelation: 'meal_plans'; referencedColumns: ['id'] }];
};
type Slot = {
  Row: { id: string; meal_plan_id: string; position: number; locked: boolean; created_at: string; updated_at: string };
  Insert: { id?: string; meal_plan_id: string; position: number; locked?: boolean };
  Update: Partial<Slot['Insert']>;
  Relationships: [{ foreignKeyName: 'meal_plan_slots_meal_plan_id_fkey'; columns: ['meal_plan_id']; isOneToOne: false; referencedRelation: 'meal_plans'; referencedColumns: ['id'] }];
};
type Selection = {
  Row: { id: string; meal_plan_slot_id: string; recipe_id: string; selection_source: 'manual' | 'approved_suggestion'; created_by: string; created_at: string; updated_at: string };
  Insert: { id?: string; meal_plan_slot_id: string; recipe_id: string; selection_source?: 'manual' | 'approved_suggestion'; created_by: string };
  Update: Partial<Selection['Insert']>;
  Relationships: [
    { foreignKeyName: 'meal_plan_selections_meal_plan_slot_id_fkey'; columns: ['meal_plan_slot_id']; isOneToOne: true; referencedRelation: 'meal_plan_slots'; referencedColumns: ['id'] },
    { foreignKeyName: 'meal_plan_selections_recipe_id_fkey'; columns: ['recipe_id']; isOneToOne: false; referencedRelation: 'recipes'; referencedColumns: ['id'] }
  ];
};

export type Database = Omit<ShoppingDatabase, 'public'> & {
  public: Omit<ShoppingDatabase['public'], 'Tables' | 'Functions'> & {
    Tables: ShoppingDatabase['public']['Tables'] & {
      meal_plans: Plan; weekly_planning_contexts: Context;
      meal_plan_slots: Slot; meal_plan_selections: Selection;
    };
    Functions: ShoppingDatabase['public']['Functions'] & {
      save_manual_plan: { Args: { p_household_id: string; p_start: string; p_count: number }; Returns: string };
      set_manual_plan_recipe: { Args: { p_slot_id: string; p_recipe_id: string | null }; Returns: undefined };
      add_plan_shopping_items: {
        Args: { p_plan_id: string; p_origins: import('./database').Json };
        Returns: { slot_id: string; recipe_ingredient_id: string; outcome: string; shopping_item_id: string | null }[];
      };
    };
  };
};
