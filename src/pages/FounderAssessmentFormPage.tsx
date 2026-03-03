import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PILLARS, PILLAR_QUESTIONS, SCORE_ANCHORS,
  computePillarScoreUsed, computeFounderScore, getFounderStageLabel,
  getCurrentSemester, getPillarLevel, computePriorityScore,
  ACTION_RECOMMENDATIONS
} from '@/utils/founder-scoring';
import type { Founder } from '@/types/founder';
import type { Company } from '@/types/darwin';

interface PillarInput {
  scoreAuto: number | null;
  scoreJv: number | null;
  evidenceAuto: string;
  evidenceJv: string;
}

interface FounderFormData {
  founder: Founder;
  pillars: Record<number, PillarInput>;
}

export default function FounderAssessmentFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const { user } = useAuth();
  const { toast } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [allFounders, setAllFounders] = useState<Founder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Step management
  const [step, setStep] = useState(0); // 0 = context, 1..N = founder pillars, last = review
  const [selectedFounderIds, setSelectedFounderIds] = useState<string[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [founderData, setFounderData] = useState<Record<string, FounderFormData>>({});
  
  // Cooldown check
  const [blockedFounders, setBlockedFounders] = useState<Record<string, string>>({});

  const semester = getCurrentSemester();

  useEffect(() => {
    if (!companyId) return;
    loadInitialData();
  }, [companyId]);

  const loadInitialData = async () => {
    const [compRes, foundersRes] = await Promise.all([
      supabase.from('companies').select('*').eq('id', companyId!).single(),
      supabase.from('founders').select('*').eq('company_id', companyId!).eq('active', true).order('created_at'),
    ]);

    if (compRes.data) setCompany(compRes.data as Company);
    const fList = (foundersRes.data || []) as Founder[];
    setAllFounders(fList);

    // Check cooldowns
    const { data: existing } = await supabase
      .from('founder_assessments')
      .select('founder_id, assessment_date')
      .eq('company_id', companyId!)
      .gte('assessment_date', new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]);
    
    const blocked: Record<string, string> = {};
    for (const e of (existing || []) as { founder_id: string; assessment_date: string }[]) {
      const nextDate = new Date(new Date(e.assessment_date).getTime() + 180 * 86400000);
      blocked[e.founder_id] = nextDate.toLocaleDateString('pt-BR');
    }
    setBlockedFounders(blocked);

    // Pre-select non-blocked founders
    const selectable = fList.filter(f => !blocked[f.id]).map(f => f.id);
    setSelectedFounderIds(selectable);

    // Initialize form data
    const data: Record<string, FounderFormData> = {};
    for (const f of fList) {
      const pillars: Record<number, PillarInput> = {};
      for (const p of PILLARS) {
        pillars[p.number] = { scoreAuto: null, scoreJv: null, evidenceAuto: '', evidenceJv: '' };
      }
      data[f.id] = { founder: f, pillars };
    }
    setFounderData(data);
    setLoading(false);
  };

  const selectedFounders = allFounders.filter(f => selectedFounderIds.includes(f.id));

  // Calculate total steps: 1 (context) + selectedFounders * 6 pillars + 1 (review)
  const totalPillarSteps = selectedFounders.length * 6;
  const totalSteps = 1 + totalPillarSteps + 1;

  // Get current founder and pillar from step
  const getStepInfo = (s: number) => {
    if (s === 0) return { type: 'context' as const };
    if (s > totalPillarSteps) return { type: 'review' as const };
    const idx = s - 1;
    const founderIdx = Math.floor(idx / 6);
    const pillarIdx = idx % 6;
    return { type: 'pillar' as const, founderIdx, pillarNumber: pillarIdx };
  };

  const stepInfo = getStepInfo(step);

  const updatePillarScore = (founderId: string, pillarNum: number, field: keyof PillarInput, value: any) => {
    setFounderData(prev => ({
      ...prev,
      [founderId]: {
        ...prev[founderId],
        pillars: {
          ...prev[founderId].pillars,
          [pillarNum]: { ...prev[founderId].pillars[pillarNum], [field]: value },
        },
      },
    }));
  };

  // Validation: pillars 1-4 must have at least score_jv
  const canSave = useMemo(() => {
    for (const fId of selectedFounderIds) {
      const data = founderData[fId];
      if (!data) return false;
      for (let p = 1; p <= 4; p++) {
        if (data.pillars[p].scoreJv == null) return false;
      }
    }
    return selectedFounderIds.length > 0;
  }, [selectedFounderIds, founderData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const fId of selectedFounderIds) {
        const data = founderData[fId];
        const pillarScores = PILLARS.map(p => ({
          pillar_number: p.number,
          score_auto: data.pillars[p.number].scoreAuto,
          score_jv: data.pillars[p.number].scoreJv,
        }));
        
        const computed = computeFounderScore(pillarScores);
        const stageLabel = computed.scoreUsed != null ? getFounderStageLabel(computed.scoreUsed).label : null;

        // Insert assessment
        const { data: assessment, error: aErr } = await supabase.from('founder_assessments').insert({
          founder_id: fId,
          company_id: companyId!,
          semester,
          score_auto: computed.scoreAuto,
          score_jv: computed.scoreJv,
          score_used: computed.scoreUsed,
          stage_label: stageLabel,
          notes: generalNotes || null,
          created_by: user?.id,
        }).select().single();

        if (aErr) throw aErr;

        // Insert pillar scores
        const pillarInserts = PILLARS.map(p => ({
          founder_assessment_id: assessment.id,
          pillar_number: p.number,
          pillar_name: p.name,
          weight: p.weight,
          score_auto: data.pillars[p.number].scoreAuto,
          score_jv: data.pillars[p.number].scoreJv,
          evidence_auto: data.pillars[p.number].evidenceAuto || null,
          evidence_jv: data.pillars[p.number].evidenceJv || null,
        }));

        const { error: pErr } = await supabase.from('founder_pillar_scores').insert(pillarInserts);
        if (pErr) throw pErr;

        // Generate action plan
        const scoredPillars = pillarScores
          .filter(p => p.pillar_number >= 1 && p.pillar_number <= 5)
          .map(p => {
            const used = computePillarScoreUsed(p.score_auto, p.score_jv);
            const pillar = PILLARS.find(pi => pi.number === p.pillar_number)!;
            return { number: p.pillar_number, priorityScore: used != null ? computePriorityScore(used, pillar.weight) : 0, scoreUsed: used };
          })
          .sort((a, b) => b.priorityScore - a.priorityScore);

        const focus1 = scoredPillars[0]?.number ?? null;
        const focus2 = scoredPillars[1]?.number ?? null;

        const actions30d: any[] = [];
        for (const focusPillar of [focus1, focus2].filter(Boolean) as number[]) {
          const sp = scoredPillars.find(s => s.number === focusPillar);
          if (!sp || sp.scoreUsed == null) continue;
          const level = getPillarLevel(sp.scoreUsed);
          const rec = ACTION_RECOMMENDATIONS[focusPillar]?.[level];
          if (rec) {
            actions30d.push({
              pillar: focusPillar,
              action: rec.actions,
              expected_delivery: rec.delivery,
              kpi: '',
              key_behavior: '',
              anti_goal: '',
            });
          }
        }

        await supabase.from('founder_action_plans').insert({
          founder_assessment_id: assessment.id,
          pillar_focus_1: focus1,
          pillar_focus_2: focus2,
          actions_30d: actions30d,
        });
      }

      toast({ title: 'Avaliação salva com sucesso!' });
      navigate(`/app/startups/${companyId}/founders`);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;

  const ScoreButton = ({ value, selected, onClick }: { value: number; selected: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border-2 transition-all min-w-[70px] ${
        selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border hover:border-primary/50'
      }`}
    >
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[9px] text-muted-foreground leading-tight text-center">{SCORE_ANCHORS[value]}</span>
    </button>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-bold">Avaliação Founder Score</h1>
            <span className="text-xs text-muted-foreground">{step + 1} / {totalSteps}</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

          {/* Step 0: Context */}
          {stepInfo.type === 'context' && (
            <Card>
              <CardHeader>
                <CardTitle>Contexto da Avaliação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Startup</Label>
                    <p className="font-medium">{company?.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Semestre</Label>
                    <p className="font-medium">{semester}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data</Label>
                    <p className="font-medium">{new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-medium mb-2 block">Selecionar Founders para avaliação</Label>
                  <div className="space-y-2">
                    {allFounders.map(f => {
                      const blocked = blockedFounders[f.id];
                      return (
                        <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border">
                          <Checkbox
                            checked={selectedFounderIds.includes(f.id)}
                            disabled={!!blocked}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedFounderIds(prev => [...prev, f.id]);
                              else setSelectedFounderIds(prev => prev.filter(id => id !== f.id));
                            }}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{f.name}</p>
                            {f.role && <p className="text-xs text-muted-foreground">{f.role}</p>}
                          </div>
                          {blocked && (
                            <Badge variant="secondary" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Disponível em {blocked}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label>Notas gerais (opcional)</Label>
                  <Textarea value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} placeholder="Observações sobre o semestre..." />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pillar steps */}
          {stepInfo.type === 'pillar' && (() => {
            const founder = selectedFounders[stepInfo.founderIdx!];
            if (!founder) return null;
            const pillar = PILLARS[stepInfo.pillarNumber!];
            const input = founderData[founder.id]?.pillars[pillar.number];
            if (!input) return null;
            const delta = computePillarScoreUsed(input.scoreAuto, input.scoreJv);
            const deltaVal = input.scoreJv != null && input.scoreAuto != null ? input.scoreJv - input.scoreAuto : null;
            const questions = PILLAR_QUESTIONS[pillar.number] || [];

            return (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{founder.name} · {founder.role}</p>
                      <CardTitle className="text-lg">Pilar {pillar.number} — {pillar.name}</CardTitle>
                    </div>
                    <Badge variant={pillar.weight === 0 ? 'secondary' : 'default'}>
                      {pillar.weight === 0 ? 'Contexto' : `Peso ${(pillar.weight * 100).toFixed(0)}%`}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{pillar.description}</p>
                  {pillar.number === 0 && (
                    <Badge variant="outline" className="w-fit mt-1">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Este pilar não entra no cálculo do score
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Reference questions */}
                  {questions.length > 0 && (
                    <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Perguntas de referência</p>
                      <ul className="text-sm space-y-1">
                        {questions.map((q, i) => <li key={i} className="text-muted-foreground">• {q}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Autoavaliação */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nota Autoavaliação (o que o founder relatou)</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 2, 3, 4, 5].map(v => (
                        <ScoreButton key={v} value={v} selected={input.scoreAuto === v} onClick={() => updatePillarScore(founder.id, pillar.number, 'scoreAuto', input.scoreAuto === v ? null : v)} />
                      ))}
                    </div>
                    <Textarea
                      placeholder="Evidência — o que o founder disse (opcional)"
                      value={input.evidenceAuto}
                      onChange={e => updatePillarScore(founder.id, pillar.number, 'evidenceAuto', e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  {/* JV */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nota JV {pillar.number >= 1 && pillar.number <= 4 && <span className="text-destructive">*</span>}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 2, 3, 4, 5].map(v => (
                        <ScoreButton key={v} value={v} selected={input.scoreJv === v} onClick={() => updatePillarScore(founder.id, pillar.number, 'scoreJv', input.scoreJv === v ? null : v)} />
                      ))}
                    </div>
                    <Textarea
                      placeholder="Evidência — visão da JV (opcional)"
                      value={input.evidenceJv}
                      onChange={e => updatePillarScore(founder.id, pillar.number, 'evidenceJv', e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  {/* Delta */}
                  {deltaVal != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Delta:</span>
                      <Badge variant={Math.abs(deltaVal) > 1 ? 'destructive' : 'secondary'} className={deltaVal > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : ''}>
                        {deltaVal > 0 ? '+' : ''}{deltaVal.toFixed(1)}
                      </Badge>
                      {Math.abs(deltaVal) > 1 && (
                        <span className="text-xs text-muted-foreground">Desalinhamento significativo</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Review step */}
          {stepInfo.type === 'review' && (
            <Card>
              <CardHeader>
                <CardTitle>Revisão e Confirmação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedFounders.map(f => {
                  const data = founderData[f.id];
                  const pillarScores = PILLARS.map(p => ({
                    pillar_number: p.number,
                    score_auto: data.pillars[p.number].scoreAuto,
                    score_jv: data.pillars[p.number].scoreJv,
                  }));
                  const computed = computeFounderScore(pillarScores);
                  const stage = computed.scoreUsed != null ? getFounderStageLabel(computed.scoreUsed) : null;

                  return (
                    <div key={f.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{f.role}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{computed.scoreUsed?.toFixed(1) ?? '—'}</p>
                          {stage && <p className={`text-xs font-medium ${stage.color}`}>{stage.label}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="font-medium text-muted-foreground">Pilar</div>
                        <div className="text-center font-medium text-muted-foreground">Auto</div>
                        <div className="text-center font-medium text-muted-foreground">JV</div>
                        <div className="text-center font-medium text-muted-foreground">Usado</div>
                        {PILLARS.filter(p => p.number >= 1).map(p => {
                          const pi = data.pillars[p.number];
                          const used = computePillarScoreUsed(pi.scoreAuto, pi.scoreJv);
                          return [
                            <div key={`${p.number}-name`} className="truncate">{p.name}</div>,
                            <div key={`${p.number}-auto`} className="text-center">{pi.scoreAuto ?? '—'}</div>,
                            <div key={`${p.number}-jv`} className="text-center">{pi.scoreJv ?? '—'}</div>,
                            <div key={`${p.number}-used`} className="text-center font-medium">{used?.toFixed(1) ?? '—'}</div>,
                          ];
                        })}
                      </div>

                      {/* Red flag warnings */}
                      {computed.scoreUsed != null && computed.scoreUsed < 50 && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Risco estrutural: {f.name} com score {computed.scoreUsed.toFixed(1)}
                        </Badge>
                      )}

                      {PILLARS.filter(p => p.number >= 1).map(p => {
                        const pi = data.pillars[p.number];
                        if (pi.scoreAuto != null && pi.scoreJv != null) {
                          const delta = pi.scoreJv - pi.scoreAuto;
                          if (delta < -1.5) {
                            return (
                              <Badge key={p.number} variant="secondary" className="text-xs mr-1">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Desalinhamento em {p.name}
                              </Badge>
                            );
                          }
                        }
                        return null;
                      })}

                      <Separator />
                    </div>
                  );
                })}

                {/* Composite */}
                {(() => {
                  const scores = selectedFounders.map(f => {
                    const data = founderData[f.id];
                    const ps = PILLARS.map(p => ({ pillar_number: p.number, score_auto: data.pillars[p.number].scoreAuto, score_jv: data.pillars[p.number].scoreJv }));
                    return computeFounderScore(ps).scoreUsed;
                  }).filter((s): s is number => s != null);
                  
                  if (scores.length === 0) return null;
                  const composite = scores.reduce((a, b) => a + b, 0) / scores.length;
                  const stage = getFounderStageLabel(composite);
                  
                  return (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Score Composto da Startup</p>
                          <p className={`text-xs ${stage.color}`}>{stage.label}</p>
                        </div>
                        <p className="text-3xl font-bold">{composite.toFixed(1)}</p>
                      </div>
                    </div>
                  );
                })()}

                {!canSave && (
                  <p className="text-xs text-destructive">Preencha pelo menos a nota JV para os pilares 1 a 4 de todos os founders selecionados.</p>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {step === 0 ? 'Cancelar' : 'Voltar'}
        </Button>
        {stepInfo.type === 'review' ? (
          <Button onClick={handleSave} disabled={saving || !canSave}>
            <Check className="mr-1 h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar e Gerar Plano 30-60-90'}
          </Button>
        ) : (
          <Button onClick={() => setStep(step + 1)} disabled={stepInfo.type === 'context' && selectedFounderIds.length === 0}>
            Próximo <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
