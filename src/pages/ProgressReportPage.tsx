import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DimensionBadge } from '@/components/DimensionBadge';
import { Button } from '@/components/ui/button';
import type { CouncilAction, CouncilDimensionProgress, CouncilMeeting, DimensionTrend } from '@/types/council';

type CompanyLite = { id: string; name: string };
type DimensionOption = { id: string; label: string };

const trendLabel: Record<DimensionTrend, string> = {
  improving: 'Melhorando',
  stable: 'Estável',
  worsening: 'Piorando',
  insufficient_evidence: 'Sem evidência suficiente',
};

const actionStatusLabel: Record<CouncilAction['status'], string> = {
  completed: 'Concluída',
  in_progress: 'Em andamento',
  blocked: 'Travada',
  not_started: 'Não iniciada',
  cancelled: 'Cancelada',
};

const statusOrder: CouncilAction['status'][] = ['completed', 'in_progress', 'blocked', 'not_started'];

export default function ProgressReportPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyLite | null>(null);
  const [meetings, setMeetings] = useState<CouncilMeeting[]>([]);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [progressRows, setProgressRows] = useState<CouncilDimensionProgress[]>([]);
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);

      const [{ data: companyData }, { data: meetingsData }, { data: publishedConfig }] = await Promise.all([
        supabase.from('companies').select('id,name').eq('id', id).single(),
        supabase.from('council_meetings').select('*').eq('company_id', id).order('meeting_date', { ascending: false }),
        supabase.from('config_versions').select('id').eq('status', 'published').single(),
      ]);

      const dimensionsQuery = supabase.from('dimensions').select('id,label').order('sort_order', { ascending: true });
      const { data: dimensionsData } = publishedConfig?.id
        ? await dimensionsQuery.eq('config_version_id', publishedConfig.id)
        : await dimensionsQuery;

      const meetingIds = (meetingsData || []).map(m => m.id);
      const [{ data: actionsData }, { data: progressData }] = await Promise.all([
        meetingIds.length ? supabase.from('council_actions').select('*').in('meeting_id', meetingIds) : Promise.resolve({ data: [] as any[] }),
        meetingIds.length ? supabase.from('council_dimension_progress').select('*').in('meeting_id', meetingIds).order('updated_at', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
      ]);

      setCompany((companyData || null) as CompanyLite | null);
      setMeetings((meetingsData || []) as CouncilMeeting[]);
      setActions((actionsData || []) as CouncilAction[]);
      setProgressRows((progressData || []) as CouncilDimensionProgress[]);
      setDimensions((dimensionsData || []) as DimensionOption[]);
      setLoading(false);
    };

    load();
  }, [id]);

  const actionsByStatus = useMemo(() => {
    const grouped: Record<CouncilAction['status'], CouncilAction[]> = {
      completed: [], in_progress: [], blocked: [], not_started: [], cancelled: [],
    };
    actions.forEach(a => grouped[a.status].push(a));
    return grouped;
  }, [actions]);

  const latestProgressByDimension = useMemo(() => {
    const map = new Map<string, CouncilDimensionProgress>();
    for (const row of progressRows) if (!map.has(row.dimension_id)) map.set(row.dimension_id, row);
    return map;
  }, [progressRows]);

  const dimensionRows = useMemo(() => dimensions
    .map((d) => ({ dim: d, progress: latestProgressByDimension.get(d.id) }))
    .filter((r) => !!r.progress), [dimensions, latestProgressByDimension]);

  const summary = useMemo(() => {
    const positive = dimensionRows.filter(r => r.progress?.trend === 'improving').map(r => r.dim.label);
    const pending = actions.filter(a => a.status === 'blocked' || a.status === 'not_started').slice(0, 4).map(a => a.title);
    const nextFocus = buildNextFocuses(dimensionRows.map(r => r.progress!).filter(Boolean), actions, dimensions);

    return {
      text1: `Desde o início do acompanhamento, a empresa teve ${meetings.length} encontros, ${actionsByStatus.completed.length} ações concluídas e ${dimensionRows.length} dimensões avaliadas.`,
      text2: `As dimensões com tendência positiva são: ${positive.length ? positive.join(', ') : 'nenhuma registrada até o momento'}.`,
      text3: `As principais pendências estão em: ${pending.length ? pending.join('; ') : 'sem pendências críticas registradas'}.`,
      text4: `O próximo foco sugerido é: ${nextFocus[0] || 'registrar evolução por dimensão e atualizar ações abertas'}.`,
      nextFocus,
    };
  }, [meetings.length, actionsByStatus.completed.length, dimensionRows, actions, dimensions]);


  const openActions = useMemo(() => actions.filter(a => a.status === 'not_started' || a.status === 'in_progress' || a.status === 'blocked'), [actions]);

  const latestMeeting = meetings[0];
  const oldestMeeting = meetings[meetings.length - 1];

  if (loading) return <div className='text-sm text-muted-foreground'>Carregando relatório de progresso...</div>;
  if (!company) return <div className='text-sm text-muted-foreground'>Empresa não encontrada.</div>;

  return <div className='space-y-4 print-safe'>
    <div className='executive-surface rounded-xl p-5 print-safe'>
      <p className='executive-header'>Relatório de Progresso</p>
      <div className='flex items-center justify-between gap-3 mt-2'>
        <h1 className='executive-section-title text-2xl font-bold'>{company.name}</h1>
        <Button variant='outline' className='print:hidden' onClick={() => window.print()}>Imprimir / Exportar PDF</Button>
      </div>
      <div className='grid md:grid-cols-3 gap-2 text-sm mt-3'>
        <p><strong>Data do relatório:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
        <p><strong>Período analisado:</strong> {oldestMeeting?.meeting_date ? new Date(oldestMeeting.meeting_date).toLocaleDateString('pt-BR') : '—'} até {latestMeeting?.meeting_date ? new Date(latestMeeting.meeting_date).toLocaleDateString('pt-BR') : '—'}</p>
        <p><strong>Última reunião:</strong> {latestMeeting?.meeting_date ? new Date(latestMeeting.meeting_date).toLocaleDateString('pt-BR') : '—'}</p>
        <p><strong>Encontros registrados:</strong> {meetings.length}</p>
        <p><strong>Ações totais/abertas:</strong> {actions.length} / {openActions.length}</p>
        <p><strong>Ações concluídas/travadas:</strong> {actionsByStatus.completed.length} / {actionsByStatus.blocked.length}</p>
      </div>
    </div>

    {meetings.length === 0 && <Card className='executive-surface print-safe'><CardContent className='py-8 text-sm text-muted-foreground'>
      Nenhum encontro de conselho foi registrado para esta empresa ainda. Registre o primeiro encontro na <Link className='underline text-primary' to='/app/agenda'>Agenda de Evolução</Link>.
    </CardContent></Card>}

    <Card className='executive-surface print-safe'><CardHeader><CardTitle>Resumo executivo</CardTitle></CardHeader><CardContent className='space-y-2 text-sm'>
      <p>{summary.text1}</p><p>{summary.text2}</p><p>{summary.text3}</p><p>{summary.text4}</p>
    </CardContent></Card>

    <Card className='executive-surface print-safe'><CardHeader><CardTitle>Evolução por dimensão</CardTitle></CardHeader><CardContent>
      {dimensionRows.length === 0 ? <p className='text-sm text-muted-foreground'>Sem evolução por dimensão registrada. Abra o detalhe do encontro para registrar evidências e tendência por dimensão.</p> :
      <div className='space-y-3'>{dimensionRows.map(({ dim, progress }) => <div key={dim.id} className='executive-card rounded-lg p-3 text-sm space-y-1'>
        <div className='flex items-center justify-between'><p className='font-medium'>{dim.label}</p><Badge className='executive-pill'>{trendLabel[progress!.trend]}</Badge></div>
        <p><strong>Score inicial:</strong> {progress?.initial_score ?? '—'} | <strong>Score percebido atual:</strong> {progress?.current_perceived_score ?? '—'}</p>
        <p><strong>Evidência:</strong> {progress?.evidence_note || '—'}</p>
        <p><strong>Comentário do conselheiro:</strong> {progress?.counselor_comment || '—'}</p>
        <p className='text-xs text-muted-foreground'>Última atualização: {progress?.updated_at ? new Date(progress.updated_at).toLocaleString('pt-BR') : '—'}</p>
      </div>)}</div>}
    </CardContent></Card>

    <Card className='executive-surface print-safe'><CardHeader><CardTitle>Ações de conselho</CardTitle></CardHeader><CardContent>
      {actions.length === 0 ? <p className='text-sm text-muted-foreground'>Sem ações de conselho registradas. Crie ações na Agenda de Evolução para acompanhar execução entre encontros.</p> :
      <div className='space-y-4'>{statusOrder.map((status) => <div key={status} className='space-y-2'>
        <h3 className='font-semibold text-sm'>{actionStatusLabel[status]} ({actionsByStatus[status].length})</h3>
        {actionsByStatus[status].length === 0 ? <p className='text-xs text-muted-foreground'>Sem ações neste status.</p> : actionsByStatus[status].map(action => <div key={action.id} className='executive-card rounded-lg p-3 text-sm'>
          <p className='font-medium'>{action.title}</p>
          <p className='text-muted-foreground'>{action.related_dimension ? <DimensionBadge code={action.related_dimension} /> : 'Sem dimensão'} • {action.owner_name || 'Sem responsável'} • Prazo: {action.due_date ? new Date(action.due_date).toLocaleDateString('pt-BR') : '—'}</p>
          <p>Prioridade: {action.priority} | Impacto: {action.impact || '—'} | Esforço: {action.effort || '—'} | Status: {actionStatusLabel[action.status]}</p>
          <p><strong>Evidência esperada:</strong> {action.expected_evidence || '—'}</p>
        </div>)}
      </div>)}</div>}
    </CardContent></Card>

    <Card className='executive-surface print-safe'><CardHeader><CardTitle>Decisões e recomendações recentes</CardTitle></CardHeader><CardContent className='space-y-3'>
      {meetings.slice(0, 3).map((meeting) => <div key={meeting.id} className='executive-card rounded-lg p-3 text-sm'>
        <p className='font-medium'>{meeting.title || meeting.main_topic || 'Encontro de conselho'} • {new Date(meeting.meeting_date).toLocaleDateString('pt-BR')}</p>
        <p><strong>Decisões:</strong> {meeting.decisions || '—'}</p>
        <p><strong>Recomendações:</strong> {meeting.recommendations || '—'}</p>
        <p><strong>Principais travas:</strong> {meeting.key_blockers || '—'}</p>
        <p><strong>Próxima pauta:</strong> {meeting.next_agenda || '—'}</p>
      </div>)}
      {meetings.length === 0 && <p className='text-sm text-muted-foreground'>Sem encontros para extrair decisões e recomendações.</p>}
    </CardContent></Card>

    <Card className='executive-surface print-safe'><CardHeader><CardTitle>Próximos focos sugeridos</CardTitle></CardHeader><CardContent>
      {summary.nextFocus.length === 0 ? <p className='text-sm text-muted-foreground'>Sem focos sugeridos no momento.</p> :
      <ol className='list-decimal pl-5 text-sm space-y-1'>{summary.nextFocus.map((item, idx) => <li key={idx}>{item}</li>)}</ol>}
    </CardContent></Card>
  </div>;
}

function buildNextFocuses(progressRows: CouncilDimensionProgress[], actions: CouncilAction[], dimensions: DimensionOption[]) {
  const dimensionName = (id: string) => dimensions.find(d => d.id === id)?.label || id;
  const items: string[] = [];

  progressRows.filter(d => d.trend === 'worsening').forEach(d => items.push(`Reverter tendência de queda em ${dimensionName(d.dimension_id)}.`));
  progressRows.filter(d => d.trend === 'stable' && (d.current_perceived_score ?? 999) <= 2.5).forEach(d => items.push(`Elevar score percebido (estável e baixo) em ${dimensionName(d.dimension_id)}.`));
  actions.filter(a => a.status === 'blocked' && a.priority === 'high').forEach(a => items.push(`Destravar ação crítica: ${a.title}.`));
  actions.filter(a => (a.status === 'not_started' || a.status === 'in_progress' || a.status === 'blocked') && a.impact === 'high' && a.effort === 'low').forEach(a => items.push(`Executar quick win de alto impacto: ${a.title}.`));

  return Array.from(new Set(items)).slice(0, 8);
}
