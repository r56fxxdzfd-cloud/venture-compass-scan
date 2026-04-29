export type MeetingType = 'collective' | 'individual' | 'extraordinary';
export type ActionPriority = 'low' | 'medium' | 'high';
export type ActionStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
export type DimensionTrend = 'improving' | 'stable' | 'worsening' | 'insufficient_evidence';

export interface CouncilMeeting {
  id: string;
  company_id: string;
  meeting_date: string;
  meeting_type: MeetingType;
  title: string | null;
  main_topic: string | null;
  related_dimensions: string[] | null;
  attendees_counselors: string[] | null;
  attendees_founders: string[] | null;
  executive_summary: string | null;
  key_progress: string | null;
  key_blockers: string | null;
  decisions: string | null;
  recommendations: string | null;
  next_agenda: string | null;
  perceived_progress_score: number | null;
  counselor_confidence_score: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CouncilAction {
  id: string;
  meeting_id: string;
  company_id: string;
  title: string;
  description: string | null;
  related_dimension: string | null;
  owner_name: string | null;
  due_date: string | null;
  priority: ActionPriority;
  impact: ActionPriority | null;
  effort: ActionPriority | null;
  status: ActionStatus;
  expected_evidence: string | null;
  counselor_notes: string | null;
  completed_at: string | null;
}

export interface CouncilDimensionProgress {
  id: string;
  meeting_id: string;
  company_id: string;
  dimension_id: string;
  dimension_label: string;
  initial_score: number | null;
  current_perceived_score: number | null;
  trend: DimensionTrend;
  evidence_note: string | null;
  counselor_comment: string | null;
  created_at: string | null;
  updated_at: string | null;
}
