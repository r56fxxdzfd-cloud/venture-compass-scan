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
import { Sparkles, Plus, FileStack } from 'lucide-react';

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

const parseDateOnly = (dateString?: string | null) => {
  if (!dateString) return null;
  const [yearStr, monthStr, dayStr] = dateString.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
};

const formatDateOnly = (dateString?: string | null) => {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return '—';
  return `${String(parsed.day).padStart(2, '0')}/${String(parsed.month).padStart(2, '0')}/${parsed.year}`;
};

const getMonthKeyFromDateOnly = (dateString?: string | null) => {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return null;
  return `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
};

const getMonthLabelFromDateOnly = (dateString?: string | null) => {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return 'Mês inválido';
  return `${monthNamesPtBr[parsed.month - 1]} de ${parsed.year}`;
};

const isDateOnlyBefore = (
  dateString: string | null | undefined,
  reference: { year: number; month: number; day: number }
) => {
  const parsed = parseDateOnly(dateString);
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
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

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
      const overdue = am.filter((a) => isDateOnlyBefore(a.due_date, { year: todayYear, month: todayMonth, day: todayDay }) && !['completed', 'cancelled'].includes(a.status)).length;
      const blocked = am.filter((a) => a.status === 'blocked').length;
      const critical = overdue + blocked > 0;
      const noAgenda = !m.next_agenda;
      const noEvolution = (progressCountByMeeting[m.id] || 0) === 0;
      const status: 'Crítico' | 'Atenção' | 'Saudável' = critical ? 'Crítico' : (noAgenda || noEvolution ? 'Atenção' : 'Saudável');
      return { id: m.id, critical, noAgenda, noEvolution, status, overdue, blocked };
    });
  }, [meetings, actions, progressCountByMeeting, todayYear, todayMonth, todayDay]);

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
      const d = parseDateOnly(m.meeting_date);
      return !!d && d.year === todayYear && d.month === todayMonth;
    }).length;
    const openActions = actionsForFilteredMeetings.filter(a => ['not_started', 'in_progress', 'blocked'].includes(a.status)).length;
    const lateActionIds = new Set(actionsForFilteredMeetings.filter(a => isDateOnlyBefore(a.due_date, { year: todayYear, month: todayMonth, day: todayDay }) && !['completed', 'cancelled'].includes(a.status)).map((a) => a.id));
    const blockedActionIds = new Set(actionsForFilteredMeetings.filter(a => a.status === 'blocked').map((a) => a.id));
    const criticalActionIds = new Set([...lateActionIds, ...blockedActionIds]);
    const nonCancelledActions = actionsForFilteredMeetings.filter(a => a.status !== 'cancelled');
    const completed = nonCancelledActions.filter(a => a.status === 'completed').length;
    const completionRate = nonCancelledActions.length ? Math.round((completed / nonCancelledActions.length) * 100) : 0;
    return { totalMeetings, meetingsThisMonth, openActions, criticalActions: criticalActionIds.size, lateActions: lateActionIds.size, blockedActions: blockedActionIds.size, completed, nonCancelledTotal: nonCancelledActions.length, completionRate };
  }, [filtered, actionsForFilteredMeetings, todayYear, todayMonth, todayDay]);

  const monthlyMeetingGroups = useMemo(() => {
    const groups = filtered.reduce((acc, meeting) => {
      const parsed = parseDateOnly(meeting.meeting_date);
      const key = getMonthKeyFromDateOnly(meeting.meeting_date);
      if (!parsed || !key) return acc;
      if (!acc[key]) acc[key] = { label: getMonthLabelFromDateOnly(meeting.meeting_date), meetings: [] as CouncilMeeting[], year: parsed.year, month: parsed.month };
      acc[key].meetings.push(meeting);
      return acc;
    }, {} as Record<string, { label: string; meetings: CouncilMeeting[]; year: number; month: number }>);
    return Object.values(groups).sort((a, b) => b.year - a.year || b.month - a.month);
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
    if (!form.company_id || !form.meeting_date || !form.meeting_type) return toast({ title: 'Preencha empresa, data e tipo', variant: 'destructive' });
    const payload = {
      ...form,
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

  const canGenerateDraft = !!form.company_id && !!form.meeting_date && !!form.meeting_type && transcriptText.trim().length >= MIN_TRANSCRIPT_CHARS;

  const generateDraftFromTranscript = async () => {
    if (!canGenerateDraft || generatingDraft) return;
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
          meeting_date: form.meeting_date,
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
    if (!form.company_id || !form.meeting_date || !form.meeting_type) {
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
      meeting_date: form.meeting_date,
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
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
            <Sparkles className="h-3 w-3" /> Ritos do conselho
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Agenda de Evolução</h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Organize encontros, decisões e execução contínua do conselho.
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
    <Card className='executive-panel print:hidden'><CardContent className='pt-6 grid md:grid-cols-5 gap-3'>
      <Select value={companyId} onValueChange={setCompanyId}><SelectTrigger><SelectValue placeholder='Empresa/OS' /></SelectTrigger><SelectContent><SelectItem value='all'>Todas</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todos os tipos</SelectItem><SelectItem value='collective'>Coletivo</SelectItem><SelectItem value='individual'>Individual</SelectItem><SelectItem value='extraordinary'>Extraordinário</SelectItem></SelectContent></Select>
      <Select value={actionStatus} onValueChange={setActionStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todos status de ação</SelectItem><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em andamento</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Travada</SelectItem></SelectContent></Select>
      <Select value={meetingStatus} onValueChange={(v) => setMeetingStatus(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todos encontros</SelectItem><SelectItem value='critical'>Crítico</SelectItem><SelectItem value='attention'>Atenção</SelectItem><SelectItem value='healthy'>Saudável</SelectItem></SelectContent></Select>
      <Button variant='ghost' onClick={() => { setCompanyId('all'); setTypeFilter('all'); setActionStatus('all'); setMeetingStatus('all'); }}>Limpar filtros</Button>
    </CardContent></Card>
    {loading ? <Card className='executive-panel'><CardContent className='py-10 text-center'>Carregando agenda...</CardContent></Card> : filtered.length === 0 ? <Card className='executive-panel'><CardContent className='py-10 text-center'>
      {meetings.length > 0 ? <>Nenhum encontro encontrado com os filtros atuais.<div className='mt-3'>{hasActiveFilters && <Button variant='outline' onClick={() => { setCompanyId('all'); setTypeFilter('all'); setActionStatus('all'); setMeetingStatus('all'); }}>Limpar filtros</Button>}</div></> : <>Nenhum encontro registrado ainda. Sem encontros, não há histórico de decisões, evolução e ações acompanháveis.<div className='mt-2 text-sm text-muted-foreground'>Próximo passo: registre o primeiro encontro para iniciar acompanhamento de pautas e execução.</div><div className='mt-3'><Button onClick={() => setOpen(true)}>Registrar novo encontro</Button></div></>}
    </CardContent></Card> :
      <>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{executiveKpis.totalMeetings}</p><p className='text-xs text-muted-foreground'>Total de encontros</p></CardContent></Card>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{executiveKpis.openActions}</p><p className='text-xs text-muted-foreground'>Ações abertas</p></CardContent></Card>
        <Card className='executive-card border-destructive/40'><CardContent className='p-4'><p className='text-2xl font-bold text-destructive'>{executiveKpis.criticalActions}</p><p className='text-xs text-muted-foreground'>Ações críticas</p></CardContent></Card>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{executiveKpis.completionRate}%</p><p className='text-xs text-muted-foreground'>Taxa de conclusão</p><p className='text-[11px] text-muted-foreground mt-1'>{executiveKpis.completed}/{executiveKpis.nonCancelledTotal} concluídas · {executiveKpis.meetingsThisMonth} no mês</p></CardContent></Card>
      </div>
      <Card className='executive-panel'><CardHeader><CardTitle>Alertas do ciclo</CardTitle></CardHeader><CardContent className='grid gap-2 sm:grid-cols-3 text-sm'>
        <div className='rounded-lg border border-border/70 bg-background/40 p-3'>Sem próxima pauta: <strong>{cycleAlerts.noAgenda}</strong></div>
        <div className='rounded-lg border border-border/70 bg-background/40 p-3'>Com ações críticas: <strong>{cycleAlerts.critical}</strong></div>
        <div className='rounded-lg border border-border/70 bg-background/40 p-3'>Sem evolução registrada: <strong>{cycleAlerts.noEvolution}</strong></div>
      </CardContent></Card>
      <Card className='executive-panel'><CardHeader><CardTitle>Próximo rito a preparar</CardTitle></CardHeader><CardContent>
        {filtered.length === 0 ? <p className='text-sm text-muted-foreground'>Sem próxima reunião a preparar.</p> : (() => {
          const sorted = [...filtered].sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
          const prioritized = sorted.find((m) => filteredMeetingHealth.find((h) => h.id === m.id)?.critical)
            || sorted.find((m) => filteredMeetingHealth.find((h) => h.id === m.id)?.noAgenda)
            || sorted[0];
          const comp = companies.find((c) => c.id === prioritized.company_id)?.name || '—';
          const health = filteredMeetingHealth.find((h) => h.id === prioritized.id);
          const reason = health?.critical ? 'Existem ações críticas no encontro.' : health?.noAgenda ? 'Encontro sem próxima pauta definida.' : 'Encontro mais recente do ciclo.';
          return <div className='space-y-2 text-sm'><p><strong>{comp}</strong> · {formatDateOnly(prioritized.meeting_date)}</p><p>{reason}</p><p className='text-muted-foreground'>{prioritized.next_agenda || 'Sem próxima pauta'}</p><Button asChild size='sm' variant='outline'><Link to={`/app/agenda/${prioritized.id}`}>Abrir encontro</Link></Button></div>;
        })()}
      </CardContent></Card>
      <div className='space-y-5'>{monthlyMeetingGroups.map((group) => <section key={`${group.year}-${group.month}`} className='space-y-3'>
        <div className='print:break-inside-avoid print:mb-3'>
          <h3 className='text-lg font-semibold capitalize print:break-after-avoid print:mb-1'>{group.label}</h3>
          <div className='grid gap-3'>{group.meetings.map((m, index) => {
        const comp = companies.find(c => c.id === m.company_id)?.name || '—'; const am = actions.filter(a => a.meeting_id === m.id);
        const health = filteredMeetingHealth.find((h) => h.id === m.id);
        const completedCount = am.filter(a => a.status === 'completed').length;
        const statusTone = health?.status === 'Crítico' ? 'destructive' : health?.status === 'Atenção' ? 'secondary' : 'outline';
        const dimCount = progressCountByMeeting[m.id] || 0;
        const criticalBadge = health?.overdue && health?.blocked ? 'Atrasadas + travadas' : health?.blocked ? 'Ações travadas' : health?.overdue ? 'Ações atrasadas' : '';
        const badges = [!m.next_agenda ? 'Sem próxima pauta' : '', criticalBadge, dimCount === 0 ? 'Sem evolução' : ''].filter(Boolean).slice(0, 3);
        return <Card key={m.id} className={`executive-panel border-l-2 border-l-primary/50 ${index === 0 ? 'print:break-inside-avoid' : ''}`}><CardHeader className='pb-2'><CardTitle className='flex flex-wrap items-start justify-between gap-2'><span className='leading-tight'>{m.title || m.main_topic || 'Encontro de conselho'}</span><Badge className='executive-pill'>{mt[m.meeting_type as MeetingType]}</Badge></CardTitle></CardHeader><CardContent className='text-sm space-y-2 pt-0'>
          <div className='flex flex-wrap items-center gap-2'><Badge variant='outline' className='executive-pill font-semibold'>{formatDateOnly(m.meeting_date)}</Badge><Badge variant='secondary' className='executive-pill'>{comp}</Badge><Badge variant={statusTone as any}>{health?.status || 'Atenção'}</Badge></div>
          <p><strong>Tema:</strong> {m.main_topic || '—'}</p><p><strong>Ações:</strong> {completedCount}/{am.length}</p>
          <p><strong>Dimensões avaliadas:</strong> {dimCount}</p>
          <p className='line-clamp-1 text-muted-foreground'><strong className='text-foreground'>Próxima pauta:</strong> {m.next_agenda || '—'}</p>
          <div className='flex flex-wrap gap-2'>{badges.map((badge) => <Badge key={badge} variant='outline'>{badge}</Badge>)}</div>
          <Button asChild size='sm' variant='outline' className='w-fit'><Link to={`/app/agenda/${m.id}`}>Abrir</Link></Button>
        </CardContent></Card>;
      })}</div>
        </div>
      </section>)}</div>
      <Card className='executive-panel print:hidden'><CardHeader><CardTitle>Foco recente do conselho</CardTitle></CardHeader><CardContent className='space-y-3 text-sm'>
        {focusRecentSummary.topDimensions.length === 0 ? <p className='text-muted-foreground'>Sem foco recente.</p> : <div><p className='font-medium mb-1'>Dimensões oficiais</p><div className='flex flex-wrap gap-2'>{focusRecentSummary.topDimensions.map((item) => <Badge key={item.dimension} variant='secondary'>{item.dimension} · {item.count}x</Badge>)}</div></div>}
        {focusRecentSummary.topTopics.length === 0 ? <p className='text-muted-foreground'>Sem temas frequentes.</p> : <div><p className='font-medium mb-1'>Temas frequentes</p><div className='flex flex-wrap gap-2'>{focusRecentSummary.topTopics.map((item) => <Badge key={item.label} variant='outline'>{item.label} · {item.count}x</Badge>)}</div></div>}
        <p className='text-muted-foreground'>{focusRecentSummary.insight || 'Sem insight de atenção neste ciclo.'}</p>
        <Button asChild variant='outline' size='sm'><Link to='/app/counselor'>Ver Central do Conselheiro</Link></Button>
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
