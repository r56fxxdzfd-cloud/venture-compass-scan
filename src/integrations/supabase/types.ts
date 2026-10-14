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
      action_items: {
        Row: {
          assessment_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          dimension_id: string | null
          done_definition: string | null
          due_date: string | null
          effort: string | null
          first_step: string | null
          id: string
          owner_label: string | null
          priority: number | null
          source_action_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assessment_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          dimension_id?: string | null
          done_definition?: string | null
          due_date?: string | null
          effort?: string | null
          first_step?: string | null
          id?: string
          owner_label?: string | null
          priority?: number | null
          source_action_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          dimension_id?: string | null
          done_definition?: string | null
          due_date?: string | null
          effort?: string | null
          first_step?: string | null
          id?: string
          owner_label?: string | null
          priority?: number | null
          source_action_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_assignments: {
        Row: {
          advisor_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
        }
        Insert: {
          advisor_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          advisor_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_assignments_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: string | null
          value_json: Json | null
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value?: string | null
          value_json?: Json | null
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: string | null
          value_json?: Json | null
        }
        Relationships: []
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
          priority_level: string | null
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
          priority_level?: string | null
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
          priority_level?: string | null
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
          archived_at: string | null
          business_model: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string | null
          demo_day_preferred_date_id: string | null
          demo_day_selected: boolean
          diagnosis_completed_at: string | null
          diagnosis_status: Database["public"]["Enums"]["startup_diagnosis_status"]
          expectations_text: string | null
          headcount: number | null
          id: string
          is_demo: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          pipeline_status: Database["public"]["Enums"]["startup_pipeline_status"]
          responsible_birthdate: string | null
          responsible_email: string | null
          responsible_name: string | null
          responsible_role: string | null
          responsible_whatsapp: string | null
          revenue_2025: string | null
          revenue_2026_target: string | null
          sector: string | null
          stage: string | null
        }
        Insert: {
          archived_at?: string | null
          business_model?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          demo_day_preferred_date_id?: string | null
          demo_day_selected?: boolean
          diagnosis_completed_at?: string | null
          diagnosis_status?: Database["public"]["Enums"]["startup_diagnosis_status"]
          expectations_text?: string | null
          headcount?: number | null
          id?: string
          is_demo?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          pipeline_status?: Database["public"]["Enums"]["startup_pipeline_status"]
          responsible_birthdate?: string | null
          responsible_email?: string | null
          responsible_name?: string | null
          responsible_role?: string | null
          responsible_whatsapp?: string | null
          revenue_2025?: string | null
          revenue_2026_target?: string | null
          sector?: string | null
          stage?: string | null
        }
        Update: {
          archived_at?: string | null
          business_model?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          demo_day_preferred_date_id?: string | null
          demo_day_selected?: boolean
          diagnosis_completed_at?: string | null
          diagnosis_status?: Database["public"]["Enums"]["startup_diagnosis_status"]
          expectations_text?: string | null
          headcount?: number | null
          id?: string
          is_demo?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          pipeline_status?: Database["public"]["Enums"]["startup_pipeline_status"]
          responsible_birthdate?: string | null
          responsible_email?: string | null
          responsible_name?: string | null
          responsible_role?: string | null
          responsible_whatsapp?: string | null
          revenue_2025?: string | null
          revenue_2026_target?: string | null
          sector?: string | null
          stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_demo_day_preferred_date_id_fkey"
            columns: ["demo_day_preferred_date_id"]
            isOneToOne: false
            referencedRelation: "demo_day_dates"
            referencedColumns: ["id"]
          },
        ]
      }
      company_demo_day_preferences: {
        Row: {
          company_id: string
          created_at: string
          demo_day_date_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          demo_day_date_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          demo_day_date_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_demo_day_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_demo_day_preferences_demo_day_date_id_fkey"
            columns: ["demo_day_date_id"]
            isOneToOne: false
            referencedRelation: "demo_day_dates"
            referencedColumns: ["id"]
          },
        ]
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
      council_actions: {
        Row: {
          company_id: string
          completed_at: string | null
          counselor_notes: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          effort: string | null
          expected_evidence: string | null
          id: string
          impact: string | null
          meeting_id: string
          owner_name: string | null
          priority: string | null
          related_dimension: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          counselor_notes?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          effort?: string | null
          expected_evidence?: string | null
          id?: string
          impact?: string | null
          meeting_id: string
          owner_name?: string | null
          priority?: string | null
          related_dimension?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          counselor_notes?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          effort?: string | null
          expected_evidence?: string | null
          id?: string
          impact?: string | null
          meeting_id?: string
          owner_name?: string | null
          priority?: string | null
          related_dimension?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "council_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_actions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "council_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      council_agenda_templates: {
        Row: {
          associated_red_flags: string[]
          created_at: string
          dimension_id: string
          dimension_label: string
          expected_evidence: string[]
          id: string
          is_active: boolean
          key_questions: string[]
          objective: string
          priority: string
          sort_order: number
          suggested_actions: string[]
          title: string
          updated_at: string
          when_to_use: string | null
        }
        Insert: {
          associated_red_flags?: string[]
          created_at?: string
          dimension_id: string
          dimension_label: string
          expected_evidence?: string[]
          id?: string
          is_active?: boolean
          key_questions?: string[]
          objective: string
          priority?: string
          sort_order?: number
          suggested_actions?: string[]
          title: string
          updated_at?: string
          when_to_use?: string | null
        }
        Update: {
          associated_red_flags?: string[]
          created_at?: string
          dimension_id?: string
          dimension_label?: string
          expected_evidence?: string[]
          id?: string
          is_active?: boolean
          key_questions?: string[]
          objective?: string
          priority?: string
          sort_order?: number
          suggested_actions?: string[]
          title?: string
          updated_at?: string
          when_to_use?: string | null
        }
        Relationships: []
      }
      council_dimension_progress: {
        Row: {
          company_id: string
          counselor_comment: string | null
          created_at: string
          current_perceived_score: number | null
          dimension_id: string
          dimension_label: string
          evidence_note: string | null
          id: string
          initial_score: number | null
          meeting_id: string
          trend: string
          updated_at: string
        }
        Insert: {
          company_id: string
          counselor_comment?: string | null
          created_at?: string
          current_perceived_score?: number | null
          dimension_id: string
          dimension_label: string
          evidence_note?: string | null
          id?: string
          initial_score?: number | null
          meeting_id: string
          trend?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          counselor_comment?: string | null
          created_at?: string
          current_perceived_score?: number | null
          dimension_id?: string
          dimension_label?: string
          evidence_note?: string | null
          id?: string
          initial_score?: number | null
          meeting_id?: string
          trend?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_dimension_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_dimension_progress_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "council_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      council_meetings: {
        Row: {
          attendees_counselors: string[] | null
          attendees_founders: string[] | null
          company_id: string
          counselor_confidence_score: number | null
          created_at: string | null
          created_by: string | null
          decisions: string | null
          executive_summary: string | null
          id: string
          key_blockers: string | null
          key_progress: string | null
          main_topic: string | null
          meeting_date: string
          meeting_type: string
          next_agenda: string | null
          perceived_progress_score: number | null
          recommendations: string | null
          related_dimensions: string[] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          attendees_counselors?: string[] | null
          attendees_founders?: string[] | null
          company_id: string
          counselor_confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          decisions?: string | null
          executive_summary?: string | null
          id?: string
          key_blockers?: string | null
          key_progress?: string | null
          main_topic?: string | null
          meeting_date: string
          meeting_type: string
          next_agenda?: string | null
          perceived_progress_score?: number | null
          recommendations?: string | null
          related_dimensions?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          attendees_counselors?: string[] | null
          attendees_founders?: string[] | null
          company_id?: string
          counselor_confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          decisions?: string | null
          executive_summary?: string | null
          id?: string
          key_blockers?: string | null
          key_progress?: string | null
          main_topic?: string | null
          meeting_date?: string
          meeting_type?: string
          next_agenda?: string | null
          perceived_progress_score?: number | null
          recommendations?: string | null
          related_dimensions?: string[] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "council_meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_meetings_created_by_fkey"
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
      demo_day_dates: {
        Row: {
          capacity: number | null
          created_at: string
          date: string
          date_label: string | null
          end_time: string | null
          event_id: string | null
          id: string
          is_active: boolean
          location_or_format: string | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          date: string
          date_label?: string | null
          end_time?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean
          location_or_format?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          date?: string
          date_label?: string | null
          end_time?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean
          location_or_format?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_day_dates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "intake_events"
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
      intake_events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          public_token: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          public_token?: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          public_token?: string
          slug?: string
        }
        Relationships: []
      }
      intake_submissions: {
        Row: {
          assessment_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          event_id: string | null
          expires_at: string | null
          flow_completed_at: string | null
          id: string
          imported_at: string | null
          label: string | null
          payload: Json | null
          status: string
          submitted_at: string | null
          token: string
        }
        Insert: {
          assessment_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_at?: string | null
          flow_completed_at?: string | null
          id?: string
          imported_at?: string | null
          label?: string | null
          payload?: Json | null
          status?: string
          submitted_at?: string | null
          token: string
        }
        Update: {
          assessment_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_at?: string | null
          flow_completed_at?: string | null
          id?: string
          imported_at?: string | null
          label?: string | null
          payload?: Json | null
          status?: string
          submitted_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_submissions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "intake_events"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notifications: {
        Row: {
          assessment_id: string | null
          body: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          read_by: string | null
          startup_id: string | null
          title: string
          type: string
        }
        Insert: {
          assessment_id?: string | null
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          read_by?: string | null
          startup_id?: string | null
          title: string
          type: string
        }
        Update: {
          assessment_id?: string | null
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          read_by?: string | null
          startup_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notifications_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notifications_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notifications_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_logs: {
        Row: {
          attendees: string | null
          company_id: string
          created_at: string
          created_by: string | null
          decisions: string | null
          id: string
          meeting_date: string
          next_steps: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          attendees?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          id?: string
          meeting_date?: string
          next_steps?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          attendees?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          id?: string
          meeting_date?: string
          next_steps?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_answers: {
        Row: {
          answer_json: Json | null
          answer_text: string
          created_at: string
          id: string
          question_id: string
          startup_id: string
          updated_at: string
        }
        Insert: {
          answer_json?: Json | null
          answer_text: string
          created_at?: string
          id?: string
          question_id: string
          startup_id: string
          updated_at?: string
        }
        Update: {
          answer_json?: Json | null
          answer_text?: string
          created_at?: string
          id?: string
          question_id?: string
          startup_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "onboarding_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_answers_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_questions: {
        Row: {
          created_at: string
          display_order: number
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          question_key: string
          question_text: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order: number
          field_type: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          question_key: string
          question_text: string
          source: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          question_key?: string
          question_text?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
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
      startup_documents: {
        Row: {
          created_at: string
          description: string | null
          document_category: Database["public"]["Enums"]["startup_document_category"]
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          mime_type: string
          related_entity_id: string | null
          related_entity_type: string | null
          startup_id: string
          updated_at: string
          uploaded_by_user_id: string
          visibility: Database["public"]["Enums"]["startup_document_visibility"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_category?: Database["public"]["Enums"]["startup_document_category"]
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          mime_type: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          startup_id: string
          updated_at?: string
          uploaded_by_user_id?: string
          visibility?: Database["public"]["Enums"]["startup_document_visibility"]
        }
        Update: {
          created_at?: string
          description?: string | null
          document_category?: Database["public"]["Enums"]["startup_document_category"]
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          mime_type?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          startup_id?: string
          updated_at?: string
          uploaded_by_user_id?: string
          visibility?: Database["public"]["Enums"]["startup_document_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "startup_documents_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_events: {
        Row: {
          assessment_id: string | null
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          metadata: Json
          new_status: string | null
          old_status: string | null
          startup_id: string | null
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          metadata?: Json
          new_status?: string | null
          old_status?: string | null
          startup_id?: string | null
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          new_status?: string | null
          old_status?: string | null
          startup_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_events_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      can_access_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_operate_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_operate_platform: { Args: { _user_id: string }; Returns: boolean }
      can_upload_startup_document_object: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      current_profile_role: { Args: never; Returns: string }
      delete_company: { Args: { p_company_id: string }; Returns: undefined }
      get_unconfirmed_user_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_analyst: { Args: { _user_id: string }; Returns: boolean }
      is_advisor_of: { Args: { p_company_id: string }; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      is_approved_member: { Args: { _user_id: string }; Returns: boolean }
      is_demo_admin: { Args: { _user_id: string }; Returns: boolean }
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
      is_jv_admin: { Args: { _user_id: string }; Returns: boolean }
      is_jv_member: { Args: { _user_id: string }; Returns: boolean }
      is_jv_operator: { Args: never; Returns: boolean }
      is_jv_staff: { Args: never; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      set_company_archived: {
        Args: { p_archived: boolean; p_company_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "jv_admin"
        | "jv_analyst"
        | "jv_viewer"
        | "super_admin"
        | "demo_user"
        | "demo_admin"
        | "jv_advisor"
      startup_diagnosis_status: "not_started" | "started" | "completed"
      startup_document_category:
        | "diagnostic_external"
        | "pitch_deck"
        | "financial"
        | "commercial"
        | "product"
        | "legal_corporate"
        | "board_meeting"
        | "action_plan"
        | "other"
      startup_document_visibility: "internal_only" | "startup_and_internal"
      startup_pipeline_status:
        | "invited"
        | "registration_started"
        | "registration_completed"
        | "diagnosis_started"
        | "diagnosis_completed"
        | "debrief_scheduled"
        | "debrief_completed"
        | "selected_for_pilot"
        | "standby"
        | "in_followup"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "jv_admin",
        "jv_analyst",
        "jv_viewer",
        "super_admin",
        "demo_user",
        "demo_admin",
        "jv_advisor",
      ],
      startup_diagnosis_status: ["not_started", "started", "completed"],
      startup_document_category: [
        "diagnostic_external",
        "pitch_deck",
        "financial",
        "commercial",
        "product",
        "legal_corporate",
        "board_meeting",
        "action_plan",
        "other",
      ],
      startup_document_visibility: ["internal_only", "startup_and_internal"],
      startup_pipeline_status: [
        "invited",
        "registration_started",
        "registration_completed",
        "diagnosis_started",
        "diagnosis_completed",
        "debrief_scheduled",
        "debrief_completed",
        "selected_for_pilot",
        "standby",
        "in_followup",
      ],
    },
  },
} as const
