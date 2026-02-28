import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConfigJSON, ConfigVersion } from '@/types/darwin';

// ---- Helpers ----

function toSentenceCase(s: string): string {
  const spaced = s.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '—';
}

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

  const getDimLabel = (dimId: string | undefined) => {
    if (!dimId) return '—';
    return config.dimensions.find(d => d.id === dimId)?.label || dimId;
  };

  // ---- Format trigger as Portuguese sentence ----
  const formatTrigger = (trigger: any): string => {
    const threshold = trigger.threshold ?? trigger.value ?? '—';
    const field = trigger.field || '—';
    const dimLabel = getDimLabel(trigger.dimension_id);

    switch (trigger.type) {
      case 'score_threshold':
      case 'dimension_score_below':
        return `Score da dimensão "${dimLabel}" abaixo de ${threshold}`;
      case 'numeric_threshold':
      case 'context_field_below':
        return `Campo "${field}" abaixo de ${threshold}`;
      case 'numeric_missing':
      case 'context_field_missing':
        return `Campo "${field}" não informado`;
      case 'question_score_below':
        return `Resposta da pergunta "${trigger.question_id || '—'}" abaixo de ${threshold}`;
      case 'red_flag_triggered':
        return 'Qualquer red flag disparada';
      case 'requires':
        return `Requer: ${trigger.field || trigger.dimension_id || '—'}`;
      default:
        return trigger.type ? toSentenceCase(trigger.type) : '—';
    }
  };

  // ---- Severity badge config ----
  const severityConfig = (s: string): { variant: 'destructive' | 'secondary' | 'outline'; label: string; className?: string } => {
    switch (s) {
      case 'critical': return { variant: 'destructive', label: 'Crítico' };
      case 'high': return { variant: 'destructive', label: 'Alto', className: 'bg-red-500/80' };
      case 'medium_high': return { variant: 'secondary', label: 'Médio-Alto', className: 'bg-orange-500/80 text-white border-orange-500/20' };
      case 'medium': return { variant: 'secondary', label: 'Médio', className: 'bg-yellow-500/80 text-black border-yellow-500/20' };
      case 'low': return { variant: 'outline', label: 'Baixo' };
      default: return { variant: 'outline', label: toSentenceCase(s) };
    }
  };

  // ---- Format weight as percentage ----
  const formatWeight = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      if (value < 1) return `${Math.round(value * 100)}%`;
      return String(value);
    }
    return safeString(value);
  };

  // ---- Format target: extract benchmark and potential ----
  const formatBenchmark = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') return value.toFixed(1);
    if (typeof value === 'object' && value !== null) {
      const b = (value as any).benchmark;
      return typeof b === 'number' ? b.toFixed(1) : '—';
    }
    return safeString(value);
  };

  const formatPotential = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') return '—'; // simple number = no potential
    if (typeof value === 'object' && value !== null) {
      const p = (value as any).potential;
      return typeof p === 'number' ? p.toFixed(1) : '—';
    }
    return '—';
  };

  const hasAnyPotential = stages.some(s =>
    config.dimensions.some(dim => {
      const val = config.targets_by_stage?.[s]?.[dim.id];
      return val && typeof val === 'object' && 'potential' in (val as any);
    })
  );

  // ---- Format generic value for methodology section ----
  const formatValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return '—';
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'type' in value[0]) {
        return (
          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
            {value.map((item: any, i: number) => <li key={i}>{formatTrigger(item)}</li>)}
          </ul>
        );
      }
      if (value.every((v: unknown) => typeof v === 'string' || typeof v === 'number')) {
        return (
          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
            {value.map((v, i) => <li key={i}>{String(v)}</li>)}
          </ul>
        );
      }
      return (
        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
          {value.map((v, i) => <li key={i}>{typeof v === 'object' ? formatValue(v) : String(v)}</li>)}
        </ul>
      );
    }
    if (typeof value === 'object') {
      return (
        <div className="space-y-1.5 pl-2 border-l-2 border-muted">
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <div key={k}>
              <span className="font-medium text-foreground/80">{toSentenceCase(k)}:</span>{' '}
              <span className="text-muted-foreground">{formatValue(v)}</span>
            </div>
          ))}
        </div>
      );
    }
    return String(value);
  };

  // ---- Glossary ----
  const glossaryEntries: [string, string][] = config.glossary
    ? (Array.isArray(config.glossary)
        ? (config.glossary as any[]).map((g: any) => [g.term, g.definition] as [string, string])
        : Object.entries(config.glossary).map(([k, v]) => [k, typeof v === 'string' ? v : (v as any)?.definition || safeString(v)] as [string, string])
      ).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    : [];

  const useLetterDividers = glossaryEntries.length > 15;

  // Group glossary by first letter
  const glossaryByLetter: Record<string, [string, string][]> = {};
  glossaryEntries.forEach(entry => {
    const letter = entry[0].charAt(0).toUpperCase();
    if (!glossaryByLetter[letter]) glossaryByLetter[letter] = [];
    glossaryByLetter[letter].push(entry);
  });

  // ---- Dimension abbreviation (first uppercase letters of id, e.g. "IC", "PL") ----
  const dimAbbrev = (dimId: string) => dimId.toUpperCase().slice(0, 2);

  const colsPerStage = hasAnyPotential ? 3 : 2;

  return (
    <TooltipProvider>
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
          <CardHeader><CardTitle className="text-base">Sobre o Diagnóstico</CardTitle></CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-sm text-foreground space-y-4">
              {typeof config.methodology === 'string' ? (
                <p className="whitespace-pre-wrap">{config.methodology}</p>
              ) : config.methodology && typeof config.methodology === 'object' ? (
                Object.entries(config.methodology).map(([key, value]) => (
                  <div key={key}>
                    <h3 className="text-sm font-semibold mb-1">{toSentenceCase(key)}</h3>
                    <div className="text-muted-foreground">{formatValue(value)}</div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Metodologia não definida.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Seção 2 — Dimensões e Perguntas */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dimensões e Perguntas</CardTitle></CardHeader>
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
                                        <span key={k} className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{k}: {safeString(v)}</span>
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
          <CardHeader><CardTitle className="text-base">Pesos e Targets por Estágio</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Dimensão</TableHead>
                  {stages.map(s => (
                    <TableHead key={s} className="text-center" colSpan={colsPerStage}>{stageLabels[s]}</TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead />
                  {stages.map(s => (
                    <>
                      <TableHead key={`${s}-w`} className="text-center text-xs">Peso (%)</TableHead>
                      <TableHead key={`${s}-b`} className="text-center text-xs">Benchmark</TableHead>
                      {hasAnyPotential && <TableHead key={`${s}-p`} className="text-center text-xs">Potencial 6m</TableHead>}
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
                        <TableCell key={`${s}-w-${dim.id}`} className="text-center text-sm font-mono">
                          {formatWeight(config.weights_by_stage?.[s]?.[dim.id])}
                        </TableCell>
                        <TableCell key={`${s}-b-${dim.id}`} className="text-center text-sm font-mono">
                          {formatBenchmark(config.targets_by_stage?.[s]?.[dim.id])}
                        </TableCell>
                        {hasAnyPotential && (
                          <TableCell key={`${s}-p-${dim.id}`} className="text-center text-sm font-mono">
                            {formatPotential(config.targets_by_stage?.[s]?.[dim.id])}
                          </TableCell>
                        )}
                      </>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-[11px] text-muted-foreground leading-snug">
              <strong>Benchmark</strong> = alvo por estágio definido pela JV.
              {hasAnyPotential && <> <strong>Potencial 6m</strong> = meta de 6 meses no programa.</>}
            </p>
          </CardContent>
        </Card>

        {/* Seção 4 — Red Flags */}
        {config.red_flags && config.red_flags.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Red Flags</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Red Flag</TableHead>
                    <TableHead className="w-[80px]">Nível</TableHead>
                    <TableHead>Gatilho</TableHead>
                    <TableHead>Ações Recomendadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.red_flags.map(rf => {
                    const sev = severityConfig(rf.severity);
                    const triggerTexts = rf.triggers.map(t => formatTrigger(t));
                    const fullTrigger = triggerTexts.join('; ');

                    return (
                      <TableRow key={rf.code}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium leading-tight">{rf.label}</p>
                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{rf.code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sev.variant} className={`text-[10px] ${sev.className || ''}`}>
                            {sev.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-xs text-muted-foreground line-clamp-2 cursor-help">{fullTrigger}</p>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-sm">
                              <p className="text-xs whitespace-pre-wrap">{fullTrigger}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <ul className="list-disc list-inside space-y-0.5 text-xs text-muted-foreground">
                            {rf.actions.map((a, i) => <li key={i}>{safeString(a)}</li>)}
                          </ul>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Seção 5 — Glossário */}
        {glossaryEntries.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Glossário</CardTitle></CardHeader>
            <CardContent>
              {useLetterDividers ? (
                <div className="space-y-4">
                  {Object.entries(glossaryByLetter).sort(([a], [b]) => a.localeCompare(b)).map(([letter, entries]) => (
                    <div key={letter}>
                      <div className="sticky top-0 bg-background z-10 pb-1 mb-2 border-b">
                        <span className="text-sm font-bold text-primary">{letter}</span>
                      </div>
                      <dl className="space-y-2">
                        {entries.map(([term, def]) => (
                          <div key={term} className="border-b border-border/50 pb-2 last:border-0">
                            <dt className="text-sm font-semibold">{toSentenceCase(term)}</dt>
                            <dd className="text-sm text-muted-foreground mt-0.5">{def}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <dl className="space-y-3">
                  {glossaryEntries.map(([term, def]) => (
                    <div key={term} className="border-b border-border/50 pb-2.5 last:border-0">
                      <dt className="text-sm font-semibold">{toSentenceCase(term)}</dt>
                      <dd className="text-sm text-muted-foreground mt-0.5">{def}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        )}

        {/* Seção 6 — Presets do Simulador */}
        {config.simulator?.presets && config.simulator.presets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Presets do Simulador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Valores por dimensão (escala 1–5)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {config.simulator.presets.map(preset => (
                  <Card key={preset.id} className="bg-secondary/30">
                    <CardContent className="pt-4 space-y-2">
                      <p className="text-sm font-bold">{preset.label}</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        {Object.entries(preset.dimension_scores).map(([dimId, score]) => {
                          const dim = config.dimensions.find(d => d.id === dimId);
                          const abbrev = dimAbbrev(dimId);
                          const fullName = dim?.label || dimId;
                          return (
                            <div key={dimId} className="flex justify-between text-xs">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground font-mono cursor-help" title={fullName}>{abbrev}</span>
                                </TooltipTrigger>
                                <TooltipContent side="left"><p className="text-xs">{fullName}</p></TooltipContent>
                              </Tooltip>
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
    </TooltipProvider>
  );
}
