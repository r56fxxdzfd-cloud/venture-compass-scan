export type MeetingType = 'diagnostic_initial' | 'collective' | 'individual' | 'extraordinary';
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

export type CouncilAgendaTemplatePriority = 'low' | 'medium' | 'high';

export interface CouncilAgendaTemplate {
  id: string;
  dimension_id: string;
  dimension_label: string;
  title: string;
  objective: string;
  key_questions: string[];
  expected_evidence: string[];
  suggested_actions: string[];
  associated_red_flags: string[];
  when_to_use: string | null;
  priority: CouncilAgendaTemplatePriority;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type DraftConfidence = 'high' | 'medium' | 'low';

export interface SuggestedCouncilActionDraft {
  title: string;
  description: string;
  owner_name: string;
  due_date: string;
  related_dimension: string;
  priority: ActionPriority;
  impact: ActionPriority;
  effort: ActionPriority;
  expected_evidence: string;
  confidence: DraftConfidence;
  source_excerpt: string;
  approved?: boolean;
}

export interface DimensionProgressSuggestionDraft {
  dimension_id: string;
  dimension_label: string;
  current_perceived_score: number | null;
  trend: DimensionTrend;
  evidence_note: string;
  counselor_comment: string;
  confidence: DraftConfidence;
  source_excerpt: string;
  approved?: boolean;
}

export interface UncertainItemDraft {
  type: 'owner' | 'deadline' | 'decision' | 'action' | 'dimension' | 'other';
  note: string;
  source_excerpt: string;
}

export interface CouncilMeetingNotesDraft {
  executive_summary: string;
  key_progress: string;
  key_blockers: string;
  decisions: string;
  recommendations: string;
  next_agenda: string;
  related_dimensions: string[];
  suggested_actions: SuggestedCouncilActionDraft[];
  dimension_progress_suggestions: DimensionProgressSuggestionDraft[];
  uncertain_items: UncertainItemDraft[];
}
