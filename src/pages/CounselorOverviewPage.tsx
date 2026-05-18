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
  CheckCircle2,
  Gauge,
  ClipboardList,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DimensionBadge } from '@/components/DimensionBadge';
import type { CouncilAction, CouncilDimensionProgress, CouncilMeeting } from '@/types/council';

const officialDimensions = [
  { code: 'IC', label: 'Identidade & Cultura' },
  { code: 'PL', label: 'Pessoas & Liderança' },
  { code: 'GR', label: 'Governança & Riscos' },
  { code: 'EE', label: 'Estratégia & Execução' },
  { code: 'PM', label: 'Processos & Métricas' },
  { code: 'FS', label: 'Finanças & Sustentabilidade' },
  { code: 'MN', label: 'Modelo de Negócio' },
  { code: 'GT', label: 'Go-to-market & Tração' },
  { code: 'PT', label: 'Produto & Tecnologia' },
];

const dimensionOrder = officialDimensions.map((dimension) => dimension.code);

type Company = { id: string; name: string };
type CompanyStatus = 'Saudável' | 'Atenção' | 'Crítico';
type KpiTone = 'neutral' | 'attention' | 'critical' | 'healthy';

type CompanyPriority = {
  company: Company;
  level: CompanyStatus;
  weight: number;
  reasons: {
    overdue: number;
    blocked: number;
    worsening: number;
    open: number;
    noAgenda: boolean;
    stableLow: number;
  };
  motives: string[];
  nextBestAction: string;
};

type Recommendation = {
  title: string;
  company: string;
  reason: string;
  meta?: string;
  cta: string;
  ctaText: string;
};

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

const meetingTypeLabel: Record<string, string> = {
  collective: 'Coletiva',
  individual: 'Individual',
  extraordinary: 'Extraordinária',
};

