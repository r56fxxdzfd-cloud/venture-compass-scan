import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DimensionBadge } from '@/components/DimensionBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { CouncilAction, CouncilMeeting, CouncilDimensionProgress, CouncilAgendaTemplate, CouncilMeetingNotesDraft, DimensionTrend, SuggestedCouncilActionDraft, DimensionProgressSuggestionDraft } from '@/types/council';
import { BackToTopFooter } from '@/components/BackToTopFooter';
import { formatDateOnlyBR, getTodayDateOnly, isDateOnlyBefore } from '@/lib/dateOnly';

type DimensionOption = { id: string; label: string };
type DimensionForm = Omit<CouncilDimensionProgress, 'id' | 'meeting_id' | 'company_id' | 'created_at' | 'updated_at'>;

const trendLabel: Record<DimensionTrend, string> = {
  improving: 'Melhorando',
  stable: 'Estável',
  worsening: 'Piorando',
  insufficient_evidence: 'Sem evidência',
};

const trendVariant: Record<DimensionTrend, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  improving: 'default',
  stable: 'secondary',
  worsening: 'destructive',
  insufficient_evidence: 'outline',
};
const winsSuggestions = ['Ação concluída','Decisão tomada','Indicador criado','Responsável definido','Documento criado','Rotina iniciada','Risco mitigado'];
const blockerSuggestions = ['Falta de responsável','Falta de dados','Falta de caixa','Dependência da liderança','Resistência interna','Falta de governança','Captação insuficiente','Processo inexistente','Sobrecarga operacional'];

const confidenceLabel = { high: 'Alta', medium: 'Média', low: 'Baixa' } as const;


const actionStatusLabel: Record<string, string> = {
  not_started: 'Não iniciada',
  'Not Started': 'Não iniciada',
  in_progress: 'Em andamento',
  'In Progress': 'Em andamento',
  blocked: 'Travada',
  Blocked: 'Travada',
  completed: 'Concluída',
  Completed: 'Concluída',
  cancelled: 'Cancelada',
  Cancelled: 'Cancelada',
};

const actionStatusGroupLabels = {
  not_started: 'Não iniciadas',
  in_progress: 'Em andamento',
  blocked: 'Travadas',
  completed: 'Concluídas',
  cancelled: 'Canceladas',
} as const;

const actionPriorityLabel: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const dimensionLabelByCode: Record<string, string> = {
  IC: 'Identidade & Cultura',
  PL: 'Pessoas & Liderança',
  GR: 'Governança & Riscos',
  EE: 'Estratégia & Execução',
  PM: 'Processos & Métricas',
  FS: 'Finanças & Sustentabilidade',
  MN: 'Modelo de Negócio',
  GT: 'Go-to-market & Tração',
  PT: 'Produto & Tecnologia',
};

const dimensionCodeByAlias: Record<string, keyof typeof dimensionLabelByCode> = {
  ic: 'IC',
  identidade: 'IC',
  identidadecultura: 'IC',

  pl: 'PL',
  pessoas: 'PL',
  lideranca: 'PL',

  gr: 'GR',
  governanca: 'GR',
  riscos: 'GR',

  ee: 'EE',
  estrategia: 'EE',
  execucao: 'EE',

  pm: 'PM',
  processos: 'PM',
  metricas: 'PM',

  fs: 'FS',
  financas: 'FS',
  sustentabilidade: 'FS',

  mn: 'MN',
  modelo: 'MN',
  negocio: 'MN',

  gt: 'GT',
  gotomarket: 'GT',
  tracao: 'GT',

  pt: 'PT',
  produto: 'PT',
  tecnologia: 'PT',
};

function normalizeDimensionToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeDimensionCode(value?: string | null): keyof typeof dimensionLabelByCode | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  const normalized = normalizeDimensionToken(cleaned);
  if (!normalized) return null;

  if (normalized in dimensionCodeByAlias) {
    return dimensionCodeByAlias[normalized];
  }

  const byLabel = Object.entries(dimensionLabelByCode).find(([, fullLabel]) => normalizeDimensionToken(fullLabel) === normalized);
  if (byLabel) return byLabel[0] as keyof typeof dimensionLabelByCode;

  return null;
}

function dimensionDisplayLabel(value?: string | null): string {
  if (!value) return '—';
  const code = normalizeDimensionCode(value);
  if (!code) return value.trim() || '—';
  return `${dimensionLabelByCode[code]} (${code})`;
}

const MIN_TRANSCRIPT_CHARS = 80;

