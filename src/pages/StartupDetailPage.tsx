import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Plus, ClipboardList, ArrowLeft, Pencil, AlertTriangle, ArrowRight, Inbox, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateAssessmentResult } from '@/utils/scoring';
import { scoreTo100, getLevel } from '@/utils/report-helpers';
import { getCurrentSemester, getFounderStageLabel } from '@/utils/founder-scoring';
import type { Company, Assessment, ConfigJSON, Answer } from '@/types/darwin';
import type { Founder, FounderAssessment } from '@/types/founder';
import type { CouncilAction, CouncilMeeting } from '@/types/council';
import { BackToTopFooter } from '@/components/BackToTopFooter';
import { getTodayDateOnly, isDateOnlyBefore } from '@/lib/dateOnly';
import { AdvisorsSection } from '@/components/startup/AdvisorsSection';
import { ActionPlanSection } from '@/components/startup/ActionPlanSection';
import { MeetingLogsSection } from '@/components/startup/MeetingLogsSection';
import { CONTEXT_NUMERIC_FIELDS } from '@/utils/context-fields';
import { formatCnpj, isValidCnpj } from '@/utils/cnpj';
import { friendlySupabaseError } from '@/utils/supabase-errors';

const stageLabels: Record<string, string> = { pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A' };
const openActionStatuses = new Set(['not_started', 'in_progress', 'blocked']);
const statusLabel: Record<string, string> = { not_started: 'Não iniciada', in_progress: 'Em andamento', completed: 'Concluída', blocked: 'Travada', cancelled: 'Cancelada' };
const priorityLabel: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };

function formatDateOnlyBR(dateString?: string | null) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return '-';
  return `${day}/${month}/${year}`;
}

