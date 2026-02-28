import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ConfigJSON } from '@/types/darwin';

interface Props {
  config: ConfigJSON;
  onChange: (config: ConfigJSON) => void;
}

const STAGES = ['pre_seed', 'seed', 'series_a'] as const;
const STAGE_LABELS: Record<string, string> = { pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A' };

export function WeightsTargetsTab({ config, onChange }: Props) {
  const dims = [...config.dimensions].sort((a, b) => a.sort_order - b.sort_order);

  const getWeight = (stage: string, dimId: string): number => {
    return (config.weights_by_stage?.[stage]?.[dimId] as number) || 1;
  };

  const getTarget = (stage: string, dimId: string): number => {
    const val = config.targets_by_stage?.[stage]?.[dimId];
    if (typeof val === 'number') return val;
    if (val && typeof val === 'object' && 'benchmark' in (val as any)) return (val as any).benchmark;
    return 3.0;
  };

  const cloneConfig = (): ConfigJSON => JSON.parse(JSON.stringify(config));

  const setWeight = (stage: string, dimId: string, value: number) => {
    const c = cloneConfig();
    if (!c.weights_by_stage) c.weights_by_stage = {};
    if (!c.weights_by_stage[stage]) c.weights_by_stage[stage] = {};
    c.weights_by_stage[stage][dimId] = value;
    onChange(c);
  };

  const setTarget = (stage: string, dimId: string, value: number) => {
    const c = cloneConfig();
    if (!c.targets_by_stage) c.targets_by_stage = {};
    if (!c.targets_by_stage[stage]) c.targets_by_stage[stage] = {};
    const existing = c.targets_by_stage[stage][dimId];
    if (existing && typeof existing === 'object' && 'benchmark' in (existing as any)) {
      (existing as any).benchmark = value;
    } else {
      c.targets_by_stage[stage][dimId] = value;
    }
    onChange(c);
  };

  const getStageSumWeights = (stage: string): number => {
    return dims.reduce((sum, dim) => sum + getWeight(stage, dim.id), 0);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Dimensão</TableHead>
              {STAGES.map(s => (
                <TableHead key={s} className="text-center" colSpan={2}>{STAGE_LABELS[s]}</TableHead>
              ))}
            </TableRow>
            <TableRow>
              <TableHead />
              {STAGES.map(s => (
                <><TableHead key={`${s}-w`} className="text-center text-xs w-20">Peso</TableHead>
                <TableHead key={`${s}-t`} className="text-center text-xs w-20">Benchmark</TableHead></>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dims.map(dim => (
              <TableRow key={dim.id}>
                <TableCell className="text-sm font-medium">{dim.label}</TableCell>
                {STAGES.map(s => (
                  <>
                    <TableCell key={`${s}-w-${dim.id}`} className="p-1">
                      <Input
                        type="number"
                        step={0.1}
                        min={0.1}
                        max={3.0}
                        value={getWeight(s, dim.id)}
                        onChange={e => setWeight(s, dim.id, parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-center w-16 mx-auto"
                      />
                    </TableCell>
                    <TableCell key={`${s}-t-${dim.id}`} className="p-1">
                      <Input
                        type="number"
                        step={0.1}
                        min={1.0}
                        max={5.0}
                        value={getTarget(s, dim.id)}
                        onChange={e => setTarget(s, dim.id, parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-center w-16 mx-auto"
                      />
                    </TableCell>
                  </>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Weight sums */}
      <div className="flex gap-4 text-xs">
        {STAGES.map(s => {
          const sum = getStageSumWeights(s);
          const isGood = sum >= 8.5 && sum <= 9.5;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{STAGE_LABELS[s]}:</span>
              <span className={`font-mono font-semibold ${isGood ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                {sum.toFixed(1)} / 9.0
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
