import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings2 } from 'lucide-react';

interface DashboardHeaderProps {
  configVersion: { name: string; publishedAt: string } | null;
}

export default function DashboardHeader({ configVersion }: DashboardHeaderProps) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          CMJ/Darwin Startup Readiness
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão geral do programa
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {configVersion && (
          <Link to="/app/admin/config">
            <Badge
              variant="outline"
              className="gap-1.5 text-[11px] font-normal cursor-pointer hover:bg-muted transition-colors"
            >
              <Settings2 className="h-3 w-3" />
              {configVersion.name}
              {configVersion.publishedAt &&
                ` · ${new Date(configVersion.publishedAt).toLocaleDateString('pt-BR')}`}
            </Badge>
          </Link>
        )}
        <Button onClick={() => navigate('/app/startups')} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Diagnóstico
        </Button>
      </div>
    </div>
  );
}
