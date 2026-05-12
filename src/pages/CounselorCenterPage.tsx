import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CalendarClock,
  ListChecks,
  AlertTriangle,
  Activity,
  Target,
  ClipboardList,
  Sparkles,
  ArrowUpRight,
  ArrowLeft,
  FileText,
  Plus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { DimensionBadge } from '@/components/DimensionBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { CouncilAction, CouncilAgendaTemplate, CouncilDimensionProgress, CouncilMeeting } from '@/types/council';
import { BackToTopFooter } from '@/components/BackToTopFooter';
import { DimensionEvolutionRadar } from '@/components/DimensionEvolutionRadar';

type Company = { id: string; name: string };

const openStatuses = new Set(['not_started', 'in_progress', 'blocked']);
const statusLabel: Record<string, string> = { not_started: 'Não iniciada', in_progress: 'Em andamento', completed: 'Concluída', blocked: 'Travada', cancelled: 'Cancelada' };
const trendLabel: Record<string, string> = { improving: 'Melhorando', stable: 'Estável', worsening: 'Piorando', insufficient_evidence: 'Sem evidência' };
const priorityLabel: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };

type KpiTone = 'neutral' | 'amber' | 'red';
const toneStyles: Record<KpiTone, { wrap: string; text: string }> = {
  neutral: { wrap: 'bg-muted/40 border border-border/60', text: 'text-muted-foreground' },
  amber: { wrap: 'bg-amber-500/10 border border-amber-500/25', text: 'text-amber-300' },
  red: { wrap: 'bg-red-500/10 border border-red-500/30', text: 'text-red-300' },
};

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SectionHeader({ icon: Icon, iconClass, title, subtitle, trailing }: { icon: typeof Target; iconClass: string; title: string; subtitle?: string; trailing?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClass}`} /> {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {trailing}
    </header>
  );
}

export default function CounselorCenterPage() {
  const { id } = useParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [meetings, setMeetings] = useState<CouncilMeeting[]>([]);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [progress, setProgress] = useState<CouncilDimensionProgress[]>([]);
  const [templates, setTemplates] = useState<CouncilAgendaTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const [c, m, a, p, t] = await Promise.all([
        supabase.from('companies').select('id,name').eq('id', id).single(),
        supabase.from('council_meetings').select('*').eq('company_id', id).order('meeting_date', { ascending: false }),
        supabase.from('council_actions').select('*').eq('company_id', id),
        supabase.from('council_dimension_progress').select('*').eq('company_id', id).order('updated_at', { ascending: false }),
        supabase.from('council_agenda_templates').select('*').eq('is_active', true).order('sort_order'),
      ]);
      if (c.data) setCompany(c.data as Company);
      if (m.data) setMeetings(m.data as CouncilMeeting[]);
      if (a.data) setActions(a.data as CouncilAction[]);
      if (p.data) setProgress(p.data as CouncilDimensionProgress[]);
      if (t.data) setTemplates(t.data as CouncilAgendaTemplate[]);
      setLoading(false);
    };
    load();
  }, [id]);

  const latestMeeting = meetings[0];
  const openActions = actions.filter(a => openStatuses.has(a.status));
  const overdueActions = actions.filter(a => a.due_date && new Date(a.due_date) < new Date() && !['completed', 'cancelled'].includes(a.status));
  const latestProgressByDimension = useMemo(() => {
    const map = new Map<string, CouncilDimensionProgress>();
    for (const row of progress) {
      if (!map.has(row.dimension_id)) map.set(row.dimension_id, row);
    }
    return Array.from(map.values());
  }, [progress]);

  const criticalDimensions = latestProgressByDimension.filter(d => d.trend === 'worsening' || (d.trend === 'stable' && (d.current_perceived_score ?? 999) <= 2.5));
  const lowStableDimensions = latestProgressByDimension.filter(d => d.trend === 'stable' && (d.current_perceived_score ?? 999) <= 2.5);
  const worseningDimensions = latestProgressByDimension.filter(d => d.trend === 'worsening');

  const relatedDimensionIds = useMemo(() => {
    const set = new Set<string>();
    (latestMeeting?.related_dimensions || []).forEach(d => set.add(d));
    latestProgressByDimension.forEach(p => set.add(p.dimension_id));
    worseningDimensions.forEach(p => set.add(p.dimension_id));
    lowStableDimensions.forEach(p => set.add(p.dimension_id));
    return set;
  }, [latestMeeting, latestProgressByDimension, worseningDimensions, lowStableDimensions]);

  const suggestedTemplates = templates.filter(t => relatedDimensionIds.has(t.dimension_id));
  const recentMeetings = meetings.slice(0, 3);

  if (loading) {
    return (
      <Card className="executive-panel rounded-3xl">
        <CardContent className="py-16 text-center text-muted-foreground">Carregando Central do Conselheiro...</CardContent>
      </Card>
    );
  }
  if (!company) {
    return (
      <Card className="executive-panel rounded-3xl">
        <CardContent className="py-16 text-center text-muted-foreground">Empresa não encontrada.</CardContent>
      </Card>
    );
  }

  const summaryKpis: Array<{ label: string; sublabel: string; value: number | string; tone: KpiTone; icon: typeof Target }> = [
    { label: 'Encontros realizados', sublabel: 'histórico de reuniões do conselho', value: meetings.length, tone: 'neutral', icon: CalendarClock },
    { label: 'Ações em aberto', sublabel: 'pendentes ou em execução', value: openActions.length, tone: 'neutral', icon: ListChecks },
    { label: 'Ações atrasadas', sublabel: 'fora do prazo combinado', value: overdueActions.length, tone: overdueActions.length ? 'red' : 'neutral', icon: AlertTriangle },
    { label: 'Dimensões críticas', sublabel: 'em piora ou estáveis em baixo score', value: criticalDimensions.length, tone: criticalDimensions.length ? 'amber' : 'neutral', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent p-7 sm:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              <Sparkles className="h-3 w-3" /> Central da organização
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">{company.name}</h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Visão executiva consolidada para preparar próximos encontros, acompanhar pendências e ler a evolução por dimensão.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link to="/app/agenda"><Plus className="h-4 w-4 mr-2" /> Novo encontro</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to={`/app/startups/${company.id}`}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar à organização</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* KPI Summary */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {summaryKpis.map((card) => {
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

      {!latestMeeting ? (
        <Card className="executive-panel rounded-3xl">
          <CardContent className="py-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/25 text-primary">
              <CalendarClock className="h-5 w-5" />
            </div>
            <p className="font-semibold text-base">Sem encontros registrados para esta empresa.</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Registre o primeiro encontro para iniciar o acompanhamento da organização e liberar a visão executiva do conselho.</p>
            <Button asChild className="rounded-full"><Link to="/app/agenda">Registrar primeiro encontro</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Antes da próxima reunião */}
          <Card className="executive-panel rounded-3xl print-safe">
            <CardContent className="p-6 sm:p-7 space-y-5">
              <SectionHeader
                icon={ClipboardList}
                iconClass="text-primary"
                title="Antes da próxima reunião"
                subtitle="Resumo executivo para preparar o encontro com base no histórico recente."
              />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Última reunião', value: formatDate(latestMeeting.meeting_date) },
                  { label: 'Próxima pauta', value: latestMeeting.next_agenda || 'Não registrada' },
                  { label: 'Decisões recentes', value: recentMeetings.map(m => m.decisions).filter(Boolean).join(' · ') || 'Sem decisões registradas' },
                  { label: 'Recomendações recentes', value: recentMeetings.map(m => m.recommendations).filter(Boolean).join(' · ') || 'Sem recomendações recentes' },
                  { label: 'Principais travas', value: recentMeetings.map(m => m.key_blockers).filter(Boolean).join(' · ') || 'Sem travas registradas' },
                  { label: 'Ações em aberto', value: String(openActions.length), strong: true },
                  { label: 'Ações atrasadas', value: String(overdueActions.length), strong: true },
                  { label: 'Dimensões críticas', value: String(criticalDimensions.length), strong: true },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] tracking-[0.14em] font-semibold text-muted-foreground uppercase">{item.label}</p>
                    {item.strong ? (
                      <p className="mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums text-foreground">{item.value}</p>
                    ) : (
                      <p className="mt-1.5 text-sm font-medium text-foreground/90 leading-relaxed">{item.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pauta sugerida */}
          <Card className="executive-panel rounded-3xl">
            <CardContent className="p-6 sm:p-7 space-y-5">
              <SectionHeader
                icon={Target}
                iconClass="text-muted-foreground"
                title="Pauta sugerida"
                subtitle="Templates de pauta relacionados às dimensões em foco."
              />
              <div className="space-y-3">
                {suggestedTemplates.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                    Nenhum template relacionado às dimensões atuais. Isso reduz a qualidade da preparação do encontro.{' '}
                    <Link to="/app/agenda/templates" className="text-foreground underline underline-offset-2">Consultar templates de pauta</Link>.
                  </div>
                ) : suggestedTemplates.map(t => (
                  <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <DimensionBadge code={t.dimension_id} label={t.dimension_label} />
                      <p className="font-semibold text-sm text-foreground">{t.title}</p>
                    </div>
                    <div className="grid gap-1.5 text-xs text-muted-foreground leading-relaxed">
                      <p><span className="font-semibold text-foreground/80">Objetivo:</span> {t.objective}</p>
                      <p><span className="font-semibold text-foreground/80">Perguntas-chave:</span> {t.key_questions.join(' · ') || '—'}</p>
                      <p><span className="font-semibold text-foreground/80">Evidências esperadas:</span> {t.expected_evidence.join(' · ') || '—'}</p>
                      <p><span className="font-semibold text-foreground/80">Ações sugeridas:</span> {t.suggested_actions.join(' · ') || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ações pendentes */}
          <Card className="executive-panel rounded-3xl">
            <CardContent className="p-6 sm:p-7 space-y-5">
              <SectionHeader
                icon={ListChecks}
                iconClass="text-muted-foreground"
                title="Ações pendentes"
                subtitle="Itens em execução, planejados ou travados."
                trailing={
                  <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] font-bold text-foreground/80">
                    {openActions.length}
                  </span>
                }
              />
              <div className="space-y-3">
                {openActions.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                    <p className="text-sm text-foreground font-medium">Nenhuma ação de conselho em aberto.</p>
                    <p className="text-xs text-muted-foreground mt-1">Mantenha o registro atualizado para sustentar a execução entre encontros.</p>
                  </div>
                ) : openActions.map(a => {
                  const overdue = a.due_date && new Date(a.due_date) < new Date();
                  const quickWin = a.impact === 'high' && a.effort === 'low';
                  const priorityTone = a.priority === 'high' ? 'bg-red-500/15 text-red-300 border-red-500/30' : a.priority === 'medium' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-muted/40 text-muted-foreground border-border/60';
                  return (
                    <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <p className="text-sm font-semibold text-foreground leading-snug">{a.title}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {overdue && <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border border-red-500/30 bg-red-500/15 text-red-300">Atrasada</span>}
                          {a.status === 'blocked' && <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border border-red-500/30 bg-red-500/15 text-red-300">Travada</span>}
                          {quickWin && <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border border-border/60 bg-muted/40 text-foreground/80">Quick win</span>}
                          <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border ${priorityTone}`}>{priorityLabel[a.priority] || a.priority}</span>
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {a.related_dimension && <DimensionBadge code={a.related_dimension} />}
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5"><CalendarClock className="h-3 w-3" /> {formatDate(a.due_date)}</span>
                        <span>· {a.owner_name || 'Sem responsável'}</span>
                        <span>· {statusLabel[a.status] || a.status}</span>
                        {a.impact && <span>· Impacto {a.impact}</span>}
                        {a.effort && <span>· Esforço {a.effort}</span>}
                      </div>
                      {a.expected_evidence && (
                        <p className="mt-2 text-xs text-muted-foreground/90 leading-relaxed">
                          <span className="font-semibold text-foreground/80">Evidência esperada:</span> {a.expected_evidence}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Radar */}
          <Card className="executive-panel rounded-3xl print-safe">
            <CardContent className="p-6 sm:p-7">
              <DimensionEvolutionRadar
                dimensions={latestProgressByDimension.map((item) => ({ id: item.dimension_id, label: item.dimension_label }))}
                progressRecords={progress}
                title="Radar de Evolução por Dimensão"
                subtitle="Comparação entre o baseline inicial e a última leitura registrada pelo conselho."
                compact
              />
            </CardContent>
          </Card>

          {/* Evolução recente */}
          <Card className="executive-panel rounded-3xl">
            <CardContent className="p-6 sm:p-7 space-y-5">
              <SectionHeader
                icon={Activity}
                iconClass="text-muted-foreground"
                title="Evolução recente por dimensão"
                subtitle="Última leitura registrada pelo conselho em cada dimensão."
              />
              <div className="space-y-3">
                {latestProgressByDimension.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Ainda não há leitura de evolução por dimensão. Registre a evolução das dimensões discutidas no encontro para orientar decisões.</p>
                ) : latestProgressByDimension.map(d => {
                  const trendTone = d.trend === 'worsening' ? 'bg-red-500/15 text-red-300 border-red-500/30' : d.trend === 'improving' ? 'bg-muted/40 text-foreground/80 border-border/60' : 'bg-muted/30 text-muted-foreground border-border/40';
                  return (
                    <div key={d.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors">
                      <div className="flex flex-wrap gap-2 items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <DimensionBadge code={d.dimension_id} label={d.dimension_label} />
                          <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border ${trendTone}`}>{trendLabel[d.trend] || d.trend}</span>
                        </div>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Score:</span>{' '}
                          <span className="font-extrabold tabular-nums text-foreground">{d.current_perceived_score ?? '—'}</span>
                        </p>
                      </div>
                      <div className="mt-2.5 grid gap-1.5 text-xs text-muted-foreground leading-relaxed">
                        <p><span className="font-semibold text-foreground/80">Evidência:</span> {d.evidence_note || '—'}</p>
                        <p><span className="font-semibold text-foreground/80">Comentário:</span> {d.counselor_comment || '—'}</p>
                        <p className="text-muted-foreground/70">Última atualização: {formatDate(d.updated_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Ações rápidas */}
      <Card className="executive-panel rounded-3xl border-primary/30 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <CardContent className="p-6 sm:p-7 relative">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 text-primary shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Ações rápidas</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Atalhos para registrar encontros, gerar relatórios e consultar templates.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:shrink-0">
              <Button asChild className="rounded-full"><Link to="/app/agenda"><Plus className="h-4 w-4 mr-2" />Novo encontro</Link></Button>
              <Button variant="outline" asChild className="rounded-full"><Link to={`/app/startups/${company.id}/progress`}>Relatório de Progresso <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Link></Button>
              <Button variant="outline" asChild className="rounded-full"><Link to="/app/agenda/templates">Templates de Pauta</Link></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <BackToTopFooter />
    </div>
  );
}
