import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export const DIMENSION_LABEL_FALLBACK: Record<string, string> = {
  IC: 'Identidade & Cultura',
  PL: 'Pessoas & Liderança',
  GR: 'Governança & Riscos',
  EE: 'Estratégia & Execução',
  PM: 'Processos & Métricas',
  FS: 'Finanças & Sustentabilidade',
  MN: 'Modelo de Negócio',
  GT: 'Go-to-market & Tração',
  PT: 'Produto & Tecnologia',
};

type DimensionBadgeProps = {
  code: string;
  label?: string | null;
  size?: 'sm' | 'md';
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
};

export function getDimensionFullLabel(code: string, label?: string | null): string {
  const normalized = (code || '').trim();
  if (label?.trim()) return label.trim();
  return DIMENSION_LABEL_FALLBACK[normalized] || normalized;
}

export function DimensionBadge({ code, label, size = 'md', variant = 'outline', className }: DimensionBadgeProps) {
  const safeCode = (code || '').trim() || '—';
  const fullLabel = getDimensionFullLabel(safeCode, label);
  const ariaLabel = `Dimensão: ${fullLabel}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className={cn('executive-pill', size === 'sm' && 'text-xs px-2 py-0.5', className)}
            aria-label={ariaLabel}
            title={fullLabel}
          >
            {safeCode}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{fullLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
