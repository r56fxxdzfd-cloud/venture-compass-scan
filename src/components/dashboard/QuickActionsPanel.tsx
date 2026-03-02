import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus, ClipboardList, SlidersHorizontal, BookOpen, Settings2, ChevronRight,
} from 'lucide-react';

const baseActions = [
  { label: 'Nova Startup', desc: 'Cadastrar empresa', icon: Plus, href: '/app/startups' },
  { label: 'Novo Diagnóstico', desc: 'Iniciar avaliação', icon: ClipboardList, href: '/app/startups' },
  { label: 'Simulador', desc: 'Testar cenários', icon: SlidersHorizontal, href: '/app/simulator' },
  { label: 'Metodologia', desc: 'Framework Darwin', icon: BookOpen, href: '/app/methodology' },
];

export default function QuickActionsPanel() {
  const { isAdmin } = useAuth();

  const actions = isAdmin
    ? [...baseActions, { label: 'Configuração', desc: 'Editar parâmetros', icon: Settings2, href: '/app/admin/config' }]
    : baseActions;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-semibold">Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-0.5">
        {actions.map((action) => (
          <Link key={action.label} to={action.href}>
            <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-muted group cursor-pointer">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/[0.08] text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                <action.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-tight">{action.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{action.desc}</p>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
