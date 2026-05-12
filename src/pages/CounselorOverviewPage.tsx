import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Building2,
  ListChecks,
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  CalendarClock,
  ArrowUpRight,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DimensionBadge } from '@/components/DimensionBadge';
import type { CouncilAction, CouncilDimensionProgress, CouncilMeeting } from '@/types/council';

type Company = { id: string; name: string };

const openStatuses = new Set(['not_started', 'in_progress', 'blocked']);
const closedStatuses = new Set(['completed', 'cancelled']);

const statusLabel: Record<string, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  blocked: 'Travada',
  cancelled: 'Cancelada',
};

const priorityLabel: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

type KpiTone = 'neutral' | 'attention' | 'critical';

const toneStyles: Record<KpiTone, { wrap: string; text: string; pill: string }> = {
  neutral: { wrap: 'bg-muted/40 border border-border/60', text: 'text-muted-foreground', pill: 'bg-muted/40 text-muted-foreground border-border/60' },
  attention: { wrap: 'bg-primary/10 border border-primary/25', text: 'text-primary', pill: 'bg-primary/10 text-primary border-primary/25' },
  critical: { wrap: 'bg-destructive/10 border border-destructive/30', text: 'text-destructive', pill: 'bg-destructive/10 text-destructive border-destructive/30' },
};

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CounselorOverviewPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [meetings, setMeetings] = useState<CouncilMeeting[]>([]);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [progress, setProgress] = useState<CouncilDimensionProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [c, m, a, p] = await Promise.all([
        supabase.from('companies').select('id,name').order('name'),
        supabase.from('council_meetings').select('*').order('meeting_date', { ascending: false }),
        supabase.from('council_actions').select('*'),
        supabase.from('council_dimension_progress').select('*').order('updated_at', { ascending: false }),
      ]);

      setCompanies((c.data || []) as Company[]);
      setMeetings((m.data || []) as CouncilMeeting[]);
      setActions((a.data || []) as CouncilAction[]);
      setProgress((p.data || []) as CouncilDimensionProgress[]);
      setLoading(false);
    };
    load();
  }, []);

  const today = new Date();

  const latestMeetingByCompany = useMemo(() => {
    const map = new Map<string, CouncilMeeting>();
    for (const meeting of meetings) {
      if (!map.has(meeting.company_id)) map.set(meeting.company_id, meeting);
    }
    return map;
  }, [meetings]);

  const latestProgressByCompanyAndDimension = useMemo(() => {
    const map = new Map<string, CouncilDimensionProgress>();
    for (const row of progress) {
      const key = `${row.company_id}:${row.dimension_id}`;
      if (!map.has(key)) map.set(key, row);
    }
    return Array.from(map.values());
  }, [progress]);

  const attentionByCompany = useMemo(() => {
    const map = new Map<string, { overdue: number; blocked: number; worsening: number; noAgenda: boolean; noEvolution: boolean }>();
    for (const company of companies) {
      const companyActions = actions.filter((a) => a.company_id === company.id);
      const companyProgress = latestProgressByCompanyAndDimension.filter((p) => p.company_id === company.id);
      const latestMeeting = latestMeetingByCompany.get(company.id);
      const overdue = companyActions.filter((a) => a.due_date && new Date(a.due_date) < today && !closedStatuses.has(a.status)).length;
      const blocked = companyActions.filter((a) => a.status === 'blocked').length;
      const worsening = companyProgress.filter((p) => p.trend === 'worsening').length;
      const noAgenda = !!latestMeeting && !latestMeeting.next_agenda;
      const noEvolution = companyProgress.length === 0;
      map.set(company.id, { overdue, blocked, worsening, noAgenda, noEvolution });
    }
    return map;
  }, [companies, actions, latestProgressByCompanyAndDimension, latestMeetingByCompany]);

  const kpis = useMemo(() => {
    const open = actions.filter((a) => openStatuses.has(a.status)).length;
    const overdue = actions.filter((a) => a.due_date && new Date(a.due_date) < today && !closedStatuses.has(a.status)).length;
    const blocked = actions.filter((a) => a.status === 'blocked').length;
    const inAttention = latestProgressByCompanyAndDimension.filter((p) => p.trend === 'worsening' || (p.trend === 'stable' && (p.current_perceived_score ?? 999) <= 2.5)).length;
    const noAgenda = Array.from(latestMeetingByCompany.values()).filter((m) => !m.next_agenda).length;
    return { open, overdue, blocked, inAttention, noAgenda };
  }, [actions, latestProgressByCompanyAndDimension, latestMeetingByCompany]);

  const companiesRequiringAttention = useMemo(() => companies.map((company) => {
    const reasons = attentionByCompany.get(company.id)!;
    const weight = reasons.overdue * 2 + reasons.blocked * 2 + reasons.worsening * 2 + (reasons.noAgenda ? 1 : 0) + (reasons.noEvolution ? 1 : 0);
    const level: 'Crítico' | 'Atenção' | 'Saudável' = weight >= 5 ? 'Crítico' : weight >= 2 ? 'Atenção' : 'Saudável';
    return { company, reasons, level, weight };
  }).sort((a, b) => b.weight - a.weight), [companies, attentionByCompany]);

  const criticalActions = useMemo(() => actions
    .filter((a) => openStatuses.has(a.status))
    .sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    }), [actions]);

  if (loading) {
    return (
      <Card className="executive-panel rounded-3xl">
        <CardContent className="py-16 text-center text-muted-foreground">Carregando visão consolidada...</CardContent>
      </Card>
    );
  }

  const kpiCards: Array<{ label: string; sublabel: string; value: number; tone: KpiTone; icon: typeof Building2 }> = [
    { label: 'Organizações', sublabel: 'em acompanhamento ativo', value: companies.length, tone: 'neutral', icon: Building2 },
    { label: 'Ações abertas', sublabel: 'em execução ou planejadas', value: kpis.open, tone: 'neutral', icon: ListChecks },
    { label: 'Ações atrasadas', sublabel: 'fora do prazo combinado', value: kpis.overdue, tone: kpis.overdue > 0 ? 'critical' : 'neutral', icon: AlertTriangle },
    { label: 'Ações travadas', sublabel: 'aguardando desbloqueio', value: kpis.blocked, tone: kpis.blocked > 0 ? 'critical' : 'neutral', icon: ShieldAlert },
    { label: 'Dimensões em atenção', sublabel: 'piorando ou com baixo score', value: kpis.inAttention, tone: kpis.inAttention > 0 ? 'attention' : 'neutral', icon: TrendingDown },
    { label: 'Sem próxima pauta', sublabel: 'encontros sem agenda definida', value: kpis.noAgenda, tone: kpis.noAgenda > 0 ? 'attention' : 'neutral', icon: CalendarClock },
  ];

  const focusMap = Object.entries(latestProgressByCompanyAndDimension.reduce((acc, item) => {
    const key = item.dimension_id;
    if (!acc[key]) acc[key] = { label: item.dimension_label, count: 0, trends: [] as string[] };
    if (item.trend === 'worsening' || (item.trend === 'stable' && (item.current_perceived_score ?? 999) <= 2.5)) {
      acc[key].count += 1;
      acc[key].trends.push(item.trend);
    }
    return acc;
  }, {} as Record<string, { label: string; count: number; trends: string[] }>))
    .filter(([, value]) => value.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent p-7 sm:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              <Sparkles className="h-3 w-3" /> Visão consolidada
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Central do Conselheiro
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Priorize organizações, pendências e próximos encontros a partir de uma leitura única do portfólio em acompanhamento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link to="/app/agenda">
                <CalendarClock className="h-4 w-4 mr-2" /> Abrir agenda
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/app/startups">
                <Building2 className="h-4 w-4 mr-2" /> Organizações
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* KPI Grid */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map((card) => {
          const tone = toneStyles[card.tone];
          return (
            <Card key={card.label} className="executive-card rounded-2xl transition-all duration-300 hover:-translate-y-0.5">
              <CardContent className="p-5 flex flex-col gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.wrap} ${tone.text}`}>
                  <card.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">{card.value}</p>
                  <p className="mt-1 text-[11px] tracking-[0.14em] font-semibold text-muted-foreground uppercase">{card.label}</p>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed mt-0.5">{card.sublabel}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Organizações em atenção */}
      <Card className="executive-panel rounded-3xl">
        <CardContent className="p-6 sm:p-7 space-y-5">
          <header className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Organizações que exigem atenção
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Ranking calculado por ações atrasadas, travadas, dimensões piorando e ausência de pauta.</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {companies.length} organizações
            </span>
          </header>

          <div className="grid gap-3">
            {companies.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Sem organizações cadastradas. Cadastre uma organização para iniciar o acompanhamento.</p>
            ) : companiesRequiringAttention.map((row) => {
              const motives = [
                row.reasons.overdue > 0 && `${row.reasons.overdue} ações atrasadas`,
                row.reasons.blocked > 0 && `${row.reasons.blocked} ações travadas`,
                row.reasons.worsening > 0 && `${row.reasons.worsening} dimensão(ões) piorando`,
                row.reasons.noAgenda && 'sem próxima pauta',
                row.reasons.noEvolution && 'sem evolução registrada',
              ].filter(Boolean) as string[];

              const tone =
                row.level === 'Crítico'
                  ? { dot: 'bg-destructive', border: 'border-l-destructive/70', pill: 'bg-destructive/10 text-destructive border border-destructive/30' }
                  : row.level === 'Atenção'
                  ? { dot: 'bg-primary', border: 'border-l-primary/70', pill: 'bg-primary/10 text-primary border border-primary/25' }
                  : { dot: 'bg-muted-foreground/60', border: 'border-l-border', pill: 'bg-muted/40 text-muted-foreground border border-border/60' };

              return (
                <div
                  key={row.company.id}
                  className={`group relative rounded-2xl border border-white/10 ${tone.border} border-l-4 bg-white/[0.03] p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-white/[0.06] transition-colors`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full ${tone.dot} shadow-[0_0_8px_currentColor]`} />
                      <p className="font-semibold text-foreground truncate">{row.company.name}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${tone.pill}`}>
                        {row.level}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {motives.length ? motives.join(' · ') : 'Sem alertas críticos no momento'}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost" className="rounded-full shrink-0 hover:bg-primary/10 hover:text-primary">
                    <Link to={`/app/startups/${row.company.id}/counselor`}>
                      Abrir <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Two columns: Próximas pautas | Pendências críticas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="executive-panel rounded-3xl">
          <CardContent className="p-6 sm:p-7 space-y-4">
            <header>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" /> Próximas pautas e últimos encontros
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Garanta que toda organização tenha próxima pauta combinada.</p>
            </header>
            <div className="space-y-2.5">
              {companies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem organizações para exibir encontros.</p>
              ) : companies.map((company) => {
                const lastMeeting = latestMeetingByCompany.get(company.id);
                const hasAgenda = !!lastMeeting?.next_agenda;
                return (
                  <div key={company.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate">{company.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Última: {formatDate(lastMeeting?.meeting_date)} · {lastMeeting?.meeting_type || '—'}
                        </p>
                      </div>
                      {lastMeeting && (
                        <Button asChild variant="ghost" size="sm" className="rounded-full shrink-0 -mr-2 hover:bg-primary/10 hover:text-primary">
                          <Link to={`/app/agenda/${lastMeeting.id}`}>
                            Abrir <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </div>
                    <div className={`mt-2.5 rounded-lg px-3 py-2 text-xs leading-relaxed ${hasAgenda ? 'bg-white/[0.04] border border-white/10 text-foreground/90' : 'bg-muted/40 border border-border/60 text-muted-foreground'}`}>
                      <span className="font-semibold">Próxima pauta: </span>
                      {lastMeeting?.next_agenda || 'Não registrada'}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="executive-panel rounded-3xl">
          <CardContent className="p-6 sm:p-7 space-y-4">
            <header className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" /> Pendências críticas
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Ações abertas ordenadas por prazo.</p>
              </div>
              <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] font-bold text-foreground/80">
                {criticalActions.length}
              </span>
            </header>
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {criticalActions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                  <p className="text-sm text-foreground font-medium">Nenhuma pendência crítica em aberto.</p>
                  <p className="text-xs text-muted-foreground mt-1">Ótimo trabalho no acompanhamento!</p>
                </div>
              ) : criticalActions.map((action) => {
                const companyName = companies.find((c) => c.id === action.company_id)?.name || '—';
                const isOverdue = action.due_date && new Date(action.due_date) < today;
                const priorityTone = action.priority === 'high' ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-muted/40 text-muted-foreground border-border/60';
                return (
                  <div key={action.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground leading-snug">{action.title}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border whitespace-nowrap ${priorityTone}`}>
                        {priorityLabel[action.priority] || action.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {companyName} · {action.owner_name || 'Sem responsável'}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-muted/40 text-muted-foreground'}`}>
                          <CalendarClock className="h-3 w-3" /> {formatDate(action.due_date)}
                        </span>
                        <span className="text-muted-foreground">{statusLabel[action.status] || action.status}</span>
                        {action.related_dimension && <DimensionBadge code={action.related_dimension} />}
                      </div>
                      <Button asChild size="sm" variant="ghost" className="rounded-full -mr-2 hover:bg-primary/10 hover:text-primary">
                        <Link to={`/app/startups/${action.company_id}/counselor`}>
                          Abrir <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapa de foco */}
      <Card className="executive-panel rounded-3xl">
        <CardContent className="p-6 sm:p-7 space-y-5">
          <header>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" /> Mapa de foco do conselheiro
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Dimensões que aparecem com baixa performance ou em piora em mais organizações.</p>
          </header>

          {focusMap.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sem progresso por dimensão. Registre evolução nos encontros para liberar o mapa de foco.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {focusMap.map(([key, value]) => {
                const trend = value.trends.filter((t) => t === 'worsening').length >= value.trends.filter((t) => t === 'stable').length ? 'worsening' : 'stable';
                const isWorsening = trend === 'worsening';
                return (
                  <div
                    key={key}
                    className={`rounded-2xl border p-4 bg-white/[0.03] hover:bg-white/[0.06] transition-colors ${isWorsening ? 'border-destructive/30' : 'border-white/10'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <DimensionBadge code={key} label={value.label} />
                      <Badge variant={isWorsening ? 'destructive' : 'secondary'} className="text-[10px]">
                        {isWorsening ? 'Piorando' : 'Estável (baixo)'}
                      </Badge>
                    </div>
                    <p className="mt-3 text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                      {value.count}
                      <span className="text-xs font-medium text-muted-foreground ml-1.5">organizações</span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assistente de Ata */}
      <Card className="executive-panel rounded-3xl border-primary/30 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <CardContent className="p-6 sm:p-7 relative">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:justify-between">
            <div className="flex items-start gap-4 max-w-2xl">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 text-primary shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Assistente de Ata do Conselho</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Cole a transcrição de uma reunião para gerar uma pré-ata revisável com decisões, ações e evolução por dimensão.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:shrink-0">
              <Button asChild className="rounded-full">
                <Link to="/app/agenda">Criar a partir de transcrição</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/app/agenda">Ver Agenda</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
