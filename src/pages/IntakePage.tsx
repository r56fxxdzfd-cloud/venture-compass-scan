import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { QuestionTooltipContent } from '@/components/QuestionTooltipContent';
import { hasQuestionTooltipContent } from '@/utils/question-tooltip';
import { getAnswerableQuestions, getSkippedQuestions, type AssessmentQuestionContext } from '@/utils/question-flow';
import { calculateAssessmentResult } from '@/utils/scoring';
import { getDemoDayDateLabel } from '@/utils/demo-day';
import { getNextDimensionAfterCompletedQuestion, scrollQuestionnaireToTop } from '@/utils/questionnaire-navigation';
import type { Answer, Company, ConfigJSON, ConfigQuestion, DemoDayDate } from '@/types/darwin';
import { AlertCircle, Building2, CalendarDays, Check, CheckCircle2, HelpCircle, Loader2 } from 'lucide-react';

type Phase = 'loading' | 'invalid' | 'registration' | 'demo_day' | 'diagnosis' | 'submitting' | 'done';
type AnswerState = Record<string, { value: number | null; is_na: boolean; notes: string }>;

type OnboardingQuestion = {
  id: string;
  question_key: keyof RegistrationForm;
  question_text: string;
  field_type: string;
  is_required: boolean;
  display_order: number;
};

type RegistrationForm = {
  responsible_name: string;
  company_name: string;
  responsible_role: string;
  responsible_email: string;
  responsible_whatsapp: string;
  responsible_birthdate: string;
  headcount: string;
  revenue_2025: string;
  revenue_2026_target: string;
  expectations_text: string;
};

const EMPTY_FORM: RegistrationForm = {
  responsible_name: '',
  company_name: '',
  responsible_role: '',
  responsible_email: '',
  responsible_whatsapp: '',
  responsible_birthdate: '',
  headcount: '',
  revenue_2025: '',
  revenue_2026_target: '',
  expectations_text: '',
};

const FIELD_LABELS: Record<keyof RegistrationForm, string> = {
  responsible_name: 'Nome completo do sócio responsável pela participação no programa (ponto focal)',
  company_name: 'Nome da empresa',
  responsible_role: 'Cargo atual na empresa',
  responsible_email: 'E-mail',
  responsible_whatsapp: 'WhatsApp',
  responsible_birthdate: 'Data de nascimento',
  headcount: 'Quantos colaboradores a empresa possui?',
  revenue_2025: 'Faturamento 2025',
  revenue_2026_target: 'Meta de faturamento 2026',
  expectations_text: 'O que você espera obter com a participação no Darwin Growth?',
};

const FORM_ORDER: (keyof RegistrationForm)[] = [
  'responsible_name',
  'company_name',
  'responsible_role',
  'responsible_email',
  'responsible_whatsapp',
  'responsible_birthdate',
  'headcount',
  'revenue_2025',
  'revenue_2026_target',
  'expectations_text',
];

const emailOk = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 7);

function answerStateToRows(answers: AnswerState, assessmentId = ''): Answer[] {
  return Object.entries(answers).map(([questionId, answer]) => ({
    id: `${assessmentId}:${questionId}`,
    assessment_id: assessmentId,
    question_id: questionId,
    value: answer.value,
    is_na: answer.is_na,
    notes: answer.notes || null,
    created_at: '',
  }));
}

function formatDateBR(dateString: string) {
  const [year, month, day] = dateString.split('-');
  return year && month && day ? `${day}/${month}/${year}` : dateString;
}

function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : '';
}

