export interface Founder {
  id: string;
  company_id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
}

export interface FounderAssessment {
  id: string;
  founder_id: string;
  company_id: string;
  semester: string;
  assessment_date: string;
  score_auto: number | null;
  score_jv: number | null;
  score_used: number | null;
  stage_label: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  founder?: Founder;
}

export interface FounderPillarScore {
  id: string;
  founder_assessment_id: string;
  pillar_number: number;
  pillar_name: string;
  weight: number;
  score_auto: number | null;
  score_jv: number | null;
  evidence_auto: string | null;
  evidence_jv: string | null;
  delta: number;
}

export interface FounderActionPlan {
  id: string;
  founder_assessment_id: string;
  pillar_focus_1: number | null;
  pillar_focus_2: number | null;
  actions_30d: ActionItem[];
  notes_60d: string | null;
  notes_90d: string | null;
}

export interface ActionItem {
  pillar: number;
  action: string;
  expected_delivery: string;
  kpi: string;
  key_behavior: string;
  anti_goal: string;
}

export interface FounderCheckin {
  id: string;
  founder_assessment_id: string;
  checkin_date: string;
  delivered_summary: string;
  evidence_link: string | null;
  next_step: string;
  next_step_owner: string;
  next_step_due: string | null;
  blocked: string | null;
  decision_made: string | null;
  quick_score: number | null;
}
