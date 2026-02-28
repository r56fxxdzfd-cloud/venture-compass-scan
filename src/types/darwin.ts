export type AppRole = 'jv_admin' | 'jv_analyst' | 'jv_viewer';

export interface Profile {
  id: string;
  full_name: string | null;
  created_at: string;
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
  targets_by_stage: Record<string, Record<string, number>>;
  methodology: string;
  simulator: {
    presets: ConfigPreset[];
  };
  deep_dive_prompts?: Record<string, string[]>;
  red_flags?: ConfigRedFlag[];
  glossary?: Record<string, string>;
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

export interface ConfigRedFlag {
  code: string;
  label: string;
  severity: string;
  triggers: {
    type: 'score_threshold' | 'numeric_threshold' | 'numeric_missing' | 'requires' | 'dimension_score_below' | 'context_field_below' | 'context_field_missing' | 'question_score_below' | 'red_flag_triggered';
    dimension_id?: string;
    question_id?: string;
    threshold?: number;
    field?: string;
  }[];
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
}

export interface AssessmentRedFlag {
  id: string;
  assessment_id: string;
  red_flag_code: string;
  status: 'triggered' | 'resolved';
  notes: string | null;
  created_at: string;
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
