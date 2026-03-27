import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DarwinRadarChart } from '@/components/DarwinRadarChart';
import {
  PILLARS, getFounderStageLabel, getPillarLevel, computePillarScoreUsed,
} from '@/utils/founder-scoring';
import type { FounderAssessment, FounderPillarScore, FounderActionPlan, Founder } from '@/types/founder';
import type { Company } from '@/types/darwin';

export default function FounderAssessmentPdfPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [assessment, setAssessment] = useState<FounderAssessment | null>(null);
  const [founder, setFounder] = useState<Founder | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [pillars, setPillars] = useState<FounderPillarScore[]>([]);
  const [actionPlan, setActionPlan] = useState<FounderActionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: a } = await supabase.from('founder_assessments').select('*').eq('id', id).single();
      if (!a) { setLoading(false); return; }
      const ass = a as FounderAssessment;
      setAssessment(ass);

      const [fRes, cRes, pRes, apRes] = await Promise.all([
        supabase.from('founders').select('*').eq('id', ass.founder_id).single(),
        supabase.from('companies').select('*').eq('id', ass.company_id).single(),
        supabase.from('founder_pillar_scores').select('*').eq('founder_assessment_id', id).order('pillar_number'),
        supabase.from('founder_action_plans').select('*').eq('founder_assessment_id', id).single(),
      ]);

      if (fRes.data) setFounder(fRes.data as Founder);
      if (cRes.data) setCompany(cRes.data as Company);
      setPillars((pRes.data || []) as FounderPillarScore[]);
      if (apRes.data) setActionPlan(apRes.data as unknown as FounderActionPlan);
      setLoading(false);
    };
    load();
  }, [id]);

  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      const element = printRef.current;
      if (!element) throw new Error('Element not found');

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, windowWidth: 900 });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL('image/jpeg', 0.82);

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Watermark for structural risk
      if (isRisk) {
        const totalPages = pdf.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(50);
          pdf.setTextColor(255, 0, 0);
          pdf.saveGraphicsState();
          pdf.setGState(new (pdf as any).GState({ opacity: 0.12 }));
          pdf.text('RISCO ESTRUTURAL', imgWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
          pdf.restoreGraphicsState();
        }
      }

      const founderName = founder?.name?.replace(/\s+/g, '-') || 'founder';
      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`FounderScore-${founderName}-${dateStr}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) return <Skeleton className="h-64" />;
  if (!assessment || !founder) return <p>Não encontrado.</p>;

  const stage = assessment.score_used != null ? getFounderStageLabel(assessment.score_used) : null;
  const isRisk = assessment.score_used != null && assessment.score_used < 50;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-bold flex-1">PDF — Founder Score</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>Imprimir</Button>
          <Button onClick={handleExportPdf} disabled={exporting}>
            <Download className="mr-1 h-4 w-4" /> {exporting ? 'Gerando...' : 'Exportar PDF'}
          </Button>
        </div>
      </div>

      <div ref={printRef} className="space-y-6 print:space-y-4">
        {/* Watermark */}
        {isRisk && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50 print:flex hidden">
            <p className="text-6xl font-bold text-destructive/10 rotate-[-30deg] whitespace-nowrap">
              RISCO ESTRUTURAL DE LIDERANÇA
            </p>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Founder Score — {founder.name}</h1>
          <p className="text-muted-foreground">{company?.name} · {assessment.semester} · {new Date(assessment.assessment_date).toLocaleDateString('pt-BR')}</p>
        </div>

        {/* Score */}
        <div className="text-center py-4">
          <p className="text-5xl font-bold">{assessment.score_used?.toFixed(1) ?? '—'}</p>
          {stage && <p className={`text-lg font-semibold ${stage.color}`}>{stage.label}</p>}
          <p className="text-sm text-muted-foreground mt-1">
            Auto: {assessment.score_auto?.toFixed(1) ?? '—'} · JV: {assessment.score_jv?.toFixed(1) ?? '—'}
          </p>
        </div>

        {/* Pillar table */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Pilares</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2">Pilar</th>
                  <th className="text-center py-2">Peso</th>
                  <th className="text-center py-2">Auto</th>
                  <th className="text-center py-2">JV</th>
                  <th className="text-center py-2">Delta</th>
                  <th className="text-center py-2">Nível</th>
                </tr>
              </thead>
              <tbody>
                {pillars.map(p => {
                  const used = computePillarScoreUsed(p.score_auto, p.score_jv);
                  const level = used != null ? getPillarLevel(used) : null;
                  return (
                    <tr key={p.pillar_number} className="border-b last:border-0">
                      <td className="py-2">P{p.pillar_number} — {p.pillar_name}</td>
                      <td className="text-center">{(p.weight * 100).toFixed(0)}%</td>
                      <td className="text-center">{p.score_auto ?? '—'}</td>
                      <td className="text-center">{p.score_jv ?? '—'}</td>
                      <td className="text-center">{p.delta !== 0 ? (p.delta > 0 ? '+' : '') + p.delta.toFixed(1) : '0'}</td>
                      <td className="text-center">{level ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Action Plan */}
        {actionPlan && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Plano 30-60-90</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {actionPlan.pillar_focus_1 && <Badge>Foco 1: {PILLARS[actionPlan.pillar_focus_1]?.name}</Badge>}
                {actionPlan.pillar_focus_2 && <Badge variant="secondary">Foco 2: {PILLARS[actionPlan.pillar_focus_2]?.name}</Badge>}
              </div>
              {(actionPlan.actions_30d as any[])?.map((a: any, i: number) => (
                <div key={i} className="p-3 rounded border">
                  <p className="text-xs font-semibold text-muted-foreground">Pilar {a.pillar}</p>
                  <p className="text-sm"><strong>Ações:</strong> {a.action}</p>
                  <p className="text-sm"><strong>Entrega:</strong> {a.expected_delivery}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          Documento confidencial — uso interno JV / Darwin
        </p>
      </div>
    </div>
  );
}
