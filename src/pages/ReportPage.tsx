import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { calculateAssessmentResult } from '@/utils/scoring';
import { getCompleteness } from '@/utils/report-helpers';
import { useToast } from '@/hooks/use-toast';
import type { ConfigJSON, Answer, Assessment, AssessmentResult } from '@/types/darwin';
import {
  ReportHeader, OverallScoreCard, BlocksSection, RadarSection,
  DimensionScoresSection, RedFlagsSection, DimensionNarratives,
  RoadmapSection, DeepDiveSection,
} from '@/components/report/ReportSections';
import { QuickWinsSection, MeetingAgendaSection, RiskImpactMatrixSection } from '@/components/report/ParetoSections';

const anchorLinks = [
  { label: 'Score Geral', id: 'section-overall' },
  { label: 'Blocos', id: 'section-blocks' },
  { label: 'Radar', id: 'section-radar' },
  { label: 'Gaps', id: 'section-gaps' },
  { label: 'Red Flags', id: 'section-redflags' },
  { label: 'Quick Wins', id: 'section-quickwins' },
  { label: 'Roadmap', id: 'section-roadmap' },
  { label: 'Deep Dive', id: 'section-deepdive' },
];

export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [config, setConfig] = useState<ConfigJSON | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: a } = await supabase.from('assessments').select('*, company:companies(*)').eq('id', id).single();
      if (!a) return;
      setAssessment(a as unknown as Assessment);

      const { data: cv } = await supabase.from('config_versions').select('config_json').eq('id', a.config_version_id).single();
      if (!cv) return;
      const cfg = cv.config_json as unknown as ConfigJSON;
      setConfig(cfg);

      const { data: answers } = await supabase.from('answers').select('*').eq('assessment_id', id);
      const res = calculateAssessmentResult(cfg, (answers || []) as Answer[], a.stage || 'seed', (a.context_numeric as Record<string, number>) || {});
      setResult(res);
    };
    load();
  }, [id]);

  const handleExportPDF = async () => {
    if (!result || !assessment) return;
    const completeness = getCompleteness(result);
    const isSimulation = assessment.is_simulation;

    if (completeness.confidence === 'low' && !isSimulation) {
      toast({ title: 'Completude insuficiente', description: 'Complete mais questões antes de exportar.', variant: 'destructive' });
      return;
    }

    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      const element = document.getElementById('report-root');
      if (!element) throw new Error('Report element not found');

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, windowWidth: 1024 });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL('image/png');

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = position - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      if (isSimulation) {
        const totalPages = pdf.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(60);
          pdf.setTextColor(255, 0, 0);
          pdf.saveGraphicsState();
          pdf.setGState(new (pdf as any).GState({ opacity: 0.15 }));
          pdf.text('SIMULAÇÃO', imgWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
          pdf.restoreGraphicsState();
        }
      }

      const startupName = (assessment as any).company?.name || 'Startup';
      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`${startupName}-diagnostico-${dateStr}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      toast({ title: 'Erro ao exportar PDF', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  if (!result || !config || !assessment) return null;

  const stage = assessment.stage || 'seed';
  const completeness = getCompleteness(result);
  const startupName = (assessment as any).company?.name || 'Startup';
  const isSimulation = assessment.is_simulation;

  const scrollTo = (elId: string) => {
    document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto overflow-x-hidden" id="report-root">
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
        {(assessment.status === 'completed' && completeness.confidence !== 'low' && !isSimulation) && (
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Gerando PDF...</> : <><Download className="mr-1 h-3 w-3" /> Exportar PDF</>}
          </Button>
        )}
        {isSimulation && (
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Gerando PDF...</> : <><Download className="mr-1 h-3 w-3" /> Exportar PDF (Simulação)</>}
          </Button>
        )}
      </div>

      {/* Anchor index bar - screen only */}
      <div className="flex flex-wrap gap-2 border-b pb-3 print:hidden" data-html2canvas-ignore="true">
        {anchorLinks.map((link, i) => (
          <button
            key={link.id}
            onClick={() => scrollTo(link.id)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {link.label}
            {i < anchorLinks.length - 1 && <span className="ml-2 text-border">|</span>}
          </button>
        ))}
      </div>

      <ReportHeader startupName={startupName} stage={stage} date={new Date(assessment.created_at).toLocaleDateString('pt-BR')} completeness={completeness} isSimulation={isSimulation} />

      <div id="section-overall">
        <OverallScoreCard result={result} config={config} stage={stage} />
      </div>

      <div id="section-blocks">
        <BlocksSection result={result} config={config} stage={stage} />
      </div>

      <div id="section-radar">
        <RadarSection result={result} />
      </div>

      <div id="section-gaps">
        <DimensionScoresSection result={result} config={config} stage={stage} />
      </div>

      <div id="section-redflags">
        <RedFlagsSection result={result} config={config} />
      </div>

      <DimensionNarratives result={result} />

      <div id="section-roadmap">
        <RoadmapSection result={result} config={config} stage={stage} />
      </div>

      <div id="section-deepdive">
        <DeepDiveSection result={result} config={config} />
      </div>

      <div id="section-quickwins">
        <QuickWinsSection config={config} result={result} stage={stage} />
      </div>

      <MeetingAgendaSection config={config} result={result} stage={stage} />
      <RiskImpactMatrixSection config={config} result={result} stage={stage} />

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
