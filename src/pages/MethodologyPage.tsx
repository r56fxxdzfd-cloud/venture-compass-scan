import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConfigJSON, ConfigVersion } from '@/types/darwin';

export default function MethodologyPage() {
  const [config, setConfig] = useState<ConfigJSON | null>(null);
  const [version, setVersion] = useState<ConfigVersion | null>(null);

  useEffect(() => {
    supabase
      .from('config_versions')
      .select('*')
      .eq('status', 'published')
      .single()
      .then(({ data }) => {
        if (data) {
          setVersion(data as unknown as ConfigVersion);
          setConfig(data.config_json as unknown as ConfigJSON);
        }
      });
  }, []);

  if (!config || !version) return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <Skeleton className="h-8 w-56 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map(j => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const stages = ['pre_seed', 'seed', 'series_a'];
  const stageLabels: Record<string, string> = { pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A' };

  const severityColor = (s: string) => {
    if (['high', 'critical'].includes(s)) return 'destructive';
    if (['medium_high', 'medium'].includes(s)) return 'secondary';
    return 'outline';
  };

  const triggerDescription = (trigger: any): string => {
    switch (trigger.type) {
      case 'score_threshold':
        return `Score da dimensão "${trigger.dimension_id}" abaixo de ${trigger.threshold}`;
      case 'numeric_threshold':
        return `Campo "${trigger.field}" abaixo de ${trigger.threshold}`;
      case 'numeric_missing':
        return `Campo "${trigger.field}" não informado`;
      default:
        return trigger.type;
    }
  };

  const formatCellValue = (value: unknown) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number' || typeof value === 'string') return String(value);
    if (typeof value === 'object') {
      const benchmark = (value as Record<string, unknown>).benchmark;
      const potential = (value as Record<string, unknown>).potential;
      if (typeof benchmark === 'number' || typeof potential === 'number') {
        const b = typeof benchmark === 'number' ? benchmark : '—';
        const p = typeof potential === 'number' ? potential : '—';
        return `Bench: ${b} • Pot: ${p}`;
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const glossaryEntries: [string, string][] = config.glossary
    ? (Array.isArray(config.glossary)
        ? (config.glossary as any[]).map((g: any) => [g.term, g.definition] as [string, string])
        : Object.entries(config.glossary).map(([k, v]) => [k, typeof v === 'string' ? v : (v as any)?.definition || JSON.stringify(v)] as [string, string])
      ).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    : [];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Metodologia
        </h1>
        <p className="text-sm text-muted-foreground">
          Versão: {version.version_name} • Publicada em {version.published_at ? new Date(version.published_at).toLocaleDateString('pt-BR') : '—'}
        </p>
      </div>

      {/* Seção 1 — Sobre o Diagnóstico */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Sobre o Diagnóstico</CardTitle></CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none text-sm text-foreground space-y-4">
            {typeof config.methodology === 'string' ? (
              <p className="whitespace-pre-wrap">{config.methodology}</p>
            ) : config.methodology && typeof config.methodology === 'object' ? (
              Object.entries(config.methodology).map(([key, value]) => (
                <div key={key}>
                  <h3 className="text-sm font-semibold capitalize mb-1">{key.replace(/_/g, ' ')}</h3>
                  <div className="whitespace-pre-wrap text-muted-foreground">
                    {typeof value === 'string' ? value
                      : typeof value === 'object' && value !== null
                        ? Object.entries(value as Record<string, unknown>).map(([k2, v2]) => (
                            <p key={k2}><strong className="capitalize">{k2.replace(/_/g, ' ')}:</strong> {typeof v2 === 'string' ? v2 : JSON.stringify(v2)}</p>
                          ))
                        : String(value)}
                  </div>
                </div>
              ))
            ) : (
              <p>Metodologia não definida.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seção 2 — Dimensões e Perguntas */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Dimensões e Perguntas</CardTitle></CardHeader>
        <CardContent>
          <Accordion type="multiple">
            {config.dimensions
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((dim) => {
                const dimQuestions = config.questions
                  .filter(q => q.dimension_id === dim.id && q.is_active !== false)
                  .sort((a, b) => a.sort_order - b.sort_order);

                return (
                  <AccordionItem key={dim.id} value={dim.id}>
                    <AccordionTrigger className="text-sm">
                      {dim.label}
                      <Badge variant="outline" className="ml-2 text-[10px]">{dimQuestions.length} perguntas</Badge>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {dimQuestions.map((q, idx) => (
                          <div key={q.id} className="pl-2 border-l-2 border-muted space-y-1">
                            <p className="text-sm font-medium">{idx + 1}. {q.text}</p>
                            {q.tooltip && (
                              <div className="text-xs text-muted-foreground space-y-0.5 pl-3">
                                {q.tooltip.definition && <p><strong>Definição:</strong> {q.tooltip.definition}</p>}
                                {q.tooltip.why && <p><strong>Por quê:</strong> {q.tooltip.why}</p>}
                                {q.tooltip.anchors && (
                                  <div className="flex gap-3 flex-wrap">
                                    {Object.entries(q.tooltip.anchors).map(([k, v]) => (
                                      <span key={k} className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{k}: {v as string}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Seção 3 — Pesos e Targets por Estágio */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Pesos e Targets por Estágio</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimensão</TableHead>
                {stages.map(s => (
                  <TableHead key={s} className="text-center" colSpan={2}>{stageLabels[s]}</TableHead>
                ))}
              </TableRow>
              <TableRow>
                <TableHead></TableHead>
                {stages.map(s => (
                  <>
                    <TableHead key={`${s}-w`} className="text-center text-xs">Peso</TableHead>
                    <TableHead key={`${s}-t`} className="text-center text-xs">Target</TableHead>
                  </>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.dimensions.sort((a, b) => a.sort_order - b.sort_order).map(dim => (
                <TableRow key={dim.id}>
                  <TableCell className="text-sm font-medium">{dim.label}</TableCell>
                  {stages.map(s => (
                    <>
                      <TableCell key={`${s}-w-${dim.id}`} className="text-center text-sm">
                        {formatCellValue(config.weights_by_stage?.[s]?.[dim.id])}
                      </TableCell>
                      <TableCell key={`${s}-t-${dim.id}`} className="text-center text-sm">
                        {formatCellValue(config.targets_by_stage?.[s]?.[dim.id])}
                      </TableCell>
                    </>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Seção 4 — Red Flags */}
      {config.red_flags && config.red_flags.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Red Flags</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.red_flags.map(rf => (
                  <TableRow key={rf.code}>
                    <TableCell className="text-xs font-mono">{rf.code}</TableCell>
                    <TableCell className="text-sm">{rf.label}</TableCell>
                    <TableCell>
                      <Badge variant={severityColor(rf.severity) as any} className="text-[10px]">
                        {rf.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rf.triggers.map((t, i) => (
                        <p key={i}>{triggerDescription(t)}</p>
                      ))}
                    </TableCell>
                    <TableCell className="text-xs">
                      {rf.actions.map((a, i) => <p key={i}>{a}</p>)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Seção 5 — Glossário */}
      {glossaryEntries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Glossário</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {glossaryEntries.map(([term, def]) => (
              <div key={term} className="border-b border-border pb-2 last:border-0">
                <p className="text-sm font-semibold">{term}</p>
                <p className="text-sm text-muted-foreground">{def}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Seção 6 — Presets do Simulador */}
      {config.simulator?.presets && config.simulator.presets.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Presets do Simulador</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {config.simulator.presets.map(preset => (
                <Card key={preset.id} className="bg-secondary/30">
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-sm font-semibold">{preset.label}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(preset.dimension_scores).map(([dimId, score]) => {
                        const dim = config.dimensions.find(d => d.id === dimId);
                        return (
                          <div key={dimId} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{dim?.label || dimId}</span>
                            <span className="font-mono font-semibold">{(score as number).toFixed(1)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
