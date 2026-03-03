import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, FileText, Plus, AlertTriangle, TrendingUp, TrendingDown, Target,
  CheckCircle2, Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DarwinRadarChart } from '@/components/DarwinRadarChart';
import {
  PILLARS, getFounderStageLabel, getPillarLevel, computePillarScoreUsed,
  ACTION_RECOMMENDATIONS
} from '@/utils/founder-scoring';
import type { FounderAssessment, FounderPillarScore, FounderActionPlan, FounderCheckin, Founder } from '@/types/founder';
import type { Company } from '@/types/darwin';

export default function FounderAssessmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isAnalyst } = useAuth();
  const canWrite = isAdmin || isAnalyst;

  const [assessment, setAssessment] = useState<FounderAssessment | null>(null);
  const [founder, setFounder] = useState<Founder | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [pillars, setPillars] = useState<FounderPillarScore[]>([]);
  const [actionPlan, setActionPlan] = useState<FounderActionPlan | null>(null);
  const [checkins, setCheckins] = useState<FounderCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  // Checkin dialog
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinForm, setCheckinForm] = useState({
    delivered_summary: '', evidence_link: '', next_step: '',
    next_step_owner: '', next_step_due: '', blocked: '',
    decision_made: '', quick_score: '',
  });
  const [checkinSaving, setCheckinSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    const { data: a } = await supabase.from('founder_assessments').select('*').eq('id', id!).single();
    if (!a) { setLoading(false); return; }
    const ass = a as FounderAssessment;
    setAssessment(ass);

    const [fRes, cRes, pRes, apRes, chRes] = await Promise.all([
      supabase.from('founders').select('*').eq('id', ass.founder_id).single(),
      supabase.from('companies').select('*').eq('id', ass.company_id).single(),
      supabase.from('founder_pillar_scores').select('*').eq('founder_assessment_id', id!).order('pillar_number'),
      supabase.from('founder_action_plans').select('*').eq('founder_assessment_id', id!).single(),
      supabase.from('founder_checkins').select('*').eq('founder_assessment_id', id!).order('checkin_date', { ascending: false }),
    ]);

    if (fRes.data) setFounder(fRes.data as Founder);
    if (cRes.data) setCompany(cRes.data as Company);
    setPillars((pRes.data || []) as FounderPillarScore[]);
    if (apRes.data) setActionPlan(apRes.data as unknown as FounderActionPlan);
    setCheckins((chRes.data || []) as FounderCheckin[]);
    setLoading(false);
  };

  const handleAddCheckin = async () => {
    setCheckinSaving(true);
    const { error } = await supabase.from('founder_checkins').insert({
      founder_assessment_id: id!,
      delivered_summary: checkinForm.delivered_summary,
      evidence_link: checkinForm.evidence_link || null,
      next_step: checkinForm.next_step,
      next_step_owner: checkinForm.next_step_owner,
      next_step_due: checkinForm.next_step_due || null,
      blocked: checkinForm.blocked || null,
      decision_made: checkinForm.decision_made || null,
      quick_score: checkinForm.quick_score ? parseInt(checkinForm.quick_score) : null,
    });
    setCheckinSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setCheckinOpen(false);
      setCheckinForm({ delivered_summary: '', evidence_link: '', next_step: '', next_step_owner: '', next_step_due: '', blocked: '', decision_made: '', quick_score: '' });
      toast({ title: 'Check-in salvo' });
      loadData();
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  if (!assessment || !founder) return <p>Avaliação não encontrada.</p>;

  const stage = assessment.score_used != null ? getFounderStageLabel(assessment.score_used) : null;

  // Radar chart data
  const radarDimensionScores = pillars.filter(p => p.pillar_number >= 1).map(p => ({
    dimension_id: `pillar_${p.pillar_number}`,
    label: p.pillar_name,
    score: computePillarScoreUsed(p.score_auto, p.score_jv) ?? 0,
    target: 5,
    coverage: 1,
    answered: 1,
    total: 1,
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/app/startups/${assessment.company_id}/founders`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{founder.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {founder.role && <Badge variant="outline">{founder.role}</Badge>}
            <span className="text-sm text-muted-foreground">{company?.name} · {assessment.semester}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/app/founder-assessments/${id}/pdf`)}>
          <FileText className="mr-1 h-3 w-3" /> Exportar PDF
        </Button>
      </div>

      {/* Score Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold">{assessment.score_used?.toFixed(1) ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Founder Score</p>
            </div>
            <Separator orientation="vertical" className="h-12" />
            <div>
              {stage && <p className={`text-sm font-semibold ${stage.color}`}>{stage.label}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">
                Auto: {assessment.score_auto?.toFixed(1) ?? '—'} · JV: {assessment.score_jv?.toFixed(1) ?? '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Radar — Pilares</CardTitle></CardHeader>
          <CardContent>
            <DarwinRadarChart
              dimensionScores={radarDimensionScores}
              showBenchmark={false}
            />
          </CardContent>
        </Card>

        {/* Pillar table */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Detalhamento por Pilar</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pillars.map(p => {
                const used = computePillarScoreUsed(p.score_auto, p.score_jv);
                const level = used != null ? getPillarLevel(used) : null;
                return (
                  <div key={p.pillar_number} className="flex items-center gap-3 p-2 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        <span className="text-muted-foreground mr-1">P{p.pillar_number}</span>
                        {p.pillar_name}
                      </p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>Auto: {p.score_auto ?? '—'}</span>
                        <span>JV: {p.score_jv ?? '—'}</span>
                        <span>Peso: {(p.weight * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.delta !== 0 && p.pillar_number >= 1 && (
                        <Badge variant={Math.abs(p.delta) > 1.5 ? 'destructive' : 'secondary'} className="text-xs">
                          {p.delta > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                          {p.delta > 0 ? '+' : ''}{p.delta.toFixed(1)}
                        </Badge>
                      )}
                      {level && (
                        <Badge variant="outline" className="text-xs">
                          Nível {level}
                        </Badge>
                      )}
                      <span className="text-lg font-bold min-w-[2rem] text-right">{used?.toFixed(1) ?? '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Plan 30-60-90 */}
      {actionPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" /> Plano 30-60-90
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-2">
              {actionPlan.pillar_focus_1 && (
                <Badge>Foco 1: {PILLARS[actionPlan.pillar_focus_1]?.name}</Badge>
              )}
              {actionPlan.pillar_focus_2 && (
                <Badge variant="secondary">Foco 2: {PILLARS[actionPlan.pillar_focus_2]?.name}</Badge>
              )}
            </div>

            {(actionPlan.actions_30d as any[])?.map((action: any, i: number) => (
              <div key={i} className="p-3 rounded-lg border space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Pilar {action.pillar} — {PILLARS[action.pillar]?.name}</p>
                <p className="text-sm"><span className="font-medium">Ações:</span> {action.action}</p>
                <p className="text-sm"><span className="font-medium">Entrega esperada:</span> {action.expected_delivery}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Check-ins */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Check-ins
          </CardTitle>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setCheckinOpen(true)}>
              <Plus className="mr-1 h-3 w-3" /> Novo Check-in
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {checkins.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum check-in registrado.</p>
          ) : (
            <div className="space-y-3">
              {checkins.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{new Date(c.checkin_date).toLocaleDateString('pt-BR')}</span>
                      {c.quick_score && (
                        <Badge variant={c.quick_score >= 4 ? 'default' : c.quick_score >= 3 ? 'secondary' : 'destructive'}>
                          Score: {c.quick_score}/5
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm"><span className="font-medium">Entregue:</span> {c.delivered_summary}</p>
                    <p className="text-sm"><span className="font-medium">Próximo passo:</span> {c.next_step}</p>
                    {c.blocked && <p className="text-sm text-destructive"><span className="font-medium">Bloqueio:</span> {c.blocked}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {assessment.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Notas</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{assessment.notes}</p></CardContent>
        </Card>
      )}

      {/* Checkin Dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Check-in</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>O que foi entregue? *</Label><Textarea value={checkinForm.delivered_summary} onChange={e => setCheckinForm(f => ({ ...f, delivered_summary: e.target.value }))} /></div>
            <div><Label>Link de evidência</Label><Input value={checkinForm.evidence_link} onChange={e => setCheckinForm(f => ({ ...f, evidence_link: e.target.value }))} /></div>
            <div><Label>Próximo passo *</Label><Textarea value={checkinForm.next_step} onChange={e => setCheckinForm(f => ({ ...f, next_step: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Responsável *</Label><Input value={checkinForm.next_step_owner} onChange={e => setCheckinForm(f => ({ ...f, next_step_owner: e.target.value }))} /></div>
              <div><Label>Prazo</Label><Input type="date" value={checkinForm.next_step_due} onChange={e => setCheckinForm(f => ({ ...f, next_step_due: e.target.value }))} /></div>
            </div>
            <div><Label>O que travou?</Label><Textarea value={checkinForm.blocked} onChange={e => setCheckinForm(f => ({ ...f, blocked: e.target.value }))} /></div>
            <div><Label>Decisão tomada</Label><Textarea value={checkinForm.decision_made} onChange={e => setCheckinForm(f => ({ ...f, decision_made: e.target.value }))} /></div>
            <div>
              <Label>Quick Score (1-5)</Label>
              <Select value={checkinForm.quick_score} onValueChange={v => setCheckinForm(f => ({ ...f, quick_score: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{[1,2,3,4,5].map(v => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddCheckin} disabled={checkinSaving || !checkinForm.delivered_summary || !checkinForm.next_step || !checkinForm.next_step_owner}>
              {checkinSaving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
