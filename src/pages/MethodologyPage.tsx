import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BookOpen, Download, Loader2, Users, Target, AlertTriangle, TrendingUp } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { PILLARS, PILLAR_QUESTIONS, SCORE_ANCHORS, ACTION_RECOMMENDATIONS } from '@/utils/founder-scoring';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { ConfigJSON, ConfigVersion } from '@/types/darwin';
import '@/styles/methodology-print.css';

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
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [expandedDimensions, setExpandedDimensions] = useState<string[]>([]);
  const { toast } = useToast();

  const handleExportPDF = useCallback(async () => {
    if (!version || !config) return;
    setExporting(true);
    setExportProgress('Preparando conteúdo...');

    try {
      // 1. Expand all accordion dimensions
      const allDimIds = config.dimensions.map(d => d.id);
      setExpandedDimensions(allDimIds);

      // 2. Wait for DOM to settle
      await new Promise(r => setTimeout(r, 600));

      setExportProgress('Abrindo diálogo de impressão...');

      // 3. Set document title for PDF filename suggestion
      const originalTitle = document.title;
      const versionSlug = version.version_name.replace(/\s+/g, '_').toLowerCase();
      const today = new Date().toISOString().slice(0, 10);
      document.title = `metodologia_darwin_${versionSlug}_${today}`;

      // 4. Trigger print
      window.print();

      // 5. Restore everything after print dialog closes
      document.title = originalTitle;
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast({ title: 'Erro ao gerar PDF', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setExporting(false);
      setExportProgress('');
    }
  }, [version, config, toast]);

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
      <div id="methodology-content" className="space-y-8 max-w-5xl mx-auto">
        {/* Cover page — only visible in print */}
        <div id="pdf-cover">
          <h1>Metodologia</h1>
          <h2>Darwin Startup Readiness</h2>
          <p>Versão: {version.version_name}</p>
          <p>Publicada em: {version.published_at ? new Date(version.published_at).toLocaleDateString('pt-BR') : '—'}</p>
          <p>Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        <div id="section-header" className="executive-surface rounded-xl p-5 sm:p-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-6 w-6" /> Metodologia
            </h1>
            <p className="text-sm text-muted-foreground">
              Versão: {version.version_name} • Publicada em {version.published_at ? new Date(version.published_at).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
          <div data-print-hide="true" className="shrink-0 print:hidden text-right">
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
              {exporting ? 'Gerando...' : 'Exportar PDF'}
            </Button>
            {exportProgress && <p className="text-[10px] text-muted-foreground mt-1">{exportProgress}</p>}
          </div>
        </div>

        {/* Seção 1 — Sobre o Diagnóstico */}
        <Card id="section-about" className="executive-surface print-safe">
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
        <Card id="section-dimensions" className="executive-surface print-safe">
          <CardHeader><CardTitle className="text-base">Dimensões e Perguntas</CardTitle></CardHeader>
          <CardContent>
            <Accordion type="multiple" value={expandedDimensions} onValueChange={setExpandedDimensions}>
              {config.dimensions
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((dim) => {
                  const dimQuestions = config.questions
                    .filter(q => q.dimension_id === dim.id && q.is_active !== false)
                    .sort((a, b) => a.sort_order - b.sort_order);

                  return (
                    <AccordionItem key={dim.id} value={dim.id}>
                      <AccordionTrigger className="text-sm dimension-header">
                        {dim.label}
                        <Badge variant="outline" className="ml-2 text-[10px]" data-print-hide="true">{dimQuestions.length} perguntas</Badge>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          {dimQuestions.map((q, idx) => (
                            <div key={q.id} className="question-card pl-2 border-l-2 border-muted space-y-1">
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
        <Card id="section-weights" className="executive-surface print-safe">
          <CardHeader><CardTitle className="text-base">Pesos e Targets por Estágio</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Dimensão</TableHead>
                  {stages.map(s => (
                    <TableHead key={s} className="text-center" colSpan={colsPerStage}>{stageLabels[s]}</TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead />
                  {stages.map(s => (
                    <>
                      <TableHead key={`${s}-w`} className="text-center text-[10px]">Peso</TableHead>
                      <TableHead key={`${s}-b`} className="text-center text-[10px]">Bench.</TableHead>
                      {hasAnyPotential && <TableHead key={`${s}-p`} className="text-center text-[10px]">Pot.</TableHead>}
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
          <Card id="section-redflags" className="executive-surface print-safe">
            <CardHeader><CardTitle className="text-base">Red Flags</CardTitle></CardHeader>
            <CardContent>
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
                      <TableRow key={rf.code} className="red-flag-row">
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
                        <TableCell className="max-w-[280px]">
                          <p className="text-xs text-muted-foreground whitespace-normal break-words">{fullTrigger}</p>
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
          <Card id="section-glossary" className="executive-surface print-safe">
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
                          <div key={term} className="glossary-term border-b border-border/50 pb-2 last:border-0">
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
                    <div key={term} className="glossary-term border-b border-border/50 pb-2.5 last:border-0">
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
          <Card id="section-presets">
            <CardHeader>
              <CardTitle className="text-base">Presets do Simulador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Valores por dimensão (escala 1–5)</p>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                {config.dimensions.sort((a, b) => a.sort_order - b.sort_order).map(dim => (
                  <span key={dim.id}>
                    <span className="font-mono font-semibold text-foreground/70">{dimAbbrev(dim.id)}</span>
                    {' = '}
                    {dim.label}
                  </span>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {config.simulator.presets.map(preset => (
                  <Card key={preset.id} className="preset-card bg-secondary/30">
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

        {/* ═══════════════════════════════════════════════ */}
        {/* FOUNDER'S SCORE — METODOLOGIA                   */}
        {/* ═══════════════════════════════════════════════ */}

        <Separator className="my-8" />

        {/* FS.1 — Visão Geral */}
        <Card id="section-founder-score">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" /> Founder's Score — Metodologia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Em estágios iniciais, investidores frequentemente avaliam o time tanto quanto (ou mais do que) o modelo de negócio. O Founder's Score mede se os founders estão evoluindo sua capacidade de liderar uma empresa em crescimento acelerado. Responde às perguntas críticas: este founder tem o que é preciso para transformar seu projeto em realidade? Está ficando melhor a cada semestre? Evolui rápido o suficiente para justificar alocação de capital, tempo e reputação da JV?
            </p>
          </CardContent>
        </Card>

        {/* FS.2 — Princípios */}
        <Card id="section-fs-principles">
          <CardHeader><CardTitle className="text-base">Princípios da Metodologia</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="pl-2 border-l-2 border-primary/30"><strong className="text-foreground">Avaliação dual:</strong> perspectiva do founder (autoavaliação, registrada pelo JV) e perspectiva da JV — o delta entre as duas é informação estratégica</li>
              <li className="pl-2 border-l-2 border-primary/30"><strong className="text-foreground">Cadência semestral:</strong> a curva de evolução importa mais do que o número absoluto de um ciclo isolado</li>
              <li className="pl-2 border-l-2 border-primary/30"><strong className="text-foreground">Score composto:</strong> quando a startup tem múltiplos founders, o score da empresa é a média simples dos scores individuais ativos no semestre</li>
              <li className="pl-2 border-l-2 border-primary/30"><strong className="text-foreground">Foco em comportamento observável,</strong> não em intenção declarada</li>
              <li className="pl-2 border-l-2 border-primary/30"><strong className="text-foreground">Máximo de 2 pilares foco</strong> por semestre — concentração é a regra</li>
            </ul>
          </CardContent>
        </Card>

        {/* FS.3 — Os 5 Pilares */}
        <Card id="section-fs-pillars">
          <CardHeader><CardTitle className="text-base">Os 5 Pilares</CardTitle></CardHeader>
          <CardContent>
            <Accordion type="multiple">
              {PILLARS.map(pillar => {
                const questions = PILLAR_QUESTIONS[pillar.number] || [];
                return (
                  <AccordionItem key={pillar.number} value={`pillar-${pillar.number}`}>
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        Pilar {pillar.number} — {pillar.name}
                        <Badge variant={pillar.weight === 0 ? 'secondary' : 'default'} className="text-[10px]">
                          {pillar.weight === 0 ? 'Contexto' : `${(pillar.weight * 100).toFixed(0)}%`}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{pillar.description}</p>
                      {pillar.number === 0 && (
                        <p className="text-xs text-muted-foreground italic bg-secondary/50 p-2 rounded">
                          Não entra no score, mas aparece no relatório como contexto. Ancora a leitura dos demais pilares — um founder sem cadência básica tem os outros pilares comprometidos estruturalmente.
                        </p>
                      )}
                      {pillar.number === 1 && (
                        <p className="text-xs text-muted-foreground italic bg-primary/5 p-2 rounded border border-primary/10">
                          <strong>Pergunta-chave de conselho:</strong> "O time sobreviveria se o founder desaparecesse amanhã?"
                        </p>
                      )}
                      {pillar.number === 3 && (
                        <p className="text-xs text-muted-foreground italic bg-primary/5 p-2 rounded border border-primary/10">
                          <strong>Pergunta-chave de conselho:</strong> "O founder influencia decisões ou apenas reage a elas?"
                        </p>
                      )}
                      {pillar.number === 4 && (
                        <p className="text-xs text-muted-foreground italic bg-primary/5 p-2 rounded border border-primary/10">
                          Maior peso — maior fator de sobrevivência em estágio inicial.
                        </p>
                      )}
                      {questions.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Perguntas de referência:</p>
                          <ul className="space-y-1">
                            {questions.map((q, i) => (
                              <li key={i} className="text-sm text-muted-foreground pl-2 border-l-2 border-muted">
                                {i + 1}. {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* FS.4 — Escala de Notas */}
        <Card id="section-fs-scale">
          <CardHeader><CardTitle className="text-base">Escala de Notas (Âncoras 1–5)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Nota</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(SCORE_ANCHORS).map(([score, label]) => (
                  <TableRow key={score}>
                    <TableCell className="font-mono font-bold text-lg">{score}</TableCell>
                    <TableCell className="text-sm">{label}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* FS.5 — Fórmula do Score */}
        <Card id="section-fs-formula">
          <CardHeader><CardTitle className="text-base">Fórmula do Score</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score por pilar usado</p>
                <p className="text-sm font-mono">score_pilar = média(nota_auto, nota_jv)</p>
                <p className="text-xs text-muted-foreground">Quando ambas disponíveis. Se apenas uma, usa a disponível.</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Founder Score Individual (0–100)</p>
                <p className="text-sm font-mono">score = Σ(peso_pilar × nota_usada) × 20</p>
                <p className="text-xs text-muted-foreground">Apenas pilares 1 a 5 entram no cálculo (pilar 0 excluído).</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score Composto da Startup</p>
                <p className="text-sm font-mono">composto = média_simples(scores_individuais)</p>
                <p className="text-xs text-muted-foreground">Média de todos os founders ativos com avaliação no semestre vigente.</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delta</p>
                <p className="text-sm font-mono">delta = nota_jv − nota_auto</p>
                <p className="text-xs text-muted-foreground">
                  Delta negativo (founder superestima): sinal de alerta. Delta positivo (founder subestima): oportunidade de coaching.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FS.6 — Interpretação do Score */}
        <Card id="section-fs-interpretation">
          <CardHeader><CardTitle className="text-base">Interpretação do Score</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Score</TableHead>
                  <TableHead>Interpretação</TableHead>
                  <TableHead className="w-[100px]">Nível</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono font-bold">80–100</TableCell>
                  <TableCell className="text-sm">Founder em forte evolução</TableCell>
                  <TableCell><Badge className="bg-emerald-500/80 text-white text-[10px]">Verde</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono font-bold">65–79</TableCell>
                  <TableCell className="text-sm">Evolução positiva, com alertas</TableCell>
                  <TableCell><Badge className="bg-amber-500/80 text-white text-[10px]">Amarelo</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono font-bold">50–64</TableCell>
                  <TableCell className="text-sm">Risco de estagnação</TableCell>
                  <TableCell><Badge className="bg-orange-500/80 text-white text-[10px]">Laranja</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono font-bold">&lt; 50</TableCell>
                  <TableCell className="text-sm">Risco estrutural de liderança</TableCell>
                  <TableCell><Badge variant="destructive" className="text-[10px]">Vermelho</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground italic">
              O mais importante não é o número absoluto — é a curva de evolução ao longo dos semestres.
            </p>
          </CardContent>
        </Card>

        {/* FS.7 — Red Flags do Founder */}
        <Card id="section-fs-redflags">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Red Flags do Founder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gatilho</TableHead>
                  <TableHead className="w-[100px]">Severidade</TableHead>
                  <TableHead>Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm">Score composto &lt; 50</TableCell>
                  <TableCell><Badge variant="destructive" className="text-[10px]">Alta</Badge></TableCell>
                  <TableCell className="text-sm">Risco estrutural de liderança no time fundador</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Qualquer founder individual com score &lt; 50</TableCell>
                  <TableCell><Badge variant="destructive" className="text-[10px]">Alta</Badge></TableCell>
                  <TableCell className="text-sm">Risco estrutural: [nome] com score [X]</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Delta (JV − auto) &lt; −1.5 em qualquer pilar</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">Média</Badge></TableCell>
                  <TableCell className="text-sm">Desalinhamento de percepção: founder superestima [pilar]</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Score composto atual &lt; semestre anterior − 10 pontos</TableCell>
                  <TableCell><Badge variant="destructive" className="text-[10px]">Alta</Badge></TableCell>
                  <TableCell className="text-sm">Regressão no Founder Score composto</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">Founder ativo sem avaliação no semestre vigente</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">Baixa</Badge></TableCell>
                  <TableCell className="text-sm">Founder Score desatualizado (último: [semestre])</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* FS.8 — Plano 30-60-90 */}
        <Card id="section-fs-action-plan">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" /> Plano 30-60-90
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Lógica de geração automática:</p>
              <ul className="space-y-1.5">
                <li className="pl-2 border-l-2 border-muted">Calcula-se o <strong className="text-foreground font-mono">priority_score</strong> de cada pilar: <span className="font-mono">(5 − nota_usada) × peso</span></li>
                <li className="pl-2 border-l-2 border-muted">Os <strong className="text-foreground">2 pilares</strong> com maior priority_score tornam-se os pilares foco do semestre</li>
                <li className="pl-2 border-l-2 border-muted"><strong className="text-foreground">Regra inegociável:</strong> máximo de 2 pilares foco por semestre</li>
                <li className="pl-2 border-l-2 border-muted">Para cada pilar foco, a recomendação é determinada pelo <strong className="text-foreground">nível do founder</strong> naquele pilar (1, 2 ou 3)</li>
              </ul>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Cadência do plano:</p>
              <ul className="space-y-1">
                <li className="pl-2 border-l-2 border-primary/30"><strong className="text-foreground">30 dias:</strong> ação estrutural básica + KPI + comportamento-chave + anti-meta</li>
                <li className="pl-2 border-l-2 border-primary/30"><strong className="text-foreground">60 dias:</strong> consolidar o ritual/hábito, medir KPI, reduzir variabilidade</li>
                <li className="pl-2 border-l-2 border-primary/30"><strong className="text-foreground">90 dias:</strong> institucionalizar (playbook/checklist), reduzir dependência do founder, preparar o próximo foco</li>
              </ul>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4">Recomendações por Pilar e Nível</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Pilar</TableHead>
                    <TableHead className="min-w-[200px]">Nível 1 (nota ≤2)</TableHead>
                    <TableHead className="min-w-[200px]">Nível 2 (nota 3)</TableHead>
                    <TableHead className="min-w-[200px]">Nível 3 (nota ≥4)</TableHead>
                    <TableHead className="min-w-[200px]">Entrega esperada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PILLARS.filter(p => p.number >= 1).map(pillar => {
                    const recs = ACTION_RECOMMENDATIONS[pillar.number];
                    return (
                      <TableRow key={pillar.number}>
                        <TableCell className="text-sm font-medium">{pillar.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{recs?.[1]?.actions || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{recs?.[2]?.actions || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{recs?.[3]?.actions || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{recs?.[1]?.delivery || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* FS.9 — Cadência e Governança */}
        <Card id="section-fs-governance">
          <CardHeader><CardTitle className="text-base">Cadência e Governança</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="pl-2 border-l-2 border-muted"><strong className="text-foreground">Avaliação:</strong> semestral (mínimo 180 dias entre avaliações do mesmo founder)</li>
              <li className="pl-2 border-l-2 border-muted"><strong className="text-foreground">Check-in:</strong> quinzenal dentro do semestre ativo (4 perguntas fixas: o que foi entregue? próximo passo? o que travou? pilar foco subindo ou estável?)</li>
              <li className="pl-2 border-l-2 border-muted"><strong className="text-foreground">Quem preenche:</strong> exclusivamente a JV — o founder não acessa o sistema</li>
              <li className="pl-2 border-l-2 border-muted"><strong className="text-foreground">Perspectiva "autoavaliação":</strong> registrada pelo JV com base no que o founder relatou em conversa/entrevista</li>
              <li className="pl-2 border-l-2 border-muted"><strong className="text-foreground">PDF do Founder Score:</strong> documento separado e confidencial, exportado independentemente do PDF da startup</li>
            </ul>
          </CardContent>
        </Card>

        {/* FS.10 — Glossário do Módulo */}
        <Card id="section-fs-glossary">
          <CardHeader><CardTitle className="text-base">Glossário — Founder's Score</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {[
                ['Founder Score', 'Score 0–100 que mede a evolução do founder como líder de empresa em crescimento acelerado'],
                ['Score Composto', 'Média simples dos Founder Scores individuais de todos os founders ativos no semestre'],
                ['Delta', 'Diferença entre nota JV e nota autoavaliação (positivo = founder subestima; negativo = founder superestima)'],
                ['Pilar Foco', 'Um dos 2 pilares com maior priority_score no semestre — foco de desenvolvimento obrigatório'],
                ['Priority Score', '(5 − nota usada) × peso do pilar — determina quais pilares têm maior gap ponderado'],
                ['Nível do Pilar', 'Classificação 1/2/3 baseada na nota usada: ≤2 = Nível 1; 3 = Nível 2; ≥4 = Nível 3'],
                ['Perspectiva JV', 'Avaliação independente feita pelo analista JV com base em evidências observáveis'],
                ['Perspectiva Auto', 'Autoavaliação do founder, registrada pelo JV com base no relato do próprio founder'],
              ].map(([term, def]) => (
                <div key={term} className="glossary-term border-b border-border/50 pb-2.5 last:border-0">
                  <dt className="text-sm font-semibold">{term}</dt>
                  <dd className="text-sm text-muted-foreground mt-0.5">{def}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
