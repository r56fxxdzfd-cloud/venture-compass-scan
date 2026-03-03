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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          assessment_id: string
          created_at: string | null
          id: string
          is_na: boolean | null
          notes: string | null
          question_id: string
          value: number | null
        }
        Insert: {
          assessment_id: string
          created_at?: string | null
          id?: string
          is_na?: boolean | null
          notes?: string | null
          question_id: string
          value?: number | null
        }
        Update: {
          assessment_id?: string
          created_at?: string | null
          id?: string
          is_na?: boolean | null
          notes?: string | null
          question_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_red_flags: {
        Row: {
          assessment_id: string
          created_at: string | null
          id: string
          notes: string | null
          red_flag_code: string
          status: string | null
        }
        Insert: {
          assessment_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          red_flag_code: string
          status?: string | null
        }
        Update: {
          assessment_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          red_flag_code?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_red_flags_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          business_model: string | null
          company_id: string
          completed_at: string | null
          config_version_id: string
          context_numeric: Json | null
          created_at: string | null
          created_by: string | null
          customer_type: string | null
          id: string
          is_simulation: boolean | null
          revenue_model: string | null
          stage: string | null
          status: string | null
        }
        Insert: {
          business_model?: string | null
          company_id: string
          completed_at?: string | null
          config_version_id: string
          context_numeric?: Json | null
          created_at?: string | null
          created_by?: string | null
          customer_type?: string | null
          id?: string
          is_simulation?: boolean | null
          revenue_model?: string | null
          stage?: string | null
          status?: string | null
        }
        Update: {
          business_model?: string | null
          company_id?: string
          completed_at?: string | null
          config_version_id?: string
          context_numeric?: Json | null
          created_at?: string | null
          created_by?: string | null
          customer_type?: string | null
          id?: string
          is_simulation?: boolean | null
          revenue_model?: string | null
          stage?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_config_version_id_fkey"
            columns: ["config_version_id"]
            isOneToOne: false
            referencedRelation: "config_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          business_model: string | null
          cnpj: string | null
          created_at: string | null
          id: string
          legal_name: string | null
          name: string
          sector: string | null
          stage: string | null
        }
        Insert: {
          business_model?: string | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          legal_name?: string | null
          name: string
          sector?: string | null
          stage?: string | null
        }
        Update: {
          business_model?: string | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          sector?: string | null
          stage?: string | null
        }
        Relationships: []
      }
      config_versions: {
        Row: {
          config_json: Json
          created_at: string | null
          created_by: string | null
          id: string
          published_at: string | null
          status: string | null
          version_name: string
        }
        Insert: {
          config_json: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          published_at?: string | null
          status?: string | null
          version_name: string
        }
        Update: {
          config_json?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          published_at?: string | null
          status?: string | null
          version_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_dive_prompts: {
        Row: {
          config_version_id: string
          dimension_id: string
          id: string
          prompt: string
          sort_order: number | null
        }
        Insert: {
          config_version_id: string
          dimension_id: string
          id?: string
          prompt: string
          sort_order?: number | null
        }
        Update: {
          config_version_id?: string
          dimension_id?: string
          id?: string
          prompt?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deep_dive_prompts_config_version_id_fkey"
            columns: ["config_version_id"]
            isOneToOne: false
            referencedRelation: "config_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      dimensions: {
        Row: {
          config_version_id: string
          id: string
          label: string
          sort_order: number | null
        }
        Insert: {
          config_version_id: string
          id: string
          label: string
          sort_order?: number | null
        }
        Update: {
          config_version_id?: string
          id?: string
          label?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dimensions_config_version_id_fkey"
            columns: ["config_version_id"]
            isOneToOne: false
            referencedRelation: "config_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_action_plans: {
        Row: {
          actions_30d: Json | null
          founder_assessment_id: string
          id: string
          notes_60d: string | null
          notes_90d: string | null
          pillar_focus_1: number | null
          pillar_focus_2: number | null
        }
        Insert: {
          actions_30d?: Json | null
          founder_assessment_id: string
          id?: string
          notes_60d?: string | null
          notes_90d?: string | null
          pillar_focus_1?: number | null
          pillar_focus_2?: number | null
        }
        Update: {
          actions_30d?: Json | null
          founder_assessment_id?: string
          id?: string
          notes_60d?: string | null
          notes_90d?: string | null
          pillar_focus_1?: number | null
          pillar_focus_2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_action_plans_founder_assessment_id_fkey"
            columns: ["founder_assessment_id"]
            isOneToOne: false
            referencedRelation: "founder_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_assessments: {
        Row: {
          assessment_date: string
          company_id: string
          created_at: string
          created_by: string | null
          founder_id: string
          id: string
          notes: string | null
          score_auto: number | null
          score_jv: number | null
          score_used: number | null
          semester: string
          stage_label: string | null
        }
        Insert: {
          assessment_date?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          founder_id: string
          id?: string
          notes?: string | null
          score_auto?: number | null
          score_jv?: number | null
          score_used?: number | null
          semester: string
          stage_label?: string | null
        }
        Update: {
          assessment_date?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          founder_id?: string
          id?: string
          notes?: string | null
          score_auto?: number | null
          score_jv?: number | null
          score_used?: number | null
          semester?: string
          stage_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_assessments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_assessments_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_checkins: {
        Row: {
          blocked: string | null
          checkin_date: string
          decision_made: string | null
          delivered_summary: string
          evidence_link: string | null
          founder_assessment_id: string
          id: string
          next_step: string
          next_step_due: string | null
          next_step_owner: string
          quick_score: number | null
        }
        Insert: {
          blocked?: string | null
          checkin_date?: string
          decision_made?: string | null
          delivered_summary?: string
          evidence_link?: string | null
          founder_assessment_id: string
          id?: string
          next_step?: string
          next_step_due?: string | null
          next_step_owner?: string
          quick_score?: number | null
        }
        Update: {
          blocked?: string | null
          checkin_date?: string
          decision_made?: string | null
          delivered_summary?: string
          evidence_link?: string | null
          founder_assessment_id?: string
          id?: string
          next_step?: string
          next_step_due?: string | null
          next_step_owner?: string
          quick_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_checkins_founder_assessment_id_fkey"
            columns: ["founder_assessment_id"]
            isOneToOne: false
            referencedRelation: "founder_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_pillar_scores: {
        Row: {
          delta: number | null
          evidence_auto: string | null
          evidence_jv: string | null
          founder_assessment_id: string
          id: string
          pillar_name: string
          pillar_number: number
          score_auto: number | null
          score_jv: number | null
          weight: number
        }
        Insert: {
          delta?: number | null
          evidence_auto?: string | null
          evidence_jv?: string | null
          founder_assessment_id: string
          id?: string
          pillar_name: string
          pillar_number: number
          score_auto?: number | null
          score_jv?: number | null
          weight?: number
        }
        Update: {
          delta?: number | null
          evidence_auto?: string | null
          evidence_jv?: string | null
          founder_assessment_id?: string
          id?: string
          pillar_name?: string
          pillar_number?: number
          score_auto?: number | null
          score_jv?: number | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "founder_pillar_scores_founder_assessment_id_fkey"
            columns: ["founder_assessment_id"]
            isOneToOne: false
            referencedRelation: "founder_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      founders: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          role: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          role?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "founders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      glossary_terms: {
        Row: {
          config_version_id: string
          definition: string
          id: string
          term: string
        }
        Insert: {
          config_version_id: string
          definition: string
          id?: string
          term: string
        }
        Update: {
          config_version_id?: string
          definition?: string
          id?: string
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "glossary_terms_config_version_id_fkey"
            columns: ["config_version_id"]
            isOneToOne: false
            referencedRelation: "config_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          full_name: string | null
          id: string
          requested_at: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          requested_at?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          requested_at?: string | null
          status?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          config_version_id: string
          dimension_id: string
          id: string
          is_active: boolean | null
          scale_id: string | null
          sort_order: number | null
          tags: Json | null
          text: string
          tooltip: Json | null
          type: string | null
        }
        Insert: {
          config_version_id: string
          dimension_id: string
          id: string
          is_active?: boolean | null
          scale_id?: string | null
          sort_order?: number | null
          tags?: Json | null
          text: string
          tooltip?: Json | null
          type?: string | null
        }
        Update: {
          config_version_id?: string
          dimension_id?: string
          id?: string
          is_active?: boolean | null
          scale_id?: string | null
          sort_order?: number | null
          tags?: Json | null
          text?: string
          tooltip?: Json | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_config_version_id_fkey"
            columns: ["config_version_id"]
            isOneToOne: false
            referencedRelation: "config_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      red_flags: {
        Row: {
          actions: Json | null
          code: string
          config_version_id: string
          label: string
          severity: string | null
          triggers: Json | null
        }
        Insert: {
          actions?: Json | null
          code: string
          config_version_id: string
          label: string
          severity?: string | null
          triggers?: Json | null
        }
        Update: {
          actions?: Json | null
          code?: string
          config_version_id?: string
          label?: string
          severity?: string | null
          triggers?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "red_flags_config_version_id_fkey"
            columns: ["config_version_id"]
            isOneToOne: false
            referencedRelation: "config_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      simulator_presets: {
        Row: {
          config_version_id: string
          dimension_scores: Json | null
          expected_red_flags: Json | null
          id: string
          label: string
          numeric_context_defaults: Json | null
        }
        Insert: {
          config_version_id: string
          dimension_scores?: Json | null
          expected_red_flags?: Json | null
          id: string
          label: string
          numeric_context_defaults?: Json | null
        }
        Update: {
          config_version_id?: string
          dimension_scores?: Json | null
          expected_red_flags?: Json | null
          id?: string
          label?: string
          numeric_context_defaults?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "simulator_presets_config_version_id_fkey"
            columns: ["config_version_id"]
            isOneToOne: false
            referencedRelation: "config_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_analyst: { Args: { _user_id: string }; Returns: boolean }
      is_approved_member: { Args: { _user_id: string }; Returns: boolean }
      is_jv_member: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "jv_admin" | "jv_analyst" | "jv_viewer" | "super_admin"
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
      app_role: ["jv_admin", "jv_analyst", "jv_viewer", "super_admin"],
    },
  },
} as const
