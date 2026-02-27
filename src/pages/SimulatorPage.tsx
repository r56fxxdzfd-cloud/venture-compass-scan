import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateAssessmentResult } from '@/utils/scoring';
import { getCompleteness } from '@/utils/report-helpers';
import type { ConfigJSON, AssessmentResult, Answer } from '@/types/darwin';
import { SlidersHorizontal, Shuffle, Settings, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ReportHeader, OverallScoreCard, BlocksSection, RadarSection,
  DimensionScoresSection, RedFlagsSection, DimensionNarratives,
  RoadmapSection, DeepDiveSection,
} from '@/components/report/ReportSections';
import { QuickWinsSection, MeetingAgendaSection, RiskImpactMatrixSection } from '@/components/report/ParetoSections';

export default function SimulatorPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ConfigJSON | null>(null);
  const [configId, setConfigId] = useState('');
  const [sliders, setSliders] = useState<Record<string, number>>({});
  const [stage, setStage] = useState('seed');
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [noConfig, setNoConfig] = useState(false);

  const [customerType, setCustomerType] = useState('B2B');
  const [revenueModel, setRevenueModel] = useState('recurring');
  const [animKey, setAnimKey] = useState(0);
  const defaultNumericContext: Record<string, number> = {
    runway_months: 12, burn_monthly: 50000, headcount: 10, gross_margin_pct: 60,
    cac: 500, ltv: 5000, revenue_concentration_top1_pct: 30, revenue_concentration_top3_pct: 60,
  };
  const [numericContext, setNumericContext] = useState<Record<string, number>>({ ...defaultNumericContext });

  useEffect(() => {
    supabase
      .from('config_versions')
      .select('id, config_json')
      .eq('status', 'published')
      .single()
      .then(({ data }) => {
        if (data) {
          const cfg = data.config_json as unknown as ConfigJSON;
          setConfig(cfg);
          setConfigId(data.id);
          const initial: Record<string, number> = {};
          cfg.dimensions.forEach((d) => (initial[d.id] = 3));
          setSliders(initial);
        } else {
          setNoConfig(true);
        }
      });
  }, []);

  useEffect(() => {
    if (!config) return;
    const syntheticAnswers: Answer[] = [];
    const deltas = [-0.4, -0.2, 0, 0.2, 0.4];
    config.dimensions.forEach((dim) => {
      const baseScore = sliders[dim.id] || 3;
      const dimQuestions = config.questions.filter((q) => q.dimension_id === dim.id && q.is_active !== false);
      dimQuestions.forEach((q, i) => {
        const delta = deltas[i % deltas.length];
        const val = Math.max(1, Math.min(5, Math.round(baseScore + delta)));
        syntheticAnswers.push({ id: `sim-${q.id}`, assessment_id: 'simulation', question_id: q.id, value: val, is_na: false, notes: null, created_at: new Date().toISOString() });
      });
    });
    const res = calculateAssessmentResult(config, syntheticAnswers, stage, numericContext);
    setResult(res);
  }, [config, sliders, stage, numericContext]);

  const loadPreset = (presetId: string) => {
    const preset = config?.simulator?.presets?.find((p) => p.id === presetId);
    if (preset) {
      setSliders(preset.dimension_scores);
      if (preset.numeric_context_defaults) setNumericContext((prev) => ({ ...prev, ...preset.numeric_context_defaults }));
      setAnimKey((k) => k + 1);
    }
  };

  const randomize = () => {
    if (!config) return;
    const rand: Record<string, number> = {};
    config.dimensions.forEach((d) => { rand[d.id] = Math.round((1 + Math.random() * 4) * 10) / 10; });
    setSliders(rand);
    const stages = ['pre_seed', 'seed', 'series_a'];
    setStage(stages[Math.floor(Math.random() * stages.length)]);
    const customerTypes = ['B2B', 'B2C', 'B2B2C'];
    setCustomerType(customerTypes[Math.floor(Math.random() * customerTypes.length)]);
    const revenueModels = ['non_recurring', 'recurring', 'subscription', 'usage_based'];
    setRevenueModel(revenueModels[Math.floor(Math.random() * revenueModels.length)]);
    setNumericContext({
      runway_months: Math.round(3 + Math.random() * 21), burn_monthly: Math.round((20 + Math.random() * 180) * 1000),
      headcount: Math.round(3 + Math.random() * 47), gross_margin_pct: Math.round(20 + Math.random() * 60),
      cac: Math.round(50 + Math.random() * 1950), ltv: Math.round(500 + Math.random() * 19500),
      revenue_concentration_top1_pct: Math.round(10 + Math.random() * 70), revenue_concentration_top3_pct: Math.round(30 + Math.random() * 60),
    });
    setAnimKey((k) => k + 1);
  };

  const resetDefaults = () => {
    if (!config) return;
    const initial: Record<string, number> = {};
    config.dimensions.forEach((d) => (initial[d.id] = 3));
    setSliders(initial);
    setStage('seed');
    setCustomerType('B2B');
    setRevenueModel('recurring');
    setNumericContext({ ...defaultNumericContext });
    setAnimKey((k) => k + 1);
  };

  const updateNumeric = (key: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) setNumericContext((prev) => ({ ...prev, [key]: num }));
  };

  if (noConfig) {
    return (
      <div className="text-center py-16">
        <Settings className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground mb-4">Nenhuma configuração publicada. Acesse Configuração para importar e publicar uma versão.</p>
        <Button asChild variant="outline">
          <Link to="/app/admin/config">Ir para Configuração</Link>
        </Button>
      </div>
    );
  }

  if (!config || !result) return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div><Skeleton className="h-7 w-48 mb-2" /><Skeleton className="h-4 w-72" /></div>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Card><CardHeader><Skeleton className="h-4 w-28" /></CardHeader><CardContent className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-8 w-full" />)}</CardContent></Card>
          <Card><CardHeader><Skeleton className="h-4 w-28" /></CardHeader><CardContent className="space-y-3">{[1,2,3,4].map(i=><Skeleton key={i} className="h-8 w-full" />)}</CardContent></Card>
        </div>
        <div className="space-y-4">{[1,2,3].map(i=><Skeleton key={i} className="h-40 w-full rounded-lg" />)}</div>
      </div>
    </div>
  );

  const completeness = getCompleteness(result);
  const numericFields = [
    { key: 'runway_months', label: 'Runway (meses)', step: 1 },
    { key: 'burn_monthly', label: 'Burn Mensal (R$)', step: 1000 },
    { key: 'headcount', label: 'Headcount', step: 1 },
    { key: 'gross_margin_pct', label: 'Margem Bruta (%)', step: 1 },
    { key: 'cac', label: 'CAC (R$)', step: 50 },
    { key: 'ltv', label: 'LTV (R$)', step: 100 },
    { key: 'revenue_concentration_top1_pct', label: 'Concentração Top 1 (%)', step: 1 },
    { key: 'revenue_concentration_top3_pct', label: 'Concentração Top 3 (%)', step: 1 },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6" /> Simulador
        </h1>
        <p className="text-muted-foreground text-sm">Ajuste scores e contexto — veja o relatório completo em tempo real</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Configurações</CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={resetDefaults} className="h-7 text-xs gap-1">
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
                <Button variant="outline" size="sm" onClick={randomize} className="h-7 text-xs gap-1">
                  <Shuffle className="h-3 w-3" /> Random
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <motion.div key={`stage-${stage}-${animKey}`} className="space-y-2" initial={{ opacity: 0.5, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                <Label className="text-xs">Estágio</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre_seed">Pre-Seed</SelectItem>
                    <SelectItem value="seed">Seed</SelectItem>
                    <SelectItem value="series_a">Series A</SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>
              {config.simulator?.presets && config.simulator.presets.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Presets</Label>
                  <Select onValueChange={loadPreset}>
                    <SelectTrigger><SelectValue placeholder="Escolher preset" /></SelectTrigger>
                    <SelectContent>
                      {config.simulator.presets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <motion.div key={`ct-${customerType}-${animKey}`} className="space-y-1" initial={{ opacity: 0.5, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
                  <Label className="text-xs">Tipo de Cliente</Label>
                  <Select value={customerType} onValueChange={setCustomerType}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B2B">B2B</SelectItem>
                      <SelectItem value="B2C">B2C</SelectItem>
                      <SelectItem value="B2B2C">B2B2C</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>
                <motion.div key={`rm-${revenueModel}-${animKey}`} className="space-y-1" initial={{ opacity: 0.5, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
                  <Label className="text-xs">Modelo de Receita</Label>
                  <Select value={revenueModel} onValueChange={setRevenueModel}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="non_recurring">Não recorrente</SelectItem>
                      <SelectItem value="recurring">Recorrente</SelectItem>
                      <SelectItem value="subscription">Assinatura</SelectItem>
                      <SelectItem value="usage_based">Uso</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Contexto Numérico</CardTitle></CardHeader>
             <CardContent className="space-y-3">
              {numericFields.map((f, idx) => (
                <motion.div
                  key={`${f.key}-${numericContext[f.key]}-${animKey}`}
                  className="space-y-1"
                  initial={{ opacity: 0.5, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.03 }}
                >
                  <Label className="text-xs">{f.label}</Label>
                  <Input type="number" className="h-8 text-xs" value={numericContext[f.key] ?? ''} step={f.step} onChange={(e) => updateNumeric(f.key, e.target.value)} />
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Dimensões</CardTitle></CardHeader>
            <CardContent className="space-y-5">
          {config.dimensions.map((dim) => (
                <motion.div
                  key={dim.id}
                  className="space-y-2"
                  animate={{ scale: [1, 1.02, 1], backgroundColor: ['transparent', 'hsl(var(--primary) / 0.05)', 'transparent'] }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  // Re-trigger animation when slider value changes externally
                  // Using key suffix forces remount on big changes (Random/Preset)
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium">{dim.label}</label>
                    <motion.span
                      key={sliders[dim.id]}
                      className="text-xs font-mono text-primary font-semibold"
                      initial={{ scale: 1.3, color: 'hsl(var(--primary))' }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {(sliders[dim.id] || 3).toFixed(1)}
                    </motion.span>
                  </div>
                  <Slider value={[sliders[dim.id] || 3]} onValueChange={([val]) => setSliders((prev) => ({ ...prev, [dim.id]: val }))} min={1} max={5} step={0.1} />
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <QuickWinsSection config={config} result={result} stage={stage} />
          <MeetingAgendaSection config={config} result={result} stage={stage} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={JSON.stringify(result.overall_score) + stage}
            className="space-y-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <ReportHeader startupName="Simulação" stage={stage} date={new Date().toLocaleDateString('pt-BR')} completeness={completeness} isSimulation />
            <OverallScoreCard result={result} config={config} stage={stage} />
            <BlocksSection result={result} config={config} stage={stage} />
            <RadarSection result={result} />
            <RiskImpactMatrixSection config={config} result={result} stage={stage} />
            <DimensionScoresSection result={result} config={config} stage={stage} />
            <RedFlagsSection result={result} config={config} />
            <DimensionNarratives result={result} />
            <RoadmapSection result={result} config={config} stage={stage} />
            <DeepDiveSection result={result} config={config} />
            <div className="text-center py-4 text-xs text-muted-foreground italic">
              ⚠ SIMULAÇÃO — Dados fictícios para análise exploratória.
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
