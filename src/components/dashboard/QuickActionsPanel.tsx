import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ClipboardList, SlidersHorizontal, BookOpen, Settings2, ChevronRight, UserCheck } from 'lucide-react';

const baseActions = [
  { label: 'Nova Startup', desc: 'Cadastrar nova organização no portfólio', icon: Plus, href: '/app/startups' },
  { label: 'Novo Diagnóstico', desc: 'Iniciar coleta para leitura de maturidade', icon: ClipboardList, href: '/app/startups' },
  { label: 'Avaliação de Founder', desc: 'Registrar evolução semestral de liderança', icon: UserCheck, href: '/app/founder-assessments/new' },
  { label: 'Simulador', desc: 'Projetar cenários de desenvolvimento', icon: SlidersHorizontal, href: '/app/simulator' },
  { label: 'Metodologia', desc: 'Consultar framework e critérios Darwin', icon: BookOpen, href: '/app/methodology' },
];

export default function QuickActionsPanel() {
  const { isAdmin } = useAuth();
  const actions = isAdmin ? [...baseActions, { label: 'Configuração', desc: 'Ajustar parâmetros e versão ativa', icon: Settings2, href: '/app/admin/config' }] : baseActions;

  return (
    <Card className="executive-panel h-full">
      <CardHeader className="pb-3 pt-5 px-5 border-b border-border/60">
        <CardTitle className="executive-section-title text-base">Ações Estratégicas</CardTitle>
        <p className="text-xs text-muted-foreground">Acesso rápido aos fluxos mais recorrentes do conselho.</p>
      </CardHeader>
      <CardContent className="px-4 py-4 space-y-2">
        {actions.map((action) => (
          <Link key={action.label} to={action.href}>
            <div className="executive-card px-3 py-3 flex items-center gap-3 group hover:border-primary/40 transition-all">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                <action.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{action.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-1">{action.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
