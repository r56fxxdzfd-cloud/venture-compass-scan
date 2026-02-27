import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Calendar, Target, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ConfigJSON, AssessmentResult } from '@/types/darwin';
import {
  computeParetoActions, selectTop5,
  generateMeetingAgenda, compute2x2Matrix,
  type ScoredAction, type AgendaItem, type MatrixPoint,
} from '@/utils/pareto-engine';
import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, ReferenceLine, Label } from 'recharts';

// ---- Effort badge ----
function EffortBadge({ effort }: { effort: 'S' | 'M' | 'L' }) {
  const styles = {
    S: 'bg-primary/10 text-primary border-primary/20',
    M: 'bg-warning/10 text-warning border-warning/20',
    L: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  const labels = { S: 'Baixo esforço', M: 'Médio esforço', L: 'Alto esforço' };
  return <Badge variant="outline" className={`text-xs ${styles[effort]}`}>{labels[effort]}</Badge>;
}

// ======== Quick Wins ========
export function QuickWinsSection({
  config, result, stage,
}: { config: ConfigJSON; result: AssessmentResult; stage: string }) {
  const scored = computeParetoActions(config, result, stage);
  const top5 = selectTop5(scored, result, config);

  if (top5.length === 0) return null;

  return (
    <Card>
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
              className="p-4 rounded-lg border bg-secondary/20 space-y-2"
            >
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
                    {action.time_to_impact_days}d
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{action.description}</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Razão:</strong> {action.reason}</p>
                <p><strong>Primeiro passo:</strong> {action.first_step}</p>
                <p><strong>Definição de pronto:</strong> {action.done_definition}</p>
                {action.kpi_hint && <p><strong>KPI:</strong> {action.kpi_hint}</p>}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {action.impacted_dimensions.map((d) => (
                  <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                ))}
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
  config, result, stage,
}: { config: ConfigJSON; result: AssessmentResult; stage: string }) {
  const agenda = generateMeetingAgenda(config, result, stage);
  if (agenda.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold">Pauta — Próximo Conselho Coletivo</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Agenda auto-gerada para reunião quinzenal. 3 itens priorizados por gaps e red flags.
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
                    <Badge key={c} variant="outline" className="text-xs font-mono">{c}</Badge>
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

        {/* Quadrant labels */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="text-right pr-4"><Badge variant="destructive" className="text-xs">Agir Imediatamente</Badge></div>
          <div><Badge className="text-xs bg-primary/80">Quick Win</Badge></div>
          <div className="text-right pr-4"><Badge variant="secondary" className="text-xs">Monitorar</Badge></div>
          <div><Badge variant="outline" className="text-xs">Baixa Prioridade</Badge></div>
        </div>

        <div className="h-[300px] sm:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
              <XAxis
                type="number"
                dataKey="risk"
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                name="Risco"
              >
                <Label value="Risco →" offset={-10} position="insideBottom" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              </XAxis>
              <YAxis
                type="number"
                dataKey="impact"
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                name="Impacto"
              >
                <Label value="Impacto →" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              </YAxis>
              <ReferenceLine x={50} stroke="hsl(var(--border))" strokeDasharray="4 4" />
              <ReferenceLine y={50} stroke="hsl(var(--border))" strokeDasharray="4 4" />
              <Tooltip content={<MatrixTooltipContent />} />
              <Scatter data={points} name="Items">
                {points.map((point, i) => (
                  <Cell
                    key={point.id}
                    fill={point.type === 'red_flag' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                    opacity={0.8}
                    r={point.type === 'red_flag' ? 6 : 8}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground justify-center">
          {points.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: p.type === 'red_flag' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }}
              />
              {p.label.length > 20 ? p.label.slice(0, 20) + '…' : p.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
