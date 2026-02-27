import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download } from 'lucide-react';
import { calculateAssessmentResult } from '@/utils/scoring';
import { getCompleteness } from '@/utils/report-helpers';
import type { ConfigJSON, Answer, Assessment, AssessmentResult } from '@/types/darwin';
import {
  ReportHeader, OverallScoreCard, BlocksSection, RadarSection,
  DimensionScoresSection, RedFlagsSection, DimensionNarratives,
  RoadmapSection, DeepDiveSection,
} from '@/components/report/ReportSections';

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

  const stage = assessment.stage || 'seed';
  const completeness = getCompleteness(result);
  const startupName = (assessment as any).company?.name || 'Startup';
  const isSimulation = assessment.is_simulation;

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="report-root">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Relatório — {startupName}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(assessment.created_at).toLocaleDateString('pt-BR')} •{' '}
              <Badge variant={assessment.status === 'completed' ? 'default' : 'secondary'}>
                {assessment.status === 'completed' ? 'Concluído' : 'Parcial'}
              </Badge>
            </p>
          </div>
        </div>
        {assessment.status === 'completed' && completeness.confidence !== 'low' && !isSimulation && (
          <Button variant="outline" size="sm">
            <Download className="mr-1 h-3 w-3" /> Exportar PDF
          </Button>
        )}
      </div>

      {/* A. Header */}
      <ReportHeader
        startupName={startupName}
        stage={stage}
        date={new Date(assessment.created_at).toLocaleDateString('pt-BR')}
        completeness={completeness}
        isSimulation={isSimulation}
      />

      {/* B. Overall Score */}
      <OverallScoreCard result={result} config={config} stage={stage} />

      {/* C. Blocks */}
      <BlocksSection result={result} config={config} stage={stage} />

      {/* D. Radar */}
      <RadarSection result={result} />

      {/* E. Dimension Scores + Gaps */}
      <DimensionScoresSection result={result} config={config} stage={stage} />

      {/* F. Red Flags */}
      <RedFlagsSection result={result} config={config} />

      {/* G. Dimension Narratives */}
      <DimensionNarratives result={result} />

      {/* H. Roadmap */}
      <RoadmapSection result={result} config={config} stage={stage} />

      {/* I. Deep Dive */}
      <DeepDiveSection result={result} config={config} />

      {completeness.confidence === 'low' && (
        <div className="text-center py-4 text-xs text-muted-foreground italic">
          ⚠ RASCUNHO / BAIXA COMPLETUDE — Este relatório é preliminar.
        </div>
      )}
      {isSimulation && (
        <div className="text-center py-4 text-xs text-muted-foreground italic">
          ⚠ SIMULAÇÃO — Este relatório é baseado em dados simulados.
        </div>
      )}
    </div>
  );
}
