import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DarwinRadarChart } from '@/components/DarwinRadarChart';
import { calculateAssessmentResult } from '@/utils/scoring';
import type { ConfigJSON, DimensionScore, AssessmentResult, Answer } from '@/types/darwin';
import { SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SimulatorPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ConfigJSON | null>(null);
  const [configId, setConfigId] = useState('');
  const [sliders, setSliders] = useState<Record<string, number>>({});
  const [stage, setStage] = useState('seed');
  const [result, setResult] = useState<AssessmentResult | null>(null);

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
        }
      });
  }, []);

  useEffect(() => {
    if (!config) return;
    // Generate synthetic answers
    const syntheticAnswers: Answer[] = [];
    const deltas = [-0.4, -0.2, 0, 0.2, 0.4];

    config.dimensions.forEach((dim) => {
      const baseScore = sliders[dim.id] || 3;
      const dimQuestions = config.questions.filter(
        (q) => q.dimension_id === dim.id && q.is_active !== false
      );
      dimQuestions.forEach((q, i) => {
        const delta = deltas[i % deltas.length];
        const val = Math.max(1, Math.min(5, Math.round(baseScore + delta)));
        syntheticAnswers.push({
          id: `sim-${q.id}`,
          assessment_id: 'simulation',
          question_id: q.id,
          value: val,
          is_na: false,
          notes: null,
          created_at: new Date().toISOString(),
        });
      });
    });

    const res = calculateAssessmentResult(config, syntheticAnswers, stage, {});
    setResult(res);
  }, [config, sliders, stage]);

  const loadPreset = (presetId: string) => {
    const preset = config?.simulator?.presets?.find((p) => p.id === presetId);
    if (preset) {
      setSliders(preset.dimension_scores);
    }
  };

  if (!config || !result) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6" /> Simulador
        </h1>
        <p className="text-muted-foreground text-sm">
          Ajuste os scores por dimensão e veja o resultado em tempo real
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Estágio</label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre_seed">Pre-Seed</SelectItem>
                    <SelectItem value="seed">Seed</SelectItem>
                    <SelectItem value="series_a">Series A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.simulator?.presets && config.simulator.presets.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Presets</label>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dimensões</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {config.dimensions.map((dim) => (
                <div key={dim.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium">{dim.label}</label>
                    <span className="text-xs font-mono text-primary font-semibold">
                      {(sliders[dim.id] || 3).toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[sliders[dim.id] || 3]}
                    onValueChange={([val]) =>
                      setSliders((prev) => ({ ...prev, [dim.id]: val }))
                    }
                    min={1}
                    max={5}
                    step={0.1}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Score Simulado</p>
                <p className="hero-score">{result.overall_score.toFixed(1)}</p>
              </CardContent>
            </Card>
          </motion.div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Radar Simulado</CardTitle>
            </CardHeader>
            <CardContent>
              <DarwinRadarChart dimensionScores={result.dimension_scores} showBenchmark />
            </CardContent>
          </Card>

          {result.red_flags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-destructive">Red Flags ({result.red_flags.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.red_flags.map((rf) => (
                  <div key={rf.code} className="red-flag-badge text-sm">
                    <strong>{rf.label}</strong> — {rf.severity}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
