import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2, ClipboardList, TrendingUp, ArrowRight, Inbox,
  Plus, SlidersHorizontal, BookOpen, Percent, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { motion, animate } from 'framer-motion';

interface RecentAssessment {
  id: string;
  created_at: string;
  stage: string | null;
  status: string | null;
  company: { name: string } | null;
}

const stageLabels: Record<string, string> = { pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A' };

export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ companies: 0, assessments: 0, completed: 0 });
  const [recentAssessments, setRecentAssessments] = useState<RecentAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [configVersion, setConfigVersion] = useState<{ name: string; publishedAt: string } | null>(null);
  const [assessmentScores, setAssessmentScores] = useState<Record<string, number | null>>({});
  const [assessmentProgress, setAssessmentProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      const [companies, assessments, completed, recent, config] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('assessments').select('id', { count: 'exact', head: true }),
        supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('assessments').select('id, created_at, stage, status, company:companies(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('config_versions').select('version_name, published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(1),
      ]);
      setStats({
        companies: companies.count || 0,
        assessments: assessments.count || 0,
        completed: completed.count || 0,
      });
      if (recent.data) {
        const recentData = recent.data as unknown as RecentAssessment[];
        setRecentAssessments(recentData);

        // Fetch scores for completed assessments and progress for in-progress
        const completedIds = recentData.filter(a => a.status === 'completed').map(a => a.id);
        const inProgressIds = recentData.filter(a => a.status !== 'completed').map(a => a.id);

        if (completedIds.length > 0) {
          const { data: answers } = await supabase
            .from('answers')
            .select('assessment_id, value, is_na')
            .in('assessment_id', completedIds);
          if (answers) {
            const scoreMap: Record<string, number | null> = {};
            for (const id of completedIds) {
              const aAnswers = answers.filter(a => a.assessment_id === id && !a.is_na && a.value != null);
              if (aAnswers.length > 0) {
                const avg = aAnswers.reduce((s, a) => s + (a.value || 0), 0) / aAnswers.length;
                scoreMap[id] = Math.round((avg / 5) * 100);
              }
            }
            setAssessmentScores(scoreMap);
          }
        }

        if (inProgressIds.length > 0) {
          const { data: answers } = await supabase
            .from('answers')
            .select('assessment_id')
            .in('assessment_id', inProgressIds);
          if (answers) {
            const progressMap: Record<string, number> = {};
            for (const id of inProgressIds) {
              progressMap[id] = answers.filter(a => a.assessment_id === id).length;
            }
            setAssessmentProgress(progressMap);
          }
        }
      }
      if (config.data && config.data.length > 0) {
        setConfigVersion({
          name: (config.data[0] as any).version_name,
          publishedAt: (config.data[0] as any).published_at,
        });
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const coverage = stats.assessments > 0 ? Math.round((stats.completed / stats.assessments) * 100) : 0;

  const statCards = [
    {
      label: 'Startups', sublabel: 'no programa', value: stats.companies,
      icon: Building2, href: '/app/startups', suffix: undefined,
      border: 'border-l-primary', bg: 'bg-primary/[0.06]',
      iconBg: 'bg-primary/[0.12]', iconColor: 'text-primary',
    },
    {
      label: 'Diagnósticos', sublabel: 'criados', value: stats.assessments,
      icon: ClipboardList, href: '/app/startups', suffix: undefined,
      border: 'border-l-accent', bg: 'bg-accent/[0.06]',
      iconBg: 'bg-accent/[0.12]', iconColor: 'text-accent',
    },
    {
      label: 'Finalizados', sublabel: 'com relatório gerado', value: stats.completed,
      icon: TrendingUp, href: '/app/startups', suffix: undefined,
      border: 'border-l-success', bg: 'bg-success/[0.06]',
      iconBg: 'bg-success/[0.12]', iconColor: 'text-success',
    },
    {
      label: 'Cobertura Média', sublabel: 'dos diagnósticos', value: coverage,
      icon: Percent, href: '/app/startups', suffix: '%',
      border: 'border-l-purple-400', bg: 'bg-purple-400/[0.06]',
      iconBg: 'bg-purple-400/[0.12]', iconColor: 'text-purple-400',
    },
  ];

  const quickActions = [
    { label: 'Nova Startup', icon: Plus, href: '/app/startups', desc: 'Cadastrar empresa' },
    { label: 'Simulador', icon: SlidersHorizontal, href: '/app/simulator', desc: 'Testar cenários' },
    { label: 'Metodologia', icon: BookOpen, href: '/app/methodology', desc: 'Framework Darwin' },
  ];

  const getScoreColor = (score: number) => {
    if (score < 35) return 'bg-destructive text-destructive-foreground';
    if (score < 55) return 'bg-accent text-accent-foreground';
    if (score < 75) return 'bg-primary text-primary-foreground';
    return 'bg-success text-success-foreground';
  };

  return (
    <div className="space-y-6 relative">
      {/* Subtle radial gradient background */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_60%_50%_at_85%_10%,hsl(var(--primary)/0.04),transparent_70%)]" />

      {/* 1 — Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between relative z-10"
      >
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Olá, {profile?.full_name || 'Usuário'}
          </h1>
          <p className="text-muted-foreground text-sm">
            CMJ/Darwin — Startup Readiness Diagnostic
          </p>
          {configVersion && (
            <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5 pt-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              Config ativa: {configVersion.name}
              {configVersion.publishedAt && ` · Publicada em ${new Date(configVersion.publishedAt).toLocaleDateString('pt-BR')}`}
            </p>
          )}
        </div>
        <Button onClick={() => navigate('/app/startups')} className="gap-2 shrink-0 self-start">
          <Plus className="h-4 w-4" />
          Novo Diagnóstico
        </Button>
      </motion.div>

      {/* 2 — Metric Cards */}
      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 relative z-10">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="rounded-xl">
              <CardContent className="flex items-center gap-4 pt-6">
                <Skeleton className="h-11 w-11 rounded-lg" />
                <div className="space-y-2"><Skeleton className="h-7 w-14" /><Skeleton className="h-3 w-24" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 relative z-10">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              <Link to={card.href}>
                <Card className={`rounded-xl border-l-[3px] cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 group ${card.border} ${card.bg}`}>
                  <CardContent className="flex items-center gap-4 pt-6 pb-5">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-lg shrink-0 transition-transform duration-200 group-hover:scale-110 ${card.iconBg} ${card.iconColor}`}>
                      <card.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-0.5">
                        <AnimatedCounter value={card.value} />
                        {card.suffix && <span className="text-lg font-bold text-foreground">{card.suffix}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{card.sublabel}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* 3 — Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="relative z-10"
      >
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Atividade Recente</CardTitle>
              {recentAssessments.length > 0 && (
                <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground gap-1">
                  <Link to="/app/startups">Ver todos <ChevronRight className="h-3 w-3" /></Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4" />
                      <div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recentAssessments.length === 0 ? (
              <div className="text-center py-10">
                <Inbox className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Nenhum diagnóstico criado ainda.</p>
                <Button asChild size="sm">
                  <Link to="/app/startups">Cadastre uma startup e crie o primeiro diagnóstico</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentAssessments.map((a, i) => {
                  const isCompleted = a.status === 'completed';
                  const score = assessmentScores[a.id];
                  const answered = assessmentProgress[a.id] || 0;
                  const totalQuestions = 45;
                  const progressPct = Math.min(Math.round((answered / totalQuestions) * 100), 100);

                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + i * 0.06, duration: 0.3 }}
                    >
                      <Link
                        to={isCompleted ? `/app/assessments/${a.id}/report` : `/app/assessments/${a.id}/questionnaire`}
                        className="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${isCompleted ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                            <ClipboardList className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate">{a.company?.name || 'Startup'}</p>
                              {a.stage && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal border-muted-foreground/20">
                                  {stageLabels[a.stage] || a.stage}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {isCompleted ? (
                            <>
                              {score != null && (
                                <Badge className={`text-xs font-bold px-2 ${getScoreColor(score)}`}>
                                  {score}/100
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground hidden sm:inline group-hover:text-primary transition-colors">
                                Ver relatório
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="hidden sm:flex items-center gap-2 min-w-[120px]">
                                <Progress value={progressPct} className="h-1.5 flex-1" />
                                <span className="text-[10px] text-muted-foreground w-8 text-right">{answered}/45</span>
                              </div>
                              <span className="text-xs text-muted-foreground hidden sm:inline group-hover:text-primary transition-colors">
                                Continuar
                              </span>
                            </>
                          )}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 4 — Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="relative z-10"
      >
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Ações Rápidas</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {quickActions.map((action, i) => (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 + i * 0.08, duration: 0.3 }}
            >
              <Link to={action.href}>
                <Card className="rounded-xl cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:scale-[1.02] group">
                  <CardContent className="flex items-center gap-4 py-5 px-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/[0.08] text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200 shrink-0">
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 ml-auto group-hover:text-primary transition-colors shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const controls = animate(0, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate(v) {
        node.textContent = Math.round(v).toString();
      },
    });

    return () => controls.stop();
  }, [value]);

  return <p ref={ref} className="text-2xl font-bold">0</p>;
}
