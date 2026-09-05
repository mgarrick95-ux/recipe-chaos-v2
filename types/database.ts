export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Migration-aligned Supabase types through Phase 3B (local, pending application).
// Row shapes do not replace database column grants or RLS enforcement.
export type Database = {
  public: {
    Tables: {
      recipes: {
        Row: {
          id: string;
          household_id: string;
          title: string;
          description: string | null;
          source_url: string | null;
          servings: number | null;
          yield_text: string | null;
          is_favorite: boolean;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          title: string;
          description?: string | null;
          source_url?: string | null;
          servings?: number | null;
          yield_text?: string | null;
          is_favorite?: boolean;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          title?: string;
          description?: string | null;
          source_url?: string | null;
          servings?: number | null;
          yield_text?: string | null;
          is_favorite?: boolean;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          position: number;
          original_text: string;
          ingredient_text: string;
          quantity: string | null;
          unit: string | null;
          descriptor: string | null;
          preparation: string | null;
          optional: boolean;
          canonical_ingredient_id: string | null;
          verification_state: "unreviewed" | "verified" | "needs_review";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          position: number;
          original_text: string;
          ingredient_text: string;
          quantity?: string | null;
          unit?: string | null;
          descriptor?: string | null;
          preparation?: string | null;
          optional?: boolean;
          canonical_ingredient_id?: string | null;
          verification_state?: "unreviewed" | "verified" | "needs_review";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          position?: number;
          original_text?: string;
          ingredient_text?: string;
          quantity?: string | null;
          unit?: string | null;
          descriptor?: string | null;
          preparation?: string | null;
          optional?: boolean;
          canonical_ingredient_id?: string | null;
          verification_state?: "unreviewed" | "verified" | "needs_review";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_canonical_ingredient_id_fkey";
            columns: ["canonical_ingredient_id"];
            isOneToOne: false;
            referencedRelation: "canonical_ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_steps: {
        Row: {
          id: string;
          recipe_id: string;
          position: number;
          instruction: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          position: number;
          instruction: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          position?: number;
          instruction?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          default_household_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          default_household_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          default_household_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_default_household_id_fkey";
            columns: ["default_household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          household_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["household_member_role"];
          created_at: string;
        };
        Insert: {
          household_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["household_member_role"];
          created_at?: string;
        };
        Update: {
          household_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["household_member_role"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      canonical_ingredients: {
        Row: {
          id: string;
          name: string;
          normalized_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          normalized_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          normalized_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ingredient_aliases: {
        Row: {
          id: string;
          canonical_ingredient_id: string;
          alias: string;
          normalized_alias: string;
          source: "app_seed" | "owner_approved";
          household_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          canonical_ingredient_id: string;
          alias: string;
          normalized_alias: string;
          source: "app_seed" | "owner_approved";
          household_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          canonical_ingredient_id?: string;
          alias?: string;
          normalized_alias?: string;
          source?: "app_seed" | "owner_approved";
          household_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_aliases_canonical_ingredient_id_fkey";
            columns: ["canonical_ingredient_id"];
            isOneToOne: false;
            referencedRelation: "canonical_ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredient_aliases_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_separation_rules: {
        Row: {
          id: string;
          household_id: string;
          normalized_input: string;
          blocked_canonical_ingredient_id: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          normalized_input: string;
          blocked_canonical_ingredient_id: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          normalized_input?: string;
          blocked_canonical_ingredient_id?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_separation_rules_blocked_canonical_ingredient_id_fkey";
            columns: ["blocked_canonical_ingredient_id"];
            isOneToOne: false;
            referencedRelation: "canonical_ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredient_separation_rules_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_recipe: {
        Args: {
          p_household_id: string;
          p_recipe: Json;
          p_ingredients: Json;
          p_steps: Json;
          p_recipe_id?: string | null;
          p_expected_updated_at?: string | null;
        };
        Returns: { recipe_id: string; updated_at: string }[];
      };
      bootstrap_default_household: {
        Args: Record<PropertyKey, never>;
        Returns: {
          user_id: string;
          profile_id: string;
          household_id: string;
          household_name: string;
          role: Database["public"]["Enums"]["household_member_role"];
        }[];
      };
    };
    Enums: {
      household_member_role: "owner";
    };
    CompositeTypes: Record<string, never>;
  };
};
