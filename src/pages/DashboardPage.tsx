import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import KpiCards, { KpiData } from '@/components/dashboard/KpiCards';
import { BackToTopFooter } from '@/components/BackToTopFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  FileStack,
  Gauge,
  Layers3,
  ListChecks,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';

const OPEN_ACTION_STATUSES = new Set(['not_started', 'in_progress', 'blocked']);

const quickAccessCards = [
  { label: 'Organizações', description: 'Ver portfólio acompanhado', href: '/app/startups', icon: Building2 },
  { label: 'Central do Conselheiro', description: 'Abrir cockpit operacional', href: '/app/counselor', icon: Users },
  { label: 'Agenda de Evolução', description: 'Preparar ritos e encontros', href: '/app/agenda', icon: CalendarRange },
  { label: 'Novo Diagnóstico', description: 'Iniciar fluxo em uma organização', href: '/app/startups', icon: ClipboardList },
  { label: 'Registrar Encontro', description: 'Criar rito na agenda', href: '/app/agenda', icon: Plus },
  { label: 'Templates de Pauta', description: 'Usar pautas recomendadas', href: '/app/agenda/templates', icon: FileStack },
  { label: 'Metodologia', description: 'Consultar método Conselho OS', href: '/app/methodology', icon: BookOpen },
];

type Company = { id: string; name: string; created_at: string | null };
type Assessment = {
  id: string;
  company_id: string;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  company: { name: string } | null;
};
type Meeting = {
  id: string;
  company_id: string;
  meeting_date: string;
  title: string | null;
  main_topic: string | null;
  next_agenda: string | null;
  meeting_type: string | null;
  company: { name: string } | null;
};
type CouncilAction = {
  id: string;
  meeting_id: string;
  company_id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  impact: string | null;
  effort: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  company: { name: string } | null;
};
type DimensionProgress = {
  id: string;
  meeting_id: string;
  company_id: string;
  dimension_label: string;
  trend: string | null;
  created_at: string | null;
  company: { name: string } | null;
};

type PortfolioStatus = 'Saudável' | 'Atenção' | 'Crítico';

type ExecutiveData = {
  companies: Company[];
  assessments: Assessment[];
  meetings: Meeting[];
  actions: CouncilAction[];
  dimensionProgress: DimensionProgress[];
  criticalRiskCompanies: number;
  configVersion: { name: string; publishedAt: string; id?: string } | null;
};

type PortfolioSummary = {
  status: PortfolioStatus;
  tone: string;
  Icon: LucideIcon;
  microtext: string;
  overdueActions: number;
  blockedActions: number;
  meetingsWithoutAgenda: number;
  openActions: number;
  pendingDiagnostics: number;
  criticalRisks: number;
};

