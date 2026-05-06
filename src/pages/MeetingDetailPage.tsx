import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  const { id } = useParams();
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

  const [transcriptText, setTranscriptText] = useState('');
  const [draft, setDraft] = useState<CouncilMeetingNotesDraft | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [applyingDraft, setApplyingDraft] = useState(false);


  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: m, error: meetingError } = await supabase.from('council_meetings').select('*').eq('id', id).single();
    if (meetingError) {
      toast({ title: 'Erro ao carregar encontro', description: meetingError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const [{ data: a, error: actionError }, { data: company, error: companyError }, { data: publishedConfig }, { data: progress, error: progressError }, { data: templates, error: templatesError }] = await Promise.all([
      supabase.from('council_actions').select('*').eq('meeting_id', id),
      supabase.from('companies').select('name').eq('id', m.company_id).single(),
      supabase.from('config_versions').select('id').eq('status', 'published').single(),
      supabase.from('council_dimension_progress').select('*').eq('meeting_id', id),
      supabase.from('council_agenda_templates').select('*').eq('is_active', true).order('sort_order'),
    ]);

    if (actionError) toast({ title: 'Erro ao carregar ações', description: actionError.message, variant: 'destructive' });
    if (companyError) toast({ title: 'Erro ao carregar empresa', description: companyError.message, variant: 'destructive' });
    if (progressError) toast({ title: 'Erro ao carregar evolução por dimensão', description: progressError.message, variant: 'destructive' });
    if (templatesError) toast({ title: 'Erro ao carregar templates de pauta', description: templatesError.message, variant: 'destructive' });

    let dimensionData: DimensionOption[] = [];
    if (publishedConfig?.id) {
      const { data: dims, error: dimError } = await supabase.from('dimensions').select('id,label').eq('config_version_id', publishedConfig.id).order('sort_order', { ascending: true });
      if (dimError) toast({ title: 'Erro ao carregar dimensões', description: dimError.message, variant: 'destructive' });
      dimensionData = (dims || []) as DimensionOption[];
    }

    const rows = (progress || []) as CouncilDimensionProgress[];
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
    setActions((a || []) as CouncilAction[]);
    setCompanyName(company?.name || '');
    setDimensions(dimensionData);
    setProgressRows(rows);
    setAgendaTemplates((templates || []) as CouncilAgendaTemplate[]);
    setFormByDimension(formState);
    setLoading(false);
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
    if (!meeting || !transcriptText.trim()) return;
    setGeneratingDraft(true);
    const { data, error } = await supabase.functions.invoke('extract-council-meeting-notes', {
      body: {
        meeting_id: meeting.id,
        company_id: meeting.company_id,
        transcript_text: transcriptText,
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
    setDraft({ ...emptyDraft, ...(data?.draft || {}) });
    toast({ title: 'Pré-ata gerada', description: 'Revise cada item antes de aplicar ao encontro.' });
  };

  const applyDraftToMeeting = async () => {
    if (!meeting || !draft) return;
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
        owner_name: item.owner_name || null,
        due_date: item.due_date || null,
        related_dimension: item.related_dimension || null,
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
  if (!meeting) return <div className='text-sm text-muted-foreground'>Encontro não encontrado.</div>;

  const today = new Date();
  const totalActions = actions.length;
  const completedActions = actions.filter(a => a.status === 'completed').length;
  const openActions = actions.filter(a => ['not_started', 'in_progress', 'blocked'].includes(a.status)).length;
  const overdueActions = actions.filter(a => a.due_date && new Date(a.due_date) < today && !['completed', 'cancelled'].includes(a.status)).length;
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
  const suggestedTemplates = agendaTemplates.filter(t =>
    discussedDimensionIds.has(t.dimension_id) ||
    Array.from(discussedDimensionIds).some(id => id.toLowerCase() === t.dimension_label.toLowerCase())
  );

  return <div className='space-y-4'>
    <div>
      <Button variant='ghost' asChild className='px-0 text-muted-foreground hover:text-foreground'>
        <Link to='/app/agenda'>
          <ArrowLeft className='h-4 w-4' />
          Voltar para Agenda
        </Link>
      </Button>
    </div>
    <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-6'>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{totalActions}</p><p className='text-xs text-muted-foreground'>Ações totais</p></CardContent></Card>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{completedActions}</p><p className='text-xs text-muted-foreground'>Concluídas</p></CardContent></Card>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{openActions}</p><p className='text-xs text-muted-foreground'>Abertas</p></CardContent></Card>
      <Card className='executive-card border-destructive/40'><CardContent className='p-4'><p className='text-2xl font-bold text-destructive'>{overdueActions}</p><p className='text-xs text-muted-foreground'>Atrasadas</p></CardContent></Card>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{progressRows.length}</p><p className='text-xs text-muted-foreground'>Dimensões avaliadas</p></CardContent></Card>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-sm font-semibold'>{meeting.next_agenda ? 'Sim' : 'Não'}</p><p className='text-xs text-muted-foreground'>Próxima pauta definida</p></CardContent></Card>
      <Card className='executive-card'><CardContent className='p-4'><p className='text-sm font-semibold'>{cycleHealth}</p><p className='text-xs text-muted-foreground'>Saúde do ciclo (atrasos, travas, pauta, evolução e conclusão)</p></CardContent></Card>
    </div>
    <Card className='executive-panel'><CardHeader><CardTitle>Ata estruturada</CardTitle></CardHeader><CardContent className='space-y-2 text-sm'>
      <Badge className='executive-pill'>{meeting.meeting_type === 'collective' ? 'Coletivo' : meeting.meeting_type === 'individual' ? 'Individual' : 'Extraordinário'}</Badge>
      <p><strong>Empresa:</strong> {companyName || '—'}</p>
      <p><strong>Resumo:</strong> {meeting.executive_summary || '—'}</p>
      <p><strong>Decisões:</strong> {meeting.decisions || '—'}</p>
      <p><strong>Recomendações:</strong> {meeting.recommendations || '—'}</p>
      <p><strong>Travas:</strong> {meeting.key_blockers || '—'}</p>
      <div><p className='mb-1'><strong>Sugestões de avanços:</strong></p><div className='flex flex-wrap gap-2'>{winsSuggestions.map(item => <button key={item} type='button' className='rounded-full border px-2 py-1 text-xs' onClick={async () => { const v = meeting.recommendations ? `${meeting.recommendations}; ${item}` : item; await supabase.from('council_meetings').update({ recommendations: v }).eq('id', meeting.id); setMeeting({ ...meeting, recommendations: v }); }}>{item}</button>)}</div></div>
      <div><p className='mb-1'><strong>Sugestões de travas:</strong></p><div className='flex flex-wrap gap-2'>{blockerSuggestions.map(item => <button key={item} type='button' className='rounded-full border px-2 py-1 text-xs' onClick={async () => { const v = meeting.key_blockers ? `${meeting.key_blockers}; ${item}` : item; await supabase.from('council_meetings').update({ key_blockers: v }).eq('id', meeting.id); setMeeting({ ...meeting, key_blockers: v }); }}>{item}</button>)}</div></div>
      <p><strong>Próxima pauta:</strong> {meeting.next_agenda || '—'}</p>
      <div className='flex flex-wrap gap-2'>
        {!meeting.next_agenda && <Badge variant='outline'>Sem próxima pauta</Badge>}
        {totalActions === 0 && <Badge variant='outline'>Sem ações</Badge>}
        {overdueActions > 0 && <Badge variant='destructive'>Ações atrasadas</Badge>}
        {progressRows.length === 0 && <Badge variant='outline'>Sem evolução registrada</Badge>}
      </div>
    <div className='pt-1'><Link to='/app/agenda/templates' className='text-sm text-primary underline'>Consultar Templates de Pauta</Link></div></CardContent></Card>


    <Card className='executive-panel'><CardHeader><CardTitle>Pautas sugeridas para este encontro</CardTitle></CardHeader><CardContent className='space-y-3'>
      {suggestedTemplates.length === 0 ? <p className='text-sm text-muted-foreground'>Nenhum template relacionado às dimensões deste encontro. Consulte a biblioteca de templates para qualificar a pauta.</p> :
      suggestedTemplates.map(t => <div key={t.id} className='executive-card rounded-lg p-3 space-y-2'>
        <p className='font-medium flex items-center gap-2'><DimensionBadge code={t.dimension_id} label={t.dimension_label} /><span>{t.title}</span></p>
        <p className='text-sm'><strong>Objetivo:</strong> {t.objective}</p>
        <ul className='list-disc pl-5 text-sm'>{t.key_questions.map((q, idx) => <li key={idx}>{q}</li>)}</ul>
      </div>)}
    </CardContent></Card>

    <Card className='executive-panel'><CardHeader><CardTitle>Evolução por Dimensão</CardTitle></CardHeader><CardContent className='space-y-3'>
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
              <Button size='sm' onClick={() => saveDimensionProgress(d.id)}>{existing ? 'Atualizar dimensão' : 'Salvar dimensão'}</Button>
            </div>
          </div>;
        })}</div>
      </>}
    </CardContent></Card>

    <Card className='executive-panel'><CardHeader><CardTitle>Ações combinadas</CardTitle></CardHeader><CardContent className='space-y-3'>
      <div className='space-y-1'>
        <div className='h-2 rounded bg-muted overflow-hidden'><div className='h-full bg-primary' style={{ width: `${progressPct}%` }} /></div>
        <p className='text-xs text-muted-foreground'>{completedActions} de {totalActions} ações concluídas ({progressPct}%)</p>
      </div>
      <div className='grid md:grid-cols-5 gap-2'>
        <div className='md:col-span-2'><Label>Ação</Label><Input value={newAction.title || ''} onChange={e => setNewAction({ ...newAction, title: e.target.value })} /></div>
        <div><Label>Responsável</Label><Input value={newAction.owner_name || ''} onChange={e => setNewAction({ ...newAction, owner_name: e.target.value })} /></div>
        <div><Label>Prazo</Label><Input type='date' value={newAction.due_date || ''} onChange={e => setNewAction({ ...newAction, due_date: e.target.value })} /></div>
        <div><Label>Status</Label><Select value={newAction.status} onValueChange={v => setNewAction({ ...newAction, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em andamento</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Travada</SelectItem></SelectContent></Select></div>
      </div><Button onClick={addAction}>Adicionar ação de conselho</Button>
      {actions.length === 0 ? <p className='text-sm text-muted-foreground'>Nenhuma ação vinculada. Sem ações fica impossível monitorar execução do encontro. Próximo passo: registre ao menos uma ação com responsável e prazo.</p> :
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-5'>{Object.entries(actionsByStatus).map(([status, rows]) => <div key={status} className='executive-card rounded p-2 space-y-2'>
        <p className='text-sm font-semibold capitalize'>{status.replace('_', ' ')}</p>
        {rows.length === 0 ? <p className='text-xs text-muted-foreground'>Sem itens</p> : rows.map(a => <div key={a.id} className='rounded border border-border/50 p-2 space-y-1'>
          <p className='text-sm font-medium'>{a.title}</p><p className='text-xs text-muted-foreground'>{a.owner_name || 'Sem responsável'} • {a.due_date || 'Sem prazo'}</p>
          {a.impact === 'high' && a.effort === 'low' && ['not_started', 'in_progress', 'blocked'].includes(a.status) && <Badge className='mt-1'>Prioridade imediata</Badge>}
          <Select value={a.status} onValueChange={(v) => updateStatus(a, v)}><SelectTrigger className='w-full h-8'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em andamento</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Travada</SelectItem><SelectItem value='cancelled'>Cancelada</SelectItem></SelectContent></Select>
        </div>)}
      </div>)}</div>}
    </CardContent></Card>

    <Card className='executive-panel'><CardHeader><CardTitle>Matriz impacto x esforço</CardTitle></CardHeader><CardContent>
      <div className='grid md:grid-cols-2 gap-3 text-sm'>
        <div className='executive-card rounded p-3'><p className='font-semibold'>Alto impacto / baixo esforço</p><p>{matrix.high_low.length} ações</p></div>
        <div className='executive-card rounded p-3'><p className='font-semibold'>Alto impacto / alto esforço</p><p>{matrix.high_high.length} ações</p></div>
        <div className='executive-card rounded p-3'><p className='font-semibold'>Baixo impacto / baixo esforço</p><p>{matrix.low_low.length} ações</p></div>
        <div className='executive-card rounded p-3'><p className='font-semibold'>Baixo impacto / alto esforço</p><p>{matrix.low_high.length} ações</p></div>
      </div>
    </CardContent></Card>

    <Card className='executive-panel'><CardHeader><CardTitle>Assistente de Ata do Conselho</CardTitle></CardHeader><CardContent className='space-y-3'>
      <p className='text-xs text-muted-foreground'>A IA gera um rascunho. Revise antes de aplicar ao encontro.</p>
      <Textarea value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} placeholder='Cole a transcrição da reunião aqui...' className='min-h-40' />
      <Button disabled={!transcriptText.trim() || generatingDraft} onClick={generateMeetingDraft}>{generatingDraft ? 'Analisando transcrição...' : 'Gerar pré-ata'}</Button>

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
        <Button onClick={applyDraftToMeeting} disabled={applyingDraft}>{applyingDraft ? 'Aplicando...' : 'Aplicar ao encontro'}</Button>
      </div>}
    </CardContent></Card>

    <BackToTopFooter />
  </div>;
}
