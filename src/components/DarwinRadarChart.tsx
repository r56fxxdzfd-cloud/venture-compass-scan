import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip
} from 'recharts';
import type { DimensionScore } from '@/types/darwin';

interface RadarChartProps {
  dimensionScores: DimensionScore[];
  showBenchmark?: boolean;
  showPotential?: boolean;
  potentialScores?: Record<string, number>;
}

/** Extract a short label from a dimension name */
function abbreviate(label: string): string {
  // Split on " & " or " e " (as a word, not the letter inside words)
  const parts = label.split(/\s+[&]\s+|\s+e\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    return parts.map((p) => p.split(/\s+/)[0]).join(' & ');
  }

  const words = label.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return label;

  // Avoid broken labels like "Modelo de"
  const connectors = new Set(['de', 'da', 'do', 'das', 'dos', 'e', '&']);
  if (connectors.has(words[1]?.toLowerCase())) {
    return words.slice(0, 3).join(' ');
  }

  return words.slice(0, 2).join(' ');
}

export function DarwinRadarChart({
  dimensionScores,
  showBenchmark = true,
  showPotential = false,
  potentialScores,
}: RadarChartProps) {
  const data = dimensionScores.map((ds) => {
    const atual = ds.score;
    const benchmark = ds.target;
    const rawPotencial = potentialScores?.[ds.dimension_id] ?? benchmark;
    const enforcedBenchmark = Math.max(benchmark, 0);
    const potencial = Math.min(5, Math.max(rawPotencial, enforcedBenchmark, atual));

    return {
      dimension: abbreviate(ds.label),
      fullName: ds.label,
      atual,
      benchmark: enforcedBenchmark,
      potencial,
    };
  });

  if (import.meta.env.DEV) {
    data.forEach(d => {
      if (d.potencial < d.atual) console.warn(`[Radar] Potencial (${d.potencial}) < Atual (${d.atual}) for "${d.fullName}"`);
      if (d.potencial < d.benchmark) console.warn(`[Radar] Potencial (${d.potencial}) < Benchmark (${d.benchmark}) for "${d.fullName}"`);
    });
  }

  return (
    <div className="radar-chart-container">
      <ResponsiveContainer width="100%" height={320} minHeight={260}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="60%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickCount={6}
          />
          {showPotential && (
            <Radar
              name="Potencial"
              dataKey="potencial"
              stroke="hsl(var(--chart-potential))"
              fill="hsl(var(--chart-potential))"
              fillOpacity={0.15}
              strokeWidth={2.5}
              strokeDasharray="6 3"
            />
          )}
          {showBenchmark && (
            <Radar
              name="Benchmark"
              dataKey="benchmark"
              stroke="hsl(var(--chart-benchmark))"
              fill="hsl(var(--chart-benchmark))"
              fillOpacity={0.12}
              strokeWidth={2.5}
              strokeDasharray="8 3"
            />
          )}
          <Radar
            name="Atual"
            dataKey="atual"
            stroke="hsl(var(--chart-current))"
            fill="hsl(var(--chart-current))"
            fillOpacity={0.2}
            strokeWidth={2.5}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const item = payload[0]?.payload;
              return (
                <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-md text-xs space-y-1">
                  <p className="font-semibold text-sm">{item?.fullName}</p>
                  {payload.map((p: any) => (
                    <p key={p.dataKey}>{p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : '—'}</strong></p>
                  ))}
                </div>
              );
            }}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
