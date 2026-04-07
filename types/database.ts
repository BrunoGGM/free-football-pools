export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_provider_sync_state: {
        Row: {
          created_at: string
          last_error: string | null
          last_response_count: number
          last_status: string
          last_synced_at: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_error?: string | null
          last_response_count?: number
          last_status?: string
          last_synced_at?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_error?: string | null
          last_response_count?: number
          last_status?: string
          last_synced_at?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_provider_usage: {
        Row: {
          created_at: string
          provider: string
          requests_used: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          created_at?: string
          provider: string
          requests_used?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          created_at?: string
          provider?: string
          requests_used?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          api_fixture_id: number
          away_score: number | null
          away_team: string
          away_team_code: string | null
          away_team_logo_url: string | null
          created_at: string
          home_score: number | null
          home_team: string
          home_team_code: string | null
          home_team_logo_url: string | null
          id: string
          match_time: string
          source_time: string | null
          source_timezone: string
          stage: Database["public"]["Enums"]["match_stage"]
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          venue: string | null
        }
        Insert: {
          api_fixture_id: number
          away_score?: number | null
          away_team: string
          away_team_code?: string | null
          away_team_logo_url?: string | null
          created_at?: string
          home_score?: number | null
          home_team: string
          home_team_code?: string | null
          home_team_logo_url?: string | null
          id?: string
          match_time: string
          source_time?: string | null
          source_timezone?: string
          stage: Database["public"]["Enums"]["match_stage"]
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue?: string | null
        }
        Update: {
          api_fixture_id?: number
          away_score?: number | null
          away_team?: string
          away_team_code?: string | null
          away_team_logo_url?: string | null
          created_at?: string
          home_score?: number | null
          home_team?: string
          home_team_code?: string | null
          home_team_logo_url?: string | null
          id?: string
          match_time?: string
          source_time?: string | null
          source_timezone?: string
          stage?: Database["public"]["Enums"]["match_stage"]
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      predictions: {
        Row: {
          away_score: number
          created_at: string
          home_score: number
          id: string
          match_id: string
          quiniela_id: string
          points_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          away_score: number
          created_at?: string
          home_score: number
          id?: string
          match_id: string
          quiniela_id: string
          points_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          away_score?: number
          created_at?: string
          home_score?: number
          id?: string
          match_id?: string
          quiniela_id?: string
          points_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_quiniela_id_fkey"
            columns: ["quiniela_id"]
            isOneToOne: false
            referencedRelation: "quinielas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_global_admin: boolean
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          is_global_admin?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_global_admin?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      quiniela_members: {
        Row: {
          champion_predicted_at: string | null
          created_at: string
          predicted_champion: string | null
          quiniela_id: string
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          champion_predicted_at?: string | null
          created_at?: string
          predicted_champion?: string | null
          quiniela_id: string
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          champion_predicted_at?: string | null
          created_at?: string
          predicted_champion?: string | null
          quiniela_id?: string
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiniela_members_quiniela_id_fkey"
            columns: ["quiniela_id"]
            isOneToOne: false
            referencedRelation: "quinielas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiniela_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quinielas: {
        Row: {
          access_code: string
          admin_id: string
          champion_team: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          access_code: string
          admin_id: string
          champion_team?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          admin_id?: string
          champion_team?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quinielas_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_profiles: {
        Row: {
          api_team_id: number | null
          code: string | null
          country: string | null
          created_at: string
          id: string
          is_national: boolean | null
          logo_url: string | null
          name: string
          source_provider: string
          team_key: string
          updated_at: string
        }
        Insert: {
          api_team_id?: number | null
          code?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_national?: boolean | null
          logo_url?: string | null
          name: string
          source_provider?: string
          team_key: string
          updated_at?: string
        }
        Update: {
          api_team_id?: number | null
          code?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_national?: boolean | null
          logo_url?: string | null
          name?: string
          source_provider?: string
          team_key?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_prediction_points: {
        Args: {
          actual_away: number
          actual_home: number
          predicted_away: number
          predicted_home: number
        }
        Returns: number
      }
      is_admin_of_quiniela: {
        Args: { p_quiniela_id: string; p_user_id: string }
        Returns: boolean
      }
      is_global_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_member_of_quiniela: {
        Args: { p_quiniela_id: string; p_user_id: string }
        Returns: boolean
      }
      map_team_code: { Args: { p_name: string }; Returns: string }
      normalize_team_key: { Args: { p_name: string }; Returns: string }
      recalculate_member_total_points: {
        Args: { p_quiniela_id: string; p_user_id: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      match_stage:
      | "group_a"
      | "group_b"
      | "group_c"
      | "group_d"
      | "group_e"
      | "group_f"
      | "group_g"
      | "group_h"
      | "group_i"
      | "group_j"
      | "group_k"
      | "group_l"
      | "round_32"
      | "round_16"
      | "quarter_final"
      | "semi_final"
      | "third_place"
      | "final"
      match_status: "pending" | "in_progress" | "finished"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      match_stage: [
        "group_a",
        "group_b",
        "group_c",
        "group_d",
        "group_e",
        "group_f",
        "group_g",
        "group_h",
        "group_i",
        "group_j",
        "group_k",
        "group_l",
        "round_32",
        "round_16",
        "quarter_final",
        "semi_final",
        "third_place",
        "final",
      ],
      match_status: ["pending", "in_progress", "finished"],
    },
  },
} as const