export default function IntakePage() {
  const { token } = useParams();
  const [phase, setPhase] = useState<Phase>('loading');
  const [invalidReason, setInvalidReason] = useState('');
  const [error, setError] = useState('');
  const [company, setCompany] = useState<Company | null>(null);
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [demoDates, setDemoDates] = useState<DemoDayDate[]>([]);
  const [selectedDemoDateIds, setSelectedDemoDateIds] = useState<string[]>([]);
  const [debriefUrl, setDebriefUrl] = useState('');
  const [form, setForm] = useState<RegistrationForm>(EMPTY_FORM);
  const [assessmentId, setAssessmentId] = useState('');
  const [assessmentContext, setAssessmentContext] = useState<AssessmentQuestionContext>({});
  const [config, setConfig] = useState<ConfigJSON | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [activeDim, setActiveDim] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const applyValidationPayload = useCallback((data: any) => {
    const companyData = data.company as Company | null;
    setCompany(companyData);
    setQuestions(((data.onboarding_questions || []) as OnboardingQuestion[]).sort((a, b) => a.display_order - b.display_order));
    setDemoDates((data.demo_day_dates || []) as DemoDayDate[]);
    setDebriefUrl(data.debrief_calendar_url || '');
    setSelectedDemoDateIds(
      Array.isArray(companyData?.demo_day_preferred_date_ids) && companyData.demo_day_preferred_date_ids.length > 0
        ? companyData.demo_day_preferred_date_ids
        : companyData?.demo_day_preferred_date_id
          ? [companyData.demo_day_preferred_date_id]
          : []
    );

    const incomingAnswers = data.onboarding_answers || {};
    setForm({
      responsible_name: incomingAnswers.responsible_name || companyData?.responsible_name || '',
      company_name: incomingAnswers.company_name || companyData?.company_name || companyData?.name || '',
      responsible_role: incomingAnswers.responsible_role || companyData?.responsible_role || '',
      responsible_email: incomingAnswers.responsible_email || companyData?.responsible_email || '',
      responsible_whatsapp: incomingAnswers.responsible_whatsapp || companyData?.responsible_whatsapp || '',
      responsible_birthdate: incomingAnswers.responsible_birthdate || companyData?.responsible_birthdate || '',
      headcount: incomingAnswers.headcount || (companyData?.headcount ? String(companyData.headcount) : ''),
      revenue_2025: incomingAnswers.revenue_2025 || companyData?.revenue_2025 || '',
      revenue_2026_target: incomingAnswers.revenue_2026_target || companyData?.revenue_2026_target || '',
      expectations_text: incomingAnswers.expectations_text || companyData?.expectations_text || '',
    });

    if (data.assessment?.id && data.config?.config_json) {
      setAssessmentId(data.assessment.id);
      setAssessmentContext({
        revenue_model: data.assessment.revenue_model,
        customer_type: data.assessment.customer_type,
        business_model: data.assessment.business_model,
      });
      const cfg = data.config.config_json as ConfigJSON;
      setConfig(cfg);
      const mapped: AnswerState = {};
      (data.answers || []).forEach((answer: any) => {
        mapped[answer.question_id] = {
          value: answer.value,
          is_na: answer.is_na,
          notes: answer.notes || '',
        };
      });
      setAnswers(mapped);
      setActiveDim(cfg.dimensions?.[0]?.id || '');
    }

    if (data.status === 'diagnosis_completed' || data.intake?.flow_completed_at) {
      setPhase('done');
    } else if (data.assessment?.id && data.config?.config_json) {
      setPhase('diagnosis');
    } else if (companyData?.pipeline_status && companyData.pipeline_status !== 'invited' && companyData.pipeline_status !== 'registration_started') {
      setPhase('demo_day');
    } else {
      setPhase('registration');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const validate = async () => {
      if (!token) {
        setInvalidReason('Link inválido.');
        setPhase('invalid');
        return;
      }
      const { data, error: fnError } = await supabase.functions.invoke('intake-validate', { body: { token } });
      if (!active) return;
      if (fnError || !data) {
        setInvalidReason('Não foi possível validar este link.');
        setPhase('invalid');
        return;
      }
      if (!data.valid) {
        setInvalidReason(data.status === 'expired' ? 'Este link expirou.' : 'Link inválido ou não encontrado.');
        setPhase('invalid');
        return;
      }
      applyValidationPayload(data);
    };
    validate();
    return () => { active = false; };
  }, [applyValidationPayload, token]);

  const setField = (key: keyof RegistrationForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const registrationErrors = useMemo(() => {
    const errors: string[] = [];
    FORM_ORDER.forEach((key) => {
      if (!form[key].trim()) errors.push(FIELD_LABELS[key]);
    });
    if (form.responsible_email && !emailOk(form.responsible_email)) errors.push('E-mail válido');
    const headcount = Number(form.headcount);
    if (form.headcount && (!Number.isInteger(headcount) || headcount <= 0)) errors.push('Quantos colaboradores a empresa possui?');
    return errors;
  }, [form]);

  const submitRegistration = async () => {
    if (!token) return;
    setError('');
    if (registrationErrors.length > 0) {
      setError('Preencha todos os campos obrigatórios com e-mail válido e headcount positivo.');
      return;
    }
    setPhase('submitting');
    const { data, error: fnError } = await supabase.functions.invoke('intake-submit', {
      body: { token, action: 'registration', payload: form },
    });
    if (fnError || !data?.ok) {
      setPhase('registration');
      setError(data?.error || 'Não foi possível salvar o cadastro inicial.');
      return;
    }
    setCompany(data.company as Company);
    setPhase('demo_day');
  };

  const toggleDemoDate = (id: string) => {
    setSelectedDemoDateIds((current) =>
      current.includes(id) ? current.filter((dateId) => dateId !== id) : [...current, id]
    );
  };

  const startDiagnosis = useCallback(async (demoDayDateIds = selectedDemoDateIds) => {
    if (!token) return;
    setError('');
    setPhase('submitting');
    const demoRes = await supabase.functions.invoke('intake-submit', {
      body: {
        token,
        action: 'demo_day',
        demo_day_date_id: demoDayDateIds[0] || null,
        demo_day_date_ids: demoDayDateIds,
      },
    });
    if (demoRes.error || !demoRes.data?.ok) {
      // Do not block the founder from starting the diagnosis if production is
      // temporarily between the legacy single-date schema and the multi-option schema.
      console.warn('Demo Day preference could not be saved before diagnosis start', demoRes.error || demoRes.data?.error);
    }
    if (demoRes.data?.company) setCompany(demoRes.data.company as Company);

    const { data, error: fnError } = await supabase.functions.invoke('intake-submit', {
      body: { token, action: 'diagnosis_start' },
    });
    if (fnError || !data?.ok) {
      setPhase('demo_day');
      setError(data?.error || 'Não foi possível iniciar o diagnóstico.');
      return;
    }
    setAssessmentId(data.assessment.id);
    setAssessmentContext({
      revenue_model: data.assessment.revenue_model,
      customer_type: data.assessment.customer_type,
      business_model: data.assessment.business_model,
    });
    const cfg = data.config.config_json as ConfigJSON;
    setConfig(cfg);
    const mapped: AnswerState = {};
    (data.answers || []).forEach((answer: any) => {
      mapped[answer.question_id] = { value: answer.value, is_na: answer.is_na, notes: answer.notes || '' };
    });
    setAnswers(mapped);
    setActiveDim(cfg.dimensions?.[0]?.id || '');
    setPhase('diagnosis');
  }, [selectedDemoDateIds, token]);

  const flowAnswers = useMemo(() => answerStateToRows(answers, assessmentId), [answers, assessmentId]);
  const answerableQuestions = useMemo(
    () => (config ? getAnswerableQuestions(config, flowAnswers, assessmentContext) : []),
    [assessmentContext, config, flowAnswers]
  );
  const skippedQuestions = useMemo(
    () => (config ? getSkippedQuestions(config, flowAnswers, assessmentContext) : []),
    [assessmentContext, config, flowAnswers]
  );
  const answerableIds = useMemo(() => new Set(answerableQuestions.map((question) => question.id)), [answerableQuestions]);
  const answeredCount = useMemo(
    () => answerableQuestions.filter((question) => {
      const answer = answers[question.id];
      return answer && (answer.value !== null || answer.is_na);
    }).length,
    [answerableQuestions, answers]
  );
  const progressPct = answerableQuestions.length > 0 ? (answeredCount / answerableQuestions.length) * 100 : 0;
  const allAnswered = answerableQuestions.length > 0 && answeredCount === answerableQuestions.length;

  const saveDiagnosis = useCallback(async () => {
    if (!token || !assessmentId) return false;
    setSaving(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('intake-submit', {
      body: { token, action: 'save_diagnosis', answers: flowAnswers },
    });
    setSaving(false);
    if (fnError || !data?.ok) {
      setError(data?.error || 'Não foi possível salvar as respostas.');
      return false;
    }
    setLastSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    return true;
  }, [assessmentId, flowAnswers, token]);

  const completeDiagnosis = async () => {
    if (!token || !config || !assessmentId) return;
    setError('');
    if (!allAnswered) {
      setError('Responda todas as perguntas aplicáveis antes de finalizar.');
      return;
    }
    setPhase('submitting');
    const result = calculateAssessmentResult(
      config,
      flowAnswers,
      company?.stage || 'seed',
      { ...(company?.headcount ? { headcount: company.headcount } : {}) },
      assessmentContext,
    );
    const { data, error: fnError } = await supabase.functions.invoke('intake-submit', {
      body: {
        token,
        action: 'complete_diagnosis',
        answers: flowAnswers,
        answerable_question_ids: [...answerableIds],
        app_origin: window.location.origin,
        result_summary: {
          overall_score: result.overall_score,
          overall_weighted: result.overall_weighted,
          red_flags: result.red_flags.map((flag) => ({
            code: flag.code,
            label: flag.label,
            severity: flag.severity,
          })),
        },
      },
    });
    if (fnError || !data?.ok) {
      setPhase('diagnosis');
      setError(data?.error || 'Não foi possível finalizar o diagnóstico.');
      return;
    }
    setDebriefUrl(data.debrief_calendar_url || debriefUrl);
    setPhase('done');
  };

  const clickDebrief = async () => {
    if (token) {
      await supabase.functions.invoke('intake-submit', { body: { token, action: 'debrief_link_clicked' } });
    }
    window.open(debriefUrl, '_blank', 'noopener,noreferrer');
  };

  const activeDimensionQuestions = useMemo(() => {
    if (!config) return [];
    return answerableQuestions
      .filter((question) => question.dimension_id === activeDim && question.is_active !== false)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [activeDim, answerableQuestions, config]);

  const setDiagnosisAnswer = (questionId: string, value: number | null, isNA = false) => {
    const updatedAnswers = {
      ...answers,
      [questionId]: { value: isNA ? null : value, is_na: isNA, notes: answers[questionId]?.notes || '' },
    };
    setAnswers(updatedAnswers);

    if (!config) return;
    const updatedFlowAnswers = answerStateToRows(updatedAnswers, assessmentId);
    const updatedAnswerableQuestions = getAnswerableQuestions(config, updatedFlowAnswers, assessmentContext);
    const nextDimensionId = getNextDimensionAfterCompletedQuestion({
      config,
      questionId,
      currentAnswerableQuestions: answerableQuestions,
      updatedAnswerableQuestions,
      updatedAnswers,
    });
    if (nextDimensionId) {
      setActiveDim(nextDimensionId);
      scrollQuestionnaireToTop();
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Building2 className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide">Darwin Growth - Cadastro inicial</span>
        </div>

        {phase === 'loading' && (
          <Card><CardContent className="flex items-center justify-center gap-3 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Validando link...</CardContent></Card>
        )}

        {phase === 'invalid' && (
          <Card><CardContent className="space-y-3 py-10 text-center"><AlertCircle className="mx-auto h-8 w-8 text-amber-500" /><p className="text-sm text-muted-foreground">{invalidReason}</p></CardContent></Card>
        )}

        {phase === 'registration' && (
          <RegistrationStep
            questions={questions}
            form={form}
            error={error}
            onChange={(key, value) => {
              if (key === 'responsible_whatsapp') setField(key, maskPhone(value));
              else if (key === 'headcount') setField(key, onlyDigits(value));
              else setField(key, value);
            }}
            onSubmit={submitRegistration}
          />
        )}

        {phase === 'demo_day' && (
          <DemoDayStep
            dates={demoDates}
            selectedIds={selectedDemoDateIds}
            error={error}
            onToggle={toggleDemoDate}
            onContinue={() => void startDiagnosis()}
          />
        )}

        {phase === 'diagnosis' && config && (
          <DiagnosisStep
            config={config}
            company={company}
            answers={answers}
            activeDim={activeDim}
            activeQuestions={activeDimensionQuestions}
            answerableQuestions={answerableQuestions}
            skippedQuestionsCount={skippedQuestions.length}
            answeredCount={answeredCount}
            progressPct={progressPct}
            allAnswered={allAnswered}
            saving={saving}
            lastSavedAt={lastSavedAt}
            error={error}
            onSetActiveDim={setActiveDim}
            onAnswer={(questionId, value) => setDiagnosisAnswer(questionId, value)}
            onNA={(questionId) => setDiagnosisAnswer(questionId, null, true)}
            onNotes={(questionId, notes) => {
              setAnswers((current) => ({
                ...current,
                [questionId]: { value: current[questionId]?.value ?? null, is_na: current[questionId]?.is_na ?? false, notes },
              }));
            }}
            onSave={saveDiagnosis}
            onComplete={completeDiagnosis}
          />
        )}

        {phase === 'submitting' && (
          <Card><CardContent className="flex items-center justify-center gap-3 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Salvando...</CardContent></Card>
        )}

        {phase === 'done' && (
          <CompletionStep debriefUrl={debriefUrl} onClickDebrief={clickDebrief} />
        )}
      </div>
    </div>
  );
}

function RegistrationStep({
  questions,
  form,
  error,
  onChange,
  onSubmit,
}: {
  questions: OnboardingQuestion[];
  form: RegistrationForm;
  error: string;
  onChange: (key: keyof RegistrationForm, value: string) => void;
  onSubmit: () => void;
}) {
  const orderedKeys = questions.length
    ? questions.map((question) => question.question_key).filter((key): key is keyof RegistrationForm => FORM_ORDER.includes(key))
    : FORM_ORDER;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Formulário inicial</CardTitle>
        <Progress value={33} className="h-1.5" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {orderedKeys.map((key) => {
            if (key === 'expectations_text') {
              return (
                <div key={key} className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">{FIELD_LABELS[key]} <span className="text-destructive">*</span></Label>
                  <Textarea rows={4} value={form[key]} onChange={(event) => onChange(key, event.target.value)} />
                </div>
              );
            }
            return (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{FIELD_LABELS[key]} <span className="text-destructive">*</span></Label>
                <Input
                  type={key === 'responsible_email' ? 'email' : key === 'responsible_birthdate' ? 'date' : 'text'}
                  inputMode={key === 'responsible_email' ? 'email' : key === 'responsible_whatsapp' ? 'tel' : key === 'headcount' ? 'numeric' : 'text'}
                  value={form[key]}
                  onChange={(event) => onChange(key, event.target.value)}
                />
              </div>
            );
          })}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={onSubmit}>Continuar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DemoDayStep({
  dates,
  selectedIds,
  error,
  onToggle,
  onContinue,
}: {
  dates: DemoDayDate[];
  selectedIds: string[];
  error: string;
  onToggle: (id: string) => void;
  onContinue: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5" /> Preferência de Demo Day</CardTitle>
        <Progress value={66} className="h-1.5" />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Você pode selecionar uma, duas ou nenhuma opção para São Paulo.</p>
        {dates.length === 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
            Nenhuma data ativa de Demo Day está configurada no momento.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dates.map((date) => {
              const selected = selectedIds.includes(date.id);
              const dateLabel = getDemoDayDateLabel(date) || formatDateBR(date.date);
              return (
                <button
                  key={date.id}
                  type="button"
                  onClick={() => onToggle(date.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{date.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {dateLabel}
                        {date.start_time && `, ${formatTime(date.start_time)}`}
                        {date.end_time && `-${formatTime(date.end_time)}`}
                      </p>
                      {date.location_or_format && <p className="text-xs text-muted-foreground">{date.location_or_format}</p>}
                    </div>
                    {selected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={onContinue}>Continuar para o diagnóstico</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DiagnosisStep({
  config,
  company,
  answers,
  activeDim,
  activeQuestions,
  answerableQuestions,
  skippedQuestionsCount,
  answeredCount,
  progressPct,
  allAnswered,
  saving,
  lastSavedAt,
  error,
  onSetActiveDim,
  onAnswer,
  onNA,
  onNotes,
  onSave,
  onComplete,
}: {
  config: ConfigJSON;
  company: Company | null;
  answers: AnswerState;
  activeDim: string;
  activeQuestions: ConfigQuestion[];
  answerableQuestions: ConfigQuestion[];
  skippedQuestionsCount: number;
  answeredCount: number;
  progressPct: number;
  allAnswered: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  error: string;
  onSetActiveDim: (dimensionId: string) => void;
  onAnswer: (questionId: string, value: number) => void;
  onNA: (questionId: string) => void;
  onNotes: (questionId: string, notes: string) => void;
  onSave: () => Promise<boolean>;
  onComplete: () => void;
}) {
  const activeDimension = config.dimensions.find((dimension) => dimension.id === activeDim);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">Diagnóstico de maturidade</h1>
              {company?.company_name && <Badge variant="secondary">{company.company_name}</Badge>}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={progressPct} className="h-2 flex-1" />
              <span className="font-mono text-xs text-muted-foreground">{answeredCount}/{answerableQuestions.length}</span>
            </div>
            {skippedQuestionsCount > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">{skippedQuestionsCount} pergunta(s) não aplicável(is) pelo contexto ou respostas anteriores.</p>
            )}
          </div>
          <Button variant="outline" onClick={() => void onSave()} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : lastSavedAt ? `Salvo às ${lastSavedAt}` : 'Salvar rascunho'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {config.dimensions.map((dimension) => {
              const dimQuestions = answerableQuestions.filter((question) => question.dimension_id === dimension.id);
              const dimAnswered = dimQuestions.filter((question) => {
                const answer = answers[question.id];
                return answer && (answer.value !== null || answer.is_na);
              }).length;
              const complete = dimQuestions.length > 0 && dimAnswered === dimQuestions.length;
              return (
                <button
                  key={dimension.id}
                  type="button"
                  onClick={() => onSetActiveDim(dimension.id)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${activeDim === dimension.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'}`}
                >
                  {dimension.id} · {dimension.label} {complete && <Check className="ml-1 inline h-3 w-3" />}
                </button>
              );
            })}
          </div>
          {activeDimension && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dimensão em resposta</p>
              <h2 className="text-base font-bold">{activeDimension.label}</h2>
            </div>
          )}
          <div className="space-y-3">
            {activeQuestions.map((question, index) => (
              <QuestionCard
                key={question.id}
                index={index + 1}
                question={question}
                answer={answers[question.id]}
                onAnswer={(value) => onAnswer(question.id, value)}
                onNA={() => onNA(question.id)}
                onNotes={(notes) => onNotes(question.id, notes)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      <div className="flex justify-end">
        <Button onClick={onComplete} disabled={!allAnswered}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar diagnóstico
        </Button>
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
  onAnswer: (value: number) => void;
  onNA: () => void;
  onNotes: (notes: string) => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const hasTooltip = hasQuestionTooltipContent(question);

  return (
    <Card className={answer?.value !== null && answer?.value !== undefined || answer?.is_na ? 'border-primary/20' : ''}>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{index}</span>
          <div className="flex-1 space-y-3">
            <div className="flex items-start gap-2">
              <p className="text-base font-medium leading-relaxed">{question.text}</p>
              {hasTooltip && (
                <TooltipProvider>
                  <Tooltip open={helpOpen} onOpenChange={setHelpOpen} delayDuration={150}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Explicação da pergunta"
                        onClick={() => setHelpOpen((open) => !open)}
                      >
                        <HelpCircle className="h-4 w-4 shrink-0" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="center" sideOffset={8} className="z-[1000] max-h-[min(70vh,28rem)] w-96 max-w-[calc(100vw-3rem)] overflow-y-auto px-3 py-2 text-left">
                      <QuestionTooltipContent question={question} />
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    answer?.value === value
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card hover:bg-secondary'
                  }`}
                  onClick={() => onAnswer(value)}
                >
                  {value}
                </button>
              ))}
              <button
                type="button"
                className={`flex h-10 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition-all ${
                  answer?.is_na
                    ? 'border-primary/30 bg-muted text-muted-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                }`}
                onClick={onNA}
              >
                N/A
              </button>
              <button type="button" className="ml-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowNotes((current) => !current)}>
                {showNotes ? 'Ocultar observação' : (answer?.notes?.trim() ? 'Observação salva' : '+ Observação opcional')}
              </button>
            </div>
            {showNotes && (
              <Textarea
                rows={2}
                value={answer?.notes || ''}
                onChange={(event) => onNotes(event.target.value)}
                placeholder="Contexto ou evidência relevante para esta resposta"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompletionStep({ debriefUrl, onClickDebrief }: { debriefUrl: string; onClickDebrief: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-5 py-10 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <div className="mx-auto max-w-2xl space-y-3">
          <h1 className="text-2xl font-bold">Diagnóstico recebido.</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Obrigado por preencher as informações iniciais. A equipe do Darwin Growth / Boardwise irá analisar suas respostas e preparar uma devolutiva estruturada com os principais pontos de atenção, oportunidades e próximos passos sugeridos.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Para concluir esta etapa, agende agora sua reunião de devolutiva pelo link abaixo.
          </p>
        </div>
        <Button onClick={onClickDebrief} disabled={!debriefUrl}>Agendar devolutiva</Button>
      </CardContent>
    </Card>
  );
}
