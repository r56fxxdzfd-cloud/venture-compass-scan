import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ClipboardList, SlidersHorizontal, BookOpen, Settings } from 'lucide-react';

interface Props {
  isAdmin: boolean;
}

export default function DashboardQuickActions({ isAdmin }: Props) {
  const actions = [
    { label: 'Nova Startup', icon: Plus, href: '/app/startups', desc: 'Cadastrar empresa' },
    { label: 'Novo Diagnóstico', icon: ClipboardList, href: '/app/startups', desc: 'Iniciar avaliação' },
    { label: 'Simulador', icon: SlidersHorizontal, href: '/app/simulator', desc: 'Testar cenários' },
    { label: 'Metodologia', icon: BookOpen, href: '/app/methodology', desc: 'Framework Darwin' },
    ...(isAdmin ? [{ label: 'Configuração', icon: Settings, href: '/app/admin/config', desc: 'Editar config' }] : []),
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Ações rápidas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {actions.map(action => (
          <Link
            key={action.label}
            to={action.href}
            className="flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-muted group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground group-hover:bg-foreground group-hover:text-background transition-colors shrink-0">
              <action.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{action.label}</p>
              <p className="text-[11px] text-muted-foreground">{action.desc}</p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
