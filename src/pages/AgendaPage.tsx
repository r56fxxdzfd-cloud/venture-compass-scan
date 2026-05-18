import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DimensionBadge, getDimensionFullLabel } from '@/components/DimensionBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import type { CouncilAction, CouncilDimensionProgress, CouncilMeeting, CouncilMeetingNotesDraft, DimensionTrend, MeetingType } from '@/types/council';
import { BackToTopFooter } from '@/components/BackToTopFooter';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, FileStack, Plus, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

type Company = { id: string; name: string };
type DimensionCatalogItem = { id: string; label: string; sort_order: number | null };
const mt = { collective: 'Coletivo', individual: 'Individual', extraordinary: 'Extraordinário' } as const;
const mainTopics = ['Diagnóstico inicial','Revisão de execução','Finanças e sustentabilidade','Governança e riscos','Pessoas e liderança','Processos e métricas','Estratégia e foco','Captação e parcerias','Impacto e entrega','Revisão de ciclo','Outro'] as const;
const trendLabels: Record<DimensionTrend | 'sem_trend', string> = {
  improving: 'Melhorando',
  stable: 'Estável',
  worsening: 'Piorando',
  insufficient_evidence: 'Sem evidência',
  sem_trend: 'Sem evidência',
};
const officialDimensionOrder = ['IC', 'PL', 'GR', 'EE', 'PM', 'FS', 'MN', 'GT', 'PT'] as const;
const trendToneClasses: Record<DimensionTrend | 'sem_trend', string> = {
  improving: 'text-emerald-500',
  stable: 'text-slate-500',
  worsening: 'text-rose-500',
  insufficient_evidence: 'text-muted-foreground',
  sem_trend: 'text-muted-foreground',
};
const officialDimensions = new Set<string>(officialDimensionOrder);
const monthNamesPtBr = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] as const;

const statusBadgeClasses = (status?: 'Crítico' | 'Atenção' | 'Saudável') => {
  if (status === 'Crítico') return 'border-destructive/40 bg-destructive/10 text-destructive shadow-sm shadow-destructive/10';
  if (status === 'Atenção') return 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300';
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
};

const statusAccentClasses = (status?: 'Crítico' | 'Atenção' | 'Saudável') => {
  if (status === 'Crítico') return 'border-l-destructive/80 bg-gradient-to-r from-destructive/10 via-card/95 to-card/95';
  if (status === 'Atenção') return 'border-l-amber-500/80 bg-gradient-to-r from-amber-500/10 via-card/95 to-card/95';
  return 'border-l-emerald-500/70 bg-gradient-to-r from-emerald-500/10 via-card/95 to-card/95';
};

const statusDotClasses = (status?: 'Crítico' | 'Atenção' | 'Saudável') => {
  if (status === 'Crítico') return 'bg-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.12)]';
  if (status === 'Atenção') return 'bg-amber-500 shadow-[0_0_0_3px_rgb(245_158_11/0.13)]';
  return 'bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.10)]';
};

const timelineAlertBadgeClasses = (alertBadge: string) => {
  if (alertBadge === 'Atrasadas + travadas') return 'border-destructive/35 bg-destructive/10 text-destructive';
  if (alertBadge === 'Ações travadas') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (alertBadge === 'Ações atrasadas') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-primary/25 bg-primary/10 text-primary';
};

// meeting_date is a date-only field; never persist via Date.toISOString().
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const getDateParts = (dateString: string) => {
  const [yearStr, monthStr, dayStr] = dateString.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
};

// meeting_date is a date-only field; do not parse with new Date(dateString).
const formatDateOnlyBR = (dateString?: string | null) => {
  if (!dateString) return '—';
  const parsed = getDateParts(dateString);
  if (!parsed) return '—';
  return `${String(parsed.day).padStart(2, '0')}/${String(parsed.month).padStart(2, '0')}/${parsed.year}`;
};

