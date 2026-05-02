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
      achievements: {
        Row: {
          achievement_key: string
          created_at: string
          emoji: string | null
          id: string
          label: string
          league_id: string
          match_id: string | null
          player_id: string | null
          player_name: string | null
          season_number: number | null
          team_id: string | null
          value: number | null
        }
        Insert: {
          achievement_key: string
          created_at?: string
          emoji?: string | null
          id?: string
          label: string
          league_id: string
          match_id?: string | null
          player_id?: string | null
          player_name?: string | null
          season_number?: number | null
          team_id?: string | null
          value?: number | null
        }
        Update: {
          achievement_key?: string
          created_at?: string
          emoji?: string | null
          id?: string
          label?: string
          league_id?: string
          match_id?: string | null
          player_id?: string | null
          player_name?: string | null
          season_number?: number | null
          team_id?: string | null
          value?: number | null
        }
        Relationships: []
      }
      balls: {
        Row: {
          ball_in_over: number
          bowler_id: string | null
          commentary: string | null
          created_at: string
          extra_type: string | null
          extras: number
          id: string
          innings: number
          is_wicket: boolean
          match_id: string
          non_striker_id: string | null
          out_player_id: string | null
          over_num: number
          runs: number
          striker_id: string | null
          wicket_type: string | null
        }
        Insert: {
          ball_in_over: number
          bowler_id?: string | null
          commentary?: string | null
          created_at?: string
          extra_type?: string | null
          extras?: number
          id?: string
          innings: number
          is_wicket?: boolean
          match_id: string
          non_striker_id?: string | null
          out_player_id?: string | null
          over_num: number
          runs?: number
          striker_id?: string | null
          wicket_type?: string | null
        }
        Update: {
          ball_in_over?: number
          bowler_id?: string | null
          commentary?: string | null
          created_at?: string
          extra_type?: string | null
          extras?: number
          id?: string
          innings?: number
          is_wicket?: boolean
          match_id?: string
          non_striker_id?: string | null
          out_player_id?: string | null
          over_num?: number
          runs?: number
          striker_id?: string | null
          wicket_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balls_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      ceremony_images: {
        Row: {
          award: string
          created_at: string
          id: string
          image_url: string
          league_id: string
          player_id: string | null
          season_number: number
          team_id: string | null
        }
        Insert: {
          award: string
          created_at?: string
          id?: string
          image_url: string
          league_id: string
          player_id?: string | null
          season_number: number
          team_id?: string | null
        }
        Update: {
          award?: string
          created_at?: string
          id?: string
          image_url?: string
          league_id?: string
          player_id?: string | null
          season_number?: number
          team_id?: string | null
        }
        Relationships: []
      }
      custom_records: {
        Row: {
          created_at: string
          description: string | null
          emoji: string | null
          higher_is_better: boolean
          id: string
          league_id: string
          metric: string
          name: string
          scope: string
          threshold: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          higher_is_better?: boolean
          id?: string
          league_id: string
          metric?: string
          name: string
          scope?: string
          threshold?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          higher_is_better?: boolean
          id?: string
          league_id?: string
          metric?: string
          name?: string
          scope?: string
          threshold?: number | null
        }
        Relationships: []
      }
      leagues: {
        Row: {
          created_at: string
          current_season: number
          device_id: string
          id: string
          name: string
          settings: Json
          teams: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_season?: number
          device_id: string
          id?: string
          name?: string
          settings?: Json
          teams?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_season?: number
          device_id?: string
          id?: string
          name?: string
          settings?: Json
          teams?: Json
          updated_at?: string
        }
        Relationships: []
      }
      match_moments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          league_id: string
          match_id: string
          moment_type: string
          player_id: string | null
          player_name: string | null
          season_number: number | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          league_id: string
          match_id: string
          moment_type: string
          player_id?: string | null
          player_name?: string | null
          season_number?: number | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          league_id?: string
          match_id?: string
          moment_type?: string
          player_id?: string | null
          player_name?: string | null
          season_number?: number | null
          team_id?: string | null
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          home_team: string | null
          id: string
          match_date: string | null
          match_number: number
          player_of_match: string | null
          result_text: string | null
          scorecard: Json | null
          season_id: string
          stage: string
          state: Json | null
          status: string
          team_a: string
          team_b: string
          toss_decision: string | null
          toss_winner: string | null
          venue: string | null
          winner: string | null
        }
        Insert: {
          created_at?: string
          home_team?: string | null
          id?: string
          match_date?: string | null
          match_number: number
          player_of_match?: string | null
          result_text?: string | null
          scorecard?: Json | null
          season_id: string
          stage?: string
          state?: Json | null
          status?: string
          team_a: string
          team_b: string
          toss_decision?: string | null
          toss_winner?: string | null
          venue?: string | null
          winner?: string | null
        }
        Update: {
          created_at?: string
          home_team?: string | null
          id?: string
          match_date?: string | null
          match_number?: number
          player_of_match?: string | null
          result_text?: string | null
          scorecard?: Json | null
          season_id?: string
          stage?: string
          state?: Json | null
          status?: string
          team_a?: string
          team_b?: string
          toss_decision?: string | null
          toss_winner?: string | null
          venue?: string | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          attrs: Json
          base_price: number
          created_at: string
          debut_season: number | null
          form: Json
          id: string
          injury_status: string | null
          injury_until_season: number | null
          league_id: string
          name: string
          nationality: string | null
          personality: string | null
          pfp_url: string | null
          rating: number
          role: string
          seasons_played: number
        }
        Insert: {
          attrs?: Json
          base_price?: number
          created_at?: string
          debut_season?: number | null
          form?: Json
          id?: string
          injury_status?: string | null
          injury_until_season?: number | null
          league_id: string
          name: string
          nationality?: string | null
          personality?: string | null
          pfp_url?: string | null
          rating?: number
          role: string
          seasons_played?: number
        }
        Update: {
          attrs?: Json
          base_price?: number
          created_at?: string
          debut_season?: number | null
          form?: Json
          id?: string
          injury_status?: string | null
          injury_until_season?: number | null
          league_id?: string
          name?: string
          nationality?: string | null
          personality?: string | null
          pfp_url?: string | null
          rating?: number
          role?: string
          seasons_played?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_history: {
        Row: {
          created_at: string
          delta: number
          id: string
          league_id: string
          new_rating: number
          old_rating: number
          player_id: string
          reason: string | null
          season_number: number
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          league_id: string
          new_rating: number
          old_rating: number
          player_id: string
          reason?: string | null
          season_number: number
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          league_id?: string
          new_rating?: number
          old_rating?: number
          player_id?: string
          reason?: string | null
          season_number?: number
        }
        Relationships: []
      }
      records: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          label: string
          league_id: string
          match_id: string | null
          player_id: string | null
          player_name: string | null
          record_key: string
          season_number: number | null
          team_id: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          label: string
          league_id: string
          match_id?: string | null
          player_id?: string | null
          player_name?: string | null
          record_key: string
          season_number?: number | null
          team_id?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          label?: string
          league_id?: string
          match_id?: string | null
          player_id?: string | null
          player_name?: string | null
          record_key?: string
          season_number?: number | null
          team_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "records_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          auction_status: string
          auction_type: string
          champion_team_id: string | null
          created_at: string
          id: string
          league_id: string
          purse: number
          season_number: number
          status: string
          year: number
        }
        Insert: {
          auction_status?: string
          auction_type?: string
          champion_team_id?: string | null
          created_at?: string
          id?: string
          league_id: string
          purse?: number
          season_number: number
          status?: string
          year: number
        }
        Update: {
          auction_status?: string
          auction_type?: string
          champion_team_id?: string | null
          created_at?: string
          id?: string
          league_id?: string
          purse?: number
          season_number?: number
          status?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          account_type: string
          bio: string | null
          created_at: string
          display_name: string
          followers: number
          following: number
          handle: string
          id: string
          league_id: string
          pfp_seed: string | null
          pfp_url: string | null
          player_id: string | null
          team_id: string | null
          verified: boolean
        }
        Insert: {
          account_type?: string
          bio?: string | null
          created_at?: string
          display_name: string
          followers?: number
          following?: number
          handle: string
          id?: string
          league_id: string
          pfp_seed?: string | null
          pfp_url?: string | null
          player_id?: string | null
          team_id?: string | null
          verified?: boolean
        }
        Update: {
          account_type?: string
          bio?: string | null
          created_at?: string
          display_name?: string
          followers?: number
          following?: number
          handle?: string
          id?: string
          league_id?: string
          pfp_seed?: string | null
          pfp_url?: string | null
          player_id?: string | null
          team_id?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      social_follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
          id: string
          league_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
          id?: string
          league_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
          id?: string
          league_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_likes: {
        Row: {
          account_id: string
          created_at: string
          id: string
          league_id: string
          post_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          league_id: string
          post_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          league_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_likes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          account_id: string
          content: string
          created_at: string
          hashtags: string[] | null
          id: string
          image_prompt: string | null
          image_url: string | null
          league_id: string
          likes: number
          match_id: string | null
          post_type: string
          replies: number
          reposts: number
          season_number: number | null
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          league_id: string
          likes?: number
          match_id?: string | null
          post_type?: string
          replies?: number
          reposts?: number
          season_number?: number | null
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          league_id?: string
          likes?: number
          match_id?: string | null
          post_type?: string
          replies?: number
          reposts?: number
          season_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_replies: {
        Row: {
          account_id: string
          content: string
          created_at: string
          id: string
          league_id: string
          likes: number
          post_id: string
        }
        Insert: {
          account_id: string
          content: string
          created_at?: string
          id?: string
          league_id: string
          likes?: number
          post_id: string
        }
        Update: {
          account_id?: string
          content?: string
          created_at?: string
          id?: string
          league_id?: string
          likes?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_replies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          created_at: string
          id: string
          is_captain: boolean
          is_vice_captain: boolean
          player_id: string
          price: number
          retained: boolean
          retention_price: number | null
          season_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_captain?: boolean
          is_vice_captain?: boolean
          player_id: string
          price?: number
          retained?: boolean
          retention_price?: number | null
          season_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_captain?: boolean
          is_vice_captain?: boolean
          player_id?: string
          price?: number
          retained?: boolean
          retention_price?: number | null
          season_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squads_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      trophies: {
        Row: {
          award: string
          created_at: string
          id: string
          league_id: string
          player_id: string | null
          player_name: string | null
          season_number: number
          team_id: string | null
          value: number | null
        }
        Insert: {
          award: string
          created_at?: string
          id?: string
          league_id: string
          player_id?: string | null
          player_name?: string | null
          season_number: number
          team_id?: string | null
          value?: number | null
        }
        Update: {
          award?: string
          created_at?: string
          id?: string
          league_id?: string
          player_id?: string | null
          player_name?: string | null
          season_number?: number
          team_id?: string | null
          value?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
