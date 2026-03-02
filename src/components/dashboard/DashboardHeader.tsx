import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Settings2 } from 'lucide-react';

interface DashboardHeaderProps {
  configVersion: { name: string; publishedAt: string; id?: string } | null;
}

interface ConfigStats {
  dimensions: number;
  questions: number;
  redFlags: number;
  presets: number;
}

export default function DashboardHeader({ configVersion }: DashboardHeaderProps) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ConfigStats | null>(null);

  useEffect(() => {
    if (!configVersion?.id) return;
    const fetchStats = async () => {
      const [dims, qs, rfs, presets] = await Promise.all([
        supabase.from('dimensions').select('id', { count: 'exact', head: true }).eq('config_version_id', configVersion.id!),
        supabase.from('questions').select('id', { count: 'exact', head: true }).eq('config_version_id', configVersion.id!).eq('is_active', true),
        supabase.from('red_flags').select('code', { count: 'exact', head: true }).eq('config_version_id', configVersion.id!),
        supabase.from('simulator_presets').select('id', { count: 'exact', head: true }).eq('config_version_id', configVersion.id!),
      ]);
      setStats({
        dimensions: dims.count || 0,
        questions: qs.count || 0,
        redFlags: rfs.count || 0,
        presets: presets.count || 0,
      });
    };
    fetchStats();
  }, [configVersion?.id]);

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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/app/admin/config">
                  <Badge
                    variant="outline"
                    className="gap-1.5 text-[11px] font-normal cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Settings2 className="h-3 w-3" />
                    Config: {configVersion.name}
                  </Badge>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs space-y-1 max-w-[220px]">
                <p className="font-medium">Config publicada: {configVersion.name}</p>
                {configVersion.publishedAt && (
                  <p className="text-muted-foreground">
                    Publicada em {new Date(configVersion.publishedAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
                {stats && (
                  <p className="text-muted-foreground">
                    {stats.dimensions} dimensões · {stats.questions} perguntas · {stats.redFlags} red flags · {stats.presets} presets
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Button onClick={() => navigate('/app/startups')} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Diagnóstico
        </Button>
      </div>
    </div>
  );
}
