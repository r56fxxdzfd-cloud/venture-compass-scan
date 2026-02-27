import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ClipboardList, TrendingUp, ArrowRight, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

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
  const [stats, setStats] = useState({ companies: 0, assessments: 0, completed: 0 });
  const [recentAssessments, setRecentAssessments] = useState<RecentAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [companies, assessments, completed, recent] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('assessments').select('id', { count: 'exact', head: true }),
        supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('assessments').select('id, created_at, stage, status, company:companies(name)').order('created_at', { ascending: false }).limit(5),
      ]);
      setStats({
        companies: companies.count || 0,
        assessments: assessments.count || 0,
        completed: completed.count || 0,
      });
      if (recent.data) setRecentAssessments(recent.data as unknown as RecentAssessment[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const cards = [
    { label: 'Startups', value: stats.companies, icon: Building2, color: 'text-primary' },
    { label: 'Diagnósticos', value: stats.assessments, icon: ClipboardList, color: 'text-accent' },
    { label: 'Finalizados', value: stats.completed, icon: TrendingUp, color: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Olá, {profile?.full_name || 'Usuário'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo ao CMJ/ Darwin — Startup Readiness Diagnostic
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="flex items-center gap-4 pt-6">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2"><Skeleton className="h-6 w-16" /><Skeleton className="h-4 w-20" /></div>
            </CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-secondary ${card.color}`}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atividade Recente</CardTitle>
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
            <div className="text-center py-8">
              <Inbox className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Nenhum diagnóstico criado ainda.</p>
              <Button asChild size="sm">
                <Link to="/app/startups">Cadastre uma startup e crie o primeiro diagnóstico</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentAssessments.map((a) => (
                <Link
                  key={a.id}
                  to={a.status === 'completed' ? `/app/assessments/${a.id}/report` : `/app/assessments/${a.id}/questionnaire`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{a.company?.name || 'Startup'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString('pt-BR')}
                        {a.stage && ` • ${stageLabels[a.stage] || a.stage}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === 'completed' ? 'default' : 'secondary'}>
                      {a.status === 'completed' ? 'Concluído' : 'Em andamento'}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