type CriticalAction = CouncilAction & { reason: string; priorityScore: number };
type RecentActivity = { id: string; label: string; detail: string; date: string | null; href: string; icon: LucideIcon };

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isOpenAction = (status: string | null | undefined) => OPEN_ACTION_STATUSES.has(status || '');
const isBlocked = (action: CouncilAction) => action.status === 'blocked';
const isOverdue = (action: CouncilAction) => {
  if (!action.due_date || !isOpenAction(action.status)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${action.due_date}T00:00:00`);
  return dueDate < today;
};
const hasHighLeverage = (action: CouncilAction) => action.impact === 'high' && action.effort === 'low';
const isCriticalAction = (action: CouncilAction) =>
  isBlocked(action) || isOverdue(action) || action.priority === 'high' || hasHighLeverage(action);

const getActionReason = (action: CouncilAction) => {
  if (isBlocked(action)) return 'Travada';
  if (isOverdue(action)) return 'Atrasada';
  if (action.priority === 'high') return 'Alta prioridade';
  if (hasHighLeverage(action)) return 'Alto impacto / baixo esforço';
  return 'Aberta';
};

const getActionPriorityScore = (action: CouncilAction) => {
  if (isBlocked(action)) return 100;
  if (isOverdue(action)) return 90;
  if (action.priority === 'high') return 70;
  if (hasHighLeverage(action)) return 60;
  return 10;
};

const statusCopy: Record<PortfolioStatus, { label: string; description: string; className: string }> = {
  Saudável: {
    label: 'Portfólio saudável',
    description: 'Sem alertas críticos no momento. Mantenha o acompanhamento dos ritos planejados.',
    className: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  Atenção: {
    label: 'Portfólio em atenção',
    description: 'Há pendências operacionais que merecem acompanhamento no próximo ciclo.',
    className: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  Crítico: {
    label: 'Portfólio crítico',
    description: 'Existem bloqueios, atrasos ou riscos críticos que exigem ação executiva.',
    className: 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300',
  },
};

function plural(count: number, singular: string, pluralLabel: string) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function buildMicrotext(parts: Array<[number, string, string]>) {
  const visible = parts.filter(([count]) => count > 0).map(([count, singular, pluralLabel]) => plural(count, singular, pluralLabel));
  if (visible.length === 0) return 'Nenhum alerta relevante encontrado no portfólio atual.';
  return `${visible.join(', ')}.`;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExecutiveData>({
    companies: [],
    assessments: [],
    meetings: [],
    actions: [],
    dimensionProgress: [],
    criticalRiskCompanies: 0,
    configVersion: null,
  });

  useEffect(() => {
    const fetchExecutiveHome = async () => {
      setLoading(true);

      const [companiesRes, assessmentsRes, meetingsRes, actionsRes, progressRes, configRes] = await Promise.all([
        supabase.from('companies').select('id, name, created_at').order('created_at', { ascending: false }),
        supabase
          .from('assessments')
          .select('id, company_id, status, created_at, completed_at, company:companies(name)')
          .eq('is_simulation', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('council_meetings')
          .select('id, company_id, meeting_date, title, main_topic, next_agenda, meeting_type, company:companies(name)')
          .order('meeting_date', { ascending: false })
          .limit(100),
        supabase
          .from('council_actions')
          .select('id, meeting_id, company_id, title, due_date, priority, impact, effort, status, created_at, completed_at, company:companies(name)')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('council_dimension_progress')
          .select('id, meeting_id, company_id, dimension_label, trend, created_at, company:companies(name)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('config_versions')
          .select('id, version_name, published_at')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(1),
      ]);

      let criticalRiskCompanies = 0;
      const { data: redFlagDefs } = await supabase.from('red_flags').select('code, severity');
      const highSeverityCodes = new Set((redFlagDefs || []).filter((rf) => rf.severity === 'high').map((rf) => rf.code));

      if (highSeverityCodes.size > 0) {
        const { data: highFlags } = await supabase
          .from('assessment_red_flags')
          .select('assessment_id, red_flag_code')
          .eq('status', 'triggered')
          .in('red_flag_code', [...highSeverityCodes]);

        const assessmentIds = [...new Set((highFlags || []).map((flag) => flag.assessment_id))];
        if (assessmentIds.length > 0) {
          const { data: flaggedAssessments } = await supabase
            .from('assessments')
            .select('company_id')
            .in('id', assessmentIds)
            .eq('is_simulation', false);
          criticalRiskCompanies = new Set((flaggedAssessments || []).map((assessment) => assessment.company_id)).size;
        }
      }

      const config = configRes.data?.[0] as { id: string; version_name: string; published_at: string | null } | undefined;

      setData({
        companies: (companiesRes.data || []) as Company[],
        assessments: (assessmentsRes.data || []) as unknown as Assessment[],
        meetings: (meetingsRes.data || []) as unknown as Meeting[],
        actions: (actionsRes.data || []) as unknown as CouncilAction[],
        dimensionProgress: (progressRes.data || []) as unknown as DimensionProgress[],
        criticalRiskCompanies,
        configVersion: config ? { id: config.id, name: config.version_name, publishedAt: config.published_at || '' } : null,
      });
      setLoading(false);
    };

    fetchExecutiveHome();
  }, []);

  const openActions = useMemo(() => data.actions.filter((action) => isOpenAction(action.status)), [data.actions]);
  const criticalActions = useMemo<CriticalAction[]>(
    () =>
      openActions
        .filter(isCriticalAction)
        .map((action) => ({ ...action, reason: getActionReason(action), priorityScore: getActionPriorityScore(action) }))
        .sort((a, b) => b.priorityScore - a.priorityScore || (a.due_date || '').localeCompare(b.due_date || '')),
    [openActions]
  );

  const meetingsWithoutAgenda = useMemo(
    () => data.meetings.filter((meeting) => !meeting.next_agenda || meeting.next_agenda.trim().length === 0),
    [data.meetings]
  );

  const portfolioSummary = useMemo<PortfolioSummary>(() => {
    const overdueActions = openActions.filter(isOverdue).length;
    const blockedActions = openActions.filter(isBlocked).length;
    const pendingDiagnostics = data.assessments.filter((assessment) => assessment.status === 'in_progress').length;
    const criticalRisks = data.criticalRiskCompanies;

    const status: PortfolioStatus =
      overdueActions > 0 || blockedActions > 0 || criticalRisks > 0
        ? 'Crítico'
        : pendingDiagnostics > 0 || meetingsWithoutAgenda.length > 0 || openActions.length > 0
          ? 'Atenção'
          : 'Saudável';

    return {
      status,
      tone: statusCopy[status].className,
      Icon: status === 'Crítico' ? AlertTriangle : status === 'Atenção' ? Gauge : CheckCircle2,
      microtext: buildMicrotext([
        [overdueActions, 'ação atrasada', 'ações atrasadas'],
        [blockedActions, 'travada', 'travadas'],
        [criticalRisks, 'organização com risco crítico', 'organizações com riscos críticos'],
        [pendingDiagnostics, 'diagnóstico pendente', 'diagnósticos pendentes'],
        [meetingsWithoutAgenda.length, 'encontro sem próxima pauta', 'encontros sem próxima pauta'],
        [openActions.length, 'ação aberta', 'ações abertas'],
      ]),
      overdueActions,
      blockedActions,
      meetingsWithoutAgenda: meetingsWithoutAgenda.length,
      openActions: openActions.length,
      pendingDiagnostics,
      criticalRisks,
    };
  }, [data.assessments, data.criticalRiskCompanies, meetingsWithoutAgenda.length, openActions]);

  const nextRite = useMemo(() => {
    if (data.meetings.length === 0) return null;
    const actionsByMeeting = new Map<string, CriticalAction[]>();
    criticalActions.forEach((action) => {
      const current = actionsByMeeting.get(action.meeting_id) || [];
      current.push(action);
      actionsByMeeting.set(action.meeting_id, current);
    });

    return [...data.meetings].sort((a, b) => {
      const aCritical = actionsByMeeting.has(a.id) ? 1 : 0;
      const bCritical = actionsByMeeting.has(b.id) ? 1 : 0;
      if (aCritical !== bCritical) return bCritical - aCritical;
      const aWithoutAgenda = !a.next_agenda || a.next_agenda.trim().length === 0 ? 1 : 0;
      const bWithoutAgenda = !b.next_agenda || b.next_agenda.trim().length === 0 ? 1 : 0;
      if (aWithoutAgenda !== bWithoutAgenda) return bWithoutAgenda - aWithoutAgenda;
      return new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime();
    })[0];
  }, [criticalActions, data.meetings]);

  const recentActivities = useMemo<RecentActivity[]>(() => {
    const lastCompletedAssessment = data.assessments
      .filter((assessment) => assessment.status === 'completed')
      .sort((a, b) => new Date(b.completed_at || b.created_at || '').getTime() - new Date(a.completed_at || a.created_at || '').getTime())[0];
    const lastMeeting = data.meetings[0];
    const lastAction = [...data.actions].sort((a, b) => {
      const aDate = a.completed_at || a.created_at || '';
      const bDate = b.completed_at || b.created_at || '';
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    })[0];
    const lastProgress = data.dimensionProgress[0];

    return [
      lastCompletedAssessment && {
        id: `assessment-${lastCompletedAssessment.id}`,
        label: 'Diagnóstico concluído',
        detail: lastCompletedAssessment.company?.name || 'Organização',
        date: lastCompletedAssessment.completed_at || lastCompletedAssessment.created_at,
        href: `/app/assessments/${lastCompletedAssessment.id}/report`,
        icon: CheckCircle2,
      },
      lastMeeting && {
        id: `meeting-${lastMeeting.id}`,
        label: 'Encontro registrado',
        detail: `${lastMeeting.company?.name || 'Organização'} · ${lastMeeting.main_topic || lastMeeting.title || 'Rito de acompanhamento'}`,
        date: lastMeeting.meeting_date,
        href: `/app/agenda/${lastMeeting.id}`,
        icon: CalendarRange,
      },
      lastAction && {
        id: `action-${lastAction.id}`,
        label: lastAction.status === 'completed' ? 'Ação concluída' : 'Ação criada',
        detail: `${lastAction.company?.name || 'Organização'} · ${lastAction.title}`,
        date: lastAction.completed_at || lastAction.created_at,
        href: `/app/startups/${lastAction.company_id}/counselor`,
        icon: ListChecks,
      },
      lastProgress && {
        id: `progress-${lastProgress.id}`,
        label: 'Evolução por dimensão',
        detail: `${lastProgress.company?.name || 'Organização'} · ${lastProgress.dimension_label}`,
        date: lastProgress.created_at,
        href: `/app/agenda/${lastProgress.meeting_id}`,
        icon: Layers3,
      },
    ].filter(Boolean) as RecentActivity[];
  }, [data.actions, data.assessments, data.dimensionProgress, data.meetings]);

  const kpi: KpiData = {
    companies: data.companies.length,
    inProgress: portfolioSummary.pendingDiagnostics,
    completed: data.assessments.filter((assessment) => assessment.status === 'completed').length,
    openActions: openActions.length,
    criticalActions: criticalActions.length,
    highRedFlags: data.criticalRiskCompanies,
  };

  const hasNoOperatingData = !loading && data.companies.length === 0;
  const hasNoDiagnostics = !loading && data.companies.length > 0 && data.assessments.length === 0;
  const hasNoMeetings = !loading && data.meetings.length === 0;
  const hasNoActions = !loading && data.actions.length === 0;

  return (
    <div className="space-y-5 lg:space-y-6">
      <DashboardHeader configVersion={data.configVersion} />

      {hasNoOperatingData && (
        <Card className="executive-panel rounded-3xl border-primary/25 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="executive-section-title text-sm">Comece pelo portfólio</p>
              <p className="mt-1 text-sm text-muted-foreground">Nenhuma organização cadastrada. Cadastre uma organização para liberar diagnósticos, ritos e ações.</p>
            </div>
            <Button asChild className="rounded-full"><Link to="/app/startups">Adicionar organização</Link></Button>
          </CardContent>
        </Card>
      )}

      <KpiCards data={kpi} loading={loading} />

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="executive-panel rounded-3xl overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="executive-section-title text-sm">Status do portfólio</p>
                <CardTitle className="mt-2 text-2xl">{portfolioSummary.status}</CardTitle>
              </div>
              {loading ? <Skeleton className="h-11 w-11 rounded-2xl" /> : (
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${portfolioSummary.tone}`}>
                  <portfolioSummary.Icon className="h-6 w-6" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-24 w-full rounded-2xl" /></div>
            ) : (
              <>
                <Badge variant="outline" className={`executive-pill ${portfolioSummary.tone}`}>{statusCopy[portfolioSummary.status].label}</Badge>
                <p className="text-sm text-muted-foreground leading-relaxed">{portfolioSummary.microtext}</p>
                <p className="text-sm leading-relaxed">{statusCopy[portfolioSummary.status].description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {[
                    ['Atrasadas', portfolioSummary.overdueActions],
                    ['Travadas', portfolioSummary.blockedActions],
                    ['Sem pauta', portfolioSummary.meetingsWithoutAgenda],
                    ['Abertas', portfolioSummary.openActions],
                    ['Diagnósticos', portfolioSummary.pendingDiagnostics],
                    ['Riscos', portfolioSummary.criticalRisks],
                  ].map(([label, value]) => (
                    <div key={label} className="executive-card rounded-2xl p-3">
                      <p className="text-2xl font-bold tabular-nums">{value}</p>
                      <p className="text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="executive-panel rounded-3xl overflow-hidden border-primary/25">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="executive-section-title text-sm">Próximo rito</p>
                <CardTitle className="mt-2 text-2xl">Encontro relevante</CardTitle>
              </div>
              <Badge variant="outline" className="executive-pill border-primary/30 bg-primary/10 text-primary">Prioridade</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-10 w-36 rounded-full" /></div>
            ) : nextRite ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-4">
                  <div>
                    <p className="text-xl font-semibold">{nextRite.company?.name || 'Organização'}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(nextRite.meeting_date)} · {nextRite.main_topic || nextRite.title || 'Rito de acompanhamento'}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="executive-card rounded-2xl p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Status</p>
                      <p className="mt-1 font-semibold">{criticalActions.some((action) => action.meeting_id === nextRite.id) ? 'Com ações críticas' : !nextRite.next_agenda ? 'Sem próxima pauta' : 'Recente'}</p>
                    </div>
                    <div className="executive-card rounded-2xl p-3 sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Próxima pauta</p>
                      <p className="mt-1 line-clamp-2 font-semibold">{nextRite.next_agenda || 'Pauta ainda não registrada'}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-end">
                  <Button asChild className="rounded-full shadow-lg shadow-primary/20">
                    <Link to={`/app/agenda/${nextRite.id}`}>Abrir encontro <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyBlock icon={CalendarRange} title="Nenhum encontro registrado" description="Registre o primeiro rito para acompanhar pauta, decisões e ações do conselho." cta="Registrar encontro" href="/app/agenda" />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="executive-panel rounded-3xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="executive-section-title text-sm">Pendências críticas</p>
                <CardTitle className="mt-2 text-2xl">Top 3 ações</CardTitle>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-full border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
                <Link to="/app/counselor">Ver Central do Conselheiro</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full rounded-2xl" />)}</div>
            ) : criticalActions.length > 0 ? (
              <div className="space-y-3">
                {criticalActions.slice(0, 3).map((action) => (
                  <div key={action.id} className="executive-card rounded-2xl p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="executive-pill border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300">{action.reason}</Badge>
                          <span className="text-xs text-muted-foreground">Prazo: {formatDate(action.due_date)}</span>
                        </div>
                        <p className="font-semibold line-clamp-1">{action.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{action.company?.name || 'Organização'} · status: {action.status || '—'}</p>
                      </div>
                      <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full">
                        <Link to={`/app/startups/${action.company_id}/counselor`}>Abrir central</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : hasNoActions ? (
              <EmptyBlock icon={ListChecks} title="Nenhuma ação registrada" description="Registre encontros na Agenda de Evolução para criar ações e acompanhar responsáveis." cta="Registrar encontro" href="/app/agenda" />
            ) : (
              <EmptyBlock icon={CheckCircle2} title="Sem pendências críticas" description="Existem ações no sistema, mas nenhuma está travada, atrasada, em alta prioridade ou com alto impacto/baixo esforço." cta="Ver ações" href="/app/counselor" />
            )}
          </CardContent>
        </Card>

        <Card className="executive-panel rounded-3xl">
          <CardHeader className="pb-3">
            <p className="executive-section-title text-sm">Atividades recentes</p>
            <CardTitle className="mt-2 text-2xl">Últimos eventos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 w-full rounded-2xl" />)}</div>
            ) : recentActivities.length > 0 ? (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <Link key={activity.id} to={activity.href} className="executive-card group flex items-center gap-3 rounded-2xl p-3 transition-all hover:border-primary/35">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <activity.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{activity.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{activity.detail}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(activity.date)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyBlock icon={Sparkles} title="Sem histórico suficiente" description="Conclua um diagnóstico, registre um encontro ou crie ações para formar a linha recente do portfólio." cta="Abrir organizações" href="/app/startups" />
            )}
          </CardContent>
        </Card>
      </section>

      {(hasNoDiagnostics || hasNoMeetings) && (
        <section className="grid gap-3 md:grid-cols-2">
          {hasNoDiagnostics && <GuidanceCard title="Sem diagnósticos" description="Inicie um diagnóstico a partir da página de organizações para gerar leitura executiva." href="/app/startups" cta="Novo diagnóstico" icon={ClipboardList} />}
          {hasNoMeetings && <GuidanceCard title="Sem encontros" description="Registre ritos na Agenda de Evolução para ativar pautas, atas e ações." href="/app/agenda" cta="Registrar encontro" icon={CalendarRange} />}
        </section>
      )}

      <Card className="executive-panel rounded-3xl">
        <CardHeader className="pb-3">
          <p className="executive-section-title text-sm">Acesso rápido</p>
          <CardTitle className="mt-2 text-2xl">Principais fluxos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {quickAccessCards.map((shortcut) => (
              <Link key={shortcut.label} to={shortcut.href} className="executive-card rounded-2xl p-3 transition-all hover:-translate-y-0.5 hover:border-primary/35">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <shortcut.icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold leading-tight">{shortcut.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{shortcut.description}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <BackToTopFooter />
    </div>
  );
}

function EmptyBlock({ icon: Icon, title, description, cta, href }: { icon: LucideIcon; title: string; description: string; cta: string; href: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border/80 bg-background/50 p-5 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button asChild size="sm" className="mt-4 rounded-full"><Link to={href}>{cta}</Link></Button>
    </div>
  );
}

function GuidanceCard({ title, description, href, cta, icon: Icon }: { title: string; description: string; href: string; cta: string; icon: LucideIcon }) {
  return (
    <Card className="executive-card rounded-3xl">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full"><Link to={href}>{cta}</Link></Button>
      </CardContent>
    </Card>
  );
}
