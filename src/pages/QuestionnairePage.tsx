import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, HelpCircle, Check, Eye, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConfigJSON, ConfigQuestion, Answer } from '@/types/darwin';

export default function QuestionnairePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [config, setConfig] = useState<ConfigJSON | null>(null);
  const [answers, setAnswers] = useState<Record<string, { value: number | null; is_na: boolean; notes: string }>>({});
  const [saving, setSaving] = useState(false);
  const [activeDim, setActiveDim] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const { data: assessment } = await supabase
        .from('assessments')
        .select('config_version_id')
        .eq('id', id)
        .single();

      if (!assessment) return;

      const { data: configVersion } = await supabase
        .from('config_versions')
        .select('config_json')
        .eq('id', assessment.config_version_id)
        .single();

      if (configVersion) {
        const cfg = configVersion.config_json as unknown as ConfigJSON;
        setConfig(cfg);
        if (cfg.dimensions.length > 0) setActiveDim(cfg.dimensions[0].id);
      }

      const { data: existingAnswers } = await supabase
        .from('answers')
        .select('*')
        .eq('assessment_id', id);

      if (existingAnswers) {
        const map: Record<string, { value: number | null; is_na: boolean; notes: string }> = {};
        existingAnswers.forEach((a: any) => {
          map[a.question_id] = { value: a.value, is_na: a.is_na, notes: a.notes || '' };
        });
        setAnswers(map);
      }
    };
    load();
  }, [id]);

  const setAnswer = (questionId: string, value: number | null, is_na: boolean = false) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { value: is_na ? null : value, is_na, notes: prev[questionId]?.notes || '' },
    }));
  };

  const setNotes = (questionId: string, notes: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], notes },
    }));
  };

  const saveAnswers = useCallback(async () => {
    if (!id) return;
    setSaving(true);

    const upserts = Object.entries(answers).map(([question_id, ans]) => ({
      assessment_id: id,
      question_id,
      value: ans.value,
      is_na: ans.is_na,
      notes: ans.notes || null,
    }));

    for (const upsert of upserts) {
      await supabase.from('answers').upsert(upsert, { onConflict: 'assessment_id,question_id' });
    }

    setSaving(false);
    const now = new Date();
    setLastSavedAt(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    toast({ title: 'Respostas salvas' });
  }, [id, answers, toast]);

  const completeAssessment = async () => {
    await saveAnswers();
    await supabase.from('assessments').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id!);
    const answeredCount = Object.values(answers).filter((a) => a.value !== null || a.is_na).length;
    const totalQuestions = config?.questions.filter((q) => q.is_active !== false).length || 45;
    toast({ title: `Diagnóstico finalizado — ${answeredCount}/${totalQuestions} questões respondidas. Gerando relatório...` });
    setTimeout(() => {
      navigate(`/app/assessments/${id}/report`);
    }, 1500);
  };

  if (!config) return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(j => <Skeleton key={j} className="h-10 w-10 rounded-lg" />)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const totalQuestions = config.questions.filter((q) => q.is_active !== false).length;
  const answeredCount = Object.values(answers).filter((a) => a.value !== null || a.is_na).length;
  const progressPct = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Voltar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Questionário</h1>
          <div className="flex items-center gap-3 mt-1">
            <Progress value={progressPct} className="flex-1 h-2" />
            <span className="text-xs text-muted-foreground font-mono">
              {answeredCount}/{totalQuestions}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastSavedAt && (
            <span className="text-[10px] text-muted-foreground">Salvo às {lastSavedAt}</span>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => navigate(`/app/assessments/${id}/report`)}>
                  <Eye className="mr-1 h-3 w-3" /> Relatório parcial
                </Button>
              </TooltipTrigger>
              <TooltipContent>Visualizar o relatório com as respostas atuais</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={saveAnswers} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Salvar todas as respostas como rascunho</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <Tabs value={activeDim} onValueChange={setActiveDim}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {config.dimensions.map((dim) => {
            const dimQuestions = config.questions.filter((q) => q.dimension_id === dim.id && q.is_active !== false);
            const dimAnswered = dimQuestions.filter((q) => answers[q.id]?.value !== null || answers[q.id]?.is_na).length;
            const isComplete = dimAnswered === dimQuestions.length && dimQuestions.length > 0;

            return (
              <TabsTrigger key={dim.id} value={dim.id} className="text-xs relative">
                {dim.label}
                {isComplete && <Check className="ml-1 h-3 w-3 text-success" />}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {config.dimensions.map((dim) => (
          <TabsContent key={dim.id} value={dim.id} className="space-y-4 mt-4">
            {config.questions
              .filter((q) => q.dimension_id === dim.id && q.is_active !== false)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((question, idx) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  index={idx + 1}
                  answer={answers[question.id]}
                  onAnswer={(val) => setAnswer(question.id, val)}
                  onNA={() => setAnswer(question.id, null, true)}
                  onNotes={(notes) => setNotes(question.id, notes)}
                />
              ))}
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={saveAnswers} variant="outline" disabled={saving}>
                Salvar rascunho
              </Button>
            </TooltipTrigger>
            <TooltipContent>Salvar progresso sem finalizar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={completeAssessment}>
                Finalizar diagnóstico
              </Button>
            </TooltipTrigger>
            <TooltipContent>Marcar como concluído e gerar relatório final</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  answer,
  onAnswer,
  onNA,
  onNotes,
}: {
  question: ConfigQuestion;
  index: number;
  answer?: { value: number | null; is_na: boolean; notes: string };
  onAnswer: (val: number) => void;
  onNA: () => void;
  onNotes: (notes: string) => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const tooltip = question.tooltip;

  return (
    <Card className={answer?.value !== null && answer?.value !== undefined || answer?.is_na ? 'border-primary/20' : ''}>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            {index}
          </span>
          <div className="flex-1 space-y-3">
            <div className="flex items-start gap-2">
              <p className="text-base font-medium leading-relaxed">{question.text}</p>
              {tooltip && (tooltip.definition || tooltip.why) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {tooltip.definition && <p className="text-xs mb-1"><strong>Definição:</strong> {tooltip.definition}</p>}
                      {tooltip.why && <p className="text-xs"><strong>Por quê:</strong> {tooltip.why}</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    answer?.value === val
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card hover:bg-secondary border-border'
                  }`}
                  onClick={() => onAnswer(val)}
                >
                  {val}
                </button>
              ))}
              <button
                className={`flex h-10 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition-all ${
                  answer?.is_na
                    ? 'bg-muted text-muted-foreground border-primary/30'
                    : 'bg-card hover:bg-secondary border-border text-muted-foreground'
                }`}
                onClick={onNA}
              >
                N/A
              </button>
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
                onClick={() => setShowNotes(!showNotes)}
              >
                {showNotes ? 'Ocultar notas' : '+ Notas'}
              </button>
            </div>

            {tooltip?.anchors && (
              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-muted-foreground mt-1 bg-secondary/40 rounded-md px-3 py-2">
                {Object.entries(tooltip.anchors).map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-1.5">
                    <span className="font-bold text-foreground/60 shrink-0">{k}:</span>
                    <span className="leading-snug">{v as string}</span>
                  </div>
                ))}
              </div>
            )}

            {showNotes && (
              <Textarea
                placeholder="Observações..."
                value={answer?.notes || ''}
                onChange={(e) => onNotes(e.target.value)}
                className="text-sm"
                rows={2}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
