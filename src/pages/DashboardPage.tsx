import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ClipboardList, AlertTriangle, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ companies: 0, assessments: 0, completed: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [companies, assessments, completed] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('assessments').select('id', { count: 'exact', head: true }),
        supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      ]);
      setStats({
        companies: companies.count || 0,
        assessments: assessments.count || 0,
        completed: completed.count || 0,
      });
    };
    fetchStats();
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
          Olá, {profile?.full_name || 'Usuário'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo ao Darwin — Startup Readiness Diagnostic
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Início rápido</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Cadastre uma startup em <strong>Startups</strong></p>
          <p>2. Crie um novo diagnóstico para a startup</p>
          <p>3. Preencha o questionário (45 perguntas, 9 dimensões)</p>
          <p>4. Visualize o relatório interativo com radar e gaps</p>
          <p>5. Exporte o PDF para enviar ao cliente</p>
        </CardContent>
      </Card>
    </div>
  );
}
