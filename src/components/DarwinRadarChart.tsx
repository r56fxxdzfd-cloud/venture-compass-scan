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

/** Extract a short abbreviation from a dimension label */
function abbreviate(label: string): string {
  // If label has "&" or "e" separator, take initials of each part
  const parts = label.split(/\s*[&e]\s*/i).map((p) => p.trim());
  if (parts.length >= 2) {
    // Take first word of each part, max 3-4 chars each
    return parts.map((p) => {
      const words = p.split(/\s+/);
      return words[0].slice(0, 4);
    }).join(' & ');
  }
  // Fallback: first two words
  const words = label.split(/\s+/);
  if (words.length >= 2) return words.slice(0, 2).join(' ');
  return label.slice(0, 10);
}

export function DarwinRadarChart({
  dimensionScores,
  showBenchmark = true,
  showPotential = false,
  potentialScores,
}: RadarChartProps) {
  const data = dimensionScores.map((ds) => ({
    dimension: abbreviate(ds.label),
    fullName: ds.label,
    atual: ds.score,
    benchmark: ds.target,
    potencial: potentialScores?.[ds.dimension_id] || ds.score,
  }));

  return (
    <div className="radar-chart-container">
      <ResponsiveContainer width="100%" height={380}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="65%">
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
          <Radar
            name="Atual"
            dataKey="atual"
            stroke="hsl(var(--chart-current))"
            fill="hsl(var(--chart-current))"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          {showBenchmark && (
            <Radar
              name="Benchmark"
              dataKey="benchmark"
              stroke="hsl(var(--chart-benchmark))"
              fill="none"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
          {showPotential && (
            <Radar
              name="Potencial"
              dataKey="potencial"
              stroke="hsl(var(--chart-potential))"
              fill="hsl(var(--chart-potential))"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="3 3"
            />
          )}
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
