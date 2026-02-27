import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import type { AssessmentResult, ConfigJSON, DimensionScore, EvaluatedRedFlag } from '@/types/darwin';
import {
  scoreTo100, getLevel, getCompleteness, computeBlocks, getBlocks,
  computeGaps, getPenalty, computeCouncilRisk, getSeverityCategory,
  generateOverallNarrative, generateDimensionNarrative, generateRoadmap,
  type BlockResult, type PrioritizedGap, type RoadmapAction, type CompletenessInfo,
} from '@/utils/report-helpers';
import { DarwinRadarChart } from '@/components/DarwinRadarChart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

// ======== A. Header ========
export function ReportHeader({
  startupName, stage, date, completeness, isSimulation,
}: {
  startupName: string; stage: string; date: string; completeness: CompletenessInfo; isSimulation?: boolean;
}) {
  const stageLabels: Record<string, string> = { pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A' };
  const confidenceColors = { high: 'default', medium: 'secondary', low: 'destructive' } as const;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{startupName}</h2>
              {isSimulation && <Badge variant="outline" className="text-xs">SIMULAÇÃO</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{stageLabels[stage] || stage} • {date}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Completude</p>
              <div className="flex items-center gap-2">
                <Progress value={completeness.pct} className="w-24 h-2" />
                <span className="text-sm font-mono font-semibold">{completeness.pct}%</span>
              </div>
            </div>
            <Badge variant={confidenceColors[completeness.confidence] as any}>
              Confiança {completeness.confidenceLabel}
            </Badge>
          </div>
        </div>
        {completeness.confidence === 'low' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Completude baixa ({completeness.pct}%). O relatório pode não refletir a realidade da startup. Complete mais questões para maior confiabilidade.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ======== B. Overall Score ========
export function OverallScoreCard({ result, config, stage }: { result: AssessmentResult; config: ConfigJSON; stage: string }) {
  const score100 = scoreTo100(result.overall_score);
  const level = getLevel(score100);
  const narrative = generateOverallNarrative(result, config, stage);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground mb-2">Score Geral</p>
            <p className="hero-score">{score100}</p>
            <p className="text-sm text-muted-foreground mt-1">de 100</p>
            <Badge className={`mt-2 ${level.color}`} variant="outline">{level.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed text-center max-w-2xl mx-auto">{narrative}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ======== C. Blocks ========
export function BlocksSection({ result, config, stage }: { result: AssessmentResult; config: ConfigJSON; stage: string }) {
  const blocks = computeBlocks(getBlocks(config), result.dimension_scores, config, stage);
  if (blocks.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {blocks.map((block) => (
        <Card key={block.id}>
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{block.label}</p>
            <p className={`text-3xl font-bold font-mono ${block.level.color}`}>{block.score100}</p>
            <Badge variant="outline" className="mt-2 text-xs">{block.level.label}</Badge>
            {block.lowestDim && block.score100 < 75 && (
              <p className="text-xs text-muted-foreground mt-3">
                Foco em <strong>{block.lowestDim}</strong> elevará o conjunto.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ======== D. Radar ========
export function RadarSection({ result }: { result: AssessmentResult }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-base font-semibold mb-4">Radar — Atual vs Benchmark vs Potencial</h3>
        <DarwinRadarChart dimensionScores={result.dimension_scores} showBenchmark showPotential />
      </CardContent>
    </Card>
  );
}

// ======== E. Dimension Bars + Gap Table ========
export function DimensionScoresSection({ result, config, stage }: { result: AssessmentResult; config: ConfigJSON; stage: string }) {
  const gaps = computeGaps(result.dimension_scores, config, stage);

  const barData = result.dimension_scores.map((ds) => ({
    name: ds.label.length > 15 ? ds.label.slice(0, 15) + '…' : ds.label,
    score: scoreTo100(ds.score),
    target: scoreTo100(ds.target),
  }));

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <h3 className="text-base font-semibold">Scores por Dimensão</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} name="Score">
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.score >= 75 ? 'hsl(152 60% 40%)' : entry.score >= 55 ? 'hsl(220 70% 50%)' : entry.score >= 35 ? 'hsl(38 95% 55%)' : 'hsl(0 72% 51%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {gaps.length > 0 && (
          <>
            <h4 className="text-sm font-semibold mt-4">Gaps Priorizados</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2">Dimensão</th>
                    <th className="pb-2 text-center">Atual</th>
                    <th className="pb-2 text-center">Benchmark</th>
                    <th className="pb-2 text-center">Gap</th>
                    <th className="pb-2 text-center">Prioridade</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g) => (
                    <tr key={g.dimension_id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{g.label}</td>
                      <td className="py-2 text-center font-mono">{g.score100}</td>
                      <td className="py-2 text-center font-mono">{g.target100}</td>
                      <td className="py-2 text-center font-mono text-destructive">-{g.gap_potential}</td>
                      <td className="py-2 text-center">
                        <Badge variant={g.priority_score > 20 ? 'destructive' : 'secondary'} className="text-xs">
                          {Math.round(g.priority_score)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ======== F. Red Flags Impact ========
export function RedFlagsSection({ result, config }: { result: AssessmentResult; config: ConfigJSON }) {
  if (result.red_flags.length === 0) return null;

  const councilRisk = computeCouncilRisk(result.red_flags, config);
  const impactData = result.red_flags.map((rf) => ({
    name: rf.label.length > 25 ? rf.label.slice(0, 25) + '…' : rf.label,
    penalty: getPenalty(rf, config),
    severity: rf.severity,
  }));

  const counts = {
    critico: result.red_flags.filter((rf) => getSeverityCategory(rf.severity) === 'Crítico').length,
    atencao: result.red_flags.filter((rf) => getSeverityCategory(rf.severity) === 'Atenção').length,
    monitorar: result.red_flags.filter((rf) => getSeverityCategory(rf.severity) === 'Monitorar').length,
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Red Flags ({result.red_flags.length})
          </h3>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Council Risk Score: <strong className={`font-mono ${councilRisk < 50 ? 'text-destructive' : councilRisk < 75 ? 'text-warning' : 'text-success'}`}>{councilRisk}</strong>/100</span>
          </div>
        </div>

        <div className="flex gap-3">
          {counts.critico > 0 && <Badge variant="destructive">{counts.critico} Crítico{counts.critico > 1 ? 's' : ''}</Badge>}
          {counts.atencao > 0 && <Badge variant="secondary">{counts.atencao} Atenção</Badge>}
          {counts.monitorar > 0 && <Badge variant="outline">{counts.monitorar} Monitorar</Badge>}
        </div>

        {/* Impact chart */}
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={impactData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="penalty" name="Penalidade" radius={[0, 4, 4, 0]}>
                {impactData.map((entry, i) => (
                  <Cell key={i} fill={['high', 'critical'].includes(entry.severity) ? 'hsl(0 72% 51%)' : 'hsl(38 95% 55%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Individual cards */}
        <div className="space-y-3">
          {result.red_flags.map((rf) => (
            <div key={rf.code} className="red-flag-badge">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="destructive" className="text-xs">{getSeverityCategory(rf.severity)}</Badge>
                <span className="text-xs font-mono text-muted-foreground">-{getPenalty(rf, config)}pts</span>
                <span className="text-sm font-semibold">{rf.label}</span>
              </div>
              {rf.actions.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  {rf.actions.map((a, i) => <li key={i}>• {a}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ======== G. Dimension Narratives ========
export function DimensionNarratives({ result }: { result: AssessmentResult }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h3 className="text-base font-semibold">Análise por Dimensão</h3>
        {result.dimension_scores.filter((ds) => ds.coverage > 0).map((ds) => {
          const s100 = scoreTo100(ds.score);
          const level = getLevel(s100);
          return (
            <div key={ds.dimension_id} className="p-3 rounded-lg bg-secondary/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{ds.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-mono font-bold ${level.color}`}>{s100}</span>
                  <Badge variant="outline" className="text-xs">{level.label}</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{generateDimensionNarrative(ds)}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ======== H. Roadmap ========
export function RoadmapSection({ result, config, stage }: { result: AssessmentResult; config: ConfigJSON; stage: string }) {
  const gaps = computeGaps(result.dimension_scores, config, stage);
  const actions = generateRoadmap(gaps, result.red_flags, config);
  if (actions.length === 0) return null;

  const waves = [
    { wave: 1 as const, label: '0-30 dias', color: 'border-destructive/50 bg-destructive/5' },
    { wave: 2 as const, label: '31-90 dias', color: 'border-warning/50 bg-warning/5' },
    { wave: 3 as const, label: '3-6 meses', color: 'border-primary/50 bg-primary/5' },
  ];

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h3 className="text-base font-semibold">Roadmap 6 Meses</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {waves.map(({ wave, label, color }) => {
            const waveActions = actions.filter((a) => a.wave === wave);
            if (waveActions.length === 0) return null;
            return (
              <div key={wave} className={`rounded-lg border p-4 space-y-3 ${color}`}>
                <p className="text-xs font-semibold uppercase tracking-wider">Wave {wave} — {label}</p>
                {waveActions.map((a, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.rationale}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ======== I. Deep Dive ========
export function DeepDiveSection({ result, config }: { result: AssessmentResult; config: ConfigJSON }) {
  if (result.deep_dive_dimensions.length === 0 || !config.deep_dive_prompts) return null;

  // Normalize deep_dive_prompts (handle both formats)
  const dd = config.deep_dive_prompts;
  let ddMap: Record<string, string[]> = {};
  if (Array.isArray(dd)) {
    (dd as any[]).forEach((item: any) => {
      if (item?.dimension_id) ddMap[item.dimension_id] = Array.isArray(item?.prompts) ? item.prompts : [];
    });
  } else if (dd && typeof dd === 'object') {
    Object.entries(dd).forEach(([dimId, list]) => {
      ddMap[dimId] = Array.isArray(list) ? list as string[] : [];
    });
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-accent" /> Deep Dive — Questões para Aprofundamento
        </h3>
        {result.deep_dive_dimensions.map((dimId) => {
          const dim = config.dimensions.find((d) => d.id === dimId);
          const prompts = ddMap[dimId] || [];
          if (!dim || prompts.length === 0) return null;
          return (
            <div key={dimId}>
              <p className="text-sm font-semibold mb-2">{dim.label}</p>
              <ul className="space-y-1">
                {prompts.map((p, i) => (
                  <li key={i} className="text-sm text-muted-foreground pl-4 border-l-2 border-accent">{p}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
