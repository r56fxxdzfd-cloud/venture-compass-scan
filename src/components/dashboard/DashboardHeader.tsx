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
    <div className="executive-hero rounded-2xl px-5 py-6 sm:px-7 sm:py-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3 max-w-3xl">
          <Badge variant="outline" className="executive-pill w-fit border-primary/35 bg-primary/10 text-primary">
            Painel executivo
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground/95">Conselho OS</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
              Governança, diagnóstico e evolução das organizações acompanhadas pela JV.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          {configVersion && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/app/admin/config">
                    <Badge variant="outline" className="executive-pill gap-1.5 text-[11px] font-medium cursor-pointer hover:bg-secondary/70 transition-colors">
                      <Settings2 className="h-3 w-3" />
                      Config ativa: {configVersion.name}
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
          <Button onClick={() => navigate('/app/startups')} size="sm" className="h-10 px-4 gap-1.5 font-medium shadow-md shadow-primary/20">
            <Plus className="h-4 w-4" />
            Novo Diagnóstico
          </Button>
        </div>
      </div>
    </div>
  );
}
