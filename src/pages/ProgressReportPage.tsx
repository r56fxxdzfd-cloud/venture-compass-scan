import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CouncilAction, CouncilDimensionProgress, CouncilMeeting, DimensionTrend } from '@/types/council';
import { BackToTopFooter } from '@/components/BackToTopFooter';
import { DimensionEvolutionRadar } from '@/components/DimensionEvolutionRadar';
import { formatDateOnlyBR as formatDateOnlyBRHelper, getTodayDateOnly, isDateOnlyBefore } from '@/lib/dateOnly';

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

const statusOrder: CouncilAction['status'][] = ['completed', 'in_progress', 'blocked', 'not_started', 'cancelled'];

const valueLabels = {
  priority: { low: 'Baixa', medium: 'Média', high: 'Alta' },
  impact: { low: 'Baixo', medium: 'Médio', high: 'Alto' },
  effort: { low: 'Baixo', medium: 'Médio', high: 'Alto' },
} as const;

const dimensionCodeToLabel: Record<string, string> = {
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
const dimensionCodeOrder = ['IC', 'PL', 'GR', 'EE', 'PM', 'FS', 'MN', 'GT', 'PT'] as const;

const formatDateOnlyBR = (value?: string | null) => formatDateOnlyBRHelper(value, '—');

export default function ProgressReportPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [company, setCompany] = useState<CompanyLite | null>(null);
  const [meetings, setMeetings] = useState<CouncilMeeting[]>([]);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [progressRows, setProgressRows] = useState<CouncilDimensionProgress[]>([]);
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const { data: companyData, error: companyError } = await supabase.from('companies').select('id,name').eq('id', id).maybeSingle();
        if (companyError) {
          setError('Não foi possível carregar a organização.');
          return;
        }
        if (!companyData) {
          setNotFound(true);
          return;
        }
        setCompany(companyData as CompanyLite);

        const meetingsResult = await supabase.from('council_meetings').select('*').eq('company_id', id).order('meeting_date', { ascending: false });
        if (meetingsResult.error) console.error('Erro ao carregar council_meetings:', meetingsResult.error);
        const meetingsData = (meetingsResult.data || []) as CouncilMeeting[];
        setMeetings(meetingsData);

        const publishedConfigResult = await supabase.from('config_versions').select('id').eq('status', 'published').maybeSingle();
        if (publishedConfigResult.error) console.error('Erro ao carregar config_versions:', publishedConfigResult.error);
        const publishedConfigId = publishedConfigResult.data?.id;

        try {
          const dimensionsQuery = supabase.from('dimensions').select('id,label').order('sort_order', { ascending: true });
          const dimensionsResult = publishedConfigId
            ? await dimensionsQuery.eq('config_version_id', publishedConfigId)
            : await dimensionsQuery;
          if (dimensionsResult.error) throw dimensionsResult.error;
          setDimensions((dimensionsResult.data || []) as DimensionOption[]);
        } catch (dimensionsError) {
          console.error('Erro ao carregar dimensions:', dimensionsError);
          setDimensions([]);
        }

        const meetingIds = meetingsData.map(m => m.id);
        if (meetingIds.length === 0) {
          setActions([]);
          setProgressRows([]);
          return;
        }

        const [actionsResult, progressResult] = await Promise.allSettled([
          supabase.from('council_actions').select('*').in('meeting_id', meetingIds),
          supabase.from('council_dimension_progress').select('*').in('meeting_id', meetingIds).order('updated_at', { ascending: false }),
        ]);

        if (actionsResult.status === 'fulfilled') {
          if (actionsResult.value.error) {
            console.error('Erro ao carregar council_actions:', actionsResult.value.error);
            setActions([]);
          } else {
            setActions((actionsResult.value.data || []) as CouncilAction[]);
          }
        } else {
          console.error('Erro ao carregar council_actions:', actionsResult.reason);
          setActions([]);
        }

        if (progressResult.status === 'fulfilled') {
          if (progressResult.value.error) {
            console.error('Erro ao carregar council_dimension_progress:', progressResult.value.error);
            setProgressRows([]);
          } else {
            setProgressRows((progressResult.value.data || []) as CouncilDimensionProgress[]);
          }
        } else {
          console.error('Erro ao carregar council_dimension_progress:', progressResult.reason);
          setProgressRows([]);
        }
      } catch (loadError) {
        console.error('Erro ao carregar relatório de progresso:', loadError);
        setError('Não foi possível carregar o relatório de progresso.');
      } finally {
        setLoading(false);
      }
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

  const dimensionRows = useMemo(() => dimensions.map((d) => ({ dim: d, progress: latestProgressByDimension.get(d.id) })), [dimensions, latestProgressByDimension]);
  const progressDimensionRows = useMemo(() => dimensionRows.filter((r) => !!r.progress), [dimensionRows]);
  const dimensionsWithoutEvidence = useMemo(() => dimensionRows.filter((r) => !r.progress).map((r) => extractDimensionCode(r.dim.label)), [dimensionRows]);
  const printDimensionRows = useMemo(() => progressDimensionRows
    .map(({ dim, progress }) => {
      const shortCodeRaw = dim.label.match(/\(([^)]+)\)\s*$/)?.[1]?.toUpperCase() || dim.label.split(/[\s&/-]+/).map(w => w[0]?.toUpperCase()).join('').slice(0, 2);
      const safeCode = dimensionCodeOrder.includes(shortCodeRaw as any) ? shortCodeRaw : dim.label;
      const initial = progress?.initial_score ?? null;
      const current = progress?.current_perceived_score ?? null;
      const variation = initial !== null && current !== null ? current - initial : null;
      return { dim, progress, safeCode, initial, current, variation };
    })
    .sort((a, b) => dimensionCodeOrder.indexOf(a.safeCode as typeof dimensionCodeOrder[number]) - dimensionCodeOrder.indexOf(b.safeCode as typeof dimensionCodeOrder[number])), [progressDimensionRows]);

  const todayDateOnly = getTodayDateOnly();
  const openActions = useMemo(() => actions.filter(a => a.status === 'not_started' || a.status === 'in_progress' || a.status === 'blocked'), [actions]);

  const summary = useMemo(() => {
    const positive = progressDimensionRows.filter(r => r.progress?.trend === 'improving').map(r => r.dim.label);
    const attentionDimensions = progressDimensionRows.filter((r) => r.progress?.trend === 'worsening' || r.progress?.trend === 'insufficient_evidence').map((r) => r.dim.label);
    const pending = actions.filter(a => a.status === 'blocked' || a.status === 'not_started').slice(0, 4).map(a => a.title);
    const nextFocus = buildNextFocuses(dimensionRows.map(r => r.progress!).filter(Boolean), actions, dimensions, meetings, todayDateOnly);

    const normalizeSentence = (value: string) => value.replace(/\.{2,}/g, '.').replace(/\s+\./g, '.').trim();

    return {
      text1: normalizeSentence(`Desde o início do acompanhamento, a organização teve ${meetings.length} encontros e ${actionsByStatus.completed.length} ações concluídas.`),
      text15: progressDimensionRows.length === 0
        ? 'Ainda não há evolução por dimensão registrada nos encontros do conselho.'
        : normalizeSentence(`Foram registradas ${progressDimensionRows.length} dimensões com evolução acompanhada.`),
      text2: positive.length ? normalizeSentence(`As dimensões com tendência positiva são: ${positive.join(', ')}.`) : '',
      text25: attentionDimensions.length ? normalizeSentence(`As dimensões em atenção são: ${attentionDimensions.join(', ')}.`) : '',
      text3: normalizeSentence(`As principais pendências estão em: ${pending.length ? pending.join('; ') : 'sem pendências críticas registradas'}.`),
      text4: normalizeSentence(`O próximo foco sugerido é: ${nextFocus[0] || 'registrar evolução por dimensão e atualizar ações abertas'}.`),
      nextFocus,
    };
  }, [meetings, actionsByStatus.completed.length, progressDimensionRows, actions, dimensions, todayDateOnly]);

  const overdueActions = useMemo(() => actions.filter((a) => a.due_date && isDateOnlyBefore(a.due_date, todayDateOnly) && !['completed', 'cancelled'].includes(a.status)), [actions, todayDateOnly]);
  const improvingCount = progressDimensionRows.filter((r) => r.progress?.trend === 'improving').length;
  const worseningCount = progressDimensionRows.filter((r) => r.progress?.trend === 'worsening').length;
  const attentionCount = progressDimensionRows.filter((r) => r.progress?.trend === 'worsening' || r.progress?.trend === 'insufficient_evidence').length;

  const topMetrics = [
    { label: 'Encontros registrados', value: meetings.length },
    { label: 'Ações concluídas', value: actionsByStatus.completed.length },
    { label: 'Ações abertas', value: openActions.length },
    { label: 'Ações críticas', value: actionsByStatus.blocked.length + overdueActions.length },
    { label: 'Dimensões melhorando', value: improvingCount },
    { label: 'Dimensões em atenção', value: attentionCount },
  ];


  const latestMeeting = meetings[0];
  const oldestMeeting = meetings[meetings.length - 1];

  if (loading) return <div className='text-sm text-muted-foreground'>Carregando relatório de progresso...</div>;
  if (error) return <div className='space-y-3 text-sm text-muted-foreground'>
    <p>{error}</p>
    <Button asChild variant='outline'><Link to='/app/startups'>Voltar para Organizações</Link></Button>
  </div>;
  if (notFound) return <div className='space-y-3 text-sm text-muted-foreground'>
    <p>Organização não encontrada ou sem permissão de acesso.</p>
    <Button asChild variant='outline'><Link to='/app/startups'>Voltar para Organizações</Link></Button>
  </div>;
  if (!company) return <div className='text-sm text-muted-foreground'>Organização não encontrada ou sem permissão de acesso.</div>;

  return <div className='space-y-4 print-safe'>
    <div className='executive-surface rounded-xl p-5 print-safe'>
      <p className='executive-header'>Relatório de Progresso</p>
      <p className='text-sm text-muted-foreground mt-1'>Evolução da organização ao longo dos encontros do conselho.</p>
      <div className='flex items-center justify-between gap-3 mt-2'>
        <h1 className='executive-section-title text-2xl font-bold'>{company.name}</h1>
        <div className='flex items-center gap-2 print:hidden'>
          <Button asChild variant='outline'><Link to={`/app/startups/${company.id}`}>Voltar para organização</Link></Button>
          <Button asChild variant='outline'><Link to='/app/agenda'>Abrir Agenda</Link></Button>
          <Button asChild variant='outline'><Link to={`/app/startups/${company.id}/counselor`}>Abrir Central do Conselheiro</Link></Button>
          <Button variant='outline' onClick={() => window.print()}>Imprimir / Exportar PDF</Button>
        </div>
      </div>
      <div className='grid md:grid-cols-3 gap-2 text-sm mt-3'>
        <p><strong>Data do relatório:</strong> {formatDateOnlyBR(todayDateOnly)}</p>
        <p><strong>Período analisado:</strong> {formatDateOnlyBR(oldestMeeting?.meeting_date)} até {formatDateOnlyBR(latestMeeting?.meeting_date)}</p>
        <p><strong>Última reunião:</strong> {formatDateOnlyBR(latestMeeting?.meeting_date)}</p>
        <p><strong>Encontros registrados:</strong> {meetings.length}</p>
        <p><strong>Ações totais/abertas:</strong> {actions.length} / {openActions.length}</p>
        <p><strong>Ações concluídas/travadas:</strong> {actionsByStatus.completed.length} / {actionsByStatus.blocked.length}</p>
      </div>
    </div>

    {meetings.length === 0 && <Card className='executive-surface print-safe'><CardContent className='py-8 text-sm text-muted-foreground'>
      Nenhum encontro de conselho foi registrado para esta empresa ainda. Registre o primeiro encontro na <Link className='underline text-primary' to='/app/agenda'>Agenda de Evolução</Link>.
    </CardContent></Card>}

    <Card className='executive-surface print-safe'><CardHeader><CardTitle>Resumo executivo</CardTitle></CardHeader><CardContent className='space-y-2 text-sm'>
      <p>{summary.text1}</p>
      <p>{summary.text15}</p>
      {summary.text2 ? <p>{summary.text2}</p> : null}
      {summary.text25 ? <p>{summary.text25}</p> : null}
      <p>{summary.text3}</p>
      <p>{summary.text4}</p>
    </CardContent></Card>

    <Card className='executive-surface print-safe'>
      <CardHeader className='pb-2'><CardTitle>Indicadores do acompanhamento</CardTitle></CardHeader>
      <CardContent className='pt-2'>
        <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
      {topMetrics.map((metric) => <Card key={metric.label} className='executive-surface print-safe'><CardContent className='py-4'>
        <p className='text-xs text-muted-foreground'>{metric.label}</p>
        <p className='text-2xl font-bold'>{metric.value}</p>
      </CardContent></Card>)}
        </div>
      </CardContent>
    </Card>


    <Card className='executive-surface print-safe print:hidden'><CardContent className='pt-6'>
      <DimensionEvolutionRadar
        dimensions={dimensions}
        progressRecords={progressRows}
        title='Radar de Evolução por Dimensão'
        subtitle='Comparação entre o baseline inicial e a última leitura registrada pelo conselho.'
      />
    </CardContent></Card>

    <Card className='executive-surface print-safe hidden print:block'><CardHeader className='pb-2'><CardTitle>Evolução por dimensão — visão executiva</CardTitle></CardHeader><CardContent className='pt-0'>
      {printDimensionRows.length === 0 ? <div className='text-sm text-muted-foreground space-y-1'><p>Nenhuma evolução por dimensão registrada até o momento.</p>{dimensionsWithoutEvidence.length > 0 ? <p>Dimensões sem evidência registrada: {dimensionsWithoutEvidence.join(', ')}.</p> : null}</div> :
      <div className='print-dimension-grid'>{printDimensionRows.map(({ dim, progress, safeCode, initial, current, variation }) => {
        const baselinePct = initial === null ? 0 : Math.min(100, Math.max(0, (initial / 5) * 100));
        const currentPct = current === null ? 0 : Math.min(100, Math.max(0, (current / 5) * 100));
        return <div key={dim.id} className='print-dimension-card'>
          <div className='flex items-center justify-between gap-2'>
            <p className='font-semibold text-[11px]'>{dim.label} ({safeCode})</p>
            <Badge className='executive-pill h-5 text-[10px]'>{progress ? trendLabel[progress.trend] : 'Sem evidência'}</Badge>
          </div>
          <p className='text-[11px] mt-1'><strong>Baseline:</strong> {initial ?? '—'} • <strong>Última leitura:</strong> {current ?? '—'} • <strong>Variação:</strong> {variation === null ? '—' : `${variation > 0 ? '+' : ''}${variation.toFixed(1)}`}</p>
          <div className='print-mini-bar'>
            <div className='print-mini-baseline' style={{ width: `${baselinePct}%` }} />
            <div className='print-mini-current' style={{ width: `${currentPct}%` }} />
          </div>
        </div>;
      })}</div>}
    </CardContent></Card>

    <Card className='executive-surface print-safe'><CardHeader className='pb-2'><CardTitle>Evolução por dimensão</CardTitle></CardHeader><CardContent className='pt-2'>
      {progressDimensionRows.length === 0 ? <div className='text-sm text-muted-foreground space-y-1'><p>Nenhuma evolução por dimensão registrada até o momento.</p>{dimensionsWithoutEvidence.length > 0 ? <p>Dimensões sem evidência registrada: {dimensionsWithoutEvidence.join(', ')}.</p> : null}</div> :
      <div className='space-y-2'>{progressDimensionRows.map(({ dim, progress }) => <div key={dim.id} className='executive-card rounded-lg p-2.5 text-sm space-y-1'>
        <div className='flex items-center justify-between'><p className='font-medium'>{dim.label}</p>{progress ? <Badge className='executive-pill'>{trendLabel[progress.trend]}</Badge> : <Badge variant='outline'>Sem evidência</Badge>}</div>
        <p><strong>Baseline:</strong> {progress?.initial_score ?? 'sem evidência'} | <strong>Última leitura:</strong> {progress?.current_perceived_score ?? 'sem evidência'}</p>
        <p><strong>Variação:</strong> {(progress?.initial_score !== null && progress?.initial_score !== undefined && progress?.current_perceived_score !== null && progress?.current_perceived_score !== undefined) ? `${(progress.current_perceived_score - progress.initial_score) > 0 ? '+' : ''}${(progress.current_perceived_score - progress.initial_score).toFixed(1)}` : 'não disponível'}</p>
        <p><strong>Evidência:</strong> {progress?.evidence_note || 'sem evidência registrada'}</p>
        <p><strong>Comentário do conselheiro:</strong> {progress?.counselor_comment || 'sem evidência registrada'}</p>
        <p className='text-xs text-muted-foreground'>Última atualização: {progress?.updated_at ? new Date(progress.updated_at).toLocaleString('pt-BR') : '—'}</p>
      </div>)}</div>}
    </CardContent></Card>

    <Card className='executive-surface print-safe'><CardHeader className='pb-2'><CardTitle>Leitura executiva da evolução</CardTitle></CardHeader><CardContent className='pt-2 text-sm'>
      <p>{`${improvingCount} dimens${improvingCount === 1 ? 'ão' : 'ões'} melhorando; ${worseningCount === 0 ? 'nenhuma dimensão piorando' : `${worseningCount} em piora`}.`}</p>
    </CardContent></Card>

    <Card className='executive-surface print-safe'><CardHeader className='pb-2'><CardTitle>Ações do conselho</CardTitle></CardHeader><CardContent className='pt-2'>
      {actions.length === 0 ? <p className='text-sm text-muted-foreground'>Sem ações de conselho registradas. Crie ações na Agenda de Evolução para acompanhar execução entre encontros.</p> :
      <div className='space-y-3'>{statusOrder.map((status) => <div key={status} className='space-y-1.5'>
        <h3 className='font-semibold text-sm'>{actionStatusLabel[status]} ({actionsByStatus[status].length})</h3>
        {actionsByStatus[status].length === 0 ? <p className='text-xs text-muted-foreground'>Sem ações neste status.</p> : actionsByStatus[status].map(action => <div key={action.id} className='executive-card rounded-lg p-2.5 text-sm print:break-inside-avoid'>
          <p className='font-medium'>{action.title}</p>
          <p className='text-muted-foreground'>{formatDimensionLabel(action.related_dimension)} • {action.owner_name || 'Sem responsável'} • Prazo: {formatDateOnlyBR(action.due_date)}</p>
          <p>Prioridade: {valueLabels.priority[action.priority as keyof typeof valueLabels.priority] || action.priority} | Impacto: {action.impact ? (valueLabels.impact[action.impact as keyof typeof valueLabels.impact] || action.impact) : '—'} | Esforço: {action.effort ? (valueLabels.effort[action.effort as keyof typeof valueLabels.effort] || action.effort) : '—'} | Status: {actionStatusLabel[action.status]}</p>
          <p><strong>Evidência esperada/registrada:</strong> {action.expected_evidence || 'sem evidência registrada'}</p>
        </div>)}
      </div>)}</div>}
    </CardContent></Card>

    <Card className='executive-surface print-safe'><CardHeader className='pb-2'><CardTitle>Decisões e recomendações recentes</CardTitle></CardHeader><CardContent className='pt-2 space-y-2'>
      {(() => {
        const recent = meetings.slice(0, 6);
        const withContent = recent.filter((meeting) => !!(meeting.decisions || meeting.recommendations || meeting.key_blockers || meeting.next_agenda));
        const withoutContentCount = recent.length - withContent.length;
        if (recent.length === 0) return <p className='text-sm text-muted-foreground'>Sem encontros para extrair decisões e recomendações.</p>;
        if (withContent.length === 0) return <div className='text-sm text-muted-foreground space-y-1'><p>Nenhuma ata estruturada registrada nos encontros analisados.</p><p>Use o Assistente de Ata para gerar pré-atas revisáveis a partir das transcrições.</p></div>;
        return <>
          {withContent.slice(0, 3).map((meeting) => <div key={meeting.id} className='executive-card rounded-lg p-2.5 text-sm'>
            <p className='font-medium'>{meeting.title || meeting.main_topic || 'Encontro de conselho'} • {formatDateOnlyBR(meeting.meeting_date)}</p>
            <p><strong>Decisões:</strong> {meeting.decisions || 'sem evidência registrada'}</p>
            <p><strong>Recomendações:</strong> {meeting.recommendations || 'sem evidência registrada'}</p>
            <p><strong>Principais travas:</strong> {meeting.key_blockers || 'sem evidência registrada'}</p>
            <p><strong>Próxima pauta:</strong> {meeting.next_agenda || 'sem evidência registrada'}</p>
          </div>)}
          {withoutContentCount > 0 ? <p className='text-xs text-muted-foreground'>{withoutContentCount} encontro(s) recente(s) sem ata estruturada detalhada.</p> : null}
        </>;
      })()}
    </CardContent></Card>

    <Card className='executive-surface print-safe'><CardHeader className='pb-2'><CardTitle>Próximos focos sugeridos</CardTitle></CardHeader><CardContent className='pt-2'>
      {summary.nextFocus.length === 0 ? <p className='text-sm text-muted-foreground'>Sem focos sugeridos no momento.</p> :
      <ol className='list-decimal pl-5 text-sm space-y-1'>{summary.nextFocus.map((item, idx) => <li key={idx}>{item}</li>)}</ol>}
    </CardContent></Card>
    <BackToTopFooter />
    <div className='hidden print:block print-report-footer'>Relatório gerado pelo Darwin Conselho OS — uso executivo.</div>
  </div>;
}

