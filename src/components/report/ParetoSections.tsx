import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Calendar, Target, AlertTriangle, Flag, CheckCircle2, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ConfigJSON, AssessmentResult, Answer } from '@/types/darwin';
import {
  computeParetoActions, selectTop5,
  generateMeetingAgenda, compute2x2Matrix,
  type ScoredAction, type AgendaItem, type MatrixPoint, type QuestionAnswer,
} from '@/utils/pareto-engine';
import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Cell, ReferenceLine, Label } from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { humanizeFieldName, shortDimensionLabel, EFFORT_TOOLTIPS } from '@/utils/label-maps';

// ---- Effort badge with tooltip ----
function EffortBadge({ effort }: { effort: 'S' | 'M' | 'L' }) {
  const styles = {
    S: 'bg-primary/10 text-primary border-primary/20',
    M: 'bg-warning/10 text-warning border-warning/20',
    L: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  const labels = { S: 'Rápido', M: 'Médio', L: 'Pesado' };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span><Badge variant="outline" className={`text-xs cursor-help ${styles[effort]}`}>{labels[effort]}</Badge></span>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs max-w-[200px]">{EFFORT_TOOLTIPS[effort]}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ======== Quick Wins (Step 7 rendering) ========
export function QuickWinsSection({
  config, result, stage,
}: { config: ConfigJSON; result: AssessmentResult; stage: string }) {
  const scored = computeParetoActions(config, result, stage);
  const top5 = selectTop5(scored, result, config);

  if (top5.length === 0) return null;

  return (
    <Card className="executive-surface print-safe">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold">Top 5 Quick Wins (Pareto)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Ações de maior impacto com menor esforço — priorizadas por gaps, pesos e red flags.
        </p>
        <div className="space-y-3">
          {top5.map((action, i) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-lg border bg-secondary/20 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <h4 className="text-sm font-semibold">{action.title}</h4>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <EffortBadge effort={action.effort} />
                  <Badge variant="outline" className="text-xs">
                    ~{action.time_to_impact_days}d
                  </Badge>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground">{action.description}</p>

              {/* First step (highlighted box) */}
              <div className="rounded-md bg-primary/5 border border-primary/10 p-2.5">
                <p className="text-xs">
                  <span className="font-semibold text-primary inline-flex items-center gap-1">
                    Primeiro passo:
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs max-w-[220px]">Ação concreta para começar hoje — não precisa estar perfeito, apenas iniciado.</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>{' '}
                  <span className="text-foreground">{action.first_step}</span>
                </p>
              </div>

              {/* Done definition (subtle box) */}
              <div className="rounded-md bg-muted/50 border border-border/50 p-2.5 flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs">
                  <span className="font-medium text-muted-foreground inline-flex items-center gap-1">
                    Concluído quando:
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs max-w-[220px]">Critério objetivo para considerar esta ação encerrada e medir o progresso.</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>{' '}
                  <span className="text-foreground">{action.done_definition}</span>
                </p>
              </div>

              {/* Footer: badges + metadata */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Dimension badge - use label not raw ID */}
                <Badge variant="secondary" className="text-xs">
                  {config.dimensions.find(d => d.id === action.dimension_id)?.label || action.dimension_id}
                </Badge>

                {/* Red flags indicator - show label not code */}
                {action.addresses_red_flags && action.addresses_red_flags.length > 0 && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <Flag className="h-3 w-3" />
                    {action.addresses_red_flags.map(code => {
                      const rf = config.red_flags?.find(r => r.code === code);
                      return rf?.label || '';
                    }).filter(Boolean).join(', ') || 'Red Flag'}
                  </Badge>
                )}

                {/* KPI hint */}
                {action.kpi_hint && (
                  <Badge variant="outline" className="text-xs font-mono">{action.kpi_hint}</Badge>
                )}

                {/* Pareto score */}
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  Score: {action.pareto_score}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ======== Meeting Agenda ========
export function MeetingAgendaSection({
  config, result, stage, answers,
}: { config: ConfigJSON; result: AssessmentResult; stage: string; answers?: Answer[] }) {
  const questionAnswers: QuestionAnswer[] = (answers || []).map(a => {
    const q = config.questions?.find(q => q.id === a.question_id);
    return { question_id: a.question_id, dimension_id: q?.dimension_id || '', score: a.value, notes: a.notes };
  });
  const agenda = generateMeetingAgenda(config, result, stage, questionAnswers);
  if (agenda.length === 0) return null;

  return (
    <Card className="executive-surface print-safe">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold">Pauta — Próximo Conselho Coletivo</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Temas prioritários para discussão e decisão no próximo encontro.
        </p>
        <div className="space-y-4">
          {agenda.map((item, i) => (
            <div key={i} className="p-4 rounded-lg border space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <h4 className="text-sm font-semibold">{item.topic}</h4>
                {item.red_flag && (
                  <Badge variant="destructive" className="text-xs ml-auto">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Red Flag
                  </Badge>
                )}
              </div>
              {item.low_questions && item.low_questions.length > 0 && (
                <div className="pl-8 mb-1">
                  <div className="rounded-md bg-destructive/5 border border-destructive/15 p-2">
                    <p className="text-xs font-medium text-destructive mb-0.5">Pontos críticos identificados:</p>
                    {item.low_questions.map((q, j) => (
                      <p key={j} className="text-xs text-muted-foreground">• {q}</p>
                    ))}
                  </div>
                </div>
              )}
              {item.deep_dive_prompts.length > 0 && (
                <ul className="space-y-1 pl-8">
                  {item.deep_dive_prompts.map((p, j) => (
                    <li key={j} className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3">
                      {p}
                    </li>
                  ))}
                </ul>
              )}
              <div className="pl-8">
                <p className="text-xs">
                  <span className="font-medium text-primary">Decisão esperada:</span>{' '}
                  <span className="text-muted-foreground">{item.expected_decision}</span>
                </p>
              </div>
              {item.context_checks && item.context_checks.length > 0 && (
                <div className="pl-8 flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">Verificar:</span>
                  {item.context_checks.map((c) => (
                    <Badge key={c} variant="outline" className="text-xs">{humanizeFieldName(c)}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ======== 2x2 Matrix ========
const QUADRANT_LABELS = {
  high_risk_high_impact: 'Agir Imediatamente',
  low_risk_high_impact: 'Quick Win',
  high_risk_low_impact: 'Monitorar',
  low_risk_low_impact: 'Baixa Prioridade',
};

function computeLabelOffsets(points: MatrixPoint[]): Record<string, { dx: number; dy: number; anchor: string }> {
  const offsets: Record<string, { dx: number; dy: number; anchor: string }> = {};
  const placed: { x: number; y: number; id: string }[] = [];

  const candidates: [number, number, string][] = [
    [0, -14, 'middle'],
    [12, -8, 'start'],
    [14, 3, 'start'],
    [12, 14, 'start'],
    [0, 18, 'middle'],
    [-12, 14, 'end'],
    [-14, 3, 'end'],
    [-12, -8, 'end'],
  ];

  for (const point of points) {
    let best = candidates[0];
    let bestScore = -Infinity;

    for (const [dx, dy, anchor] of candidates) {
      const labelX = point.risk + dx;
      const labelY = point.impact + dy;

      let minDist = Infinity;
      for (const p of placed) {
        const dist = Math.sqrt((labelX - p.x) ** 2 + (labelY - p.y) ** 2);
        minDist = Math.min(minDist, dist);
      }

      const boundsPenalty = (labelX < 5 || labelX > 95 || labelY < 5 || labelY > 95) ? -20 : 0;
      const score = (minDist === Infinity ? 50 : minDist) + boundsPenalty;

      if (score > bestScore) {
        bestScore = score;
        best = [dx, dy, anchor];
      }
    }

    offsets[point.id] = { dx: best[0], dy: best[1], anchor: best[2] };
    placed.push({ x: point.risk + best[0], y: point.impact + best[1], id: point.id });
  }

  return offsets;
}

function MatrixTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as MatrixPoint;
  return (
    <div className="bg-popover text-popover-foreground border rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold">{point.label}</p>
      <p>Impacto: {point.impact}</p>
      <p>Risco: {point.risk}</p>
      <p className="text-muted-foreground">{QUADRANT_LABELS[point.quadrant]}</p>
    </div>
  );
}

export function RiskImpactMatrixSection({
  config, result, stage,
}: { config: ConfigJSON; result: AssessmentResult; stage: string }) {
  const points = compute2x2Matrix(config, result, stage);
  const labelOffsets = computeLabelOffsets(points);
  if (points.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold">Matriz Risco × Impacto</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Dimensões (círculos) e Red Flags (triângulos) posicionados por risco e impacto potencial.
        </p>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="text-right pr-4"><Badge variant="destructive" className="text-xs">Agir Imediatamente</Badge></div>
          <div><Badge className="text-xs bg-primary/80">Quick Win</Badge></div>
          <div className="text-right pr-4"><Badge variant="secondary" className="text-xs">Monitorar</Badge></div>
          <div><Badge variant="outline" className="text-xs">Baixa Prioridade</Badge></div>
        </div>

        <div className="h-[350px] sm:h-[400px]" style={{ overflow: 'visible' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
              <XAxis type="number" dataKey="risk" domain={[0, 100]} tick={{ fontSize: 10 }} name="Risco">
                <Label value="Risco →" offset={-10} position="insideBottom" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              </XAxis>
              <YAxis type="number" dataKey="impact" domain={[0, 100]} tick={{ fontSize: 10 }} name="Impacto">
                <Label value="Impacto →" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              </YAxis>
              <ReferenceLine x={50} stroke="hsl(var(--border))" strokeDasharray="4 4" />
              <ReferenceLine y={50} stroke="hsl(var(--border))" strokeDasharray="4 4" />
              <RechartsTooltip content={<MatrixTooltipContent />} />
              <Scatter data={points} name="Items" shape={(props: any) => {
                const { cx, cy, payload } = props;
                if (!cx || !cy) return null;
                const isRf = payload.type === 'red_flag';
                const color = isRf ? 'hsl(var(--destructive))' : 'hsl(var(--primary))';
                const idx = points.findIndex(p => p.id === payload.id);
                const num = idx + 1;
                return (
                  <g>
                    {isRf ? (
                      <polygon
                        points={`${cx},${cy - 10} ${cx - 9},${cy + 6} ${cx + 9},${cy + 6}`}
                        fill={color}
                        opacity={0.85}
                      />
                    ) : (
                      <circle cx={cx} cy={cy} r={9} fill={color} opacity={0.8} />
                    )}
                    <text
                      x={cx}
                      y={cy + (isRf ? -1 : 1)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={9}
                      fontWeight={700}
                    >
                      {num}
                    </text>
                  </g>
                );
              }}>
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-1 text-xs text-muted-foreground pt-2 pb-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {points.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0 text-[9px] font-bold text-white"
                style={{ background: p.type === 'red_flag' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }}
              >
                {i + 1}
              </span>
              <span>{p.label}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
