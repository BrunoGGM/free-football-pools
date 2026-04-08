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
      achievement_definitions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon_emoji: string
          id: string
          is_active: boolean
          name: string
          tier: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon_emoji?: string
          id?: string
          is_active?: boolean
          name: string
          tier?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon_emoji?: string
          id?: string
          is_active?: boolean
          name?: string
          tier?: number
        }
        Relationships: []
      }
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
          is_test_record: boolean
          match_id: string
          points_earned: number
          quiniela_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          away_score: number
          created_at?: string
          home_score: number
          id?: string
          is_test_record?: boolean
          match_id: string
          points_earned?: number
          quiniela_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          away_score?: number
          created_at?: string
          home_score?: number
          id?: string
          is_test_record?: boolean
          match_id?: string
          points_earned?: number
          quiniela_id?: string
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
          is_test_user: boolean
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          is_global_admin?: boolean
          is_test_user?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_global_admin?: boolean
          is_test_user?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      quiniela_member_manual_points: {
        Row: {
          created_at: string
          created_by: string
          id: string
          points_delta: number
          quiniela_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          points_delta: number
          quiniela_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          points_delta?: number
          quiniela_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiniela_member_manual_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiniela_member_manual_points_quiniela_id_fkey"
            columns: ["quiniela_id"]
            isOneToOne: false
            referencedRelation: "quinielas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiniela_member_manual_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiniela_member_streaks: {
        Row: {
          best_streak: number
          current_streak: number
          quiniela_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          quiniela_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          best_streak?: number
          current_streak?: number
          quiniela_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiniela_member_streaks_quiniela_id_fkey"
            columns: ["quiniela_id"]
            isOneToOne: false
            referencedRelation: "quinielas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiniela_member_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiniela_members: {
        Row: {
          champion_predicted_at: string | null
          created_at: string
          is_test_record: boolean
          predicted_champion: string | null
          quiniela_id: string
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          champion_predicted_at?: string | null
          created_at?: string
          is_test_record?: boolean
          predicted_champion?: string | null
          quiniela_id: string
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          champion_predicted_at?: string | null
          created_at?: string
          is_test_record?: boolean
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
      quiniela_rankings: {
        Row: {
          automatic_points: number
          manual_points: number
          quiniela_id: string
          rank: number
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          automatic_points?: number
          manual_points?: number
          quiniela_id: string
          rank: number
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          automatic_points?: number
          manual_points?: number
          quiniela_id?: string
          rank?: number
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiniela_rankings_quiniela_id_fkey"
            columns: ["quiniela_id"]
            isOneToOne: false
            referencedRelation: "quinielas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiniela_rankings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiniela_rules: {
        Row: {
          allow_member_predictions_view: boolean
          champion_bonus_points: number
          correct_outcome_points: number
          created_at: string
          exact_hit_min_points: number
          exact_score_points: number
          quiniela_id: string
          streak_bonus_3_points: number
          streak_bonus_5_points: number
          streak_hit_min_points: number
          updated_at: string
        }
        Insert: {
          allow_member_predictions_view?: boolean
          champion_bonus_points?: number
          correct_outcome_points?: number
          created_at?: string
          exact_hit_min_points?: number
          exact_score_points?: number
          quiniela_id: string
          streak_bonus_3_points?: number
          streak_bonus_5_points?: number
          streak_hit_min_points?: number
          updated_at?: string
        }
        Update: {
          allow_member_predictions_view?: boolean
          champion_bonus_points?: number
          correct_outcome_points?: number
          created_at?: string
          exact_hit_min_points?: number
          exact_score_points?: number
          quiniela_id?: string
          streak_bonus_3_points?: number
          streak_bonus_5_points?: number
          streak_hit_min_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiniela_rules_quiniela_id_fkey"
            columns: ["quiniela_id"]
            isOneToOne: true
            referencedRelation: "quinielas"
            referencedColumns: ["id"]
          },
        ]
      }
      quiniela_weekly_rankings: {
        Row: {
          exact_hits: number
          quiniela_id: string
          rank: number
          updated_at: string
          user_id: string
          week_start_date: string
          weekly_points: number
        }
        Insert: {
          exact_hits?: number
          quiniela_id: string
          rank: number
          updated_at?: string
          user_id: string
          week_start_date: string
          weekly_points?: number
        }
        Update: {
          exact_hits?: number
          quiniela_id?: string
          rank?: number
          updated_at?: string
          user_id?: string
          week_start_date?: string
          weekly_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiniela_weekly_rankings_quiniela_id_fkey"
            columns: ["quiniela_id"]
            isOneToOne: false
            referencedRelation: "quinielas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiniela_weekly_rankings_user_id_fkey"
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
          has_test_data: boolean
          id: string
          name: string
          start_date: string
          ticket_price: number
          updated_at: string
        }
        Insert: {
          access_code: string
          admin_id: string
          champion_team?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          has_test_data?: boolean
          id?: string
          name: string
          start_date: string
          ticket_price?: number
          updated_at?: string
        }
        Update: {
          access_code?: string
          admin_id?: string
          champion_team?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          has_test_data?: boolean
          id?: string
          name?: string
          start_date?: string
          ticket_price?: number
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
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          metadata: Json
          quiniela_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          metadata?: Json
          quiniela_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          metadata?: Json
          quiniela_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_quiniela_id_fkey"
            columns: ["quiniela_id"]
            isOneToOne: false
            referencedRelation: "quinielas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_member_achievements: {
        Args: { p_quiniela_id: string; p_user_id: string }
        Returns: undefined
      }
      calculate_prediction_points: {
        Args: {
          actual_away: number
          actual_home: number
          predicted_away: number
          predicted_home: number
        }
        Returns: number
      }
      calculate_prediction_points_for_quiniela: {
        Args: {
          actual_away: number
          actual_home: number
          p_quiniela_id: string
          predicted_away: number
          predicted_home: number
        }
        Returns: number
      }
      get_quiniela_rules: {
        Args: { p_quiniela_id: string }
        Returns: {
          champion_bonus_points: number
          correct_outcome_points: number
          exact_hit_min_points: number
          exact_score_points: number
          streak_bonus_3_points: number
          streak_bonus_5_points: number
          streak_hit_min_points: number
        }[]
      }
      get_quiniela_rules_with_visibility: {
        Args: { p_quiniela_id: string }
        Returns: {
          allow_member_predictions_view: boolean
          champion_bonus_points: number
          correct_outcome_points: number
          exact_hit_min_points: number
          exact_score_points: number
          streak_bonus_3_points: number
          streak_bonus_5_points: number
          streak_hit_min_points: number
        }[]
      }
      get_week_start_date: { Args: { p_timestamp: string }; Returns: string }
      grant_achievement_by_code: {
        Args: {
          p_code: string
          p_metadata?: Json
          p_quiniela_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      grant_streak_bonus: {
        Args: {
          p_milestone: number
          p_points: number
          p_quiniela_id: string
          p_user_id: string
        }
        Returns: undefined
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
      recalculate_member_streak: {
        Args: { p_quiniela_id: string; p_user_id: string }
        Returns: undefined
      }
      recalculate_member_total_points: {
        Args: { p_quiniela_id: string; p_user_id: string }
        Returns: undefined
      }
      recalculate_quiniela_ranking: {
        Args: { p_quiniela_id: string }
        Returns: undefined
      }
      recalculate_quiniela_scoring: {
        Args: { p_quiniela_id: string }
        Returns: undefined
      }
      recalculate_weekly_ranking_for_week: {
        Args: { p_quiniela_id: string; p_week_start_date: string }
        Returns: undefined
      }
      refresh_member_gamification: {
        Args: { p_quiniela_id: string; p_user_id: string }
        Returns: undefined
      }
      refresh_quiniela_test_lock: {
        Args: { p_quiniela_id: string }
        Returns: undefined
      }
      refresh_weekly_ranking_for_match_and_quiniela: {
        Args: { p_match_id: string; p_quiniela_id: string }
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