// meeting_date is a date-only field; do not parse with new Date(dateString).
const getMonthKeyDateOnly = (dateString: string) => {
  const parsed = getDateParts(dateString);
  if (!parsed) return null;
  return `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
};

// meeting_date is a date-only field; do not parse with new Date(dateString).
const getMonthLabelDateOnly = (dateString: string) => {
  const parsed = getDateParts(dateString);
  if (!parsed) return 'Mês inválido';
  return `${monthNamesPtBr[parsed.month - 1]} de ${parsed.year}`;
};


// meeting_date is a date-only field; do not parse with new Date(dateString).
const compareDateOnlyDesc = (a: string, b: string) => b.localeCompare(a);

const isDateOnlyBefore = (
  dateString: string | null | undefined,
  reference: { year: number; month: number; day: number }
) => {
  const parsed = dateString ? getDateParts(dateString) : null;
  if (!parsed) return false;
  if (parsed.year !== reference.year) return parsed.year < reference.year;
  if (parsed.month !== reference.month) return parsed.month < reference.month;
  return parsed.day < reference.day;
};

export default function AgendaPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [meetings, setMeetings] = useState<CouncilMeeting[]>([]);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [dimensionCatalog, setDimensionCatalog] = useState<DimensionCatalogItem[]>([]);
  const [dimensionProgressRows, setDimensionProgressRows] = useState<CouncilDimensionProgress[]>([]);
  const [progressCountByMeeting, setProgressCountByMeeting] = useState<Record<string, number>>({});
  const [companyId, setCompanyId] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [actionStatus, setActionStatus] = useState<string>('all');
  const [meetingStatus, setMeetingStatus] = useState<'all' | 'critical' | 'attention' | 'healthy'>('all');
  const [open, setOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<'manual' | 'transcript'>('manual');
  const [form, setForm] = useState<any>({ meeting_type: 'collective', related_dimensions: [] as string[], main_topic: '' });
  const [transcriptText, setTranscriptText] = useState('');
  const [draft, setDraft] = useState<CouncilMeetingNotesDraft | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [creatingFromDraft, setCreatingFromDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const MIN_TRANSCRIPT_CHARS = 200;
  const todayDateOnly = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);
  const todayParts = useMemo(() => getDateParts(todayDateOnly), [todayDateOnly]);

  const load = async () => {
    setLoading(true);
    const [c, m, a, p, d] = await Promise.all([
      supabase.from('companies').select('id,name').order('name'),
      supabase.from('council_meetings').select('*').order('meeting_date', { ascending: false }),
      supabase.from('council_actions').select('*'),
      supabase.from('council_dimension_progress').select('*'),
      supabase.from('dimensions').select('id,label,sort_order').order('sort_order', { ascending: true }),
    ]);
    if (c.error) toast({ title: 'Erro ao carregar empresas', description: c.error.message, variant: 'destructive' });
    if (m.error) toast({ title: 'Erro ao carregar encontros', description: m.error.message, variant: 'destructive' });
    if (a.error) toast({ title: 'Erro ao carregar ações', description: a.error.message, variant: 'destructive' });
    if (p.error) toast({ title: 'Erro ao carregar evolução por dimensão', description: p.error.message, variant: 'destructive' });
    if (d.error) toast({ title: 'Erro ao carregar catálogo de dimensões', description: d.error.message, variant: 'destructive' });
    if (c.data) setCompanies(c.data as Company[]);
    if (m.data) setMeetings(m.data as CouncilMeeting[]);
    if (a.data) setActions(a.data as CouncilAction[]);
    if (d.data) setDimensionCatalog(d.data as DimensionCatalogItem[]);
    if (p.data) {
      const progress = p.data as CouncilDimensionProgress[];
      setDimensionProgressRows(progress);
      const counts = progress.reduce((acc, row) => {
        acc[row.meeting_id] = (acc[row.meeting_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      setProgressCountByMeeting(counts);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const meetingsHealth = useMemo(() => {
    return meetings.map((m) => {
      const am = actions.filter((a) => a.meeting_id === m.id);
      const overdue = am.filter((a) => todayParts && isDateOnlyBefore(a.due_date, todayParts) && !['completed', 'cancelled'].includes(a.status)).length;
      const blocked = am.filter((a) => a.status === 'blocked').length;
      const critical = overdue + blocked > 0;
      const noAgenda = !m.next_agenda;
      const noEvolution = (progressCountByMeeting[m.id] || 0) === 0;
      const status: 'Crítico' | 'Atenção' | 'Saudável' = critical ? 'Crítico' : (noAgenda || noEvolution ? 'Atenção' : 'Saudável');
      return { id: m.id, critical, noAgenda, noEvolution, status, overdue, blocked };
    });
  }, [meetings, actions, progressCountByMeeting, todayParts]);

  const filtered = useMemo(() => meetings.filter(m => {
    if (companyId !== 'all' && m.company_id !== companyId) return false;
    if (typeFilter !== 'all' && m.meeting_type !== typeFilter) return false;
    if (actionStatus !== 'all') {
      const meetingActions = actions.filter(a => a.meeting_id === m.id);
      if (!meetingActions.some(a => a.status === actionStatus)) return false;
    }
    if (meetingStatus !== 'all') {
      const status = meetingsHealth.find((h) => h.id === m.id)?.status;
      if (meetingStatus === 'critical' && status !== 'Crítico') return false;
      if (meetingStatus === 'attention' && status !== 'Atenção') return false;
      if (meetingStatus === 'healthy' && status !== 'Saudável') return false;
    }
    return true;
  }), [meetings, companyId, typeFilter, actionStatus, actions, meetingStatus, meetingsHealth]);

  const actionsForFilteredMeetings = useMemo(() => {
    const ids = new Set(filtered.map(m => m.id));
    return actions.filter(a => ids.has(a.meeting_id));
  }, [filtered, actions]);

  const executiveKpis = useMemo(() => {
    const totalMeetings = filtered.length;
    const meetingsThisMonth = filtered.filter(m => {
      const d = m.meeting_date ? getDateParts(m.meeting_date) : null;
      return !!todayParts && !!d && d.year === todayParts.year && d.month === todayParts.month;
    }).length;
    const openActions = actionsForFilteredMeetings.filter(a => ['not_started', 'in_progress'].includes(a.status)).length;
    const lateActionIds = new Set(actionsForFilteredMeetings.filter(a => todayParts && isDateOnlyBefore(a.due_date, todayParts) && !['completed', 'cancelled'].includes(a.status)).map((a) => a.id));
    const blockedActionIds = new Set(actionsForFilteredMeetings.filter(a => a.status === 'blocked').map((a) => a.id));
    const criticalActionIds = new Set([...lateActionIds, ...blockedActionIds]);
    const nonCancelledActions = actionsForFilteredMeetings.filter(a => a.status !== 'cancelled');
    const completed = nonCancelledActions.filter(a => a.status === 'completed').length;
    const completionRate = nonCancelledActions.length ? Math.round((completed / nonCancelledActions.length) * 100) : 0;
    return { totalMeetings, meetingsThisMonth, openActions, criticalActions: criticalActionIds.size, lateActions: lateActionIds.size, blockedActions: blockedActionIds.size, completed, nonCancelledTotal: nonCancelledActions.length, completionRate };
  }, [filtered, actionsForFilteredMeetings, todayParts]);

  const monthlyMeetingGroups = useMemo(() => {
    const groups = filtered.reduce((acc, meeting) => {
      if (!meeting.meeting_date) return acc;
      const parsed = getDateParts(meeting.meeting_date);
      const key = getMonthKeyDateOnly(meeting.meeting_date);
      if (!parsed || !key) return acc;
      if (!acc[key]) acc[key] = { label: getMonthLabelDateOnly(meeting.meeting_date), meetings: [] as CouncilMeeting[], year: parsed.year, month: parsed.month };
      acc[key].meetings.push(meeting);
      return acc;
    }, {} as Record<string, { label: string; meetings: CouncilMeeting[]; year: number; month: number }>);
    return Object.values(groups)
      .map((group) => ({ ...group, meetings: [...group.meetings].sort((a, b) => compareDateOnlyDesc(a.meeting_date, b.meeting_date)) }))
      .sort((a, b) => b.year - a.year || b.month - a.month);
  }, [filtered]);

  const filteredMeetingHealth = useMemo(
    () => meetingsHealth.filter((item) => filtered.some((m) => m.id === item.id)),
    [meetingsHealth, filtered]
  );

  const cycleAlerts = useMemo(() => {
    const noAgenda = filteredMeetingHealth.filter((item) => item.noAgenda).length;
    const critical = filteredMeetingHealth.filter((item) => item.critical).length;
    const noEvolution = filteredMeetingHealth.filter((item) => item.noEvolution).length;
    return { noAgenda, critical, noEvolution };
  }, [filteredMeetingHealth]);
  const hasActiveFilters = companyId !== 'all' || typeFilter !== 'all' || actionStatus !== 'all' || meetingStatus !== 'all';

  const focusRecentSummary = useMemo(() => {
    const dimensionSortMap = new Map(dimensionCatalog.map((dim, idx) => [dim.id, dim.sort_order ?? idx + 1]));
    const officialMap: Record<string, { count: number; label?: string; trends: Record<string, number> }> = {};
    const topicMap: Record<string, number> = {};
    for (const m of filtered) {
      for (const dim of m.related_dimensions || []) {
        if (officialDimensions.has(dim)) {
          if (!officialMap[dim]) officialMap[dim] = { count: 0, trends: {} };
          officialMap[dim].count += 1;
        } else {
          topicMap[dim] = (topicMap[dim] || 0) + 1;
        }
      }
      const topic = m.main_topic?.trim();
      if (topic) topicMap[topic] = (topicMap[topic] || 0) + 1;
    }
    const filteredMeetingIds = new Set(filtered.map((m) => m.id));
    for (const row of dimensionProgressRows) {
      if (!filteredMeetingIds.has(row.meeting_id)) continue;
      const dim = row.dimension_id;
      if (!officialDimensions.has(dim)) {
        topicMap[row.dimension_label || dim] = (topicMap[row.dimension_label || dim] || 0) + 1;
        continue;
      }
      if (!officialMap[dim]) officialMap[dim] = { count: 0, trends: {}, label: row.dimension_label };
      officialMap[dim].trends[row.trend] = (officialMap[dim].trends[row.trend] || 0) + 1;
      officialMap[dim].label = officialMap[dim].label || row.dimension_label;
    }
    const resolveLabel = (dimension: string, progressLabel?: string) => {
      const catalogLabel = dimensionCatalog.find((d) => d.id === dimension)?.label;
      return catalogLabel || getDimensionFullLabel(dimension, progressLabel);
    };
    const topDimensions = Object.entries(officialMap)
      .map(([dimension, info]) => {
        const dominantTrend = (Object.entries(info.trends).sort((a, b) => b[1] - a[1])[0]?.[0] || 'sem_trend') as DimensionTrend | 'sem_trend';
        return {
          dimension,
          label: resolveLabel(dimension, info.label),
          count: info.count,
          trend: dominantTrend,
          sortOrder: dimensionSortMap.get(dimension) ?? 999,
        };
      })
      .sort((a, b) => b.count - a.count || a.sortOrder - b.sortOrder)
      .slice(0, 3);
    const topTopics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, count]) => ({ label, count }));
    const attention = topDimensions.find((d) => d.trend === 'worsening') || topDimensions[0];
    const insight = attention ? `${attention.label} concentra maior atenção no ciclo.` : '';
    return { topDimensions, topTopics, insight };
  }, [filtered, dimensionCatalog, dimensionProgressRows]);

  const saveMeeting = async () => {
    const meetingDate = typeof form.meeting_date === 'string' && dateOnlyPattern.test(form.meeting_date) ? form.meeting_date : '';
    if (!form.company_id || !meetingDate || !form.meeting_type) return toast({ title: 'Preencha empresa, data e tipo', variant: 'destructive' });
    const payload = {
      ...form,
      meeting_date: meetingDate,
      related_dimensions: form.related_dimensions?.length ? form.related_dimensions : null,
      attendees_counselors: form.attendees_counselors?.split(',').map((s: string) => s.trim()).filter(Boolean) || null,
      attendees_founders: form.attendees_founders?.split(',').map((s: string) => s.trim()).filter(Boolean) || null,
    };
    const { error } = await supabase.from('council_meetings').insert(payload);
    if (error) return toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    setOpen(false); setForm({ meeting_type: 'collective', related_dimensions: [], main_topic: '' }); load();
  };

  const resetDraftFlow = () => {
    setTranscriptText('');
    setDraft(null);
    setGeneratingDraft(false);
    setCreatingFromDraft(false);
  };

  const canGenerateDraft = !!form.company_id && typeof form.meeting_date === 'string' && dateOnlyPattern.test(form.meeting_date) && !!form.meeting_type && transcriptText.trim().length >= MIN_TRANSCRIPT_CHARS;

  const generateDraftFromTranscript = async () => {
    if (!canGenerateDraft || generatingDraft) return;
    const meetingDate = typeof form.meeting_date === 'string' && dateOnlyPattern.test(form.meeting_date) ? form.meeting_date : '';
    const companyName = companies.find((c) => c.id === form.company_id)?.name || '';
    setGeneratingDraft(true);
    const { data: agendaTemplates } = await supabase.from('council_agenda_templates').select('*').eq('is_active', true).order('sort_order');
    const { data, error } = await supabase.functions.invoke('extract-council-meeting-notes', {
      body: {
        mode: 'new_meeting',
        company_id: form.company_id,
        transcript_text: transcriptText.trim(),
        context: {
          company_name: companyName,
          meeting_date: meetingDate,
          meeting_type: form.meeting_type,
          selected_topic: form.main_topic || '',
          selected_dimensions: form.related_dimensions || [],
          official_dimensions: dimensionCatalog.map((d) => ({ id: d.id, label: d.label })),
          agenda_templates: agendaTemplates || [],
        },
      },
    });
    setGeneratingDraft(false);
    if (error) return toast({ title: 'Erro ao analisar transcrição', description: error.message, variant: 'destructive' });
    if (!data?.draft || typeof data.draft !== 'object') return toast({ title: 'Resposta inválida da IA', description: 'A pré-ata retornou em formato inválido. Revise a transcrição e tente novamente.', variant: 'destructive' });
    setDraft({ ...data.draft, suggested_actions: (data.draft.suggested_actions || []).map((a: any) => ({ ...a, approved: a.approved !== false })), dimension_progress_suggestions: (data.draft.dimension_progress_suggestions || []).map((p: any) => ({ ...p, approved: p.approved !== false })) } as CouncilMeetingNotesDraft);
    toast({ title: 'Pré-ata gerada', description: 'A IA gerou um rascunho. Revise antes de criar o encontro.' });
  };

  const createMeetingWithDraft = async () => {
    if (!draft || creatingFromDraft) return;

    const approvedActions = draft.suggested_actions.filter((item) => item.approved !== false);
    const approvedProgress = draft.dimension_progress_suggestions.filter((item) => item.approved !== false);
    const meetingDate = typeof form.meeting_date === 'string' && dateOnlyPattern.test(form.meeting_date) ? form.meeting_date : '';
    if (!form.company_id || !meetingDate || !form.meeting_type) {
      return toast({ title: 'Dados incompletos para criar encontro', description: 'Preencha empresa, data e tipo antes de criar o encontro com pré-ata.', variant: 'destructive' });
    }

    const actionPayload = approvedActions.map((item) => ({
      title: item.title?.trim() || '',
      description: item.description || null,
      owner_name: item.owner_name?.trim() || null,
      due_date: item.due_date?.trim() || null,
      related_dimension: item.related_dimension || null,
      priority: item.priority,
      impact: item.impact,
      effort: item.effort,
      expected_evidence: item.expected_evidence || null,
      status: 'not_started' as const,
    }));

    const invalidActionIndex = actionPayload.findIndex((item) => !item.title);
    if (invalidActionIndex >= 0) {
      return toast({ title: 'Pré-ata inválida nas ações', description: `A ação #${invalidActionIndex + 1} está sem título. Revise a pré-ata antes de criar o encontro.`, variant: 'destructive' });
    }

    const progressPayload = approvedProgress.map((item) => ({
      dimension_id: item.dimension_id?.trim() || '',
      dimension_label: item.dimension_label?.trim() || '',
      current_perceived_score: item.current_perceived_score,
      trend: item.trend,
      evidence_note: item.evidence_note || null,
      counselor_comment: item.counselor_comment || null,
    }));

    const invalidProgressIndex = progressPayload.findIndex((item) => !item.dimension_id || !item.dimension_label || typeof item.current_perceived_score !== 'number' || Number.isNaN(item.current_perceived_score));
    if (invalidProgressIndex >= 0) {
      return toast({ title: 'Pré-ata inválida na evolução por dimensão', description: `A linha de evolução #${invalidProgressIndex + 1} está com dados obrigatórios ausentes ou inválidos.`, variant: 'destructive' });
    }

    setCreatingFromDraft(true);
    const { data: inserted, error: meetingError } = await supabase.from('council_meetings').insert({
      company_id: form.company_id,
      meeting_date: meetingDate,
      meeting_type: form.meeting_type,
      main_topic: form.main_topic || null,
      related_dimensions: draft.related_dimensions?.length ? draft.related_dimensions : (form.related_dimensions?.length ? form.related_dimensions : null),
      executive_summary: draft.executive_summary || null,
      key_progress: draft.key_progress || null,
      key_blockers: draft.key_blockers || null,
      decisions: draft.decisions || null,
      recommendations: draft.recommendations || null,
      next_agenda: draft.next_agenda || null,
    }).select('id,company_id').single();

    if (meetingError || !inserted) {
      setCreatingFromDraft(false);
      return toast({ title: 'Erro ao criar encontro', description: meetingError?.message || 'Falha ao persistir encontro', variant: 'destructive' });
    }

    const actionRows = actionPayload.map((item) => ({ ...item, meeting_id: inserted.id, company_id: inserted.company_id }));
    const { error: actionsError } = actionRows.length ? await supabase.from('council_actions').insert(actionRows).select('id') : { error: null as any };

    let progressError: Error | null = null;
    if (!actionsError) {
      for (const item of progressPayload) {
        const { error } = await supabase.from('council_dimension_progress').upsert({ meeting_id: inserted.id, company_id: inserted.company_id, ...item }, { onConflict: 'meeting_id,dimension_id' });
        if (error) {
          progressError = error;
          break;
        }
      }
    }

    if (actionsError || progressError) {
      const [{ error: rollbackActionsError }, { error: rollbackMeetingError }] = await Promise.all([
        supabase.from('council_actions').delete().eq('meeting_id', inserted.id),
        supabase.from('council_meetings').delete().eq('id', inserted.id),
      ]);

      setCreatingFromDraft(false);
      const rollbackFailed = rollbackActionsError || rollbackMeetingError;
      if (rollbackFailed) {
        return toast({
          title: 'Criação parcial detectada',
          description: `O encontro foi criado, mas falhou ao salvar ações/evolução e não foi possível desfazer tudo automaticamente. Detalhe: ${(actionsError || progressError)?.message}`,
          variant: 'destructive',
        });
      }

      return toast({
        title: 'Erro ao criar encontro com pré-ata',
        description: `Falha ao salvar ações/evolução (${(actionsError || progressError)?.message}). O encontro foi revertido automaticamente.`,
        variant: 'destructive',
      });
    }

    toast({ title: 'Encontro criado com pré-ata' });
    resetDraftFlow();
    setOpen(false);
    setForm({ meeting_type: 'collective', related_dimensions: [], main_topic: '' });
    await load();
    setCreatingFromDraft(false);
    navigate(`/app/agenda/${inserted.id}`);
  };

  return <div className='space-y-6'>
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent p-7 sm:p-8">
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
            <Sparkles className="h-3 w-3" /> Ritos do conselho
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Agenda de Evolução</h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Prepare ritos, registre decisões e acompanhe a execução do conselho.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Registrar novo encontro
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/app/agenda/templates"><FileStack className="h-4 w-4 mr-2" /> Consultar templates de pauta</Link>
          </Button>
        </div>
      </div>
    </section>
    <Card className='executive-panel print:hidden'><CardContent className='p-3 grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2'>
      <Select value={companyId} onValueChange={setCompanyId}><SelectTrigger className='h-8 rounded-full text-xs'><SelectValue placeholder='Empresa/OS' /></SelectTrigger><SelectContent><SelectItem value='all'>Todas</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className='h-8 rounded-full text-xs'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todos os tipos</SelectItem><SelectItem value='collective'>Coletivo</SelectItem><SelectItem value='individual'>Individual</SelectItem><SelectItem value='extraordinary'>Extraordinário</SelectItem></SelectContent></Select>
      <Select value={actionStatus} onValueChange={setActionStatus}><SelectTrigger className='h-8 rounded-full text-xs'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todos status de ação</SelectItem><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em andamento</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Travada</SelectItem></SelectContent></Select>
      <Select value={meetingStatus} onValueChange={(v) => setMeetingStatus(v as any)}><SelectTrigger className='h-8 rounded-full text-xs'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todos encontros</SelectItem><SelectItem value='critical'>Crítico</SelectItem><SelectItem value='attention'>Atenção</SelectItem><SelectItem value='healthy'>Saudável</SelectItem></SelectContent></Select>
      <Button size='sm' variant='ghost' className='h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground' onClick={() => { setCompanyId('all'); setTypeFilter('all'); setActionStatus('all'); setMeetingStatus('all'); }}>Limpar filtros</Button>
    </CardContent></Card>
    {loading ? <Card className='executive-panel'><CardContent className='py-10 text-center'>Carregando agenda...</CardContent></Card> : filtered.length === 0 ? <Card className='executive-panel'><CardContent className='py-10 text-center'>
      {meetings.length > 0 ? <>Nenhum encontro encontrado com os filtros atuais.<div className='mt-3'>{hasActiveFilters && <Button variant='outline' onClick={() => { setCompanyId('all'); setTypeFilter('all'); setActionStatus('all'); setMeetingStatus('all'); }}>Limpar filtros</Button>}</div></> : <>Nenhum encontro registrado ainda. Sem encontros, não há histórico de decisões, evolução e ações acompanháveis.<div className='mt-2 text-sm text-muted-foreground'>Próximo passo: registre o primeiro encontro para iniciar acompanhamento de pautas e execução.</div><div className='mt-3'><Button onClick={() => setOpen(true)}>Registrar novo encontro</Button></div></>}
    </CardContent></Card> :
      <>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <Card className='executive-card overflow-hidden'><CardContent className='p-4'><div className='flex items-start justify-between gap-3'><div><p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>Total de encontros</p><p className='mt-1 text-3xl font-extrabold'>{executiveKpis.totalMeetings}</p></div><CalendarDays className='h-4 w-4 text-primary' /></div><p className='mt-2 text-[11px] text-muted-foreground'>Ritos visíveis no filtro atual · {executiveKpis.meetingsThisMonth} no mês</p></CardContent></Card>
        <Card className='executive-card overflow-hidden'><CardContent className='p-4'><div className='flex items-start justify-between gap-3'><div><p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>Ações abertas</p><p className='mt-1 text-3xl font-extrabold'>{executiveKpis.openActions}</p></div><Target className='h-4 w-4 text-primary' /></div><p className='mt-2 text-[11px] text-muted-foreground'>Em execução ou planejadas</p></CardContent></Card>
        <Card className='executive-card overflow-hidden border-destructive/40'><CardContent className='p-4'><div className='flex items-start justify-between gap-3'><div><p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>Ações críticas</p><p className='mt-1 text-3xl font-extrabold text-destructive'>{executiveKpis.criticalActions}</p></div><AlertTriangle className='h-4 w-4 text-destructive' /></div><p className='mt-2 text-[11px] text-muted-foreground'>Atrasadas ou travadas · {executiveKpis.lateActions} atrasadas</p></CardContent></Card>
        <Card className='executive-card overflow-hidden'><CardContent className='p-4'><div className='flex items-start justify-between gap-3'><div><p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>Taxa de conclusão</p><p className='mt-1 text-3xl font-extrabold'>{executiveKpis.completionRate}%</p></div><CheckCircle2 className='h-4 w-4 text-emerald-500' /></div><p className='mt-2 text-[11px] text-muted-foreground'>{executiveKpis.completed}/{executiveKpis.nonCancelledTotal} concluídas / total</p></CardContent></Card>
      </div>
      <Card className='executive-panel'><CardHeader className='pb-2'><CardTitle>Alertas do ciclo</CardTitle></CardHeader><CardContent className='grid gap-2 sm:grid-cols-3 text-sm'>
        <div className='rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3'><p className='text-2xl font-extrabold text-amber-600'>{cycleAlerts.noAgenda}</p><p className='text-xs font-semibold text-foreground'>Sem próxima pauta</p><p className='mt-1 text-[11px] text-muted-foreground'>Precisam de pauta para o rito seguinte.</p></div>
        <div className='rounded-2xl border border-destructive/20 bg-destructive/5 p-3'><p className='text-2xl font-extrabold text-destructive'>{cycleAlerts.critical}</p><p className='text-xs font-semibold text-foreground'>Com ações críticas</p><p className='mt-1 text-[11px] text-muted-foreground'>Possuem ações atrasadas ou travadas.</p></div>
        <div className='rounded-2xl border border-primary/20 bg-primary/5 p-3'><p className='text-2xl font-extrabold text-primary'>{cycleAlerts.noEvolution}</p><p className='text-xs font-semibold text-foreground'>Sem evolução registrada</p><p className='mt-1 text-[11px] text-muted-foreground'>Faltam dimensões avaliadas no ciclo.</p></div>
      </CardContent></Card>
      <Card className='executive-panel overflow-hidden border-primary/40 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--card)/0.98),hsl(var(--background)/0.86))] shadow-primary/10 print:break-inside-avoid'><CardHeader className='pb-2'><div className='flex items-center justify-between gap-3'><div><p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-primary'>Recomendação operacional</p><CardTitle className='text-2xl'>Próximo rito a preparar</CardTitle></div><Badge variant='outline' className='executive-pill border-primary/30 bg-primary/10 text-primary'>Prioridade do ciclo</Badge></div></CardHeader><CardContent>
        {filtered.length === 0 ? <p className='text-sm text-muted-foreground'>Sem próxima reunião a preparar.</p> : (() => {
          const sorted = [...filtered].sort((a, b) => compareDateOnlyDesc(a.meeting_date, b.meeting_date));
          const prioritized = sorted.find((m) => filteredMeetingHealth.find((h) => h.id === m.id)?.critical)
            || sorted.find((m) => filteredMeetingHealth.find((h) => h.id === m.id)?.noAgenda)
            || sorted[0];
          const comp = companies.find((c) => c.id === prioritized.company_id)?.name || '—';
          const health = filteredMeetingHealth.find((h) => h.id === prioritized.id);
          const am = actions.filter(a => a.meeting_id === prioritized.id);
          const completedCount = am.filter(a => a.status === 'completed').length;
          const dimCount = progressCountByMeeting[prioritized.id] || 0;
          const reason = health?.critical && health.noAgenda ? 'Prioridade do ciclo: há ações atrasadas/travadas e a próxima pauta ainda não foi definida.' : health?.critical ? 'Prioridade do ciclo: há ações atrasadas/travadas que precisam de destravamento executivo.' : health?.noAgenda ? 'Prioridade do ciclo: a próxima pauta ainda não foi definida para orientar o rito seguinte.' : 'Prioridade do ciclo: manter cadência executiva e revisar os encaminhamentos do encontro mais recente.';
          return <div className='grid gap-5 lg:grid-cols-[1fr_220px] lg:items-stretch text-sm'>
            <div className='space-y-4'>
              <div className='flex flex-wrap items-center gap-2'><Badge variant='secondary' className='executive-pill bg-background/70'>{comp}</Badge><Badge variant='outline' className={cn('executive-pill font-bold', statusBadgeClasses(health?.status))}><span className={cn('mr-1.5 h-2 w-2 rounded-full', statusDotClasses(health?.status))} />{health?.status || 'Atenção'}</Badge><span className='rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground'>{formatDateOnlyBR(prioritized.meeting_date)}</span></div>
              <div><h3 className='text-2xl font-extrabold leading-tight tracking-tight'>{prioritized.title || prioritized.main_topic || 'Encontro de conselho'}</h3><p className='mt-1 text-sm font-medium text-foreground/80'>Tema: {prioritized.main_topic || '—'}</p><p className='mt-2 max-w-3xl rounded-2xl border border-primary/20 bg-background/60 px-3 py-2 text-sm text-muted-foreground'>{reason}</p></div>
              <div className='grid gap-2 sm:grid-cols-3'>
                <div className='rounded-2xl border border-border/70 bg-background/70 p-3 shadow-sm'><p className='text-[11px] uppercase tracking-[0.12em] text-muted-foreground'>Ações</p><p className='mt-1 font-bold'>{completedCount}/{am.length} concluídas</p></div>
                <div className='rounded-2xl border border-border/70 bg-background/70 p-3 shadow-sm'><p className='text-[11px] uppercase tracking-[0.12em] text-muted-foreground'>Dimensões avaliadas</p><p className='mt-1 font-bold'>{dimCount}</p></div>
                <div className='rounded-2xl border border-border/70 bg-background/70 p-3 shadow-sm'><p className='text-[11px] uppercase tracking-[0.12em] text-muted-foreground'>Próxima pauta</p><p className='mt-1 line-clamp-1 font-bold'>{prioritized.next_agenda || 'Sem próxima pauta'}</p></div>
              </div>
            </div>
            <div className='flex flex-col justify-between gap-3 rounded-3xl border border-primary/20 bg-primary/10 p-4 lg:items-stretch'><div><p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-primary'>Ação recomendada</p><p className='mt-2 text-sm text-muted-foreground'>Abrir o encontro, validar pauta e destravar encaminhamentos críticos.</p></div><Button asChild size='lg' className='rounded-full shadow-lg shadow-primary/20'><Link to={`/app/agenda/${prioritized.id}`}>Abrir encontro <ArrowRight className='ml-2 h-4 w-4' /></Link></Button></div>
          </div>;
        })()}
      </CardContent></Card>
      <div className='space-y-5'>{monthlyMeetingGroups.map((group) => <section key={`${group.year}-${group.month}`} className='space-y-3 print:break-inside-avoid'>
        <div className='print:mb-3'>
          <div className='flex items-center justify-between gap-3 print:break-after-avoid print:mb-1'><h3 className='text-lg font-semibold capitalize'>{group.label}</h3><span className='text-xs text-muted-foreground'>{group.meetings.length} encontros</span></div>
          <div className='grid gap-2'>{group.meetings.map((m, index) => {
        const comp = companies.find(c => c.id === m.company_id)?.name || '—'; const am = actions.filter(a => a.meeting_id === m.id);
        const health = filteredMeetingHealth.find((h) => h.id === m.id);
        const completedCount = am.filter(a => a.status === 'completed').length;
        const dimCount = progressCountByMeeting[m.id] || 0;
        const alertBadge = health?.overdue && health?.blocked ? 'Atrasadas + travadas' : health?.blocked ? 'Ações travadas' : health?.overdue ? 'Ações atrasadas' : health?.noAgenda ? 'Sem próxima pauta' : health?.noEvolution ? 'Sem evolução' : '';

        const parsedDate = getDateParts(m.meeting_date);
        return <Card key={m.id} className={cn('executive-panel overflow-hidden border-l-4 hover:-translate-y-0.5 hover:shadow-primary/10 print:break-inside-avoid', statusAccentClasses(health?.status), index === 0 ? 'print:break-inside-avoid' : '')}><CardContent className='px-3.5 py-4 sm:p-4 print:p-2.5'>
          <div className='grid gap-4 sm:grid-cols-[76px_1fr_124px] sm:items-center print:gap-2'>
            <div className='w-fit rounded-2xl border border-border/70 bg-background/75 px-3 py-2.5 text-center shadow-sm sm:w-full print:py-2'><p className='text-2xl font-extrabold leading-none'>{parsedDate ? String(parsedDate.day).padStart(2, '0') : '—'}</p><p className='mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground'>{parsedDate ? monthNamesPtBr[parsedDate.month - 1].slice(0, 3) : 'data'}</p><p className='mt-0.5 text-[10px] text-muted-foreground'>{parsedDate?.year || ''}</p></div>
            <div className='min-w-0 space-y-2'>
              <div className='flex flex-wrap items-center gap-1.5'><Badge variant='secondary' className='executive-pill bg-background/70'>{comp}</Badge><Badge variant='outline' className='executive-pill border-primary/25 bg-primary/10 text-primary'>{mt[m.meeting_type as MeetingType]}</Badge>{alertBadge && <Badge variant='outline' className={cn('executive-pill font-semibold', timelineAlertBadgeClasses(alertBadge))}>{alertBadge}</Badge>}</div>
              <div className='grid gap-1 md:grid-cols-[minmax(0,1fr)_220px] md:items-end'><div><h4 className='line-clamp-1 font-bold leading-tight tracking-tight'>{m.title || m.main_topic || 'Encontro de conselho'}</h4><p className='line-clamp-1 text-xs text-muted-foreground'>Tema: {m.main_topic || '—'}</p></div><div className='hidden text-right text-xs text-muted-foreground md:block'><span className='font-semibold text-foreground'>{completedCount}/{am.length}</span> ações · <span className='font-semibold text-foreground'>{dimCount}</span> dimensões</div></div>
              <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground md:hidden'><span><strong className='text-foreground'>{completedCount}/{am.length}</strong> ações</span><span><strong className='text-foreground'>{dimCount}</strong> dimensões avaliadas</span></div>
              <p className='line-clamp-1 text-xs text-muted-foreground'><strong className='text-foreground'>Próxima pauta:</strong> {m.next_agenda || '—'}</p>
            </div>
            <div className='flex items-center gap-2 sm:flex-col sm:items-end sm:justify-center'><Badge variant='outline' className={cn('executive-pill min-w-[92px] justify-center font-bold', statusBadgeClasses(health?.status))}><span className={cn('mr-1.5 h-2 w-2 rounded-full', statusDotClasses(health?.status))} />{health?.status || 'Atenção'}</Badge><Button asChild size='sm' variant='outline' className='h-10 rounded-full border-primary/40 bg-primary/10 px-5 font-bold text-primary shadow-sm shadow-primary/10 hover:bg-primary hover:text-primary-foreground print:h-8 print:px-3'><Link to={`/app/agenda/${m.id}`}>Abrir</Link></Button></div>
          </div>
        </CardContent></Card>;
      })}</div>
        </div>
      </section>)}</div>
      <Card className='executive-panel print:hidden'><CardContent className='p-4'>
        <div className='space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'><div className='min-w-0'><p className='text-sm font-bold'>Foco recente do conselho</p><p className='text-xs text-muted-foreground'>Síntese compacta dos filtros atuais.</p></div><Button asChild variant='outline' size='sm' className='ml-auto shrink-0 rounded-full border-primary/25 bg-background/70 px-4 font-semibold text-primary hover:bg-primary hover:text-primary-foreground'><Link to='/app/counselor'>Ver Central do Conselheiro</Link></Button></div>
          <div className='grid gap-2.5 lg:grid-cols-3'>
            <div className='rounded-2xl border border-border/70 bg-background/60 p-3 shadow-sm'><p className='mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>Dimensões em foco</p><div className='flex flex-wrap gap-1.5'>{focusRecentSummary.topDimensions.length === 0 ? <Badge variant='secondary' className='executive-pill'>Sem dimensões recentes</Badge> : focusRecentSummary.topDimensions.map((item) => <Badge key={item.dimension} variant='secondary' className='executive-pill'>{item.dimension} · {item.count}x</Badge>)}</div></div>
            <div className='rounded-2xl border border-border/70 bg-background/60 p-3 shadow-sm'><p className='mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>Temas frequentes</p><div className='flex flex-wrap gap-1.5'>{focusRecentSummary.topTopics.length === 0 ? <Badge variant='outline' className='executive-pill'>Sem temas frequentes</Badge> : focusRecentSummary.topTopics.map((item) => <Badge key={item.label} variant='outline' className='executive-pill bg-background/70'>{item.label} · {item.count}x</Badge>)}</div></div>
            <div className='rounded-2xl border border-primary/25 bg-primary/10 p-3 shadow-sm'><p className='mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary'>Insight principal</p><p className='line-clamp-2 text-sm font-medium text-foreground'>{focusRecentSummary.insight || 'Sem insight de atenção neste ciclo.'}</p></div>
          </div>
        </div>
      </CardContent></Card>
      </>}
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) { setCreationMode('manual'); resetDraftFlow(); } }}><DialogContent className='max-w-5xl max-h-[90vh] overflow-y-auto'><DialogHeader><DialogTitle>Registrar novo encontro</DialogTitle></DialogHeader>
      <Tabs value={creationMode} onValueChange={(v) => setCreationMode(v as 'manual' | 'transcript')} className='space-y-3'>
        <TabsList className='grid grid-cols-2 w-full'>
          <TabsTrigger value='manual'>Registro manual</TabsTrigger>
          <TabsTrigger value='transcript'>A partir de transcrição</TabsTrigger>
        </TabsList>
        <TabsContent value='manual' className='space-y-3'>
      <div className='grid md:grid-cols-2 gap-3'>
        <div><Label>Empresa*</Label><Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v })}><SelectTrigger><SelectValue placeholder='Selecione' /></SelectTrigger><SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Data*</Label><Input type='date' value={form.meeting_date || ''} onChange={e => setForm({ ...form, meeting_date: e.target.value })} /></div>
        <div><Label>Tipo de encontro*</Label><Select value={form.meeting_type || 'collective'} onValueChange={v => setForm({ ...form, meeting_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='collective'>Conselho Coletivo</SelectItem><SelectItem value='individual'>Acompanhamento Individual</SelectItem><SelectItem value='extraordinary'>Reunião Extraordinária</SelectItem></SelectContent></Select></div>
        <div><Label>Tema principal</Label><Select value={mainTopics.includes(form.main_topic) ? form.main_topic : 'Outro'} onValueChange={v => setForm({ ...form, main_topic: v === 'Outro' ? '' : v, main_topic_choice: v })}><SelectTrigger><SelectValue placeholder='Selecione o tema' /></SelectTrigger><SelectContent>{mainTopics.map(topic => <SelectItem key={topic} value={topic}>{topic}</SelectItem>)}</SelectContent></Select>{(form.main_topic_choice === 'Outro' || (!!form.main_topic && !mainTopics.includes(form.main_topic))) && <Input className='mt-2' placeholder='Descreva o tema principal' value={form.main_topic || ''} onChange={e => setForm({ ...form, main_topic: e.target.value, main_topic_choice: 'Outro' })} />}</div>
        <div className='md:col-span-2'><Label>Dimensões relacionadas</Label><div className='mt-2 flex flex-wrap gap-2'>{dimensionCatalog.map(dim => { const selected = form.related_dimensions?.includes(dim.id); return <button key={dim.id} type='button' onClick={() => setForm((prev: any) => ({ ...prev, related_dimensions: selected ? prev.related_dimensions.filter((id: string) => id !== dim.id) : [...(prev.related_dimensions || []), dim.id] }))} className={`rounded-full border px-3 py-1 text-xs ${selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>{dim.label}</button>; })}</div></div>
        <div className='md:col-span-2'><Label>Resumo executivo</Label><Input value={form.executive_summary || ''} onChange={e => setForm({ ...form, executive_summary: e.target.value })} /></div>
      </div>
      <div className='flex justify-end'><Button onClick={saveMeeting}>Salvar encontro</Button></div>
        </TabsContent>
        <TabsContent value='transcript' className='space-y-3'>
          <p className='text-sm text-muted-foreground'>A IA gera um rascunho. Revise antes de criar o encontro.</p>
          <div className='grid md:grid-cols-2 gap-3'>
            <div><Label>Empresa*</Label><Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v })}><SelectTrigger><SelectValue placeholder='Selecione' /></SelectTrigger><SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Data*</Label><Input type='date' value={form.meeting_date || ''} onChange={e => setForm({ ...form, meeting_date: e.target.value })} /></div>
            <div><Label>Tipo de encontro*</Label><Select value={form.meeting_type || 'collective'} onValueChange={v => setForm({ ...form, meeting_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='collective'>Conselho Coletivo</SelectItem><SelectItem value='individual'>Acompanhamento Individual</SelectItem><SelectItem value='extraordinary'>Reunião Extraordinária</SelectItem></SelectContent></Select></div>
            <div><Label>Tema principal (opcional)</Label><Input value={form.main_topic || ''} onChange={(e) => setForm({ ...form, main_topic: e.target.value })} /></div>
            <div className='md:col-span-2'><Label>Dimensões relacionadas (opcional)</Label><div className='mt-2 flex flex-wrap gap-2'>{dimensionCatalog.map(dim => { const selected = form.related_dimensions?.includes(dim.id); return <button key={dim.id} type='button' onClick={() => setForm((prev: any) => ({ ...prev, related_dimensions: selected ? prev.related_dimensions.filter((id: string) => id !== dim.id) : [...(prev.related_dimensions || []), dim.id] }))} className={`rounded-full border px-3 py-1 text-xs ${selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>{dim.label}</button>; })}</div></div>
            <div className='md:col-span-2'><Label>Transcrição da reunião*</Label><Textarea className='min-h-[220px]' value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} placeholder='Cole aqui a transcrição completa da reunião.' /></div>
          </div>
          <div className='flex justify-end'><Button disabled={!canGenerateDraft || generatingDraft} onClick={generateDraftFromTranscript}>{generatingDraft ? 'Analisando transcrição...' : 'Gerar pré-ata'}</Button></div>
          {draft && <div className='space-y-3'>
            <div className='grid md:grid-cols-2 gap-3'>
              <div><Label>Resumo executivo</Label><Textarea value={draft.executive_summary || ''} onChange={(e) => setDraft({ ...draft, executive_summary: e.target.value })} /></div>
              <div><Label>Próxima pauta</Label><Textarea value={draft.next_agenda || ''} onChange={(e) => setDraft({ ...draft, next_agenda: e.target.value })} /></div>
              <div><Label>Progressos-chave</Label><Textarea value={draft.key_progress || ''} onChange={(e) => setDraft({ ...draft, key_progress: e.target.value })} /></div>
              <div><Label>Bloqueios-chave</Label><Textarea value={draft.key_blockers || ''} onChange={(e) => setDraft({ ...draft, key_blockers: e.target.value })} /></div>
              <div><Label>Decisões</Label><Textarea value={draft.decisions || ''} onChange={(e) => setDraft({ ...draft, decisions: e.target.value })} /></div>
              <div><Label>Recomendações</Label><Textarea value={draft.recommendations || ''} onChange={(e) => setDraft({ ...draft, recommendations: e.target.value })} /></div>
            </div>
            <div className='space-y-2'>{draft.suggested_actions.map((action, idx) => <div key={idx} className='rounded border p-3 space-y-1 text-sm'><div className='flex items-center gap-2'><Checkbox checked={action.approved !== false} onCheckedChange={(checked) => setDraft({ ...draft, suggested_actions: draft.suggested_actions.map((row, i) => i === idx ? { ...row, approved: !!checked } : row) })} /><span className='font-medium'>{action.title}</span>{(!action.owner_name || !action.due_date || !action.expected_evidence) && <Badge variant='outline'>Precisa revisão</Badge>}</div><p>Responsável: {action.owner_name || '—'} · Prazo: {action.due_date || '—'} · Dimensão: {action.related_dimension || '—'}</p><p>Prioridade: {action.priority} · Impacto: {action.impact} · Esforço: {action.effort} · Confiança: {action.confidence}</p><p>Evidência esperada: {action.expected_evidence || '—'}</p></div>)}</div>
            <div className='space-y-2'>{draft.dimension_progress_suggestions.map((item, idx) => <div key={idx} className='rounded border p-3 space-y-1 text-sm'><div className='flex items-center gap-2'><Checkbox checked={item.approved !== false} onCheckedChange={(checked) => setDraft({ ...draft, dimension_progress_suggestions: draft.dimension_progress_suggestions.map((row, i) => i === idx ? { ...row, approved: !!checked } : row) })} /><span className='font-medium'>{item.dimension_id} · {item.dimension_label}</span></div><p>Score: {item.current_perceived_score ?? '—'} · Tendência: {item.trend} · Confiança: {item.confidence}</p><p>Evidência: {item.evidence_note || '—'}</p><p>Comentário: {item.counselor_comment || '—'}</p></div>)}</div>
            <div className='space-y-2'>{(draft.uncertain_items || []).map((item, idx) => <div key={idx} className='rounded border border-amber-500/40 p-3 text-sm'><p className='font-medium'>Item incerto: {item.type}</p><p>{item.note}</p></div>)}</div>
            <div className='flex justify-end'><Button onClick={createMeetingWithDraft} disabled={creatingFromDraft}>{creatingFromDraft ? 'Criando encontro...' : 'Criar encontro com pré-ata'}</Button></div>
          </div>}
        </TabsContent>
      </Tabs>
    </DialogContent></Dialog>
    <BackToTopFooter />
  </div>;
}
