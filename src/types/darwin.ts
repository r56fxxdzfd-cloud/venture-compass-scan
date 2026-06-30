export type AppRole = 'super_admin' | 'jv_admin' | 'demo_admin' | 'demo_user' | 'jv_analyst' | 'jv_viewer' | 'jv_advisor';

export type ActionItemStatus = 'todo' | 'doing' | 'done' | 'blocked';

export interface ActionItem {
  id: string;
  company_id: string;
  assessment_id: string | null;
  source_action_id: string | null;
  title: string;
  description: string | null;
  first_step: string | null;
  done_definition: string | null;
  dimension_id: string | null;
  owner_label: string | null;
  status: ActionItemStatus;
  effort: 'S' | 'M' | 'L' | null;
  priority: number | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingLog {
  id: string;
  company_id: string;
  meeting_date: string;
  attendees: string | null;
  decisions: string | null;
  next_steps: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type IntakeStatus = 'pending' | 'submitted' | 'imported' | 'expired';

export interface IntakeSubmission {
  id: string;
  token: string;
  status: IntakeStatus;
  label: string | null;
  payload: IntakePayload | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  submitted_at: string | null;
  imported_at: string | null;
  expires_at: string | null;
}

export interface IntakePayload {
  // Perguntas do Formulário Inicial Darwin Growth
  full_name?: string;        // 1. Nome completo
  company_name?: string;     // 2. Nome da empresa
  role?: string;             // 3. Cargo atual
  email?: string;            // 4. E-mail
  whatsapp?: string;         // 5. WhatsApp
  birth_date?: string;       // 6. Data de nascimento (DD/MM/AAAA)
  summary?: string;          // 7. Resumo da empresa
  stage_label?: string;      // 8. Estágio informado (Validação/Tração/...)
  headcount?: string;        // 9. Nº de colaboradores
  revenue_2025?: string;     // 10. Faturamento 2025
  revenue_goal_2026?: string;// 11. Meta de faturamento 2026
  // Chaves canônicas mantidas p/ compatibilidade com a edge function publicada
  founders?: string;
  stage?: string;
  business_model?: string;
  contact?: string;
  [key: string]: string | undefined;
}

export interface AdvisorAssignment {
  id: string;
  company_id: string;
  advisor_id: string;
  created_by: string | null;
  created_at: string;
}

export type ProfileStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  full_name: string | null;
  created_at: string;
  status: ProfileStatus;
  requested_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Company {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  sector: string | null;
  stage: 'pre_seed' | 'seed' | 'series_a' | null;
  business_model: string | null;
  created_at: string;
  is_demo?: boolean;
  archived_at?: string | null;
  demo_day_selected?: boolean;
}

export interface ConfigVersion {
  id: string;
  version_name: string;
  status: 'draft' | 'published' | 'archived';
  config_json: ConfigJSON;
  created_by: string | null;
  created_at: string;
  published_at: string | null;
}

export interface ConfigJSON {
  dimensions: ConfigDimension[];
  questions: ConfigQuestion[];
  weights_by_stage: Record<string, Record<string, number>>;
  targets_by_stage: Record<string, Record<string, StageTarget>>;
  methodology: string;
  simulator: {
    presets: ConfigPreset[];
  };
  deep_dive_prompts?: Record<string, string[]>;
  red_flags?: ConfigRedFlag[];
  glossary?: Record<string, string>;
  action_library?: Record<string, ConfigParetoAction[]>;
}

export type StageTarget = number | {
  benchmark?: number;
  potential?: number;
};

export interface ConfigParetoAction {
  id: string;
  title: string;
  description: string;
  first_step: string;
  done_definition: string;
  effort: 'S' | 'M' | 'L';
  time_to_impact_days: number;
  impact_weight: number;
  stage_tags: string[];
  business_model_tags: string[];
  addresses_red_flags?: string[];
  kpi_hint?: string;
  dimension_id: string;
}

export interface ConfigDimension {
  id: string;
  label: string;
  sort_order: number;
}

export interface ConfigQuestion {
  id: string;
  dimension_id: string;
  text: string;
  type?: string;
  scale_id?: string;
  tags?: Record<string, unknown>;
  tooltip?: {
    definition?: string;
    why?: string;
    anchors?: Record<number, string>;
    evidence_examples?: string[];
  };
  is_active?: boolean;
  sort_order: number;
}

export interface RedFlagTrigger {
  type: 'score_threshold' | 'numeric_threshold' | 'numeric_missing' | 'requires' | 'dimension_score_below' | 'context_field_below' | 'context_field_missing' | 'question_score_below' | 'red_flag_triggered';
  dimension_id?: string;
  question_id?: string;
  threshold?: number;
  value?: number;
  value_by_stage?: Record<string, number>;
  field?: string;
  fields_any?: string[];
  op?: string;
  requires?: { field: string; op: string; value: unknown }[];
}

export interface ConfigRedFlag {
  code: string;
  label: string;
  severity: string;
  triggers: RedFlagTrigger[];
  actions: string[];
}

export interface ConfigPreset {
  id: string;
  label: string;
  dimension_scores: Record<string, number>;
  numeric_context_defaults?: Record<string, number>;
  expected_red_flags?: string[];
}

export interface Assessment {
  id: string;
  company_id: string;
  config_version_id: string;
  status: 'in_progress' | 'completed';
  is_simulation: boolean;
  stage: 'pre_seed' | 'seed' | 'series_a' | null;
  business_model: string | null;
  customer_type: string | null;
  revenue_model: string | null;
  context_numeric: Record<string, number>;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  company?: Company;
}

export interface Answer {
  id: string;
  assessment_id: string;
  question_id: string;
  value: number | null;
  is_na: boolean;
  notes: string | null;
  created_at: string;
  is_demo?: boolean;
}

export interface AssessmentRedFlag {
  id: string;
  assessment_id: string;
  red_flag_code: string;
  status: 'triggered' | 'resolved';
  notes: string | null;
  created_at: string;
  is_demo?: boolean;
}

// Scoring types
export interface DimensionScore {
  dimension_id: string;
  label: string;
  score: number;
  target: number;
  coverage: number;
  answered: number;
  total: number;
}

export interface AssessmentResult {
  overall_score: number;
  overall_weighted: number;
  dimension_scores: DimensionScore[];
  red_flags: EvaluatedRedFlag[];
  deep_dive_dimensions: string[];
}

export interface EvaluatedRedFlag {
  code: string;
  label: string;
  severity: string;
  actions: string[];
}
