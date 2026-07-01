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

const DIMENSION_AXIS_LABELS: Record<string, string> = { IC: 'IC', PL: 'PL', GR: 'GR', EE: 'EE', PM: 'PM', FS: 'FS', MN: 'MN', GT: 'GT', PT: 'PT' };

function axisLabelFromDimension(label: string): string {
  const match = label.match(/\(([^)]+)\)\s*$/);
  if (match?.[1]) return match[1].toUpperCase();

  const initials = label.split(/[\s&/-]+/).filter(Boolean).map((word) => word[0]?.toUpperCase()).join('');

  return DIMENSION_AXIS_LABELS[initials] || initials.slice(0, 2) || label.slice(0, 2).toUpperCase();
}

const toNum = (value: number | null | undefined): number | null => (typeof value === 'number' ? value : null);
const clampPct = (value: number | null) => (value === null ? 0 : Math.min(100, Math.max(0, (value / 5) * 100)));
const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(1));
const variationText = (variation: number | null) => (variation === null ? '—' : `${variation > 0 ? '+' : ''}${variation.toFixed(1)}`);

export function DimensionEvolutionRadar({ dimensions, progressRecords, baseline, title, subtitle, compact = false }: DimensionEvolutionRadarProps) {
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

      const baselineScore = toNum(oldestWithInitial?.initial_score) ?? toNum(baseline?.[dimension.id]) ?? null;
      const currentScore = toNum(latest?.current_perceived_score) ?? null;
      const variation = baselineScore !== null && currentScore !== null ? currentScore - baselineScore : null;

      const hasRecordedData = baselineScore !== null || currentScore !== null;

      return {
        dimensionId: dimension.id,
        fullLabel: dimension.label,
        shortLabel: axisLabelFromDimension(dimension.label),
        baselineScore,
        currentScore,
        variation,
        trend: latest?.trend,
        hasRecordedData,
        baselineValue: baselineScore,
        currentValue: currentScore,
      };
    });
  }, [dimensions, progressRecords, baseline]);

  const rowsWithData = useMemo(() => radarRows.filter((row) => row.hasRecordedData), [radarRows]);
  const rowsWithoutData = useMemo(() => radarRows.filter((row) => !row.hasRecordedData), [radarRows]);
  const rowsWithPair = useMemo(() => rowsWithData.filter((row) => row.baselineScore !== null && row.currentScore !== null), [rowsWithData]);
  const canRenderRadar = rowsWithPair.length >= 3;

  const insights = useMemo(() => {
    const improvingCount = rowsWithData.filter((row) => row.trend === 'improving').length;
    const majorEvolution = rowsWithPair.reduce<typeof rowsWithPair[number] | null>((acc, row) => {
      if (row.variation === null) return acc;
      if (!acc || (acc.variation ?? -Infinity) < row.variation) return row;
      return acc;
    }, null);

    const lowestCurrent = rowsWithData.reduce<typeof rowsWithData[number] | null>((acc, row) => {
      if (row.currentScore === null) return acc;
      if (!acc || (acc.currentScore ?? Infinity) > row.currentScore) return row;
      return acc;
    }, null);

    const worsening = rowsWithData.find((row) => row.trend === 'worsening');
    const attention = worsening || lowestCurrent;

    return { improvingCount, majorEvolution, attention };
  }, [rowsWithData, rowsWithPair]);

  if (rowsWithData.length === 0) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground print-safe">Ainda não há leituras suficientes para gerar o radar de evolução. Registre evolução por dimensão nos encontros do comitê de crescimento.</div>;
  }

  return (
    <section className="space-y-4 print-safe">
      {(title || subtitle) && <div className="space-y-1">{title && <h3 className="text-base font-semibold">{title}</h3>}{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}</div>}

      <p className="text-xs text-muted-foreground">Radar baseado apenas nas dimensões com leitura registrada.</p>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,1fr)_minmax(320px,1.2fr)] items-start print:grid-cols-1">
        <div className="rounded-lg border p-3 bg-background print:hidden">
          {canRenderRadar ? (
            <div className="h-[260px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={rowsWithData} outerRadius={compact ? '58%' : '64%'}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="shortLabel" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 500 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickCount={6} />
                  <Radar name="Baseline inicial" dataKey="baselineValue" stroke="hsl(var(--chart-benchmark))" fill="hsl(var(--chart-benchmark))" fillOpacity={0.1} strokeWidth={3} strokeDasharray="8 4" />
                  <Radar name="Última leitura do comitê de crescimento" dataKey="currentValue" stroke="hsl(var(--chart-current))" fill="hsl(var(--chart-current))" fillOpacity={0.24} strokeWidth={3} />
                  <Tooltip content={({ payload }) => {
                    if (!payload?.length) return null;
                    const item = payload[0]?.payload;
                    return <div className="rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md space-y-1"><p className="font-semibold text-sm">{item?.fullLabel}</p><p>Baseline inicial: <strong>{fmt(item?.baselineScore ?? null)}</strong></p><p>Última leitura: <strong>{fmt(item?.currentScore ?? null)}</strong></p><p>Variação: <strong>{variationText(item?.variation ?? null)}</strong></p><p>Tendência: <strong>{item?.trend ? trendLabel[item.trend] || item.trend : 'sem dados'}</strong></p></div>;
                  }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground text-center p-4">Radar disponível quando houver pelo menos 3 dimensões avaliadas.</div>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          <div className="rounded-lg border p-3 bg-background"><p className="text-xs text-muted-foreground">Maior evolução</p><p className="font-semibold">{insights.majorEvolution?.fullLabel || 'Sem dados suficientes'}</p><p className="text-sm">{insights.majorEvolution?.variation !== null && insights.majorEvolution?.variation !== undefined ? `${variationText(insights.majorEvolution.variation)}` : 'Sem variação consolidada'}</p></div>
          <div className="rounded-lg border p-3 bg-background"><p className="text-xs text-muted-foreground">Ponto de atenção</p><p className="font-semibold">{insights.attention?.fullLabel || 'Sem alertas críticos'}</p><p className="text-sm">{insights.attention?.trend === 'worsening' ? 'Em queda' : `Score atual ${fmt(insights.attention?.currentScore ?? null)}`}</p></div>
          <div className="rounded-lg border p-3 bg-background"><p className="text-xs text-muted-foreground">Evolução positiva</p><p className="font-semibold">{insights.improvingCount} {insights.improvingCount === 1 ? 'dimensão melhorando' : 'dimensões melhorando'}</p></div>
          <div className="rounded-lg border p-3 bg-background"><p className="text-xs text-muted-foreground">Sem leitura</p><p className="font-semibold">{rowsWithoutData.length} {rowsWithoutData.length === 1 ? 'dimensão sem acompanhamento' : 'dimensões sem acompanhamento'}</p></div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Antes vs Agora</h4>
        <div className="space-y-2">
          {rowsWithData.map((row) => <div key={row.dimensionId} className="rounded-lg border p-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{row.fullLabel}</p><p className="text-xs text-muted-foreground">{row.trend ? trendLabel[row.trend] || row.trend : 'Sem dados'}</p></div>
            <p className="text-xs text-muted-foreground">Baseline inicial: <strong>{fmt(row.baselineScore)}</strong> • Última leitura: <strong>{fmt(row.currentScore)}</strong> • Variação: <strong>{variationText(row.variation)}</strong></p>
            <div className="space-y-1">
              <div><div className="flex justify-between text-[11px] text-muted-foreground"><span>Baseline</span><span>{fmt(row.baselineScore)}</span></div><div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-[hsl(var(--chart-benchmark))]" style={{ width: `${clampPct(row.baselineScore)}%` }} /></div></div>
              <div><div className="flex justify-between text-[11px] text-muted-foreground"><span>Atual</span><span>{fmt(row.currentScore)}</span></div><div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-[hsl(var(--chart-current))]" style={{ width: `${clampPct(row.currentScore)}%` }} /></div></div>
            </div>
          </div>)}
        </div>
      </div>

      {rowsWithoutData.length > 0 && <div className="rounded-lg border border-dashed p-3 bg-muted/20"><p className="text-sm font-medium">Sem leitura registrada</p><p className="text-xs text-muted-foreground mt-1">{rowsWithoutData.map((row) => row.fullLabel).join(' • ')}</p></div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <p><strong>IC</strong> — Identidade & Cultura</p><p><strong>PL</strong> — Pessoas & Liderança</p><p><strong>GR</strong> — Governança & Riscos</p><p><strong>EE</strong> — Estratégia & Execução</p><p><strong>PM</strong> — Processos & Métricas</p><p><strong>FS</strong> — Finanças & Sustentabilidade</p><p><strong>MN</strong> — Modelo de Negócio</p><p><strong>GT</strong> — Go-to-market & Tração</p><p><strong>PT</strong> — Produto & Tecnologia</p>
      </div>
    </section>
  );
}