function safeJsonClone<T>(value: T): T | null {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function normalizeDraftPayload(raw: unknown): CouncilMeetingNotesDraft | null {
  const cloned = safeJsonClone(raw);
  if (!cloned || typeof cloned !== 'object') return null;
  return { ...emptyDraft, ...(cloned as Partial<CouncilMeetingNotesDraft>) };
}

const emptyDraft: CouncilMeetingNotesDraft = {
  executive_summary: '',
  key_progress: '',
  key_blockers: '',
  decisions: '',
  recommendations: '',
  next_agenda: '',
  related_dimensions: [],
  suggested_actions: [],
  dimension_progress_suggestions: [],
  uncertain_items: [],
};


export default function MeetingDetailPage() {
  const { id: rawId } = useParams();
  const { canOperateDemo } = useAuth();
  const id = typeof rawId === 'string' ? rawId.trim() : '';
  const [meeting, setMeeting] = useState<CouncilMeeting | null>(null);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [progressRows, setProgressRows] = useState<CouncilDimensionProgress[]>([]);
  const [agendaTemplates, setAgendaTemplates] = useState<CouncilAgendaTemplate[]>([]);
  const [formByDimension, setFormByDimension] = useState<Record<string, DimensionForm>>({});
  const { toast } = useToast();
  const [newAction, setNewAction] = useState<any>({ priority: 'medium', status: 'not_started' });
  const [companyName, setCompanyName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [transcriptText, setTranscriptText] = useState('');
  const [draft, setDraft] = useState<CouncilMeetingNotesDraft | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [applyingDraft, setApplyingDraft] = useState(false);
  const [lastAppliedDraftFingerprint, setLastAppliedDraftFingerprint] = useState<string | null>(null);


  const load = async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setNotFound(false);
    try {
      if (!id) {
        setMeeting(null);
        setNotFound(true);
        return;
      }
      const { data: m, error: meetingError } = await supabase.from('council_meetings').select('*').eq('id', id).maybeSingle();
      if (meetingError) {
        console.error('[MeetingDetailPage] failed loading meeting', {
          id,
          error: meetingError,
          message: meetingError?.message,
          details: meetingError?.details,
          hint: meetingError?.hint,
          code: meetingError?.code
        });
        setError(meetingError.message || 'Falha ao carregar os dados do encontro.');
        setErrorCode(meetingError.code ?? null);
        setMeeting(null);
        return;
      }
      if (!m) {
        setMeeting(null);
        setNotFound(true);
        return;
      }

      const [actionsResult, companyResult, configResult, progressResult, templatesResult] = await Promise.allSettled([
        supabase.from('council_actions').select('*').eq('meeting_id', id),
        supabase.from('companies').select('name').eq('id', m.company_id).single(),
        supabase.from('config_versions').select('id').eq('status', 'published').single(),
        supabase.from('council_dimension_progress').select('*').eq('meeting_id', id),
        supabase.from('council_agenda_templates').select('*').eq('is_active', true).order('sort_order'),
      ]);

      const actionsPayload = actionsResult.status === 'fulfilled' ? actionsResult.value : null;
      const companyPayload = companyResult.status === 'fulfilled' ? companyResult.value : null;
      const configPayload = configResult.status === 'fulfilled' ? configResult.value : null;
      const progressPayload = progressResult.status === 'fulfilled' ? progressResult.value : null;
      const templatesPayload = templatesResult.status === 'fulfilled' ? templatesResult.value : null;

      if (actionsResult.status === 'rejected' || actionsPayload?.error) {
        const actionError = actionsResult.status === 'rejected' ? actionsResult.reason : actionsPayload?.error;
        console.error('[MeetingDetailPage] failed loading council_actions', { id, error: actionError });
      }
      if (companyResult.status === 'rejected' || companyPayload?.error) {
        const companyError = companyResult.status === 'rejected' ? companyResult.reason : companyPayload?.error;
        console.error('[MeetingDetailPage] failed loading company', { id, companyId: m.company_id, error: companyError });
      }
      if (progressResult.status === 'rejected' || progressPayload?.error) {
        const progressError = progressResult.status === 'rejected' ? progressResult.reason : progressPayload?.error;
        console.error('[MeetingDetailPage] failed loading council_dimension_progress', { id, error: progressError });
      }
      if (templatesResult.status === 'rejected' || templatesPayload?.error) {
        const templatesError = templatesResult.status === 'rejected' ? templatesResult.reason : templatesPayload?.error;
        console.error('[MeetingDetailPage] failed loading templates', { id, error: templatesError });
      }
      if (configResult.status === 'rejected' || configPayload?.error) {
        const configError = configResult.status === 'rejected' ? configResult.reason : configPayload?.error;
        console.error('[MeetingDetailPage] failed loading config_versions', { id, error: configError });
      }

      let dimensionData: DimensionOption[] = [];
      const publishedConfigId = configPayload?.data?.id;
      if (publishedConfigId) {
        const { data: dims, error: dimError } = await supabase.from('dimensions').select('id,label').eq('config_version_id', publishedConfigId).order('sort_order', { ascending: true });
        if (dimError) {
          console.error('[MeetingDetailPage] failed loading dimensions', { id, configVersionId: publishedConfigId, error: dimError });
        }
        dimensionData = (dims || []) as DimensionOption[];
      }

      const rows = (progressPayload?.data || []) as CouncilDimensionProgress[];
      const formState: Record<string, DimensionForm> = {};

      for (const dim of dimensionData) {
        const existing = rows.find(r => r.dimension_id === dim.id);
        formState[dim.id] = existing ? {
          dimension_id: existing.dimension_id,
          dimension_label: existing.dimension_label,
          initial_score: existing.initial_score,
          current_perceived_score: existing.current_perceived_score,
          trend: existing.trend,
          evidence_note: existing.evidence_note,
          counselor_comment: existing.counselor_comment,
        } : {
          dimension_id: dim.id,
          dimension_label: dim.label,
          initial_score: null,
          current_perceived_score: null,
          trend: 'stable',
          evidence_note: null,
          counselor_comment: null,
        };
      }

      setMeeting(m as CouncilMeeting);
      setActions((actionsPayload?.data || []) as CouncilAction[]);
      setCompanyName(companyPayload?.data?.name || '');
      setDimensions(dimensionData);
      setProgressRows(rows);
      setAgendaTemplates((templatesPayload?.data || []) as CouncilAgendaTemplate[]);
      setFormByDimension(formState);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar os dados do encontro.';
      setError(message);
      setMeeting(null);
      console.error('[MeetingDetailPage] failed loading meeting', {
        id,
        error: err,
        message: err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : undefined,
        details: err && typeof err === 'object' && 'details' in err ? (err as { details?: string }).details : undefined,
        hint: err && typeof err === 'object' && 'hint' in err ? (err as { hint?: string }).hint : undefined,
        code: err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined
      });
      toast({ title: 'Erro ao carregar encontro', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const addAction = async () => {
    if (!meeting || !newAction.title) {
      toast({ title: 'Informe ao menos o título da ação', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('council_actions').insert({ ...newAction, meeting_id: meeting.id, company_id: meeting.company_id });
    if (error) return toast({ title: 'Erro ao criar ação', description: error.message, variant: 'destructive' });
    setNewAction({ priority: 'medium', status: 'not_started' });
    load();
  };

  const saveDimensionProgress = async (dimensionId: string) => {
    if (!meeting) return;
    const current = formByDimension[dimensionId];
    if (!current) return;
    const payload = {
      meeting_id: meeting.id,
      company_id: meeting.company_id,
      ...current,
      evidence_note: current.evidence_note || null,
      counselor_comment: current.counselor_comment || null,
    };
    const { error } = await supabase.from('council_dimension_progress').upsert(payload, { onConflict: 'meeting_id,dimension_id' });
    if (error) return toast({ title: 'Erro ao salvar evolução', description: error.message, variant: 'destructive' });
    toast({ title: 'Evolução por dimensão atualizada' });
    load();
  };


  const generateMeetingDraft = async () => {
    if (!meeting || trimmedTranscript.length < MIN_TRANSCRIPT_CHARS) return;
    setGeneratingDraft(true);
    const { data, error } = await supabase.functions.invoke('extract-council-meeting-notes', {
      body: {
        meeting_id: meeting.id,
        company_id: meeting.company_id,
        transcript_text: trimmedTranscript,
        context: {
          organization_name: companyName,
          official_dimensions: dimensions,
          agenda_templates: agendaTemplates,
          open_actions: actions.filter((action) => action.status !== 'completed' && action.status !== 'cancelled').slice(0, 12),
          latest_agenda: meeting.next_agenda,
        },
      },
    });
    setGeneratingDraft(false);
    if (error) return toast({ title: 'Erro ao analisar transcrição', description: error.message, variant: 'destructive' });

    const normalizedDraft = normalizeDraftPayload(data?.draft);
    if (!normalizedDraft) {
      return toast({ title: 'Resposta inválida do assistente', description: 'A IA retornou um formato inesperado. Tente novamente com outra transcrição.', variant: 'destructive' });
    }

    const invalidProgressDimensions = normalizedDraft.dimension_progress_suggestions.filter((item) => !officialDimensionIds.has(item.dimension_id));
    const sanitizedDraft: CouncilMeetingNotesDraft = {
      ...normalizedDraft,
      suggested_actions: normalizedDraft.suggested_actions.map((item) => item.related_dimension && !officialDimensionIds.has(item.related_dimension) ? { ...item, related_dimension: '' } : item),
      dimension_progress_suggestions: normalizedDraft.dimension_progress_suggestions.filter((item) => officialDimensionIds.has(item.dimension_id)),
      uncertain_items: [
        ...normalizedDraft.uncertain_items,
        ...invalidProgressDimensions.map((item) => ({ type: 'dimension' as const, note: `Dimensão ignorada por não estar na lista oficial: ${item.dimension_id} (${item.dimension_label})`, source_excerpt: item.source_excerpt || '' })),
      ],
    };

    setDraft(sanitizedDraft);
    toast({ title: 'Pré-ata gerada', description: 'Revise cada item antes de aplicar ao encontro.' });
  };

  const applyDraftToMeeting = async () => {
    if (!meeting || !draft || !canApplyDraft) return;
    setApplyingDraft(true);
    const approvedActions = draft.suggested_actions.filter((item) => item.approved !== false);
    const approvedProgress = draft.dimension_progress_suggestions.filter((item) => item.approved !== false);

    const { error: meetingError } = await supabase.from('council_meetings').update({
      executive_summary: draft.executive_summary || null,
      key_progress: draft.key_progress || null,
      key_blockers: draft.key_blockers || null,
      decisions: draft.decisions || null,
      recommendations: draft.recommendations || null,
      next_agenda: draft.next_agenda || null,
      related_dimensions: draft.related_dimensions,
    }).eq('id', meeting.id);

    if (meetingError) {
      setApplyingDraft(false);
      return toast({ title: 'Erro ao aplicar pré-ata', description: meetingError.message, variant: 'destructive' });
    }

    if (approvedActions.length > 0) {
      const payload = approvedActions.map((item) => ({
        meeting_id: meeting.id,
        company_id: meeting.company_id,
        title: item.title,
        description: item.description || null,
        owner_name: item.owner_name?.trim() || null,
        due_date: item.due_date?.trim() || null,
        related_dimension: item.related_dimension && officialDimensionIds.has(item.related_dimension) ? item.related_dimension : null,
        priority: item.priority,
        impact: item.impact,
        effort: item.effort,
        expected_evidence: item.expected_evidence || null,
        status: 'not_started',
      }));
      const { error } = await supabase.from('council_actions').insert(payload);
      if (error) {
        setApplyingDraft(false);
        return toast({ title: 'Pré-ata aplicada parcialmente', description: `Erro ao criar ações: ${error.message}`, variant: 'destructive' });
      }
    }

    for (const item of approvedProgress) {
      if (!officialDimensionIds.has(item.dimension_id)) continue;
      const { error } = await supabase.from('council_dimension_progress').upsert({
        meeting_id: meeting.id,
        company_id: meeting.company_id,
        dimension_id: item.dimension_id,
        dimension_label: item.dimension_label,
        current_perceived_score: item.current_perceived_score,
        trend: item.trend,
        evidence_note: item.evidence_note || null,
        counselor_comment: item.counselor_comment || null,
      }, { onConflict: 'meeting_id,dimension_id' });
      if (error) {
        setApplyingDraft(false);
        return toast({ title: 'Pré-ata aplicada parcialmente', description: `Erro ao salvar evolução: ${error.message}`, variant: 'destructive' });
      }
    }

    setApplyingDraft(false);
    setLastAppliedDraftFingerprint(draftFingerprint);
    setDraft(null);
    setTranscriptText('');
    toast({ title: 'Pré-ata aplicada com sucesso' });
    load();
  };

  const updateStatus = async (action: CouncilAction, status: string) => {
    const { error } = await supabase.from('council_actions').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', action.id);
    if (error) return toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    load();
  };

  if (loading) return <div className='text-sm text-muted-foreground'>Carregando encontro...</div>;
  if (error) return <Card className='executive-panel'><CardHeader><CardTitle>Erro ao carregar encontro</CardTitle></CardHeader><CardContent className='space-y-3'><p className='text-sm text-muted-foreground'>Não foi possível carregar os dados deste encontro agora.</p>{import.meta.env.DEV && <div className='rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3 text-xs text-muted-foreground space-y-1'><p><strong>meeting id:</strong> {id || '(vazio)'}</p><p><strong>error code:</strong> {errorCode || '(sem código)'}</p><p><strong>mensagem:</strong> {error}</p></div>}<Button asChild><Link to='/app/agenda'>Voltar para Agenda</Link></Button></CardContent></Card>;
  if (notFound || !meeting) return <Card className='executive-panel'><CardHeader><CardTitle>Encontro não encontrado</CardTitle></CardHeader><CardContent className='space-y-3'><p className='text-sm text-muted-foreground'>{id ? 'Encontro não encontrado ou sem permissão de acesso.' : 'Encontro não encontrado.'}</p><Button asChild><Link to='/app/agenda'>Voltar para Agenda</Link></Button></CardContent></Card>;

  const todayDateOnly = getTodayDateOnly();
  const totalActions = actions.length;
  const completedActions = actions.filter(a => a.status === 'completed').length;
  const openActions = actions.filter(a => ['not_started', 'in_progress', 'blocked'].includes(a.status)).length;
  const overdueActions = actions.filter(a => a.due_date && isDateOnlyBefore(a.due_date, todayDateOnly) && !['completed', 'cancelled'].includes(a.status)).length;
  const blockedActions = actions.filter(a => a.status === 'blocked').length;
  const progressPct = totalActions ? Math.round((completedActions / totalActions) * 100) : 0;
  const actionsByStatus = {
    not_started: actions.filter(a => a.status === 'not_started'),
    in_progress: actions.filter(a => a.status === 'in_progress'),
    blocked: actions.filter(a => a.status === 'blocked'),
    completed: actions.filter(a => a.status === 'completed'),
    cancelled: actions.filter(a => a.status === 'cancelled'),
  };
  const completionRate = totalActions ? completedActions / totalActions : 0;
  const healthIssues = (overdueActions > 0 ? 1 : 0) + (blockedActions > 0 ? 1 : 0) + (!meeting.next_agenda ? 1 : 0) + (progressRows.length === 0 ? 1 : 0) + (completionRate < 0.4 ? 1 : 0);
  const cycleHealth = healthIssues >= 3 ? 'Crítico' : healthIssues >= 1 ? 'Atenção' : 'Saudável';

  const matrix = {
    high_low: actions.filter(a => a.impact === 'high' && a.effort === 'low'),
    high_high: actions.filter(a => a.impact === 'high' && a.effort === 'high'),
    low_low: actions.filter(a => a.impact === 'low' && a.effort === 'low'),
    low_high: actions.filter(a => a.impact === 'low' && a.effort === 'high'),
  };

  const discussedDimensionIds = new Set([
    ...(meeting.related_dimensions || []),
    ...progressRows.map(p => p.dimension_id),
  ]);
  const officialDimensionIds = new Set(dimensions.map((d) => d.id));
  const trimmedTranscript = transcriptText.trim();
  const canGenerateDraft = trimmedTranscript.length >= MIN_TRANSCRIPT_CHARS && !generatingDraft;
  const draftFingerprint = draft ? JSON.stringify(draft) : null;
  const canApplyDraft = !!draft && !applyingDraft && !!draftFingerprint && draftFingerprint !== lastAppliedDraftFingerprint;

  const suggestedTemplates = agendaTemplates.filter(t =>
    discussedDimensionIds.has(t.dimension_id) ||
    Array.from(discussedDimensionIds).some(id => id.toLowerCase() === t.dimension_label.toLowerCase())
  );

  const hasStructuredMinutesContent = [meeting.executive_summary, meeting.decisions, meeting.recommendations, meeting.key_blockers, meeting.next_agenda]
    .some((item) => !!item?.trim());
  const dimensionsWithProgress = dimensions.filter((dimension) => progressRows.some((row) => row.dimension_id === dimension.id));
  const dimensionsWithoutProgress = dimensions.filter((dimension) => !progressRows.some((row) => row.dimension_id === dimension.id));
  const hasCompactMatrix = actions.length <= 2;

  return <div className='space-y-4'>
    <div>
      <Button variant='ghost' asChild className='px-0 text-muted-foreground hover:text-foreground'>
        <Link to='/app/agenda'>
          <ArrowLeft className='h-4 w-4' />
          Voltar para Agenda
        </Link>
      </Button>
    </div>
    <Card className='executive-panel print:break-inside-avoid'>
      <CardContent className='p-4 space-y-3'>
        <div>
          <p className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>Encontro de conselho</p>
          <h1 className='text-xl font-bold'>{meeting.title || meeting.main_topic || 'Encontro de acompanhamento'}</h1>
        </div>
        <div className='grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3'>
          <p><strong>Organização:</strong> {companyName || '—'}</p>
          <p><strong>Data:</strong> {formatDateOnlyBR(meeting.meeting_date)}</p>
          <p><strong>Tipo:</strong> {meeting.meeting_type === 'collective' ? 'Coletivo' : meeting.meeting_type === 'individual' ? 'Individual' : 'Extraordinário'}</p>
          <p><strong>Saúde do ciclo:</strong> {cycleHealth}</p>
          <p><strong>Ações concluídas:</strong> {completedActions}/{totalActions}</p>
          <p><strong>Próxima pauta:</strong> {meeting.next_agenda || 'Não definida'}</p>
        </div>
      </CardContent>
    </Card>
    <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-6 print:grid-cols-3'>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{totalActions}</p><p className='text-xs text-muted-foreground'>Ações totais</p></CardContent></Card>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{completedActions}</p><p className='text-xs text-muted-foreground'>Concluídas</p></CardContent></Card>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{openActions}</p><p className='text-xs text-muted-foreground'>Abertas</p></CardContent></Card>
      <Card className='executive-card border-destructive/40'><CardContent className='p-4'><p className='text-2xl font-bold text-destructive'>{overdueActions}</p><p className='text-xs text-muted-foreground'>Atrasadas</p></CardContent></Card>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{progressRows.length}</p><p className='text-xs text-muted-foreground'>Dimensões avaliadas</p></CardContent></Card>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-sm font-semibold'>{meeting.next_agenda ? 'Sim' : 'Não'}</p><p className='text-xs text-muted-foreground'>Próxima pauta definida</p></CardContent></Card>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-sm font-semibold'>{cycleHealth}</p><p className='text-xs text-muted-foreground'>Saúde do ciclo (atrasos, travas, pauta, evolução e conclusão)</p></CardContent></Card>
    </div>
    <Card className='executive-panel print:break-inside-avoid'><CardHeader><CardTitle>Ata estruturada</CardTitle></CardHeader><CardContent className='space-y-2 text-sm'>
      <Badge className='executive-pill print:hidden'>{meeting.meeting_type === 'collective' ? 'Coletivo' : meeting.meeting_type === 'individual' ? 'Individual' : 'Extraordinário'}</Badge>
      <p><strong>Empresa:</strong> {companyName || '—'}</p>
      {!hasStructuredMinutesContent ? <div className='rounded-md border border-dashed p-3 text-muted-foreground'>
        <p className='font-medium'>Ata ainda não estruturada.</p>
        <p className='text-xs'>Use o Assistente de Ata para gerar uma pré-ata revisável a partir da transcrição.</p>
      </div> : <>
        <p><strong>Resumo:</strong> {meeting.executive_summary || '—'}</p>
        <p><strong>Decisões:</strong> {meeting.decisions || '—'}</p>
        <p><strong>Recomendações:</strong> {meeting.recommendations || '—'}</p>
        <p><strong>Travas:</strong> {meeting.key_blockers || '—'}</p>
        <p><strong>Próxima pauta:</strong> {meeting.next_agenda || '—'}</p>
      </>}
      {canOperateDemo && <>
        <div className='print:hidden'><p className='mb-1'><strong>Sugestões de avanços:</strong></p><div className='flex flex-wrap gap-2'>{winsSuggestions.map(item => <button key={item} type='button' className='rounded-full border px-2 py-1 text-xs' onClick={async () => { const v = meeting.recommendations ? `${meeting.recommendations}; ${item}` : item; await supabase.from('council_meetings').update({ recommendations: v }).eq('id', meeting.id); setMeeting({ ...meeting, recommendations: v }); }}>{item}</button>)}</div></div>
        <div className='print:hidden'><p className='mb-1'><strong>Sugestões de travas:</strong></p><div className='flex flex-wrap gap-2'>{blockerSuggestions.map(item => <button key={item} type='button' className='rounded-full border px-2 py-1 text-xs' onClick={async () => { const v = meeting.key_blockers ? `${meeting.key_blockers}; ${item}` : item; await supabase.from('council_meetings').update({ key_blockers: v }).eq('id', meeting.id); setMeeting({ ...meeting, key_blockers: v }); }}>{item}</button>)}</div></div>
      </>}
      <div className='flex flex-wrap gap-2'>
        {!meeting.next_agenda && <Badge variant='outline'>Sem próxima pauta</Badge>}
        {totalActions === 0 && <Badge variant='outline'>Sem ações</Badge>}
        {overdueActions > 0 && <Badge variant='destructive'>Ações atrasadas</Badge>}
        {progressRows.length === 0 && <Badge variant='outline'>Sem evolução registrada</Badge>}
      </div>
    <div className='pt-1'><Link to='/app/agenda/templates' className='text-sm text-primary underline'>Consultar Templates de Pauta</Link></div></CardContent></Card>


    <Card className={`executive-panel ${suggestedTemplates.length === 0 ? 'print:hidden' : ''}`}><CardHeader><CardTitle>Pautas sugeridas para este encontro</CardTitle></CardHeader><CardContent className='space-y-3'>
      {suggestedTemplates.length === 0 ? <p className='text-sm text-muted-foreground'>Nenhum template relacionado às dimensões deste encontro. Consulte a biblioteca de templates para qualificar a pauta.</p> :
      suggestedTemplates.map(t => <div key={t.id} className='executive-card rounded-lg p-3 space-y-2'>
        <p className='font-medium flex items-center gap-2'><DimensionBadge code={t.dimension_id} label={t.dimension_label} /><span>{t.title}</span></p>
        <p className='text-sm'><strong>Objetivo:</strong> {t.objective}</p>
        <ul className='list-disc pl-5 text-sm'>{t.key_questions.map((q, idx) => <li key={idx}>{q}</li>)}</ul>
      </div>)}
    </CardContent></Card>

    <Card className='executive-panel'><CardHeader className='print:break-after-avoid'><CardTitle>Evolução por Dimensão</CardTitle></CardHeader><CardContent className='space-y-3'>
      <div className='hidden print:block text-sm'>
        {dimensionsWithProgress.length === 0 ? <p className='text-muted-foreground'>Nenhuma evolução por dimensão registrada neste encontro.</p> : <div className='space-y-2'>
          {dimensionsWithProgress.map((d) => {
            const row = progressRows.find((p) => p.dimension_id === d.id);
            if (!row) return null;
            return <div key={`print-${d.id}`} className='rounded border p-2 print:break-inside-avoid'>
              <p className='font-medium'>{d.label} · {trendLabel[row.trend]}</p>
              <p className='text-xs text-muted-foreground'>Antes: {row.initial_score ?? '—'} · Agora: {row.current_perceived_score ?? '—'}</p>
              {row.evidence_note ? <p className='text-xs'><strong>Evidência:</strong> {row.evidence_note}</p> : null}
            </div>;
          })}
          {dimensionsWithoutProgress.length > 0 ? <p className='text-xs text-muted-foreground'>Dimensões sem registro neste encontro: {dimensionsWithoutProgress.map((d) => d.label).join(', ')}.</p> : null}
        </div>}
      </div>
      <div className='print:hidden'>
      {dimensions.length === 0 ? <p className='text-sm text-muted-foreground'>Nenhuma dimensão ativa encontrada na metodologia publicada.</p> : <>
        <p className='text-sm text-muted-foreground'>Registre apenas as dimensões discutidas neste encontro.</p>
        <div className='space-y-4'>{dimensions.map((d) => {
          const row = formByDimension[d.id];
          if (!row) return null;
          const existing = progressRows.find(p => p.dimension_id === d.id);
          return <div key={d.id} className='executive-card rounded-lg p-3 space-y-3'>
            <div className='flex items-center justify-between'>
              <p className='font-medium'>{d.label}</p>
              <Badge variant={trendVariant[row.trend]}>{trendLabel[row.trend]}</Badge>
            </div>
            <div className='grid grid-cols-3 gap-2 text-xs'><div><p className='text-muted-foreground'>Antes</p><p className='font-semibold'>{row.initial_score ?? '—'}</p></div><div><p className='text-muted-foreground'>Agora</p><p className='font-semibold'>{row.current_perceived_score ?? '—'}</p></div><div><p className='text-muted-foreground'>Diferença</p><p className='font-semibold'>{row.initial_score != null && row.current_perceived_score != null ? `${(row.current_perceived_score - row.initial_score) > 0 ? '+' : ''}${(row.current_perceived_score - row.initial_score).toFixed(1)}` : '—'}</p></div></div>
            <div className='h-2 rounded bg-muted overflow-hidden'><div className='h-full bg-cyan-500' style={{ width: `${((row.current_perceived_score ?? row.initial_score ?? 0) / 5) * 100}%` }} /></div>
            <div className='grid md:grid-cols-3 gap-2'>
              <div><Label>Score inicial</Label><Input type='number' min={1} max={5} step='0.1' value={row.initial_score ?? ''} onChange={e => setFormByDimension(prev => ({ ...prev, [d.id]: { ...prev[d.id], initial_score: e.target.value ? Number(e.target.value) : null } }))} /></div>
              <div><Label>Score percebido atual</Label><Input type='number' min={1} max={5} step='0.1' value={row.current_perceived_score ?? ''} onChange={e => setFormByDimension(prev => ({ ...prev, [d.id]: { ...prev[d.id], current_perceived_score: e.target.value ? Number(e.target.value) : null } }))} /></div>
              <div><Label>Tendência</Label><Select value={row.trend} onValueChange={(v: DimensionTrend) => setFormByDimension(prev => ({ ...prev, [d.id]: { ...prev[d.id], trend: v } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='improving'>Melhorando</SelectItem><SelectItem value='stable'>Estável</SelectItem><SelectItem value='worsening'>Piorando</SelectItem><SelectItem value='insufficient_evidence'>Sem evidência</SelectItem></SelectContent></Select></div>
            </div>
            <div className='grid md:grid-cols-2 gap-2'>
              <div><Label>Evidência</Label><Textarea value={row.evidence_note ?? ''} onChange={e => setFormByDimension(prev => ({ ...prev, [d.id]: { ...prev[d.id], evidence_note: e.target.value || null } }))} /></div>
              <div><Label>Comentário do conselheiro</Label><Textarea value={row.counselor_comment ?? ''} onChange={e => setFormByDimension(prev => ({ ...prev, [d.id]: { ...prev[d.id], counselor_comment: e.target.value || null } }))} /></div>
            </div>
            <div className='flex items-center justify-between'>
              <p className='text-xs text-muted-foreground'>{existing ? 'Registro existente: atualização incremental.' : 'Sem registro ainda para esta dimensão.'}</p>
              {canOperateDemo && <Button size='sm' onClick={() => saveDimensionProgress(d.id)}>{existing ? 'Atualizar dimensão' : 'Salvar dimensão'}</Button>}
            </div>
          </div>;
        })}</div>
      </>}
      </div>
    </CardContent></Card>

    <Card className='executive-panel'><CardHeader><CardTitle>Ações combinadas</CardTitle></CardHeader><CardContent className='space-y-3'>
      <div className='space-y-1'>
        <div className='h-2 rounded bg-muted overflow-hidden'><div className='h-full bg-primary' style={{ width: `${progressPct}%` }} /></div>
        <p className='text-xs text-muted-foreground'>{completedActions} de {totalActions} ações concluídas ({progressPct}%)</p>
      </div>
      {canOperateDemo && <div className='grid md:grid-cols-5 gap-2 print:hidden'>
        <div className='md:col-span-2'><Label>Ação</Label><Input value={newAction.title || ''} onChange={e => setNewAction({ ...newAction, title: e.target.value })} /></div>
        <div><Label>Responsável</Label><Input value={newAction.owner_name || ''} onChange={e => setNewAction({ ...newAction, owner_name: e.target.value })} /></div>
        <div><Label>Prazo</Label><Input type='date' value={newAction.due_date || ''} onChange={e => setNewAction({ ...newAction, due_date: e.target.value })} /></div>
        <div><Label>Status</Label><Select value={newAction.status} onValueChange={v => setNewAction({ ...newAction, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em andamento</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Travada</SelectItem></SelectContent></Select></div>
      </div>}
      {canOperateDemo && <Button onClick={addAction}>Adicionar ação de conselho</Button>}
      {actions.length === 0 ? <p className='text-sm text-muted-foreground'>Nenhuma ação vinculada. Sem ações fica impossível monitorar execução do encontro. Próximo passo: registre ao menos uma ação com responsável e prazo.</p> :
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-5'>{Object.entries(actionsByStatus).map(([status, rows]) => <div key={status} className='executive-card rounded p-2 space-y-2 print:break-inside-avoid'>
        <p className='text-sm font-semibold'>{actionStatusGroupLabels[status as keyof typeof actionStatusGroupLabels]}</p>
        {rows.length === 0 ? <p className='text-xs text-muted-foreground'>Sem itens</p> : rows.map(a => <div key={a.id} className='rounded border border-border/50 p-2 space-y-1 print:break-inside-avoid'>
          <p className='text-sm font-medium'>{a.title}</p><p className='text-xs text-muted-foreground'>{a.owner_name || 'Sem responsável'} • {a.due_date || 'Sem prazo'}</p>
          <p className='text-xs text-muted-foreground'>Prioridade: {actionPriorityLabel[a.priority || ''] || a.priority || '—'} · Dimensão: {dimensionDisplayLabel(a.related_dimension)}</p>
          {a.expected_evidence ? <p className='text-xs'><strong>Evidência esperada:</strong> {a.expected_evidence}</p> : null}
          {a.impact === 'high' && a.effort === 'low' && ['not_started', 'in_progress', 'blocked'].includes(a.status) && <Badge className='mt-1'>Prioridade imediata</Badge>}
          <p className='text-xs font-medium print:hidden'>Status: {actionStatusLabel[a.status] || a.status}</p>
          {canOperateDemo && <div className='print:hidden'><Select value={a.status} onValueChange={(v) => updateStatus(a, v)}><SelectTrigger className='w-full h-8'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em andamento</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Travada</SelectItem><SelectItem value='cancelled'>Cancelada</SelectItem></SelectContent></Select></div>}
        </div>)}
      </div>)}</div>}
    </CardContent></Card>

    <Card className='executive-panel'><CardHeader><CardTitle>Matriz impacto x esforço</CardTitle></CardHeader><CardContent>
      {hasCompactMatrix ? <p className='text-sm text-muted-foreground'>Poucas ações classificadas neste encontro. Resumo: alto impacto/baixo esforço {matrix.high_low.length}, alto impacto/alto esforço {matrix.high_high.length}, baixo impacto/baixo esforço {matrix.low_low.length}, baixo impacto/alto esforço {matrix.low_high.length}.</p> : <div className='grid md:grid-cols-2 gap-3 text-sm'>
        <div className='executive-card rounded p-3'><p className='font-semibold'>Alto impacto / baixo esforço</p><p>{matrix.high_low.length} ações</p></div>
        <div className='executive-card rounded p-3'><p className='font-semibold'>Alto impacto / alto esforço</p><p>{matrix.high_high.length} ações</p></div>
        <div className='executive-card rounded p-3'><p className='font-semibold'>Baixo impacto / baixo esforço</p><p>{matrix.low_low.length} ações</p></div>
        <div className='executive-card rounded p-3'><p className='font-semibold'>Baixo impacto / alto esforço</p><p>{matrix.low_high.length} ações</p></div>
      </div>}
    </CardContent></Card>

    <Card className='executive-panel'><CardHeader><CardTitle>Assistente de Ata do Conselho</CardTitle></CardHeader><CardContent className='space-y-3'>
      <p className='hidden print:block text-xs text-muted-foreground'>Assistente de Ata disponível na versão digital.</p>
      {canOperateDemo && <div className='print:hidden space-y-3'>
      <p className='text-xs text-muted-foreground'>A IA gera um rascunho. Revise antes de aplicar ao encontro.</p>
      <Textarea value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} placeholder='Cole a transcrição da reunião aqui...' className='min-h-40' />
      <Button disabled={!canGenerateDraft} onClick={generateMeetingDraft}>{generatingDraft ? 'Analisando transcrição...' : 'Gerar pré-ata'}</Button>
      {trimmedTranscript.length > 0 && trimmedTranscript.length < MIN_TRANSCRIPT_CHARS ? <p className='text-xs text-muted-foreground'>A transcrição está curta demais. Inclua mais contexto (mínimo de {MIN_TRANSCRIPT_CHARS} caracteres).</p> : null}

      {draft && <div className='space-y-4'>
        <Tabs defaultValue='minutes'>
          <TabsList>
            <TabsTrigger value='minutes'>Ata estruturada</TabsTrigger>
            <TabsTrigger value='actions'>Ações sugeridas</TabsTrigger>
            <TabsTrigger value='progress'>Evolução por dimensão</TabsTrigger>
            <TabsTrigger value='uncertain'>Itens incertos</TabsTrigger>
          </TabsList>
          <TabsContent value='minutes' className='space-y-2'>
            <Input value={draft.executive_summary} onChange={(e) => setDraft({ ...draft, executive_summary: e.target.value })} placeholder='Resumo executivo' />
            <Textarea value={draft.key_progress} onChange={(e) => setDraft({ ...draft, key_progress: e.target.value })} placeholder='Principais avanços' />
            <Textarea value={draft.key_blockers} onChange={(e) => setDraft({ ...draft, key_blockers: e.target.value })} placeholder='Principais travas' />
            <Textarea value={draft.decisions} onChange={(e) => setDraft({ ...draft, decisions: e.target.value })} placeholder='Decisões tomadas' />
            <Textarea value={draft.recommendations} onChange={(e) => setDraft({ ...draft, recommendations: e.target.value })} placeholder='Recomendações do conselho' />
            <Textarea value={draft.next_agenda} onChange={(e) => setDraft({ ...draft, next_agenda: e.target.value })} placeholder='Próxima pauta' />
          </TabsContent>
          <TabsContent value='actions' className='space-y-3'>
            {draft.suggested_actions.map((action, idx) => <div key={idx} className='executive-card p-3 rounded space-y-2'>
              <div className='flex items-center justify-between'><Badge className='executive-pill'>{confidenceLabel[action.confidence]}</Badge><Button size='icon' variant='ghost' onClick={() => setDraft({ ...draft, suggested_actions: draft.suggested_actions.filter((_, i) => i !== idx) })}><Trash2 className='h-4 w-4' /></Button></div>
              <div className='flex items-center gap-2'><Checkbox checked={action.approved !== false} onCheckedChange={(checked) => setDraft({ ...draft, suggested_actions: draft.suggested_actions.map((row, i) => i === idx ? { ...row, approved: !!checked } : row) })} /><span className='text-xs'>Aplicar ação</span></div>
              <Input value={action.title} onChange={(e) => setDraft({ ...draft, suggested_actions: draft.suggested_actions.map((row, i) => i === idx ? { ...row, title: e.target.value } : row) })} />
              <p className='text-xs text-muted-foreground'>{(!action.owner_name || !action.due_date || !action.expected_evidence) ? 'Precisa revisão' : 'Pronta para aplicar'}</p>
            </div>)}
          </TabsContent>
          <TabsContent value='progress' className='space-y-3'>
            {draft.dimension_progress_suggestions.map((item, idx) => <div key={idx} className='executive-card p-3 rounded space-y-2'>
              <div className='flex items-center justify-between'><Badge className='executive-pill'>{confidenceLabel[item.confidence]}</Badge><Button size='icon' variant='ghost' onClick={() => setDraft({ ...draft, dimension_progress_suggestions: draft.dimension_progress_suggestions.filter((_, i) => i !== idx) })}><Trash2 className='h-4 w-4' /></Button></div>
              <div className='flex items-center gap-2'><Checkbox checked={item.approved !== false} onCheckedChange={(checked) => setDraft({ ...draft, dimension_progress_suggestions: draft.dimension_progress_suggestions.map((row, i) => i === idx ? { ...row, approved: !!checked } : row) })} /><span className='text-xs'>Aplicar evolução</span></div>
              <Input value={item.dimension_label} onChange={(e) => setDraft({ ...draft, dimension_progress_suggestions: draft.dimension_progress_suggestions.map((row, i) => i === idx ? { ...row, dimension_label: e.target.value } : row) })} />
            </div>)}
          </TabsContent>
          <TabsContent value='uncertain' className='space-y-2'>
            {draft.uncertain_items.map((item, idx) => <div key={idx} className='executive-card p-3 rounded'><p className='text-sm font-medium'>{item.type}</p><p className='text-sm'>{item.note}</p></div>)}
          </TabsContent>
        </Tabs>
        <Button onClick={applyDraftToMeeting} disabled={!canApplyDraft}>{applyingDraft ? 'Aplicando...' : 'Aplicar ao encontro'}</Button>
      </div>}
      </div>}
    </CardContent></Card>

    <BackToTopFooter />
  </div>;
}
