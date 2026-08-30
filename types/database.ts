export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Temporary Phase 1B Supabase types for the foundation schema only.
// Replace this file with generated Supabase types after a new V2 project is linked.
export type Database = {
  public: {
    Tables: {
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
    };
    Views: Record<string, never>;
    Functions: {
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