function buildNextFocuses(progressRows: CouncilDimensionProgress[], actions: CouncilAction[], dimensions: DimensionOption[], meetings: CouncilMeeting[], todayDateOnly: string) {
  const dimensionName = (id: string) => dimensions.find((d) => d.id === id)?.label || id;
  const rankByAction = new Map<string, { priority: number; text: string }>();
  const generalItems: Array<{ priority: number; text: string }> = [];

  actions.forEach((action) => {
    const blocked = action.status === 'blocked';
    const overdue = !!(action.due_date && isDateOnlyBefore(action.due_date, todayDateOnly) && !['completed', 'cancelled'].includes(action.status));
    if (!blocked && !overdue) return;
    const priority = blocked ? 1 : 2;
    const text = blocked ? `Destravar ação: ${action.title}.` : `Tratar atraso da ação ${action.title} e redefinir plano de execução.`;
    const current = rankByAction.get(action.title);
    if (!current || priority < current.priority) rankByAction.set(action.title, { priority, text });
  });

  progressRows.filter((d) => d.trend === 'worsening').forEach((d) => generalItems.push({ priority: 3, text: `Reverter tendência de queda em ${dimensionName(d.dimension_id)}.` }));
  progressRows.filter((d) => d.trend === 'stable' && (d.current_perceived_score ?? 99) <= 2.5).forEach((d) => generalItems.push({ priority: 4, text: `Acelerar evolução em ${dimensionName(d.dimension_id)} para sair de estabilidade baixa.` }));
  if (!meetings.some((m) => !!m.next_agenda?.trim())) generalItems.push({ priority: 5, text: 'Definir próxima pauta do conselho.' });
  progressRows.filter((d) => !d.evidence_note).forEach((d) => generalItems.push({ priority: 6, text: `Consolidar evidências de evolução em ${dimensionName(d.dimension_id)}.` }));

  const prioritized = [
    ...Array.from(rankByAction.values()),
    ...generalItems,
  ].sort((a, b) => a.priority - b.priority);

  return Array.from(new Set(prioritized.map((item) => item.text))).slice(0, 5);
}

