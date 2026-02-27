import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend
} from 'recharts';
import type { DimensionScore } from '@/types/darwin';

interface RadarChartProps {
  dimensionScores: DimensionScore[];
  showBenchmark?: boolean;
  showPotential?: boolean;
  potentialScores?: Record<string, number>;
}

export function DarwinRadarChart({
  dimensionScores,
  showBenchmark = true,
  showPotential = false,
  potentialScores,
}: RadarChartProps) {
  const data = dimensionScores.map((ds) => ({
    dimension: ds.label.length > 12 ? ds.label.slice(0, 12) + '…' : ds.label,
    fullName: ds.label,
    atual: ds.score,
    benchmark: ds.target,
    potencial: potentialScores?.[ds.dimension_id] || ds.score,
  }));

  return (
    <div className="radar-chart-container">
      <ResponsiveContainer width="100%" height={420}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
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
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