const toneStyles: Record<KpiTone, { wrap: string; text: string; pill: string }> = {
  neutral: {
    wrap: 'bg-muted/40 border border-border/60',
    text: 'text-muted-foreground',
    pill: 'bg-muted/40 text-muted-foreground border-border/60',
  },
  attention: {
    wrap: 'bg-primary/10 border border-primary/25',
    text: 'text-primary',
    pill: 'bg-primary/10 text-primary border-primary/25',
  },
  critical: {
    wrap: 'bg-destructive/10 border border-destructive/30',
    text: 'text-destructive',
    pill: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  healthy: {
    wrap: 'bg-emerald-500/10 border border-emerald-500/25',
    text: 'text-emerald-600 dark:text-emerald-400',
    pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  },
};

function formatDate(d?: string | null) {
  if (!d) return '—';
  const [year, month, day] = d.split('-');
  if (!year || !month || !day) return '—';
  return `${day}/${month}/${year}`;
}

function plural(count: number, singular: string, pluralText: string) {
  return `${count} ${count === 1 ? singular : pluralText}`;
}

function isOverdue(action: CouncilAction, todayKey: string) {
  return !!action.due_date && action.due_date < todayKey && !closedStatuses.has(action.status);
}

function companyStatusTone(level: CompanyStatus) {
  if (level === 'Crítico') {
    return {
      dot: 'bg-destructive',
      border: 'border-l-destructive/70',
      pill: 'bg-destructive/10 text-destructive border border-destructive/30',
    };
  }
  if (level === 'Atenção') {
    return {
      dot: 'bg-primary',
      border: 'border-l-primary/70',
      pill: 'bg-primary/10 text-primary border border-primary/25',
    };
  }
  return {
    dot: 'bg-emerald-500',
    border: 'border-l-emerald-500/60',
    pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25',
  };
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

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((company) => map.set(company.id, company.name));
    return map;
  }, [companies]);

  const latestMeetingByCompany = useMemo(() => {
    const map = new Map<string, CouncilMeeting>();
    for (const meeting of meetings) {
      if (!map.has(meeting.company_id)) map.set(meeting.company_id, meeting);
    }
    return map;
  }, [meetings]);

  const actionsByCompany = useMemo(() => {
    const map = new Map<string, CouncilAction[]>();
    companies.forEach((company) => map.set(company.id, []));
    actions.forEach((action) => {
      const list = map.get(action.company_id) || [];
      list.push(action);
      map.set(action.company_id, list);
    });
    return map;
  }, [actions, companies]);

  const latestProgressByCompanyAndDimension = useMemo(() => {
    const map = new Map<string, CouncilDimensionProgress>();
    for (const row of progress) {
      const key = `${row.company_id}:${row.dimension_id}`;
      if (!map.has(key)) map.set(key, row);
    }
    return Array.from(map.values()).filter((item) => dimensionOrder.includes(item.dimension_id));
  }, [progress]);

  const progressByCompany = useMemo(() => {
    const map = new Map<string, CouncilDimensionProgress[]>();
    latestProgressByCompanyAndDimension.forEach((item) => {
      const list = map.get(item.company_id) || [];
      list.push(item);
      map.set(item.company_id, list);
    });
    return map;
  }, [latestProgressByCompanyAndDimension]);

  const kpis = useMemo(() => {
    const open = actions.filter((action) => openStatuses.has(action.status)).length;
    const overdue = actions.filter((action) => isOverdue(action, todayKey)).length;
    const blocked = actions.filter((action) => action.status === 'blocked').length;
    const inAttention = latestProgressByCompanyAndDimension.filter(
      (item) => item.trend === 'worsening' || (item.trend === 'stable' && (item.current_perceived_score ?? 999) <= 2.5),
    ).length;
    const noAgenda = Array.from(latestMeetingByCompany.values()).filter((meeting) => !meeting.next_agenda).length;
    return { open, overdue, blocked, inAttention, noAgenda };
  }, [actions, latestMeetingByCompany, latestProgressByCompanyAndDimension, todayKey]);

  const portfolioStatus = useMemo(() => {
    const hasWorsening = latestProgressByCompanyAndDimension.some((item) => item.trend === 'worsening');
    const hasStableLow = latestProgressByCompanyAndDimension.some(
      (item) => item.trend === 'stable' && (item.current_perceived_score ?? 999) <= 2.5,
    );
    const level: CompanyStatus = kpis.overdue > 0 || kpis.blocked > 0 || hasWorsening ? 'Crítico' : kpis.open > 0 || kpis.noAgenda > 0 || hasStableLow ? 'Atenção' : 'Saudável';
    const reasons = [
      kpis.overdue > 0 && plural(kpis.overdue, 'ação atrasada', 'ações atrasadas'),
      kpis.blocked > 0 && plural(kpis.blocked, 'travada', 'travadas'),
      hasWorsening && 'dimensão piorando',
      kpis.open > 0 && plural(kpis.open, 'ação aberta', 'ações abertas'),
      kpis.noAgenda > 0 && plural(kpis.noAgenda, 'organização sem próxima pauta', 'organizações sem próxima pauta'),
      hasStableLow && 'dimensão estável com score baixo',
    ].filter(Boolean) as string[];

    return {
      level,
      summary: reasons.length ? `${reasons.slice(0, 3).join(', ')}.` : 'Sem alertas relevantes no momento.',
    };
  }, [kpis, latestProgressByCompanyAndDimension]);

  const companyPriorities = useMemo<CompanyPriority[]>(() => companies.map((company) => {
    const companyActions = actionsByCompany.get(company.id) || [];
    const companyProgress = progressByCompany.get(company.id) || [];
    const latestMeeting = latestMeetingByCompany.get(company.id);
    const overdue = companyActions.filter((action) => isOverdue(action, todayKey)).length;
    const blocked = companyActions.filter((action) => action.status === 'blocked').length;
    const worsening = companyProgress.filter((item) => item.trend === 'worsening').length;
    const open = companyActions.filter((action) => openStatuses.has(action.status)).length;
    const noAgenda = !!latestMeeting && !latestMeeting.next_agenda;
    const stableLow = companyProgress.filter((item) => item.trend === 'stable' && (item.current_perceived_score ?? 999) <= 2.5).length;
    const level: CompanyStatus = overdue > 0 || blocked > 0 || worsening > 0 ? 'Crítico' : open > 0 || noAgenda || stableLow > 0 ? 'Atenção' : 'Saudável';
    const motives = [
      overdue > 0 && plural(overdue, 'ação atrasada', 'ações atrasadas'),
      blocked > 0 && plural(blocked, 'ação travada', 'ações travadas'),
      worsening > 0 && plural(worsening, 'dimensão piorando', 'dimensões piorando'),
      open > 0 && plural(open, 'ação aberta', 'ações abertas'),
      noAgenda && 'sem próxima pauta',
      stableLow > 0 && plural(stableLow, 'dimensão estável com score baixo', 'dimensões estáveis com score baixo'),
    ].filter(Boolean) as string[];
    const nextBestAction = blocked > 0
      ? 'Destravar ação bloqueada'
      : overdue > 0
      ? 'Re pactuar prazo crítico'
      : worsening > 0
      ? 'Revisar evolução por dimensão'
      : noAgenda
      ? 'Definir pauta do próximo encontro'
      : open > 0
      ? 'Acompanhar execução aberta'
      : 'Manter cadência de acompanhamento';
    const weight = blocked * 500 + overdue * 400 + worsening * 300 + (noAgenda ? 120 : 0) + stableLow * 80 + open * 10;

    return { company, level, weight, reasons: { overdue, blocked, worsening, open, noAgenda, stableLow }, motives, nextBestAction };
  }).sort((a, b) => b.weight - a.weight || a.company.name.localeCompare(b.company.name)), [actionsByCompany, companies, latestMeetingByCompany, progressByCompany, todayKey]);

  const criticalActions = useMemo(() => actions
    .filter((action) => openStatuses.has(action.status))
    .sort((a, b) => {
      const score = (item: CouncilAction) => {
        if (item.status === 'blocked') return 400;
        if (isOverdue(item, todayKey)) return 300;
        if (item.priority === 'high') return 200;
        if (item.impact === 'high' && item.effort === 'low') return 100;
        return 0;
      };
      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;
      const ad = a.due_date || '9999-12-31';
      const bd = b.due_date || '9999-12-31';
      return ad.localeCompare(bd);
    }), [actions, todayKey]);

  const actionGroups = useMemo(() => [
    { label: 'Travadas', count: criticalActions.filter((action) => action.status === 'blocked').length, tone: 'critical' as KpiTone },
    { label: 'Atrasadas', count: criticalActions.filter((action) => isOverdue(action, todayKey)).length, tone: 'critical' as KpiTone },
    { label: 'Alta prioridade', count: criticalActions.filter((action) => action.priority === 'high').length, tone: 'attention' as KpiTone },
    { label: 'Quick wins', count: criticalActions.filter((action) => action.impact === 'high' && action.effort === 'low').length, tone: 'healthy' as KpiTone },
  ], [criticalActions, todayKey]);

  const nextRecommendedAction = useMemo<Recommendation | null>(() => {
    const companyName = (id: string) => companyNameById.get(id) || '—';
    const byPriority = [...actions].sort((a, b) => {
      const ad = a.due_date || '9999-12-31';
      const bd = b.due_date || '9999-12-31';
      return ad.localeCompare(bd);
    });
    const blockedHigh = byPriority.find((action) => openStatuses.has(action.status) && action.status === 'blocked' && action.priority === 'high');
    if (blockedHigh) {
      return {
        title: blockedHigh.title,
        company: companyName(blockedHigh.company_id),
        reason: 'Ação travada com alta prioridade.',
        meta: `Status: ${statusLabel[blockedHigh.status]} · Prazo: ${formatDate(blockedHigh.due_date)}`,
        cta: `/app/startups/${blockedHigh.company_id}/counselor`,
        ctaText: 'Abrir Central',
      };
    }
    const overdueImpact = byPriority.find((action) => openStatuses.has(action.status) && isOverdue(action, todayKey) && action.impact === 'high');
    if (overdueImpact) {
      return {
        title: overdueImpact.title,
        company: companyName(overdueImpact.company_id),
        reason: 'Ação atrasada com alto impacto.',
        meta: `Prazo: ${formatDate(overdueImpact.due_date)} · Prioridade: ${priorityLabel[overdueImpact.priority] || overdueImpact.priority}`,
        cta: `/app/startups/${overdueImpact.company_id}/counselor`,
        ctaText: 'Abrir Central',
      };
    }
    const worsening = companyPriorities.find((row) => row.reasons.worsening > 0);
    if (worsening) {
      return {
        title: `Revisar evolução das dimensões de ${worsening.company.name}`,
        company: worsening.company.name,
        reason: plural(worsening.reasons.worsening, 'dimensão em piora', 'dimensões em piora'),
        meta: 'Sinal vindo do progresso por dimensão registrado nos encontros.',
        cta: `/app/startups/${worsening.company.id}/counselor`,
        ctaText: 'Abrir Central',
      };
    }
    const noAgenda = companyPriorities.find((row) => row.reasons.noAgenda);
    if (noAgenda) {
      const meeting = latestMeetingByCompany.get(noAgenda.company.id);
      return {
        title: `Definir próxima pauta de ${noAgenda.company.name}`,
        company: noAgenda.company.name,
        reason: 'Último encontro sem próxima pauta registrada.',
        meta: meeting ? `Última reunião: ${formatDate(meeting.meeting_date)}` : undefined,
        cta: meeting ? `/app/agenda/${meeting.id}` : `/app/startups/${noAgenda.company.id}/counselor`,
        ctaText: meeting ? 'Abrir encontro' : 'Abrir Central',
      };
    }
    const quickWin = byPriority.find((action) => openStatuses.has(action.status) && action.impact === 'high' && action.effort === 'low');
    if (quickWin) {
      return {
        title: quickWin.title,
        company: companyName(quickWin.company_id),
        reason: 'Ação aberta de alto impacto e baixo esforço.',
        meta: `Prazo: ${formatDate(quickWin.due_date)} · Status: ${statusLabel[quickWin.status] || quickWin.status}`,
        cta: `/app/startups/${quickWin.company_id}/counselor`,
        ctaText: 'Abrir Central',
      };
    }
    return null;
  }, [actions, companyNameById, companyPriorities, latestMeetingByCompany, todayKey]);

  const meetingPreparation = useMemo(() => companies.map((company) => {
    const lastMeeting = latestMeetingByCompany.get(company.id);
    const companyActions = actionsByCompany.get(company.id) || [];
    const companyProgress = progressByCompany.get(company.id) || [];
    const criticalCount = companyActions.filter((action) => action.status === 'blocked' || isOverdue(action, todayKey) || action.priority === 'high').length;
    const dimensionsCount = companyProgress.filter((item) => item.trend === 'worsening' || (item.trend === 'stable' && (item.current_perceived_score ?? 999) <= 2.5)).length;
    const hasRecentDecisions = !!(lastMeeting?.decisions || lastMeeting?.recommendations);
    return { company, lastMeeting, criticalCount, dimensionsCount, hasRecentDecisions };
  }).sort((a, b) => {
    const aNeedsAgenda = a.lastMeeting && !a.lastMeeting.next_agenda ? 1 : 0;
    const bNeedsAgenda = b.lastMeeting && !b.lastMeeting.next_agenda ? 1 : 0;
    return bNeedsAgenda - aNeedsAgenda || b.criticalCount - a.criticalCount;
  }), [actionsByCompany, companies, latestMeetingByCompany, progressByCompany, todayKey]);

  const focusHeatmap = useMemo(() => officialDimensions.map((dimension) => {
    const rows = latestProgressByCompanyAndDimension.filter((item) => item.dimension_id === dimension.code);
    const worsening = rows.filter((item) => item.trend === 'worsening');
    const stableLow = rows.filter((item) => item.trend === 'stable' && (item.current_perceived_score ?? 999) <= 2.5);
    const improving = rows.filter((item) => item.trend === 'improving');
    const affectedCompanies = new Set([...worsening, ...stableLow].map((item) => item.company_id));
    const predominantTrend = worsening.length >= stableLow.length && worsening.length >= improving.length && worsening.length > 0
      ? 'Piorando'
      : stableLow.length >= improving.length && stableLow.length > 0
      ? 'Estável baixo'
      : improving.length > 0
      ? 'Melhorando'
      : 'Sem sinal';
    const status = worsening.length > 0 ? 'piorando' : stableLow.length > 0 ? 'estável baixo' : improving.length > 0 ? 'melhorando' : 'sem sinal';

    return { ...dimension, affected: affectedCompanies.size, predominantTrend, status };
  }), [latestProgressByCompanyAndDimension]);

  if (loading) {
    return (
      <Card className="executive-panel rounded-3xl">
        <CardContent className="py-16 text-center text-muted-foreground">Carregando cockpit do conselheiro...</CardContent>
      </Card>
    );
  }

  const riskKpis = [
    { label: 'Ações atrasadas', sublabel: 'fora do prazo combinado', value: kpis.overdue, tone: kpis.overdue > 0 ? 'critical' : 'neutral', icon: AlertTriangle },
    { label: 'Ações travadas', sublabel: 'aguardando desbloqueio', value: kpis.blocked, tone: kpis.blocked > 0 ? 'critical' : 'neutral', icon: ShieldAlert },
    { label: 'Dimensões em atenção', sublabel: 'piorando ou estáveis com score baixo', value: kpis.inAttention, tone: kpis.inAttention > 0 ? 'attention' : 'neutral', icon: TrendingDown },
    { label: 'Sem próxima pauta', sublabel: 'encontros sem agenda definida', value: kpis.noAgenda, tone: kpis.noAgenda > 0 ? 'attention' : 'neutral', icon: CalendarClock },
  ] as const;

  const operationalKpis = [
    { label: 'Organizações acompanhadas', sublabel: 'em conselho', value: companies.length, tone: 'neutral', icon: Building2 },
    { label: 'Ações abertas', sublabel: 'em execução ou planejadas', value: kpis.open, tone: kpis.open > 0 ? 'attention' : 'neutral', icon: ListChecks },
  ] as const;

  const portfolioTone = companyStatusTone(portfolioStatus.level);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent p-7 sm:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-3 max-w-3xl">
            <span className="executive-pill inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              <Sparkles className="h-3 w-3" /> Cockpit do Conselheiro
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Central do Conselheiro</h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Priorize riscos, prepare os próximos encontros e acompanhe a execução das organizações em conselho.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-background/65 p-4 shadow-sm min-w-[280px]">
            <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground font-semibold">Status geral do portfólio</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${portfolioTone.dot}`} />
              <Badge className={`${portfolioTone.pill}`}>{portfolioStatus.level}</Badge>
            </div>
            <p className="text-xs mt-2 text-muted-foreground leading-relaxed">{portfolioStatus.summary}</p>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Button asChild size="sm" className="rounded-full">
            <Link to="/app/agenda">
              <CalendarClock className="h-4 w-4 mr-2" /> Abrir agenda
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full bg-background/60">
            <Link to="/app/startups">
              <Building2 className="h-4 w-4 mr-2" /> Organizações
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">
          <p className="executive-section-title text-xs">KPIs de risco</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {riskKpis.map((card) => {
              const tone = toneStyles[card.tone as KpiTone];
              return (
                <Card key={card.label} className="executive-card rounded-2xl transition-all duration-300 hover:-translate-y-0.5">
                  <CardContent className="p-5">
                    <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone.wrap} ${tone.text}`}>
                      <card.icon className="h-4.5 w-4.5" />
                    </div>
                    <p className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">{card.value}</p>
                    <p className="mt-1 text-[11px] tracking-[0.14em] font-semibold text-muted-foreground uppercase">{card.label}</p>
                    <p className="text-xs text-muted-foreground/80 leading-relaxed mt-0.5">{card.sublabel}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <p className="executive-section-title text-xs">KPIs operacionais</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {operationalKpis.map((card) => {
              const tone = toneStyles[card.tone as KpiTone];
              return (
                <Card key={card.label} className="executive-card rounded-2xl transition-all duration-300 hover:-translate-y-0.5">
                  <CardContent className="p-5">
                    <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone.wrap} ${tone.text}`}>
                      <card.icon className="h-4.5 w-4.5" />
                    </div>
                    <p className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">{card.value}</p>
                    <p className="mt-1 text-[11px] tracking-[0.14em] font-semibold text-muted-foreground uppercase">{card.label}</p>
                    <p className="text-xs text-muted-foreground/80 leading-relaxed mt-0.5">{card.sublabel}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="executive-panel rounded-3xl border-primary/30 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <CardContent className="p-6 sm:p-7 relative">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 text-primary shrink-0">
                <Gauge className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="executive-section-title text-xs">Próxima ação recomendada</p>
                {nextRecommendedAction ? (
                  <div className="mt-2 space-y-3">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-foreground">{nextRecommendedAction.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{nextRecommendedAction.company} · {nextRecommendedAction.reason}</p>
                      {nextRecommendedAction.meta && <p className="text-xs text-muted-foreground/80 mt-1">{nextRecommendedAction.meta}</p>}
                    </div>
                    <Button asChild className="rounded-full">
                      <Link to={nextRecommendedAction.cta}>
                        {nextRecommendedAction.ctaText} <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Nenhuma ação crítica no momento.</p>
                    <p className="text-xs text-muted-foreground mt-1">Use a agenda para manter a cadência e registrar evolução por dimensão.</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="executive-panel rounded-3xl border-primary/20 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <CardContent className="p-6 sm:p-7 relative">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 text-primary shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight">Assistente de Ata do Conselho</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Transforme transcrições em pré-atas revisáveis, ações e evolução por dimensão.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild className="rounded-full">
                    <Link to="/app/agenda">Criar encontro a partir de transcrição</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full bg-background/60">
                    <Link to="/app/agenda">Ver Agenda de Evolução</Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="executive-panel rounded-3xl">
        <CardContent className="p-6 sm:p-7 space-y-5">
          <header className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Top prioridades do conselheiro
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Ranking operacional por organização para decidir onde entrar primeiro.</p>
            </div>
            <span className="executive-pill inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {companies.length} organizações
            </span>
          </header>

          {companies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
              <p className="text-sm font-semibold text-foreground">Nenhuma organização cadastrada.</p>
              <p className="text-xs text-muted-foreground mt-1">Cadastre uma organização para iniciar o acompanhamento do conselho.</p>
              <Button asChild size="sm" className="mt-4 rounded-full"><Link to="/app/startups">Cadastrar organização</Link></Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {companyPriorities.map((row) => {
                const tone = companyStatusTone(row.level);
                return (
                  <div
                    key={row.company.id}
                    className={`group relative rounded-2xl border border-white/10 ${tone.border} border-l-4 bg-white/[0.03] p-4 sm:p-5 hover:bg-white/[0.06] transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                          <p className="font-semibold text-foreground truncate">{row.company.name}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${tone.pill}`}>{row.level}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          {row.motives.length ? row.motives.slice(0, 3).join(' · ') : 'Sem alertas críticos ou relevantes.'}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="ghost" className="rounded-full shrink-0 hover:bg-primary/10 hover:text-primary">
                        <Link to={`/app/startups/${row.company.id}/counselor`}>
                          Abrir Central <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                    <div className="mt-3 rounded-xl border border-border/50 bg-background/45 px-3 py-2 text-xs text-foreground/90">
                      <span className="font-semibold">Próxima melhor ação: </span>{row.nextBestAction}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="executive-panel rounded-3xl">
          <CardContent className="p-6 sm:p-7 space-y-5">
            <header>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" /> Preparação da próxima reunião
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Pautas, lacunas e pontos de revisão por organização.</p>
            </header>

            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {companies.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                  Cadastre organizações e registre encontros para montar a preparação da próxima reunião.
                </div>
              ) : meetingPreparation.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                  Nenhuma reunião registrada. Crie um encontro na Agenda de Evolução para iniciar a cadência.
                </div>
              ) : meetingPreparation.map(({ company, lastMeeting, criticalCount, dimensionsCount, hasRecentDecisions }) => {
                const hasAgenda = !!lastMeeting?.next_agenda;
                const reviewPoints = [
                  `${criticalCount} ações críticas`,
                  `${dimensionsCount} dimensões em atenção`,
                  hasRecentDecisions ? 'decisões/recomendações recentes' : 'sem decisões recentes registradas',
                ];
                return (
                  <div key={company.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate">{company.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Última reunião: {formatDate(lastMeeting?.meeting_date)} · Tipo: {lastMeeting ? meetingTypeLabel[lastMeeting.meeting_type] || lastMeeting.meeting_type : '—'}
                        </p>
                      </div>
                      <Button asChild variant="ghost" size="sm" className="rounded-full shrink-0 -mr-2 hover:bg-primary/10 hover:text-primary">
                        <Link to={lastMeeting ? `/app/agenda/${lastMeeting.id}` : `/app/startups/${company.id}/counselor`}>
                          {lastMeeting ? 'Abrir encontro' : 'Abrir Central'} <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                    <div className={`mt-2.5 rounded-lg px-3 py-2 text-xs leading-relaxed ${hasAgenda ? 'bg-white/[0.04] border border-white/10 text-foreground/90' : 'bg-destructive/10 border border-destructive/20 text-destructive'}`}>
                      <span className="font-semibold">Próxima pauta: </span>{lastMeeting?.next_agenda || 'Não registrada — defina antes do próximo encontro.'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {reviewPoints.map((point) => (
                        <span key={point} className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">{point}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="executive-panel rounded-3xl">
          <CardContent className="p-6 sm:p-7 space-y-4">
            <header className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" /> Pendências críticas
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">Ordenadas por travadas, atrasadas, alta prioridade e quick wins.</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] font-bold text-foreground/80">
                  {criticalActions.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {actionGroups.map((group) => {
                  const tone = toneStyles[group.tone];
                  return (
                    <span key={group.label} className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${tone.pill}`}>
                      {group.label}: {group.count}
                    </span>
                  );
                })}
              </div>
            </header>
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {criticalActions.length === 0 ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 font-semibold">Sem ações críticas em aberto.</p>
                  <p className="text-xs text-muted-foreground mt-1">Mantenha a rotina de revisão para evitar novos bloqueios.</p>
                </div>
              ) : criticalActions.map((action) => {
                const companyName = companyNameById.get(action.company_id) || '—';
                const overdue = isOverdue(action, todayKey);
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
                      {companyName} · Responsável: {action.owner_name || 'Sem responsável'}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 text-[11px] flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${overdue ? 'bg-destructive/10 text-destructive' : 'bg-muted/40 text-muted-foreground'}`}>
                          <CalendarClock className="h-3 w-3" /> {formatDate(action.due_date)}
                        </span>
                        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-muted-foreground">{statusLabel[action.status] || action.status}</span>
                        {action.related_dimension ? <DimensionBadge code={action.related_dimension} /> : <span className="text-muted-foreground">Sem dimensão</span>}
                      </div>
                      <Button asChild size="sm" variant="ghost" className="rounded-full -mr-2 hover:bg-primary/10 hover:text-primary">
                        <Link to={`/app/startups/${action.company_id}/counselor`}>
                          Abrir Central <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
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

      <Card className="executive-panel rounded-3xl">
        <CardContent className="p-6 sm:p-7 space-y-5">
          <header className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" /> Mapa de foco do conselheiro
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Heatmap compacto das 9 dimensões oficiais; ausência de sinal não é tratada como problema.</p>
            </div>
            {progress.length === 0 && (
              <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">Registre evolução nos encontros para colorir o mapa.</span>
            )}
          </header>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-9">
            {focusHeatmap.map((dimension) => {
              const statusClass = dimension.status === 'piorando'
                ? 'border-destructive/35 bg-destructive/10 text-destructive'
                : dimension.status === 'estável baixo'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : dimension.status === 'melhorando'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-border/60 bg-muted/20 text-muted-foreground';
              return (
                <div key={dimension.code} title={dimension.label} className={`rounded-2xl border p-3 min-h-[118px] flex flex-col justify-between ${statusClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-black tracking-wide text-foreground">{dimension.code}</span>
                    {dimension.status === 'melhorando' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold tabular-nums text-foreground">{dimension.affected}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] font-semibold">orgs afetadas</p>
                    <p className="mt-1 text-[11px] font-medium capitalize">{dimension.status}</p>
                    <p className="text-[10px] text-muted-foreground">Tendência: {dimension.predominantTrend}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
