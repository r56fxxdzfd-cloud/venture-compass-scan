import { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { CouncilDimensionProgress } from '@/types/council';

type DimensionOption = { id: string; label: string };

interface DimensionEvolutionRadarProps {
  dimensions: DimensionOption[];
  progressRecords: CouncilDimensionProgress[];
  baseline?: Record<string, number | null | undefined>;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

const trendLabel: Record<string, string> = {
  improving: 'Melhorando',
  stable: 'Estável',
  worsening: 'Piorando',
  insufficient_evidence: 'Sem evidência suficiente',
};

const DIMENSION_AXIS_LABELS: Record<string, string> = {
  IC: 'IC',
  PL: 'PL',
  GR: 'GR',
  EE: 'EE',
  PM: 'PM',
  FS: 'FS',
  MN: 'MN',
  GT: 'GT',
  PT: 'PT',
};

function axisLabelFromDimension(label: string): string {
  const match = label.match(/\(([^)]+)\)\s*$/);
  if (match?.[1]) return match[1].toUpperCase();

  const initials = label
    .split(/[\s&/-]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase())
    .join('');

  return DIMENSION_AXIS_LABELS[initials] || initials.slice(0, 2) || label.slice(0, 2).toUpperCase();
}

const toNum = (value: number | null | undefined): number | null => (typeof value === 'number' ? value : null);

export function DimensionEvolutionRadar({ dimensions, progressRecords, baseline, title, subtitle, compact = false }: DimensionEvolutionRadarProps) {
  const isPrintMode = typeof window !== 'undefined' && window.matchMedia?.('print')?.matches;
  const radarRows = useMemo(() => {
    const byDimension = new Map<string, CouncilDimensionProgress[]>();
    for (const row of progressRecords) {
      const bucket = byDimension.get(row.dimension_id) || [];
      bucket.push(row);
      byDimension.set(row.dimension_id, bucket);
    }

    return dimensions.map((dimension) => {
      const rows = (byDimension.get(dimension.id) || []).slice().sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return aTime - bTime;
      });

      const oldestWithInitial = rows.find((r) => toNum(r.initial_score) !== null);
      const latest = rows.length ? rows[rows.length - 1] : null;

      const baselineScore = toNum(oldestWithInitial?.initial_score)
        ?? toNum(baseline?.[dimension.id])
        ?? null;
      const currentScore = toNum(latest?.current_perceived_score) ?? null;
      const variation = baselineScore !== null && currentScore !== null ? currentScore - baselineScore : null;

      return {
        dimensionId: dimension.id,
        fullLabel: dimension.label,
        shortLabel: axisLabelFromDimension(dimension.label),
        baselineScore,
        currentScore,
        variation,
        trend: latest?.trend,
        hasAnyData: baselineScore !== null || currentScore !== null,
        baselineValue: baselineScore ?? 0,
        currentValue: currentScore ?? 0,
      };
    });
  }, [dimensions, progressRecords, baseline]);

  const hasEnoughData = radarRows.some((row) => row.baselineScore !== null && row.currentScore !== null);

  if (!hasEnoughData) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground print-safe">
        Ainda não há leituras suficientes para gerar o radar de evolução. Registre evolução por dimensão nos encontros de conselho.
      </div>
    );
  }

  return (
    <div className="space-y-3 print-safe">
      {(title || subtitle) && (
        <div className="space-y-1">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      <div className="radar-chart-container print-safe">
        <ResponsiveContainer width="100%" height={compact ? 280 : 340} minHeight={compact ? 240 : 280}>
          <RadarChart data={radarRows} cx="50%" cy="50%" outerRadius={compact ? '58%' : '64%'}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="shortLabel" tick={{ fill: 'hsl(var(--foreground))', fontSize: compact ? 10 : 11, fontWeight: 500 }} />
            <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickCount={6} />
            <Radar name="Baseline inicial" dataKey="baselineValue" stroke="hsl(var(--chart-benchmark))" fill="hsl(var(--chart-benchmark))" fillOpacity={0.12} strokeWidth={2.5} strokeDasharray="7 3" />
            <Radar name="Última leitura do conselho" dataKey="currentValue" stroke="hsl(var(--chart-current))" fill="hsl(var(--chart-current))" fillOpacity={0.2} strokeWidth={2.5} />
            {!isPrintMode && <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const item = payload[0]?.payload;
                const fmt = (v: number | null) => (v === null ? 'sem dados' : v.toFixed(1));
                const variationText = item?.variation === null ? 'sem dados' : `${item.variation > 0 ? '+' : ''}${item.variation.toFixed(1)}`;
                return (
                  <div className="rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md space-y-1">
                    <p className="font-semibold text-sm">{item?.fullLabel}</p>
                    <p>Baseline inicial: <strong>{fmt(item?.baselineScore ?? null)}</strong></p>
                    <p>Última leitura: <strong>{fmt(item?.currentScore ?? null)}</strong></p>
                    <p>Variação: <strong>{variationText}</strong></p>
                    <p>Tendência: <strong>{item?.trend ? trendLabel[item.trend] || item.trend : 'sem dados'}</strong></p>
                  </div>
                );
              }}
            />}
            <Legend formatter={(value) => <span className="text-xs sm:text-sm">{value}</span>} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <p><strong>IC</strong> — Identidade & Cultura</p>
        <p><strong>PL</strong> — Pessoas & Liderança</p>
        <p><strong>GR</strong> — Governança & Riscos</p>
        <p><strong>EE</strong> — Estratégia & Execução</p>
        <p><strong>PM</strong> — Processos & Métricas</p>
        <p><strong>FS</strong> — Finanças & Sustentabilidade</p>
        <p><strong>MN</strong> — Modelo de Negócio</p>
        <p><strong>GT</strong> — Go-to-market & Tração</p>
        <p><strong>PT</strong> — Produto & Tecnologia</p>
      </div>
    </div>
  );
}
