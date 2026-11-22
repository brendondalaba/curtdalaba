// Matches supabase/migrations. Regenerate with the Supabase CLI or MCP
// (`generate_typescript_types`) after changing the schema.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: { access_code: string; id: number; updated_at: string };
        Insert: { access_code: string; id?: number; updated_at?: string };
        Update: { access_code?: string; id?: number; updated_at?: string };
        Relationships: [];
      };
      playback_progress: {
        Row: {
          completed: boolean;
          position_seconds: number;
          sermon_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          position_seconds?: number;
          sermon_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          completed?: boolean;
          position_seconds?: number;
          sermon_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          is_admin: boolean;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          is_admin?: boolean;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          is_admin?: boolean;
        };
        Relationships: [];
      };
      sermons: {
        Row: {
          audio_content_type: string;
          audio_size_bytes: number | null;
          created_at: string;
          created_by: string | null;
          duration_seconds: number | null;
          id: string;
          preached_on: string;
          scripture: string | null;
          title: string;
        };
        Insert: {
          audio_content_type: string;
          audio_size_bytes?: number | null;
          created_at?: string;
          created_by?: string | null;
          duration_seconds?: number | null;
          id: string;
          preached_on: string;
          scripture?: string | null;
          title: string;
        };
        Update: {
          audio_content_type?: string;
          audio_size_bytes?: number | null;
          created_at?: string;
          created_by?: string | null;
          duration_seconds?: number | null;
          id?: string;
          preached_on?: string;
          scripture?: string | null;
          title?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Sermon = Database["public"]["Tables"]["sermons"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
