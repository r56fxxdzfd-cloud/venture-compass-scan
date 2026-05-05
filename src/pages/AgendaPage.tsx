import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DimensionBadge, getDimensionFullLabel } from '@/components/DimensionBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { CouncilAction, CouncilDimensionProgress, CouncilMeeting, DimensionTrend, MeetingType } from '@/types/council';
import { BackToTopFooter } from '@/components/BackToTopFooter';

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

export default function AgendaPage() {
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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ meeting_type: 'collective', related_dimensions: [] as string[], main_topic: '' });
  const [loading, setLoading] = useState(true);

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

  const filtered = useMemo(() => meetings.filter(m => {
    if (companyId !== 'all' && m.company_id !== companyId) return false;
    if (typeFilter !== 'all' && m.meeting_type !== typeFilter) return false;
    if (actionStatus !== 'all') {
      const meetingActions = actions.filter(a => a.meeting_id === m.id);
      if (!meetingActions.some(a => a.status === actionStatus)) return false;
    }
    return true;
  }), [meetings, companyId, typeFilter, actionStatus, actions]);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const actionsForFilteredMeetings = useMemo(() => {
    const ids = new Set(filtered.map(m => m.id));
    return actions.filter(a => ids.has(a.meeting_id));
  }, [filtered, actions]);

  const executiveKpis = useMemo(() => {
    const totalMeetings = filtered.length;
    const meetingsThisMonth = filtered.filter(m => {
      const d = new Date(m.meeting_date);
      return d >= monthStart && d <= monthEnd;
    }).length;
    const openActions = actionsForFilteredMeetings.filter(a => ['not_started', 'in_progress', 'blocked'].includes(a.status)).length;
    const lateActions = actionsForFilteredMeetings.filter(a => a.due_date && new Date(a.due_date) < today && !['completed', 'cancelled'].includes(a.status)).length;
    const blockedActions = actionsForFilteredMeetings.filter(a => a.status === 'blocked').length;
    const nonCancelledActions = actionsForFilteredMeetings.filter(a => a.status !== 'cancelled');
    const completed = nonCancelledActions.filter(a => a.status === 'completed').length;
    const completionRate = nonCancelledActions.length ? Math.round((completed / nonCancelledActions.length) * 100) : 0;
    return { totalMeetings, meetingsThisMonth, openActions, lateActions, blockedActions, completed, nonCancelledTotal: nonCancelledActions.length, completionRate };
  }, [filtered, actionsForFilteredMeetings]);

  const dimensionsInFocus = useMemo(() => {
    const dimensionSortMap = new Map(dimensionCatalog.map((dim, idx) => [dim.id, dim.sort_order ?? idx + 1]));
    const map: Record<string, { count: number; trends: Record<string, number>; trendCount: number; label?: string }> = {};
    for (const m of filtered) {
      for (const dim of m.related_dimensions || []) {
        if (!map[dim]) map[dim] = { count: 0, trends: {}, trendCount: 0 };
        map[dim].count += 1;
      }
    }
    const filteredMeetingIds = new Set(filtered.map((m) => m.id));
    for (const row of dimensionProgressRows) {
      if (!filteredMeetingIds.has(row.meeting_id)) continue;
      const dim = row.dimension_id;
      if (!map[dim]) map[dim] = { count: 0, trends: {}, trendCount: 0, label: row.dimension_label };
      map[dim].trends[row.trend] = (map[dim].trends[row.trend] || 0) + 1;
      map[dim].trendCount += 1;
      map[dim].label = map[dim].label || row.dimension_label;
    }
    const resolveLabel = (dimension: string, progressLabel?: string) => {
      const catalogLabel = dimensionCatalog.find((d) => d.id === dimension)?.label;
      return catalogLabel || getDimensionFullLabel(dimension, progressLabel);
    };
    return Object.entries(map)
      .map(([dimension, info]) => {
        const dominantTrend = (Object.entries(info.trends).sort((a, b) => b[1] - a[1])[0]?.[0] || 'sem_trend') as DimensionTrend | 'sem_trend';
        return {
          dimension,
          label: resolveLabel(dimension, info.label),
          count: info.count,
          trend: dominantTrend,
          trendLabel: trendLabels[dominantTrend],
          trendCount: info.trendCount,
          sortOrder: dimensionSortMap.get(dimension) ?? 999,
        };
      })
      .sort((a, b) => b.count - a.count || a.sortOrder - b.sortOrder)
      .slice(0, 12);
  }, [filtered, dimensionCatalog, dimensionProgressRows]);
  const focusSummary = useMemo(() => {
    const mostRecurring = dimensionsInFocus[0];
    const positive = dimensionsInFocus.filter((d) => d.trend === 'improving').length;
    const negative = dimensionsInFocus.filter((d) => d.trend === 'worsening').length;
    const noEvidence = dimensionsInFocus.filter((d) => d.trend === 'insufficient_evidence' || d.trend === 'sem_trend').length;
    return { total: dimensionsInFocus.length, mostRecurring, positive, negative, noEvidence };
  }, [dimensionsInFocus]);
  const focusAnalytics = useMemo(() => {
    const maxCount = dimensionsInFocus[0]?.count || 1;
    const focusByDimension = new Map(dimensionsInFocus.map((item) => [item.dimension, item]));
    const actionBuckets = actionsForFilteredMeetings.reduce((acc, action) => {
      if (!action.related_dimension) return acc;
      if (!acc[action.related_dimension]) acc[action.related_dimension] = { open: 0, blocked: 0, completed: 0 };
      if (action.status === 'blocked') acc[action.related_dimension].blocked += 1;
      else if (action.status === 'completed') acc[action.related_dimension].completed += 1;
      else if (['not_started', 'in_progress'].includes(action.status)) acc[action.related_dimension].open += 1;
      return acc;
    }, {} as Record<string, { open: number; blocked: number; completed: number }>);
    const hasActionDimensionData = Object.keys(actionBuckets).length > 0;
    const trendDistribution = dimensionsInFocus.reduce((acc, item) => {
      const key = item.trend === 'sem_trend' ? 'insufficient_evidence' : item.trend;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const heatmap = officialDimensionOrder.map((code) => {
      const item = focusByDimension.get(code);
      const count = item?.count || 0;
      const intensity = count === 0 ? 0 : Math.max(18, Math.round((count / maxCount) * 100));
      return {
        code,
        label: getDimensionFullLabel(code),
        count,
        trend: item?.trend || 'sem_trend',
        trendLabel: item?.trendLabel || trendLabels.sem_trend,
        intensity,
      };
    });
    return { maxCount, actionBuckets, hasActionDimensionData, trendDistribution, heatmap };
  }, [dimensionsInFocus, actionsForFilteredMeetings]);

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

  return <div className='space-y-6'>
    <div className='executive-header flex flex-wrap items-center justify-between gap-3'><div><h1 className='executive-section-title text-2xl font-bold'>Agenda de Evolução</h1><p className='text-sm text-muted-foreground'>Organize encontros, decisões e execução contínua do conselho.</p><Link className='text-sm text-primary underline print:hidden' to='/app/agenda/templates'>Consultar Templates de Pauta</Link></div><Button className='print:hidden' onClick={() => setOpen(true)}>Registrar novo encontro</Button></div>
    <Card className='executive-panel'><CardContent className='pt-6 grid md:grid-cols-3 gap-3'>
      <Select value={companyId} onValueChange={setCompanyId}><SelectTrigger><SelectValue placeholder='Empresa/OS' /></SelectTrigger><SelectContent><SelectItem value='all'>Todas</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todos os tipos</SelectItem><SelectItem value='collective'>Coletivo</SelectItem><SelectItem value='individual'>Individual</SelectItem><SelectItem value='extraordinary'>Extraordinário</SelectItem></SelectContent></Select>
      <Select value={actionStatus} onValueChange={setActionStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todos status de ação</SelectItem><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em andamento</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Travada</SelectItem></SelectContent></Select>
    </CardContent></Card>
    {loading ? <Card className='executive-panel'><CardContent className='py-10 text-center'>Carregando agenda...</CardContent></Card> : filtered.length === 0 ? <Card className='executive-panel'><CardContent className='py-10 text-center'>Nenhum encontro registrado ainda. Sem encontros, não há histórico de decisões, evolução e ações acompanháveis.<div className='mt-2 text-sm text-muted-foreground'>Próximo passo: registre o primeiro encontro para iniciar acompanhamento de pautas e execução.</div><div className='mt-3'><Button onClick={() => setOpen(true)}>Registrar novo encontro</Button></div></CardContent></Card> :
      <>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-6'>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{executiveKpis.totalMeetings}</p><p className='text-xs text-muted-foreground'>Total de encontros</p></CardContent></Card>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{executiveKpis.meetingsThisMonth}</p><p className='text-xs text-muted-foreground'>Encontros no mês</p></CardContent></Card>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{executiveKpis.openActions}</p><p className='text-xs text-muted-foreground'>Ações abertas</p></CardContent></Card>
        <Card className='executive-card border-destructive/40'><CardContent className='p-4'><p className='text-2xl font-bold text-destructive'>{executiveKpis.lateActions}</p><p className='text-xs text-muted-foreground'>Ações atrasadas</p></CardContent></Card>
        <Card className='executive-card border-amber-500/40'><CardContent className='p-4'><p className='text-2xl font-bold text-amber-400'>{executiveKpis.blockedActions}</p><p className='text-xs text-muted-foreground'>Ações travadas</p></CardContent></Card>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-2xl font-bold'>{executiveKpis.completionRate}%</p><p className='text-xs text-muted-foreground'>Taxa de conclusão</p></CardContent></Card>
      </div>
      <div className='grid gap-3'>{filtered.map(m => {
        const comp = companies.find(c => c.id === m.company_id)?.name || '—'; const am = actions.filter(a => a.meeting_id === m.id);
        const overdue = am.filter(a => a.due_date && new Date(a.due_date) < today && !['completed', 'cancelled'].includes(a.status)).length;
        const openCount = am.filter(a => ['not_started', 'in_progress', 'blocked'].includes(a.status)).length;
        const completedCount = am.filter(a => a.status === 'completed').length;
        const completionPct = am.length ? Math.round((completedCount / am.length) * 100) : 0;
        return <Card key={m.id} className='executive-panel border-l-2 border-l-primary/50'><CardHeader><CardTitle className='flex flex-wrap justify-between gap-2'><span>{m.title || m.main_topic || 'Encontro de conselho'}</span><Badge className='executive-pill'>{mt[m.meeting_type as MeetingType]}</Badge></CardTitle></CardHeader><CardContent className='text-sm space-y-2'>
          <div className='flex flex-wrap gap-2'><Badge variant='outline' className='executive-pill'>{new Date(m.meeting_date).toLocaleDateString('pt-BR')}</Badge><Badge variant='secondary' className='executive-pill'>{comp}</Badge>{(m.related_dimensions || []).map(d => <DimensionBadge key={d} code={d} size='sm' />)}</div>
          <p><strong>Tema:</strong> {m.main_topic || '—'}</p><p><strong>Ações:</strong> {completedCount}/{am.length} concluídas</p>
          <div className='h-2 rounded bg-muted overflow-hidden'><div className='h-full bg-primary' style={{ width: `${completionPct}%` }} /></div>
          <p className='text-xs text-muted-foreground'>{completedCount} de {am.length} ações concluídas</p>
          <p><strong>Próxima pauta:</strong> {m.next_agenda || '—'}</p>
          <p><strong>Dimensões avaliadas:</strong> {progressCountByMeeting[m.id] || 0}</p>
          <div className='flex flex-wrap gap-2'>
            {am.length === 0 && <Badge variant='outline'>Sem ações</Badge>}
            {!m.next_agenda && <Badge variant='outline'>Sem próxima pauta</Badge>}
            {overdue > 0 && <Badge variant='destructive'>Ações atrasadas</Badge>}
            {am.some(a => a.status === 'blocked') && <Badge variant='outline'>Ações travadas</Badge>}
            {(progressCountByMeeting[m.id] || 0) === 0 && <Badge variant='outline'>Sem evolução registrada</Badge>}
          </div>
          <Link className='text-primary underline' to={`/app/agenda/${m.id}`}>Abrir detalhe do encontro</Link>
        </CardContent></Card>;
      })}</div>
      <Card className='executive-panel'><CardHeader><CardTitle>Mapa de Foco do Conselho</CardTitle><p className='text-sm text-muted-foreground'>Veja quais dimensões dominaram os encontros recentes, onde há evolução percebida e onde o conselho precisa manter atenção.</p></CardHeader><CardContent className='space-y-4'>
        {dimensionsInFocus.length === 0 ? <div className='space-y-2 text-sm'><p className='text-muted-foreground'>Nenhuma dimensão em foco ainda.</p><p className='text-muted-foreground'>As dimensões aparecerão aqui quando os encontros tiverem dimensões relacionadas ou evolução registrada.</p><Link className='text-primary underline' to='/app/agenda'>Registrar evolução em um encontro</Link></div> :
          <>
            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-5'>
              <div className='executive-card rounded p-3'><p className='text-xs text-muted-foreground'>Tema dominante</p><p className='text-sm font-semibold leading-tight'>{focusSummary.mostRecurring?.label || '—'}</p><p className='text-xs text-muted-foreground mt-1'>{focusSummary.mostRecurring?.count || 0} aparições no ciclo filtrado.</p></div>
              <div className='executive-card rounded p-3'><p className='text-xs text-muted-foreground'>Dimensões monitoradas</p><p className='text-xl font-semibold'>{focusSummary.total}</p><p className='text-xs text-muted-foreground mt-1'>Total com sinal em encontros ou evolução.</p></div>
              <div className='executive-card rounded p-3'><p className='text-xs text-muted-foreground'>Evolução positiva</p><p className='text-xl font-semibold text-emerald-500'>{focusSummary.positive}</p><p className='text-xs text-muted-foreground mt-1'>Dimensões com tendência improving.</p></div>
              <div className='executive-card rounded p-3'><p className='text-xs text-muted-foreground'>Atenção crítica</p><p className='text-xl font-semibold text-rose-500'>{focusSummary.negative}</p><p className='text-xs text-muted-foreground mt-1'>Dimensões com tendência worsening.</p></div>
              <div className='executive-card rounded p-3'><p className='text-xs text-muted-foreground'>Sem evidência</p><p className='text-xl font-semibold'>{focusSummary.noEvidence}</p><p className='text-xs text-muted-foreground mt-1'>Sem leitura robusta de tendência.</p></div>
            </div>
            <div className='executive-card rounded p-3 space-y-3'>
              <div className='flex items-center justify-between gap-2'><p className='text-sm font-semibold'>Concentração por dimensão</p><p className='text-xs text-muted-foreground'>Heatmap das 9 dimensões oficiais</p></div>
              <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2'>
                {focusAnalytics.heatmap.map((cell) => <div key={cell.code} className='rounded border p-2 min-h-[84px] flex flex-col justify-between' style={{ background: `color-mix(in oklab, hsl(var(--primary)) ${cell.intensity}%, hsl(var(--card)))` }} aria-label={`${cell.code} ${cell.label}. ${cell.count} aparições. ${cell.count === 0 ? 'Sem sinal no ciclo' : `Tendência ${cell.trendLabel}`}`}>
                    <div className='flex justify-between items-center gap-1'><DimensionBadge code={cell.code} size='sm' /><span className='text-[11px] text-muted-foreground'>{cell.count}x</span></div>
                    <p className='text-xs leading-tight'>{cell.label}</p>
                    <p className={`text-[11px] font-medium ${trendToneClasses[cell.trend]}`}>{cell.count === 0 ? 'Sem sinal no ciclo' : cell.trendLabel}</p>
                  </div>)}
              </div>
            </div>
            <div className='executive-card rounded p-3 space-y-3'>
              <p className='text-sm font-semibold'>Distribuição de tendências</p>
              <div className='h-3 w-full rounded-full bg-muted overflow-hidden flex'>
                {(['improving', 'stable', 'worsening', 'insufficient_evidence'] as const).map((trend) => {
                  const count = focusAnalytics.trendDistribution[trend] || 0;
                  const width = focusSummary.total ? `${(count / focusSummary.total) * 100}%` : '0%';
                  const colorClass = trend === 'improving' ? 'bg-emerald-500' : trend === 'stable' ? 'bg-slate-400' : trend === 'worsening' ? 'bg-rose-500' : 'bg-zinc-400';
                  return <div key={trend} className={colorClass} style={{ width }} aria-label={`${trendLabels[trend]}: ${count}`} />;
                })}
              </div>
              <div className='grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-muted-foreground'>
                <p><strong>Melhorando:</strong> {focusAnalytics.trendDistribution.improving || 0}</p>
                <p><strong>Estável:</strong> {focusAnalytics.trendDistribution.stable || 0}</p>
                <p><strong>Piorando:</strong> {focusAnalytics.trendDistribution.worsening || 0}</p>
                <p><strong>Sem evidência:</strong> {focusAnalytics.trendDistribution.insufficient_evidence || 0}</p>
              </div>
            </div>
            <div className='space-y-2'>{dimensionsInFocus.map((item, idx) => {
              const width = Math.max(8, Math.round((item.count / focusAnalytics.maxCount) * 100));
              const context = item.trend === 'worsening'
                ? 'Atenção: tendência negativa'
                : item.trend === 'improving'
                  ? 'Evolução positiva percebida'
                  : item.trend === 'stable'
                    ? 'Dimensão recorrente'
                    : item.count === focusAnalytics.maxCount
                      ? 'Tema dominante do ciclo'
                      : 'Sem evidência suficiente';
              const actionData = focusAnalytics.actionBuckets[item.dimension];
              return <div key={item.dimension} className='executive-card rounded p-3 space-y-2'>
                <div className='flex items-start justify-between gap-2'><div><p className='text-xs text-muted-foreground'>#{idx + 1}</p><p className='font-medium leading-tight'>{item.label}</p></div><DimensionBadge code={item.dimension} label={item.label} size='sm' className='text-xs' /></div>
                <div className='flex items-center justify-between text-xs text-muted-foreground'><span>{item.count} aparições</span><span className={trendToneClasses[item.trend]}>{item.trendLabel}</span></div>
                <div className='h-2 rounded bg-muted/70 overflow-hidden'><div className={`h-full ${item.trend === 'worsening' ? 'bg-rose-500' : item.trend === 'improving' ? 'bg-emerald-500' : 'bg-cyan-400'}`} style={{ width: `${width}%` }} /></div>
                <div className='flex items-center justify-between'><Badge variant='outline' className={`${item.trend === 'worsening' ? 'border-rose-400/40 text-rose-400' : ''}`}>{item.trendLabel}</Badge><span className='text-xs text-muted-foreground'>{item.trendCount} registros de evolução</span></div>
                {focusAnalytics.hasActionDimensionData && actionData ? <p className='text-xs text-muted-foreground'>Ações: {actionData.open} abertas · {actionData.blocked} travadas · {actionData.completed} concluídas</p> : null}
                <p className='text-xs text-muted-foreground'>{context}</p>
              </div>;
            })}</div>
          </>}
      </CardContent></Card>
      </>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className='max-w-3xl'><DialogHeader><DialogTitle>Registrar novo encontro</DialogTitle></DialogHeader>
      <div className='grid md:grid-cols-2 gap-3'>
        <div><Label>Empresa*</Label><Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v })}><SelectTrigger><SelectValue placeholder='Selecione' /></SelectTrigger><SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Data*</Label><Input type='date' value={form.meeting_date || ''} onChange={e => setForm({ ...form, meeting_date: e.target.value })} /></div>
        <div><Label>Tipo de encontro*</Label><Select value={form.meeting_type || 'collective'} onValueChange={v => setForm({ ...form, meeting_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='collective'>Conselho Coletivo</SelectItem><SelectItem value='individual'>Acompanhamento Individual</SelectItem><SelectItem value='extraordinary'>Reunião Extraordinária</SelectItem></SelectContent></Select></div>
        <div><Label>Tema principal</Label><Select value={mainTopics.includes(form.main_topic) ? form.main_topic : 'Outro'} onValueChange={v => setForm({ ...form, main_topic: v === 'Outro' ? '' : v, main_topic_choice: v })}><SelectTrigger><SelectValue placeholder='Selecione o tema' /></SelectTrigger><SelectContent>{mainTopics.map(topic => <SelectItem key={topic} value={topic}>{topic}</SelectItem>)}</SelectContent></Select>{(form.main_topic_choice === 'Outro' || (!!form.main_topic && !mainTopics.includes(form.main_topic))) && <Input className='mt-2' placeholder='Descreva o tema principal' value={form.main_topic || ''} onChange={e => setForm({ ...form, main_topic: e.target.value, main_topic_choice: 'Outro' })} />}</div>
        <div className='md:col-span-2'><Label>Dimensões relacionadas</Label><div className='mt-2 flex flex-wrap gap-2'>{dimensionCatalog.map(dim => { const selected = form.related_dimensions?.includes(dim.id); return <button key={dim.id} type='button' onClick={() => setForm((prev: any) => ({ ...prev, related_dimensions: selected ? prev.related_dimensions.filter((id: string) => id !== dim.id) : [...(prev.related_dimensions || []), dim.id] }))} className={`rounded-full border px-3 py-1 text-xs ${selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>{dim.label}</button>; })}</div></div>
        <div className='md:col-span-2'><Label>Resumo executivo</Label><Input value={form.executive_summary || ''} onChange={e => setForm({ ...form, executive_summary: e.target.value })} /></div>
      </div>
      <div className='flex justify-end'><Button onClick={saveMeeting}>Salvar encontro</Button></div>
    </DialogContent></Dialog>
    <BackToTopFooter />
  </div>;
}