export default function StartupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isAnalyst, isAdvisor, isSuperAdmin, user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const [assessmentQuestionTotals, setAssessmentQuestionTotals] = useState<Record<string, number>>({});
  const [lastResult, setLastResult] = useState<{ score100: number; level: string; levelColor: string; redFlagCount: number; assessmentId: string } | null>(null);
  const [founders, setFounders] = useState<Founder[]>([]);
  const [founderAssessments, setFounderAssessments] = useState<FounderAssessment[]>([]);
  const [allFounderAssessments, setAllFounderAssessments] = useState<FounderAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [councilStats, setCouncilStats] = useState({ open: 0, completed: 0, lastMeeting: '-', nextAgenda: '-', meetings: 0 });
  const [lastMeetingProgressSummary, setLastMeetingProgressSummary] = useState({ total: 0, improving: 0, stable: 0, worsening: 0, insufficient_evidence: 0, meetingId: '' });
  const [recentMeetings, setRecentMeetings] = useState<CouncilMeeting[]>([]);
  const [actions, setActions] = useState<CouncilAction[]>([]);

  const canWrite = isAdmin || isAnalyst;
  // Membro do Comitê de Crescimento atribuído alcança esta página (RLS) — pode operar plano/reuniões.
  const canManageOps = isAdmin || isAnalyst || isAdvisor;

  // New assessment dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState('seed');
  const [newCustomerType, setNewCustomerType] = useState('');
  const [newRevenueModel, setNewRevenueModel] = useState('');
  const [numericFields, setNumericFields] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [newAssessmentStep, setNewAssessmentStep] = useState(0);

  // Super Admin: arquivar / excluir
  const [archiving, setArchiving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Edit company dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', legal_name: '', cnpj: '', sector: '', stage: '', business_model: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: companyData } = await supabase.from('companies').select('*').eq('id', id).maybeSingle();
      if (!companyData) {
        // RLS pode retornar 0 linhas (ex.: membro do comitê de crescimento sem atribuição). Não é erro.
        setCompany(null);
        setLoading(false);
        return;
      }
      setCompany(companyData as Company);

      // Load founders & founder assessments
      const currentSem = getCurrentSemester();
      const [{ data: foundersData }, { data: faData }, { data: allFaData }] = await Promise.all([
        supabase.from('founders').select('*').eq('company_id', id).eq('active', true),
        supabase.from('founder_assessments').select('*').eq('company_id', id).eq('semester', currentSem),
        supabase.from('founder_assessments').select('*').eq('company_id', id).order('semester', { ascending: true }),
      ]);
      if (foundersData) setFounders(foundersData as Founder[]);
      if (faData) setFounderAssessments(faData as FounderAssessment[]);
      if (allFaData) setAllFounderAssessments(allFaData as FounderAssessment[]);

      const { data: meetingData } = await supabase.from('council_meetings').select('*').eq('company_id', id).order('meeting_date', { ascending: false });
      if (meetingData) {
        setRecentMeetings((meetingData as CouncilMeeting[]).slice(0, 3));
        const ids = meetingData.map((m:any) => m.id);
        const { data: actionData } = ids.length ? await supabase.from('council_actions').select('*').in('meeting_id', ids).order('created_at', { ascending: false }) : { data: [] as any[] };
        setActions((actionData || []) as CouncilAction[]);
        const open = (actionData || []).filter((a:any) => a.status !== 'completed').length;
        const completed = (actionData || []).filter((a:any) => a.status === 'completed').length;
        setCouncilStats({ open, completed, lastMeeting: meetingData[0]?.meeting_date || '-', nextAgenda: meetingData[0]?.next_agenda || '-', meetings: meetingData.length });
        const lastMeetingId = meetingData[0]?.id;
        if (lastMeetingId) {
          const { data: progressData } = await supabase.from('council_dimension_progress').select('trend').eq('meeting_id', lastMeetingId);
          const summary = { total: progressData?.length || 0, improving: 0, stable: 0, worsening: 0, insufficient_evidence: 0, meetingId: lastMeetingId };
          (progressData || []).forEach((row: any) => {
            if (row.trend in summary) (summary as any)[row.trend] += 1;
          });
          setLastMeetingProgressSummary(summary);
        }
      }

      const { data: assessData } = await supabase.from('assessments').select('*').eq('company_id', id).order('created_at', { ascending: false });
      if (assessData) {
        setAssessments(assessData as Assessment[]);

        // Fetch answer counts and real question totals for all assessments.
        const counts: Record<string, number> = {};
        for (const a of assessData) {
          const { count } = await supabase.from('answers').select('id', { count: 'exact', head: true }).eq('assessment_id', a.id);
          counts[a.id] = count || 0;
        }
        setAnswerCounts(counts);

        const totalsByConfig: Record<string, number> = {};
        const configIds = [...new Set(assessData.map((assessment: any) => assessment.config_version_id).filter(Boolean))];
        if (configIds.length > 0) {
          const { data: configRows } = await supabase
            .from('config_versions')
            .select('id, config_json')
            .in('id', configIds);

          (configRows || []).forEach((row: any) => {
            const cfg = row.config_json as ConfigJSON | null;
            totalsByConfig[row.id] = cfg?.questions?.filter((question) => question.is_active !== false).length || 45;
          });
        }

        const totals: Record<string, number> = {};
        assessData.forEach((assessment: any) => {
          totals[assessment.id] = totalsByConfig[assessment.config_version_id] || 45;
        });
        setAssessmentQuestionTotals(totals);

        // Compute last completed assessment summary
        const lastCompleted = assessData.find((a: any) => a.status === 'completed');
        if (lastCompleted) {
          const { data: cv } = await supabase.from('config_versions').select('config_json').eq('id', lastCompleted.config_version_id).single();
          if (cv) {
            const cfg = cv.config_json as unknown as ConfigJSON;
            const { data: answers } = await supabase.from('answers').select('*').eq('assessment_id', lastCompleted.id);
            const result = calculateAssessmentResult(cfg, (answers || []) as Answer[], lastCompleted.stage || 'seed', (lastCompleted.context_numeric as Record<string, number>) || {}, { revenue_model: lastCompleted.revenue_model, customer_type: lastCompleted.customer_type, business_model: lastCompleted.business_model });
            const s100 = scoreTo100(result.overall_score);
            const level = getLevel(s100);
            setLastResult({ score100: s100, level: level.label, levelColor: level.color, redFlagCount: result.red_flags.length, assessmentId: lastCompleted.id });
          }
        }
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // ---- New Assessment Dialog ----
  const openNewDialog = async () => {
    setNewStage(company?.stage || 'seed');
    setNewCustomerType('');
    setNewRevenueModel('');
    setNumericFields({});
    setNewAssessmentStep(0);
    setNewDialogOpen(true);
    // Auto-preenche o que já temos do cadastro inicial (intake): headcount é o
    // único dado numérico em comum entre o formulário e o contexto do diagnóstico.
    const { data: intake } = await supabase
      .from('intake_submissions')
      .select('payload')
      .eq('company_id', id)
      .eq('status', 'imported')
      .order('imported_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const rawHc = (intake?.payload as { headcount?: string } | null)?.headcount;
    const hc = rawHc ? String(rawHc).replace(/\D/g, '') : '';
    if (hc) setNumericFields((prev) => ({ ...prev, headcount: hc }));
  };

  const handleCreateAssessment = async () => {
    setCreating(true);
    const { data: config } = await supabase.from('config_versions').select('id').eq('status', 'published').single();
    if (!config) {
      toast({ title: 'Erro', description: 'Nenhuma configuração publicada encontrada.', variant: 'destructive' });
      setCreating(false);
      return;
    }

    const contextNumeric: Record<string, number> = {};
    const numKeys = ['runway_months', 'burn_monthly', 'headcount', 'gross_margin_pct', 'cac', 'ltv', 'revenue_concentration_top1_pct', 'revenue_concentration_top3_pct'];
    numKeys.forEach(key => {
      const val = parseFloat(numericFields[key] || '');
      if (!isNaN(val)) contextNumeric[key] = val;
    });

    const { data, error } = await supabase.from('assessments').insert({
      company_id: id!,
      config_version_id: config.id,
      stage: newStage,
      business_model: company?.business_model || null,
      customer_type: newCustomerType || null,
      revenue_model: newRevenueModel || null,
      context_numeric: contextNumeric,
      created_by: user?.id,
    }).select().single();

    setCreating(false);
    if (data) {
      setNewDialogOpen(false);
      setNewAssessmentStep(0);
      navigate(`/app/assessments/${data.id}/questionnaire`);
    }
    if (error) {
      toast({ title: 'Erro ao criar diagnóstico', description: friendlySupabaseError(error.message), variant: 'destructive' });
    }
  };

  // ---- Super Admin: arquivar / excluir ----
  const handleArchive = async (archive: boolean) => {
    if (!company) return;
    setArchiving(true);
    const { error } = await supabase.rpc('set_company_archived', { p_company_id: company.id, p_archived: archive });
    setArchiving(false);
    if (error) { toast({ title: 'Erro', description: friendlySupabaseError(error.message), variant: 'destructive' }); return; }
    if (archive) {
      toast({ title: 'Organização arquivada' });
      navigate('/app/startups');
    } else {
      setCompany({ ...company, archived_at: null });
      toast({ title: 'Organização reativada' });
    }
  };

  const handleDelete = async () => {
    if (!company) return;
    setDeleting(true);
    const { error } = await supabase.rpc('delete_company', { p_company_id: company.id });
    setDeleting(false);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Organização excluída permanentemente' });
    navigate('/app/startups');
  };

  // ---- Marcador Demo Day ----
  const toggleDemoDay = async () => {
    if (!company) return;
    const next = !company.demo_day_selected;
    const { error } = await supabase.from('companies').update({ demo_day_selected: next } as never).eq('id', company.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setCompany({ ...company, demo_day_selected: next });
    toast({ title: next ? 'Marcada para o Demo Day' : 'Removida do Demo Day' });
  };

  // ---- Edit Company Dialog ----
  const openEditDialog = () => {
    if (!company) return;
    setEditForm({
      name: company.name,
      legal_name: company.legal_name || '',
      cnpj: company.cnpj || '',
      sector: company.sector || '',
      stage: company.stage || '',
      business_model: company.business_model || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveCompany = async () => {
    if (!company) return;
    if (editForm.cnpj && !isValidCnpj(editForm.cnpj)) {
      toast({ title: 'CNPJ inválido', description: 'Confira os dígitos do CNPJ antes de salvar.', variant: 'destructive' });
      return;
    }
    setEditSaving(true);
    const { error } = await supabase.from('companies').update({
      name: editForm.name,
      legal_name: editForm.legal_name || null,
      cnpj: editForm.cnpj || null,
      sector: editForm.sector || null,
      stage: editForm.stage || null,
      business_model: editForm.business_model || null,
    }).eq('id', company.id);
    setEditSaving(false);
    if (!error) {
      setCompany({ ...company, ...editForm, legal_name: editForm.legal_name || null, cnpj: editForm.cnpj || null, sector: editForm.sector || null, stage: (editForm.stage || null) as any, business_model: editForm.business_model || null });
      setEditDialogOpen(false);
      toast({ title: 'Organização atualizada' });
    } else {
      toast({ title: 'Erro', description: friendlySupabaseError(error.message), variant: 'destructive' });
    }
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-5 w-24 rounded-full" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader><Skeleton className="h-4 w-24" /></CardHeader><CardContent className="space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-4 w-full" />)}</CardContent></Card>
        <Card><CardHeader><Skeleton className="h-4 w-24" /></CardHeader><CardContent className="space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-12 w-full rounded-lg" />)}</CardContent></Card>
      </div>
      <BackToTopFooter />
    </div>
  );

  if (!company) return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/startups')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Organização não encontrada</h1>
      </div>
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Esta organização não existe ou você não tem acesso a ela. Membros do Comitê de Crescimento só visualizam organizações que lhes foram atribuídas.
        </CardContent>
      </Card>
      <BackToTopFooter />
    </div>
  );

  const numericFieldDefs = CONTEXT_NUMERIC_FIELDS;

  const getAssessmentTotalQuestions = (assessmentId?: string | null) => {
    if (!assessmentId) return 45;
    return assessmentQuestionTotals[assessmentId] || 45;
  };
  const inProgressAssessment = assessments.find((a) => a.status === 'in_progress');
  const inProgressAnswered = inProgressAssessment ? answerCounts[inProgressAssessment.id] || 0 : 0;
  const inProgressTotalQuestions = getAssessmentTotalQuestions(inProgressAssessment?.id);
  const inProgressPct = Math.min(100, Math.round((inProgressAnswered / inProgressTotalQuestions) * 100));
  const inProgressLink = inProgressAssessment ? `/app/assessments/${inProgressAssessment.id}/questionnaire` : null;
  const draftAssessments = assessments.filter((assessment) => assessment.status === 'in_progress');
  const latestAssessment = assessments[0];
  const latestStatusLabel = latestAssessment?.status === 'completed' ? 'Concluído' : latestAssessment?.status === 'in_progress' ? 'Em andamento' : 'Sem diagnóstico';
  const latestStatusVariant = latestAssessment?.status === 'completed' ? 'default' : 'secondary';
  const latestStatusDate = latestAssessment?.created_at ? new Date(latestAssessment.created_at).toLocaleDateString('pt-BR') : '—';
  const openActionsCount = councilStats.open;
  const criticalActionsCount = actions.filter((a) => a.status === 'blocked' || a.priority === 'high').length;
  const upcomingAgenda = councilStats.nextAgenda && councilStats.nextAgenda !== '-' ? councilStats.nextAgenda : 'Sem pauta definida até o momento';
  const diagnosticReportLink = latestAssessment?.id ? `/app/assessments/${latestAssessment.id}/report` : null;
  const companyProgressLink = `/app/startups/${company.id}/progress`;
  const todayDateOnly = getTodayDateOnly();
  const overdueActions = actions.filter((a) => a.due_date && isDateOnlyBefore(a.due_date, todayDateOnly) && !['completed', 'cancelled'].includes(a.status || ''));
  const relevantActions = actions
    .filter((a) => openActionStatuses.has(a.status || ''))
    .sort((a, b) => {
      const getWeight = (action: CouncilAction) => {
        let score = 0;
        if (action.status === 'blocked') score += 100;
        if (action.due_date && isDateOnlyBefore(action.due_date, todayDateOnly)) score += 80;
        if (action.priority === 'high') score += 60;
        if (action.status === 'in_progress') score += 20;
        return score;
      };
      return getWeight(b) - getWeight(a);
    })
    .slice(0, 5);


  const normalizedCompanyName = (company.name || '').trim().toLowerCase();
  const normalizedLegalName = (company.legal_name || '').trim().toLowerCase();
  const isLegalNameCoherent = !!company.legal_name && (!!normalizedCompanyName && (normalizedLegalName.includes(normalizedCompanyName) || normalizedCompanyName.includes(normalizedLegalName)));

  const actionBadges = [
    { label: 'Travadas', value: actions.filter((a) => a.status === 'blocked').length },
    { label: 'Atrasadas', value: overdueActions.length },
    { label: 'Alta prioridade', value: actions.filter((a) => a.priority === 'high' && openActionStatuses.has(a.status || '')).length },
    { label: 'Abertas', value: openActionsCount },
  ];

  return (
    <div className="space-y-6">
      <div className="executive-panel p-5 rounded-xl space-y-4">
        <div className="flex items-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => navigate('/app/startups')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Voltar para lista de organizações</TooltipContent>
          </Tooltip>
        </TooltipProvider>
          <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
            <h1 className="text-3xl font-bold tracking-tight leading-tight">{company.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">Perfil executivo da organização acompanhada pelo Growth OS.</p>
            </div>
            {canWrite && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEditDialog}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar dados da organização</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {company.stage && <Badge variant="secondary" className="executive-pill">{stageLabels[company.stage] || company.stage}</Badge>}
            {company.sector && <Badge variant="outline" className="executive-pill">{company.sector}</Badge>}
            <Badge variant={latestStatusVariant} className="executive-pill">Status geral: {lastResult?.level || latestStatusLabel}</Badge>
            {company.demo_day_selected && <Badge className="executive-pill bg-primary/80">Demo Day</Badge>}
            {company.archived_at && <Badge variant="destructive" className="executive-pill">Arquivada</Badge>}
          </div>
        </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          {canWrite && inProgressLink && (
            <Button asChild>
              <Link to={inProgressLink}>Continuar diagnóstico</Link>
            </Button>
          )}
          {canWrite && <Button variant={inProgressLink ? 'outline' : 'default'} onClick={openNewDialog}>Novo diagnóstico</Button>}
          {canWrite && (
            <Button variant={company.demo_day_selected ? 'default' : 'outline'} onClick={toggleDemoDay}>
              {company.demo_day_selected ? '✓ Selecionada p/ Demo Day' : 'Marcar p/ Demo Day'}
            </Button>
          )}
          <Button asChild variant='outline'><Link to={`/app/startups/${company.id}/counselor`}>Abrir Central do Comitê de Crescimento</Link></Button>
          <Button asChild variant='outline'><Link to={`/app/agenda?company=${company.id}`}>Ver Agenda</Link></Button>
          <Button asChild variant='secondary'><Link to={companyProgressLink}>Relatório de Progresso</Link></Button>
          {lastResult && diagnosticReportLink && (
            <Button asChild variant='outline'>
              <Link to={diagnosticReportLink}>Relatório de Diagnóstico</Link>
            </Button>
          )}
        </div>
      </div>

      {inProgressAssessment && inProgressLink && (
        <Card className="border-amber-500/35 bg-amber-500/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">Diagnóstico iniciado e incompleto</p>
                  <Badge variant="secondary" className="executive-pill">Rascunho</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Progress value={inProgressPct} className="h-1.5 w-36" />
                  <span className="font-mono">{inProgressAnswered}/{inProgressTotalQuestions}</span>
                  <span>criado em {new Date(inProgressAssessment.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {draftAssessments.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Há {draftAssessments.length} diagnósticos em rascunho nesta organização. A lista abaixo permite retomar cada um.
                  </p>
                )}
              </div>
            </div>
            <Button asChild size="sm">
              <Link to={inProgressLink}>Continuar questionário</Link>
            </Button>
          </CardContent>
        </Card>
      )}


      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-6'>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-xs text-muted-foreground'>Diagnósticos</p><p className='text-2xl font-bold'>{assessments.length}</p><p className='text-xs text-muted-foreground'>{draftAssessments.length > 0 ? `${draftAssessments.length} em rascunho` : 'Sem rascunho aberto'}</p></CardContent></Card>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-xs text-muted-foreground'>Último score/status</p><p className='text-2xl font-bold'>{lastResult ? `${lastResult.score100}` : '—'}</p><p className='text-xs text-muted-foreground'>{lastResult?.level || 'Sem diagnóstico concluído'}</p></CardContent></Card>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-xs text-muted-foreground'>Encontros registrados</p><p className='text-2xl font-bold'>{councilStats.meetings}</p></CardContent></Card>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-xs text-muted-foreground'>Ações abertas</p><p className='text-2xl font-bold'>{councilStats.open}</p></CardContent></Card>
        <Card className='executive-card border-destructive/40'><CardContent className='p-4'><p className='text-xs text-muted-foreground'>Ações críticas</p><p className='text-2xl font-bold text-destructive'>{criticalActionsCount}</p></CardContent></Card>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-xs text-muted-foreground'>Dimensões em atenção</p><p className='text-2xl font-bold'>{lastMeetingProgressSummary.worsening + lastMeetingProgressSummary.insufficient_evidence}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className='executive-panel'>
          <CardHeader><p className='executive-section-title text-xs'>Diagnósticos e relatórios</p><CardTitle>Último diagnóstico</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={latestStatusVariant}>{latestStatusLabel}</Badge>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Data</p>
                <p className="font-medium">{latestStatusDate}</p>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Score</p>
              <p className="text-xl font-semibold">
                {lastResult ? `${lastResult.score100} · ${lastResult.level}` : latestAssessment?.status === 'in_progress' ? 'Rascunho em andamento' : 'Sem score disponível'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {latestAssessment?.status === 'in_progress' && (
                <Button asChild>
                  <Link to={`/app/assessments/${latestAssessment.id}/questionnaire`}>Continuar questionário</Link>
                </Button>
              )}
              {latestAssessment?.id && (
                <Button asChild variant="outline">
                  <Link to={`/app/assessments/${latestAssessment.id}/report`}>
                    {latestAssessment.status === 'completed' ? 'Ver Relatório de Diagnóstico' : 'Ver relatório parcial'}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline"><Link to={companyProgressLink}>Ver Relatório de Progresso</Link></Button>
              {canWrite && <Button onClick={openNewDialog}>Novo diagnóstico</Button>}
            </div>
          </CardContent>
        </Card>

        <Card className='executive-panel'>
          <CardHeader><p className='executive-section-title text-xs'>Comitê de Crescimento e evolução</p><CardTitle>Últimos encontros e governança</CardTitle></CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className="space-y-2">
              <p className="text-muted-foreground">Últimos encontros</p>
              {recentMeetings.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-muted-foreground">
                  Nenhum encontro registrado ainda.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentMeetings.map((meeting) => (
                    <div key={meeting.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="text-xs text-muted-foreground">{formatDateOnlyBR(meeting.meeting_date)}</p>
                        <p className="font-medium">{meeting.title || meeting.executive_summary || 'Encontro do comitê de crescimento'}</p>
                        <p className="max-w-full break-words text-xs text-muted-foreground">Próxima pauta: {meeting.next_agenda || 'Não definida'}</p>
                      </div>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/app/agenda/${meeting.id}`}>Abrir</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p><span className='text-muted-foreground'>Última reunião:</span> <strong>{formatDateOnlyBR(councilStats.lastMeeting)}</strong></p>
            <p><span className='text-muted-foreground'>Próxima pauta:</span> {upcomingAgenda}</p>
            <p><span className='text-muted-foreground'>Ações abertas/críticas:</span> <strong>{openActionsCount}</strong> / <strong className='text-destructive'>{criticalActionsCount}</strong></p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant='outline'><Link to={`/app/agenda?company=${company.id}`}>Abrir Agenda</Link></Button>
              <Button asChild variant='outline'><Link to={companyProgressLink}>Ver Relatório de Progresso</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className='executive-panel'>
        <CardHeader><p className='executive-section-title text-xs'>Ações e pendências</p><CardTitle>Top ações relevantes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {actionBadges.map((badge) => (
              <Badge key={badge.label} variant="outline" className="executive-pill">{badge.label}: {badge.value}</Badge>
            ))}
          </div>
          {relevantActions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Sem ações abertas no momento. Registre ações na Agenda ou na Central do Comitê de Crescimento para acompanhar pendências executivas.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
            {relevantActions.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{item.title}</p>
                  {item.status === 'blocked' || (item.due_date && isDateOnlyBefore(item.due_date, todayDateOnly)) ? <AlertCircle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="executive-pill">{statusLabel[item.status || ''] || 'Aberta'}</Badge>
                  {item.priority && <Badge variant={item.priority === 'high' ? 'destructive' : 'secondary'} className="executive-pill">Prioridade {priorityLabel[item.priority] || item.priority}</Badge>}
                </div>
                <p className="text-muted-foreground mt-2">Prazo: {formatDateOnlyBR(item.due_date) || '—'}</p>
                <p className="text-muted-foreground">Responsável: {item.owner_name || 'Não definido'}</p>
                <p className="text-muted-foreground">Dimensão: {item.related_dimension || 'Não informada'}</p>
                <div className="mt-2">
                  <Button asChild size="sm"><Link to={item.meeting_id ? `/app/agenda/${item.meeting_id}` : `/app/startups/${company.id}/counselor`}>{item.meeting_id ? 'Abrir encontro' : 'Abrir Central do Comitê de Crescimento'}</Link></Button>
                </div>
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>

      <Card className='executive-panel'>
        <CardHeader><p className='executive-section-title text-xs'>Evolução por dimensão</p><CardTitle>Leitura executiva de evolução</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Melhorando</p><p className="text-lg font-semibold">{lastMeetingProgressSummary.improving}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Estáveis</p><p className="text-lg font-semibold">{lastMeetingProgressSummary.stable}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Piorando</p><p className="text-lg font-semibold text-destructive">{lastMeetingProgressSummary.worsening}</p></div>
          <div className="rounded-lg border p-3"><p className="text-muted-foreground">Sem evidência</p><p className="text-lg font-semibold">{lastMeetingProgressSummary.insufficient_evidence}</p></div>
          <p className='col-span-full text-sm text-muted-foreground'>
            {`${lastMeetingProgressSummary.improving} dimens${lastMeetingProgressSummary.improving === 1 ? 'ão' : 'ões'} melhorando; ${lastMeetingProgressSummary.worsening === 0 ? 'nenhuma dimensão piorando' : `${lastMeetingProgressSummary.worsening} em piora`}.`}
          </p>
          {lastMeetingProgressSummary.meetingId && <Link className='text-primary underline col-span-full' to={`/app/agenda/${lastMeetingProgressSummary.meetingId}`}>Ver detalhe da última reunião</Link>}
          {recentMeetings.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Sem histórico de reunião para calcular evolução por dimensão.</p>}
        </CardContent>
      </Card>

      {/* Resumo do diagnóstico mais recente */}
      {lastResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{lastResult.score100}</p>
                  <p className="text-xs text-muted-foreground">Resumo do diagnóstico mais recente</p>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div>
                  <p className={`text-sm font-semibold ${lastResult.levelColor}`}>{lastResult.level}</p>
                  {lastResult.redFlagCount > 0 && (
                    <div className="flex items-center gap-1 text-xs text-destructive mt-0.5">
                      <AlertTriangle className="h-3 w-3" />
                      {lastResult.redFlagCount} red flag{lastResult.redFlagCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`/app/assessments/${lastResult.assessmentId}/report`)}>
                Ver relatório completo <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Founders & Leadership Card */}
      {(() => {
        const currentSemester = getCurrentSemester();
        const currentFaScores = founderAssessments
          .map(a => a.score_used)
          .filter((s): s is number => s != null);
        const compositeScore = currentFaScores.length > 0
          ? Math.round(currentFaScores.reduce((a, b) => a + b, 0) / currentFaScores.length * 10) / 10
          : null;
        const compositeStage = compositeScore != null ? getFounderStageLabel(compositeScore) : null;

        // Build historical composite data by semester
        const semesterMap: Record<string, number[]> = {};
        allFounderAssessments.forEach(fa => {
          if (fa.score_used != null) {
            if (!semesterMap[fa.semester]) semesterMap[fa.semester] = [];
            semesterMap[fa.semester].push(fa.score_used);
          }
        });
        const historyData = Object.entries(semesterMap)
          .map(([semester, scores]) => ({
            semester,
            score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10,
          }))
          .sort((a, b) => a.semester.localeCompare(b.semester));
        const showChart = historyData.length >= 2;

        return (
          <Card className="border-amber-500/20 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/app/startups/${id}/founders`)}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <Users className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Founders & Liderança</p>
                    <p className="text-xs text-muted-foreground">{currentSemester} · {founders.length} founder(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {compositeScore != null && (
                    <div className="text-right">
                      <p className="text-xl font-bold">{compositeScore}</p>
                      <p className={`text-[10px] font-medium ${compositeStage?.color}`}>{compositeStage?.label}</p>
                    </div>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Individual founders table */}
              {founders.length > 0 && founderAssessments.length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Avaliação de liderança ainda não registrada.</div>
              )}
              {founders.length > 0 && founderAssessments.length > 0 && (
                <div className="space-y-1.5">
                  {founders.map(f => {
                    const fa = founderAssessments.find(a => a.founder_id === f.id);
                    const stage = fa?.score_used != null ? getFounderStageLabel(fa.score_used) : null;
                    return (
                      <div key={f.id} className="flex items-center justify-between text-xs py-1 border-t first:border-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{f.name}</span>
                          {f.role && <span className="text-muted-foreground">{f.role}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {fa?.score_used != null ? (
                            <>
                              <span className="font-bold font-mono">{fa.score_used.toFixed(1)}</span>
                              {stage && <Badge variant="outline" className={`text-[10px] ${stage.color}`}>{stage.label}</Badge>}
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">Avaliação de liderança ainda não registrada.</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}


              {/* Historical Composite Score Chart */}
              {showChart && (
                <div className="pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Evolução do Score Composto</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={historyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="semester" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <ReferenceLine y={50} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <RechartsTooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                        labelStyle={{ fontWeight: 600 }}
                        formatter={(value: number) => [`${value}`, 'Score Composto']}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Red flags */}
              {compositeScore != null && compositeScore < 50 && (
                <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2 rounded">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Risco estrutural de liderança no time fundador
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Membros do Comitê de Crescimento (atribuição de advisors) — apenas JV Admin/Super Admin */}
      {isAdmin && <AdvisorsSection companyId={company.id} />}

      {/* Plano de ação (action_items, nível company) */}
      <ActionPlanSection companyId={company.id} canManage={canManageOps} />

      {/* Reuniões (meeting_logs, nível company) */}
      <MeetingLogsSection companyId={company.id} canManage={canManageOps} />

      {/* Zona de Super Admin — arquivar / excluir */}
      {isSuperAdmin && (
        <Card className="border-destructive/40">
          <CardHeader>
            <p className="executive-section-title text-xs text-destructive">Zona de Super Admin</p>
            <CardTitle className="text-sm">Arquivar ou excluir organização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Arquivar esconde a organização da lista principal (reversível). Excluir remove permanentemente todo o histórico — diagnósticos, founders, ações e reuniões. Não há como desfazer.
            </p>
            <div className="flex flex-wrap gap-2">
              {company.archived_at ? (
                <Button variant="outline" size="sm" disabled={archiving} onClick={() => handleArchive(false)}>Desarquivar</Button>
              ) : (
                <Button variant="outline" size="sm" disabled={archiving} onClick={() => handleArchive(true)}>{archiving ? 'Arquivando...' : 'Arquivar'}</Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => { setDeleteConfirm(''); setDeleteOpen(true); }}>Excluir permanentemente</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {isLegalNameCoherent && <p><span className="text-muted-foreground">Razão Social:</span> {company.legal_name}</p>}
            {!isLegalNameCoherent && <p><span className="text-muted-foreground">Razão Social:</span> Informação em revisão no cadastro</p>}
            {company.cnpj && <p><span className="text-muted-foreground">CNPJ:</span> {company.cnpj}</p>}
            {company.business_model && <p><span className="text-muted-foreground">Modelo:</span> {company.business_model}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <p className='executive-section-title text-xs'>Diagnósticos e relatórios</p><CardTitle className="text-sm">Diagnósticos</CardTitle>
            {canWrite && (
              <Button size="sm" onClick={openNewDialog}>
                <Plus className="mr-1 h-3 w-3" /> Novo
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {assessments.length === 0 ? (
              <div className="text-center py-6">
                <Inbox className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Nenhum diagnóstico ainda. Crie o primeiro para começar a análise.</p>
                {canWrite && (
                  <Button size="sm" onClick={openNewDialog}>
                    <Plus className="mr-1 h-3 w-3" /> Novo
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {assessments.map((a, i) => {
                  const count = answerCounts[a.id] || 0;
                  const total = getAssessmentTotalQuestions(a.id);
                  const pct = Math.min(100, Math.round((count / total) * 100));
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.3 }}
                    >
                      <div
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-secondary/50 hover:-translate-y-0.5 transition-all duration-200 ${
                          a.status === 'in_progress' ? 'border-amber-500/35 bg-amber-500/5' : ''
                        }`}
                        onClick={() => navigate(
                          a.status === 'completed'
                            ? `/app/assessments/${a.id}/report`
                            : `/app/assessments/${a.id}/questionnaire`
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {new Date(a.created_at).toLocaleDateString('pt-BR')}
                              </span>
                              {a.stage && (
                                <span className="text-xs text-muted-foreground">
                                  {stageLabels[a.stage] || a.stage}
                                </span>
                              )}
                            </div>
                            {a.status === 'in_progress' && (
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={pct} className="flex-1 h-1.5" />
                                <span className="text-[10px] text-muted-foreground font-mono">{count}/{total}</span>
                                <span className="text-[10px] font-medium text-amber-500">incompleto</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant={a.status === 'completed' ? 'default' : 'secondary'} className="ml-2 shrink-0">
                          {a.status === 'completed' ? 'Ver relatório' : 'Continuar diagnóstico'}
                        </Badge>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Assessment Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Diagnóstico</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-xs">
              {['Preparar', 'Obrigatório', 'Opcional'].map((label, index) => (
                <div key={label} className={`rounded-lg border px-3 py-2 ${newAssessmentStep === index ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                  <span className="font-semibold">{index + 1}. {label}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" className="executive-pill">Obrigatório</Badge>
                <span>Estágio da empresa.</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="executive-pill">Opcional recomendado</Badge>
                <span>Cliente, receita e contexto financeiro/operacional enriquecem red flags, benchmarks e recomendações.</span>
              </div>
            </div>

            {newAssessmentStep === 0 && (
              <div className="space-y-3 rounded-lg border p-4 text-sm">
                <div>
                  <p className="font-semibold">Antes de começar</p>
                  <p className="mt-1 text-muted-foreground">
                    Este fluxo cria um diagnóstico em rascunho. Você pode fechar e voltar depois pela organização ou pelo dashboard.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="font-medium">1. Contexto</p>
                    <p className="text-xs text-muted-foreground">Confirme estágio e dados básicos.</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="font-medium">2. Questionário</p>
                    <p className="text-xs text-muted-foreground">Responda dimensões com autosave.</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="font-medium">3. Relatório</p>
                    <p className="text-xs text-muted-foreground">Finalize e transforme em plano.</p>
                  </div>
                </div>
              </div>
            )}

            {newAssessmentStep === 1 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2 text-xs">
                    Estágio
                    <Badge variant="default" className="executive-pill text-[10px]">Obrigatório</Badge>
                  </Label>
                  <Select value={newStage} onValueChange={setNewStage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pre_seed">Pre-Seed</SelectItem>
                      <SelectItem value="seed">Seed</SelectItem>
                      <SelectItem value="series_a">Series A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Campos obrigatórios</p>
                  <p className="mt-1">Hoje apenas o estágio é indispensável para calibrar pesos, metas e leitura por fase.</p>
                </div>
              </div>
            )}

            {newAssessmentStep === 2 && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2 text-xs">
                      Tipo de cliente
                      <span className="text-[10px] font-normal text-muted-foreground">Opcional recomendado</span>
                    </Label>
                    <Select value={newCustomerType} onValueChange={setNewCustomerType}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="B2B">B2B</SelectItem>
                        <SelectItem value="B2C">B2C</SelectItem>
                        <SelectItem value="B2B2C">B2B2C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2 text-xs">
                      Modelo de receita
                      <span className="text-[10px] font-normal text-muted-foreground">Opcional recomendado</span>
                    </Label>
                    <Select value={newRevenueModel} onValueChange={setNewRevenueModel}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="non_recurring">Não recorrente</SelectItem>
                        <SelectItem value="recurring">Recorrente</SelectItem>
                        <SelectItem value="subscription">Assinatura</SelectItem>
                        <SelectItem value="usage_based">Baseado em uso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contexto Financeiro e Operacional</p>
                  <p className="text-xs text-muted-foreground">Todos os campos abaixo são opcionais recomendados.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {numericFieldDefs.map(f => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        value={numericFields[f.key] || ''}
                        onChange={e => setNumericFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder="—"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancelar</Button>
            {newAssessmentStep > 0 && <Button variant="outline" onClick={() => setNewAssessmentStep((step) => step - 1)}>Voltar</Button>}
            {newAssessmentStep < 2 ? (
              <Button onClick={() => setNewAssessmentStep((step) => step + 1)}>Continuar</Button>
            ) : (
              <Button onClick={handleCreateAssessment} disabled={creating}>
                {creating ? 'Criando...' : 'Criar Diagnóstico'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Organização</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={editForm.name} onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Razão Social</Label>
              <Input value={editForm.legal_name} onChange={e => setEditForm(prev => ({ ...prev, legal_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CNPJ</Label>
              <Input value={editForm.cnpj} maxLength={18} onChange={e => setEditForm(prev => ({ ...prev, cnpj: formatCnpj(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Setor</Label>
              <Input value={editForm.sector} onChange={e => setEditForm(prev => ({ ...prev, sector: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estágio</Label>
              <Select value={editForm.stage} onValueChange={v => setEditForm(prev => ({ ...prev, stage: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_seed">Pre-Seed</SelectItem>
                  <SelectItem value="seed">Seed</SelectItem>
                  <SelectItem value="series_a">Series A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modelo de Negócio</Label>
              <Input value={editForm.business_model} onChange={e => setEditForm(prev => ({ ...prev, business_model: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCompany} disabled={editSaving}>
              {editSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir permanentemente (Super Admin) — confirmação por digitação */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir {company.name}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta ação é <strong className="text-destructive">permanente</strong> e remove todo o histórico ligado a esta organização (diagnósticos, founders, ações, reuniões). Não há como desfazer.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Digite <strong>{company.name}</strong> para confirmar</Label>
              <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={company.name} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleting || deleteConfirm.trim() !== company.name.trim()} onClick={handleDelete}>
              {deleting ? 'Excluindo...' : 'Excluir permanentemente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
