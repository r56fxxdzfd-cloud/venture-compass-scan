import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft,
  HelpCircle,
  Check,
  Eye,
  Info,
  CheckCircle2,
  AlertCircle,
  CalendarPlus,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { ConfigJSON, ConfigQuestion, Answer } from '@/types/darwin';
import { getAnswerableQuestions, getSkippedQuestions } from '@/utils/question-flow';

type AnswerState = Record<string, { value: number | null; is_na: boolean; notes: string }>;

function answerStateToRows(answers: AnswerState, assessmentId: string | undefined): Answer[] {
  return Object.entries(answers).map(([questionId, answer]) => ({
    id: questionId,
    assessment_id: assessmentId || '',
    question_id: questionId,
    value: answer.value,
    is_na: answer.is_na,
    notes: answer.notes || null,
    created_at: '',
  }));
}

export default function QuestionnairePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [config, setConfig] = useState<ConfigJSON | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [saving, setSaving] = useState(false);
  const [activeDim, setActiveDim] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [assessmentMeta, setAssessmentMeta] = useState<{ status: 'in_progress' | 'completed'; companyId?: string; companyName?: string } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const { data: assessment } = await supabase
        .from('assessments')
        .select('config_version_id, status, company_id, company:companies(id, name)')
        .eq('id', id)
        .single();

      if (!assessment) return;
      const assessmentCompany = Array.isArray((assessment as any).company)
        ? (assessment as any).company[0]
        : (assessment as any).company;
      setAssessmentMeta({
        status: (assessment as any).status || 'in_progress',
        companyId: (assessment as any).company_id,
        companyName: assessmentCompany?.name,
      });

      const { data: configVersion } = await supabase
        .from('config_versions')
        .select('config_json')
        .eq('id', assessment.config_version_id)
        .single();

      if (configVersion) {
        const cfg = configVersion.config_json as unknown as ConfigJSON;
        setConfig(cfg);

        const { data: existingAnswers } = await supabase
          .from('answers')
          .select('*')
          .eq('assessment_id', id);

        const map: Record<string, { value: number | null; is_na: boolean; notes: string }> = {};
        (existingAnswers || []).forEach((a: any) => {
          map[a.question_id] = { value: a.value, is_na: a.is_na, notes: a.notes || '' };
        });
        setAnswers(map);

        const existingRows = answerStateToRows(map, id);
        const answerable = getAnswerableQuestions(cfg, existingRows);
        const firstIncompleteDimension = cfg.dimensions.find((dim) => {
          const dimQuestions = answerable.filter((question) => question.dimension_id === dim.id && question.is_active !== false);
          return dimQuestions.length > 0 && dimQuestions.some((question) => {
            const answer = map[question.id];
            return !answer || (answer.value === null && !answer.is_na);
          });
        });
        if (cfg.dimensions.length > 0) setActiveDim(firstIncompleteDimension?.id || cfg.dimensions[0].id);
      }
    };
    load();
  }, [id]);

  const setAnswer = (questionId: string, value: number | null, is_na: boolean = false) => {
    setSaveState((state) => state === 'saving' ? state : 'idle');
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { value: is_na ? null : value, is_na, notes: prev[questionId]?.notes || '' },
    }));
  };

  const setNotes = (questionId: string, notes: string) => {
    setSaveState((state) => state === 'saving' ? state : 'idle');
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { value: prev[questionId]?.value ?? null, is_na: prev[questionId]?.is_na ?? false, notes },
    }));
  };

  const saveAnswers = useCallback(async () => {
    if (!id) return false;
    setSaving(true);
    setSaveState('saving');
    setSaveError('');
    const scrollContainer = document.getElementById('app-main-scroll');
    const previousScrollTop = scrollContainer?.scrollTop ?? null;

    const upserts = Object.entries(answers).map(([question_id, ans]) => ({
      assessment_id: id,
      question_id,
      value: ans.value,
      is_na: ans.is_na,
      notes: ans.notes || null,
    }));

    const errors: string[] = [];
    for (const upsert of upserts) {
      const { error } = await supabase.from('answers').upsert(upsert, { onConflict: 'assessment_id,question_id' });
      if (error) errors.push(error.message);
    }

    setSaving(false);
    if (previousScrollTop !== null) {
      requestAnimationFrame(() => {
        scrollContainer?.scrollTo({ top: previousScrollTop });
      });
    }
    if (errors.length > 0) {
      setSaveState('error');
      setSaveError(errors[0]);
      toast({ title: 'Erro ao salvar respostas', description: errors[0], variant: 'destructive' });
      return false;
    }
    const now = new Date();
    setLastSavedAt(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setSaveState('saved');
    toast({ title: 'Respostas salvas' });
    return true;
  }, [id, answers, toast]);

  // Auto-save a cada 30 segundos
  useEffect(() => {
    if (!id || !config) return;
    const hasAnswers = Object.keys(answers).length > 0;
    if (!hasAnswers) return;

    const interval = setInterval(() => {
      saveAnswers();
    }, 30000);

    return () => clearInterval(interval);
  }, [id, config, answers, saveAnswers]);

  const completeAssessment = async () => {
    if (completing) return;
    setCompleting(true);
    const saved = await saveAnswers();
    if (!saved) {
      setCompleting(false);
      return;
    }
    const { error } = await supabase.from('assessments').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id!);
    setCompleting(false);
    if (error) {
      setSaveState('error');
      setSaveError(error.message);
      toast({ title: 'Erro ao finalizar diagnóstico', description: error.message, variant: 'destructive' });
      return;
    }
    setAssessmentMeta((prev) => prev ? { ...prev, status: 'completed' } : prev);
    const flowAnswers = answerStateToRows(answers, id);
    const answerableIds = new Set(config ? getAnswerableQuestions(config, flowAnswers).map((q) => q.id) : []);
    const answeredCount = Object.entries(answers).filter(([questionId, a]) => answerableIds.has(questionId) && (a.value !== null || a.is_na)).length;
    const totalQuestions = answerableIds.size || 45;
    toast({ title: `Diagnóstico finalizado — ${answeredCount}/${totalQuestions} questões respondidas.` });
    setCompletionOpen(true);
  };

  const flowAnswers = useMemo(() => answerStateToRows(answers, id), [answers, id]);
  const answerableQuestions = useMemo(
    () => (config ? getAnswerableQuestions(config, flowAnswers) : []),
    [config, flowAnswers]
  );
  const skippedQuestions = useMemo(
    () => (config ? getSkippedQuestions(config, flowAnswers) : []),
    [config, flowAnswers]
  );
  const answerableQuestionIds = useMemo(
    () => new Set(answerableQuestions.map((q) => q.id)),
    [answerableQuestions]
  );

  if (!config) return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="executive-surface rounded-xl p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center">
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

  const totalQuestions = answerableQuestions.length;
  const answeredCount = Object.entries(answers).filter(([questionId, a]) => answerableQuestionIds.has(questionId) && a && (a.value !== null || a.is_na)).length;
  const progressPct = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
  const saveStateLabel = saveState === 'saving'
    ? 'Salvando...'
    : saveState === 'saved'
      ? `Tudo salvo${lastSavedAt ? ` às ${lastSavedAt}` : ''}`
      : saveState === 'error'
        ? 'Erro ao salvar'
        : 'Alterações não salvas';
  const dimIds = config.dimensions.map((dimension) => dimension.id);
  const activeDimIndex = Math.max(0, dimIds.indexOf(activeDim));
  const previousDimId = activeDimIndex > 0 ? dimIds[activeDimIndex - 1] : '';
  const nextDimId = activeDimIndex < dimIds.length - 1 ? dimIds[activeDimIndex + 1] : '';
  const remainingQuestions = Math.max(0, totalQuestions - answeredCount);
  const allAnswered = remainingQuestions === 0;
  const goToDimension = (dimensionId: string) => {
    if (!dimensionId) return;
    setActiveDim(dimensionId);
    document.getElementById('app-main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="executive-surface rounded-xl p-4 sm:p-5 flex items-center gap-3">
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold">Questionário</h1>
            {assessmentMeta?.status === 'in_progress' && <Badge variant="secondary" className="executive-pill">Rascunho</Badge>}
            {assessmentMeta?.status === 'completed' && <Badge className="executive-pill">Concluído</Badge>}
          </div>
          {assessmentMeta?.companyName && (
            <p className="mt-0.5 text-xs text-muted-foreground">{assessmentMeta.companyName}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <Progress value={progressPct} className="flex-1 h-2" />
            <span className="text-xs text-muted-foreground font-mono">
              {answeredCount}/{totalQuestions}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${
            saveState === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : saveState === 'idle'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600'
          }`}>
            {saveState === 'error' ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {saveStateLabel}
          </span>
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

      <Tabs value={activeDim} onValueChange={setActiveDim} className="executive-surface rounded-xl p-3 sm:p-4">
        <TabsList className="flex w-full flex-wrap h-auto gap-1 justify-start bg-muted/60">
          {config.dimensions.map((dim) => {
            const dimQuestions = answerableQuestions.filter((q) => q.dimension_id === dim.id && q.is_active !== false);
            const dimAnswered = dimQuestions.filter((q) => answers[q.id] && (answers[q.id].value !== null || answers[q.id].is_na)).length;
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
            {(() => {
              const skippedInDimension = skippedQuestions.filter((item) => item.question.dimension_id === dim.id);
              return skippedInDimension.length > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p>
                    {skippedInDimension.length} pergunta{skippedInDimension.length > 1 ? 's' : ''} pulada{skippedInDimension.length > 1 ? 's' : ''} por resposta anterior nesta dimensão.
                  </p>
                </div>
              ) : null;
            })()}
            {answerableQuestions
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

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-start sm:justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={saveAnswers} variant="outline" disabled={saving}>
                Salvar rascunho
              </Button>
            </TooltipTrigger>
            <TooltipContent>Salvar progresso sem finalizar</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {previousDimId && (
              <Button type="button" variant="outline" onClick={() => goToDimension(previousDimId)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar dimensão
              </Button>
            )}
            {nextDimId && (
              <Button type="button" variant="outline" onClick={() => goToDimension(nextDimId)}>
                Próxima dimensão <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              data-testid="finish-assessment-button"
              aria-describedby="finish-assessment-help"
              aria-busy={completing}
              onClick={() => { void completeAssessment(); }}
              disabled={completing}
              variant={allAnswered ? 'default' : 'outline'}
            >
              {completing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar diagnóstico
                </>
              )}
            </Button>
          </div>
          <p id="finish-assessment-help" className="text-right text-xs text-muted-foreground">
            {allAnswered ? 'Pronto para gerar o relatório final.' : `Ainda restam ${remainingQuestions} questões sem resposta.`}
          </p>
        </div>
      </div>
      {saveState === 'error' && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveError || 'Não foi possível salvar as respostas agora.'}
        </div>
      )}
      <Dialog open={completionOpen} onOpenChange={setCompletionOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Diagnóstico concluído</DialogTitle>
            <DialogDescription>
              O questionário foi salvo e marcado como concluído. Próximo passo recomendado: revisar o relatório e transformar prioridades em execução.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button onClick={() => navigate(`/app/assessments/${id}/report`)} className="h-auto justify-start py-3">
              <Eye className="mr-2 h-4 w-4" /> Ver relatório
            </Button>
            {assessmentMeta?.companyId && (
              <Button variant="outline" onClick={() => navigate(`/app/agenda?company=${assessmentMeta.companyId}&new=meeting&type=diagnostic_initial`)} className="h-auto justify-start py-3">
                <CalendarPlus className="mr-2 h-4 w-4" /> Agendar rito
              </Button>
            )}
            {assessmentMeta?.companyId && (
              <Button variant="outline" onClick={() => navigate(`/app/startups/${assessmentMeta.companyId}/counselor`)} className="h-auto justify-start py-3">
                <ClipboardList className="mr-2 h-4 w-4" /> Plano de ação
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompletionOpen(false)}>Continuar no questionário</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [helpOpen, setHelpOpen] = useState(false);
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
                <span
                  className="relative mt-0.5 inline-flex shrink-0"
                  onMouseEnter={() => setHelpOpen(true)}
                  onMouseLeave={() => setHelpOpen(false)}
                >
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Explicação da pergunta"
                    aria-expanded={helpOpen}
                    onClick={() => setHelpOpen((open) => !open)}
                    onFocus={() => setHelpOpen(true)}
                    onBlur={() => setHelpOpen(false)}
                  >
                    <HelpCircle className="h-4 w-4 shrink-0" />
                  </button>
                  {helpOpen && (
                    <span className="absolute right-0 top-6 z-40 w-80 max-w-[calc(100vw-3rem)] rounded-md border bg-popover px-3 py-2 text-left text-popover-foreground shadow-lg">
                      {tooltip.definition && <span className="mb-1 block text-xs leading-snug"><strong>Definição:</strong> {tooltip.definition}</span>}
                      {tooltip.why && <span className="block text-xs leading-snug"><strong>Por quê:</strong> {tooltip.why}</span>}
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  type="button"
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
                type="button"
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
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
                onClick={() => setShowNotes(!showNotes)}
              >
                {showNotes
                  ? 'Ocultar observação'
                  : (answer?.notes && answer.notes.trim() ? 'Observação opcional salva ✓' : '+ Observação opcional')}
              </button>
            </div>

            {tooltip?.anchors && (
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-3 text-[11px] text-muted-foreground mt-1 bg-secondary/40 rounded-md px-3 py-2">
                {Object.entries(tooltip.anchors).map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-1.5">
                    <span className="font-bold text-foreground/60 shrink-0">{k}:</span>
                    <span className="leading-snug">{v as string}</span>
                  </div>
                ))}
              </div>
            )}

            {showNotes && (
              <div className="space-y-1">
                <Textarea
                  placeholder="Contexto, exceção ou evidência relevante para esta resposta"
                  value={answer?.notes || ''}
                  onChange={(e) => onNotes(e.target.value)}
                  className="text-sm"
                  rows={2}
                />
                <p className="text-[11px] text-muted-foreground">
                  Opcional. Quando preenchida, a observação aparece no relatório na análise por dimensão.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