function extractDimensionCode(label: string) {
  const codeFromSuffix = label.match(/\(([^)]+)\)\s*$/)?.[1]?.toUpperCase();
  if (codeFromSuffix && dimensionCodeOrder.includes(codeFromSuffix as typeof dimensionCodeOrder[number])) return codeFromSuffix;
  const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const aliasMap: Record<string, string> = {
    identidade: 'IC', cultura: 'IC', pessoas: 'PL', lideranca: 'PL', governanca: 'GR', riscos: 'GR',
    estrategia: 'EE', execucao: 'EE', processos: 'PM', metricas: 'PM', financas: 'FS', sustentabilidade: 'FS',
    modelo: 'MN', negocio: 'MN', tracao: 'GT', produto: 'PT', tecnologia: 'PT',
  };
  const found = Object.entries(aliasMap).find(([key]) => normalized.includes(key))?.[1];
  return found || label;
}

function formatDimensionLabel(value?: string | null) {
  if (!value) return 'Sem dimensão';
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_\s]+/g, '_');
  const aliasMap: Record<string, string> = {
    ic: 'IC', identidade: 'IC', identidade_cultura: 'IC',
    pl: 'PL', pessoas: 'PL', lideranca: 'PL', liderança: 'PL',
    gr: 'GR', governanca: 'GR', governança: 'GR', riscos: 'GR',
    ee: 'EE', estrategia: 'EE', estratégia: 'EE', execucao: 'EE', execução: 'EE', execution: 'EE',
    pm: 'PM', processos: 'PM', metricas: 'PM', métricas: 'PM',
    fs: 'FS', financas: 'FS', finanças: 'FS', sustentabilidade: 'FS',
    mn: 'MN', modelo: 'MN', negocio: 'MN', negócio: 'MN',
    gt: 'GT', 'go-to-market': 'GT', tracao: 'GT', tração: 'GT',
    pt: 'PT', produto: 'PT', tecnologia: 'PT',
  };
  const code = aliasMap[normalized] || aliasMap[normalized.replace(/_/g, '-')] || value.toUpperCase();
  const label = dimensionCodeToLabel[code];
  if (!label) return value;
  return `${label} (${code})`;
}
