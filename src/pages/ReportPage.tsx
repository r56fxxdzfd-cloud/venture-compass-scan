import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, AlertTriangle, TrendingDown, Lightbulb } from 'lucide-react';
import { DarwinRadarChart } from '@/components/DarwinRadarChart';
import { calculateAssessmentResult } from '@/utils/scoring';
import type { ConfigJSON, Answer, Assessment, AssessmentResult } from '@/types/darwin';
import { motion } from 'framer-motion';

export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [config, setConfig] = useState<ConfigJSON | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: a } = await supabase
        .from('assessments')
        .select('*, company:companies(*)')
        .eq('id', id)
        .single();
      if (!a) return;
      setAssessment(a as unknown as Assessment);

      const { data: cv } = await supabase
        .from('config_versions')
        .select('config_json')
        .eq('id', a.config_version_id)
        .single();
      if (!cv) return;
      const cfg = cv.config_json as unknown as ConfigJSON;
      setConfig(cfg);

      const { data: answers } = await supabase
        .from('answers')
        .select('*')
        .eq('assessment_id', id);

      const res = calculateAssessmentResult(
        cfg,
        (answers || []) as Answer[],
        a.stage || 'seed',
        (a.context_numeric as Record<string, number>) || {}
      );
      setResult(res);
    };
    load();
  }, [id]);

  if (!result || !config || !assessment) return null;

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-success';
    if (score >= 3) return 'text-warning';
    return 'text-destructive';
  };

  const gaps = [...result.dimension_scores]
    .filter((ds) => ds.coverage > 0)
    .map((ds) => ({ ...ds, gap: ds.target - ds.score }))
    .filter((ds) => ds.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 10);

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="report-root">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">
              Relatório — {(assessment as any).company?.name || 'Startup'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {new Date(assessment.created_at).toLocaleDateString('pt-BR')} •{' '}
              <Badge variant={assessment.status === 'completed' ? 'default' : 'secondary'}>
                {assessment.status === 'completed' ? 'Concluído' : 'Parcial'}
              </Badge>
            </p>
          </div>
        </div>
        {assessment.status === 'completed' && (
          <Button variant="outline" size="sm">
            <Download className="mr-1 h-3 w-3" /> Exportar PDF
          </Button>
        )}
      </div>

      {/* Score geral */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Score Geral Ponderado</p>
            <p className={`hero-score ${getScoreColor(result.overall_score)}`}>
              {result.overall_score.toFixed(1)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">de 5.0</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Radar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Radar — Atual vs Benchmark</CardTitle>
        </CardHeader>
        <CardContent>
          <DarwinRadarChart dimensionScores={result.dimension_scores} showBenchmark />
        </CardContent>
      </Card>

      {/* Gaps */}
      {gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Top Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gaps.map((g, i) => (
                <div key={g.dimension_id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                    <span className="text-sm font-medium">{g.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={getScoreColor(g.score)}>{g.score.toFixed(1)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-muted-foreground">{g.target.toFixed(1)}</span>
                    <Badge variant="destructive" className="text-xs">
                      -{g.gap.toFixed(1)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Red Flags */}
      {result.red_flags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Red Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.red_flags.map((rf) => (
              <div key={rf.code} className="red-flag-badge">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="destructive" className="text-xs">{rf.severity}</Badge>
                  <span className="text-sm font-semibold">{rf.label}</span>
                </div>
                {rf.actions.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                    {rf.actions.map((a, i) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Deep Dive */}
      {result.deep_dive_dimensions.length > 0 && config.deep_dive_prompts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-accent" /> Deep Dive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.deep_dive_dimensions.map((dimId) => {
              const dim = config.dimensions.find((d) => d.id === dimId);
              const prompts = config.deep_dive_prompts?.[dimId] || [];
              if (!dim || prompts.length === 0) return null;

              return (
                <div key={dimId}>
                  <p className="text-sm font-semibold mb-2">{dim.label}</p>
                  <ul className="space-y-1">
                    {prompts.map((p, i) => (
                      <li key={i} className="text-sm text-muted-foreground pl-4 border-l-2 border-accent">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Dimension scores table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scores por Dimensão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {result.dimension_scores.map((ds) => (
              <div key={ds.dimension_id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm">{ds.label}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">
                    {Math.round(ds.coverage * 100)}% cobertura
                  </span>
                  <span className={`text-sm font-semibold font-mono ${getScoreColor(ds.score)}`}>
                    {ds.score.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
