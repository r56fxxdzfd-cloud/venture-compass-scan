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
  const { isAdmin, isAnalyst, user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
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

  // New assessment dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState('seed');
  const [newCustomerType, setNewCustomerType] = useState('');
  const [newRevenueModel, setNewRevenueModel] = useState('');
  const [numericFields, setNumericFields] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // Edit company dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', legal_name: '', cnpj: '', sector: '', stage: '', business_model: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: companyData } = await supabase.from('companies').select('*').eq('id', id).single();
      if (companyData) setCompany(companyData as Company);

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

        // Fetch answer counts for all assessments
        const counts: Record<string, number> = {};
        for (const a of assessData) {
          const { count } = await supabase.from('answers').select('id', { count: 'exact', head: true }).eq('assessment_id', a.id);
          counts[a.id] = count || 0;
        }
        setAnswerCounts(counts);

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
  const openNewDialog = () => {
    setNewStage(company?.stage || 'seed');
    setNewCustomerType('');
    setNewRevenueModel('');
    setNumericFields({});
    setNewDialogOpen(true);
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
      navigate(`/app/assessments/${data.id}/questionnaire`);
    }
    if (error) {
      toast({ title: 'Erro ao criar diagnóstico', description: error.message, variant: 'destructive' });
    }
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
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  if (loading || !company) return (
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

  const numericFieldDefs = [
    { key: 'runway_months', label: 'Runway (meses)' },
    { key: 'burn_monthly', label: 'Burn Mensal (R$)' },
    { key: 'headcount', label: 'Headcount' },
    { key: 'gross_margin_pct', label: 'Margem Bruta (%)' },
    { key: 'cac', label: 'CAC (R$)' },
    { key: 'ltv', label: 'LTV (R$)' },
    { key: 'revenue_concentration_top1_pct', label: 'Concentração Top 1 cliente (%)' },
    { key: 'revenue_concentration_top3_pct', label: 'Concentração Top 3 clientes (%)' },
  ];

  const totalQuestions = 45;
  const latestAssessment = assessments[0];
  const latestStatusLabel = latestAssessment?.status === 'completed' ? 'Concluído' : latestAssessment?.status === 'in_progress' ? 'Em andamento' : 'Sem diagnóstico';
  const latestStatusVariant = latestAssessment?.status === 'completed' ? 'default' : 'secondary';
  const latestStatusDate = latestAssessment?.created_at ? new Date(latestAssessment.created_at).toLocaleDateString('pt-BR') : '—';
  const openActionsCount = councilStats.open;
  const criticalActionsCount = actions.filter((a) => a.status === 'blocked' || a.priority === 'high').length;
  const upcomingAgenda = councilStats.nextAgenda && councilStats.nextAgenda !== '-' ? councilStats.nextAgenda : 'Sem pauta definida até o momento';
  const progressReportLink = lastResult ? `/app/assessments/${lastResult.assessmentId}/report` : `/app/startups/${company.id}/progress`;
  const overdueActions = actions.filter((a) => a.due_date && new Date(a.due_date) < new Date() && !['completed', 'cancelled'].includes(a.status || ''));
  const relevantActions = actions
    .filter((a) => openActionStatuses.has(a.status || ''))
    .sort((a, b) => {
      const getWeight = (action: CouncilAction) => {
        let score = 0;
        if (action.status === 'blocked') score += 100;
        if (action.due_date && new Date(action.due_date) < new Date()) score += 80;
        if (action.priority === 'high') score += 60;
        if (action.status === 'in_progress') score += 20;
        return score;
      };
      return getWeight(b) - getWeight(a);
    })
    .slice(0, 6);

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
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
            <p className="text-sm text-muted-foreground">Perfil executivo da organização</p>
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
          <div className="flex gap-2 mt-2 flex-wrap">
            {company.stage && <Badge variant="secondary" className="executive-pill">{stageLabels[company.stage] || company.stage}</Badge>}
            {company.sector && <Badge variant="outline" className="executive-pill">{company.sector}</Badge>}
            <Badge variant={latestStatusVariant} className="executive-pill">Status geral: {lastResult?.level || latestStatusLabel}</Badge>
          </div>
        </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          {canWrite && <Button onClick={openNewDialog}>Novo diagnóstico</Button>}
          <Button asChild variant='outline'><Link to={`/app/startups/${company.id}/counselor`}>Abrir Central do Conselheiro</Link></Button>
          <Button asChild variant='outline'><Link to='/app/agenda'>Ver Agenda</Link></Button>
          <Button asChild variant='secondary'><Link to={progressReportLink}>Relatório de Progresso</Link></Button>
        </div>
      </div>


      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-6'>
        <Card className='executive-card'><CardContent className='p-4'><p className='text-xs text-muted-foreground'>Diagnósticos</p><p className='text-2xl font-bold'>{assessments.length}</p></CardContent></Card>
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
              <p className="text-xl font-semibold">{lastResult ? `${lastResult.score100} · ${lastResult.level}` : 'Sem score disponível'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" disabled={!lastResult}><Link to={progressReportLink}>Abrir relatório</Link></Button>
              {canWrite && <Button onClick={openNewDialog}>Novo diagnóstico</Button>}
            </div>
          </CardContent>
        </Card>

        <Card className='executive-panel'>
          <CardHeader><p className='executive-section-title text-xs'>Conselho e evolução</p><CardTitle>Últimos encontros e governança</CardTitle></CardHeader>
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
                        <p className="font-medium">{formatDateOnlyBR(meeting.meeting_date)}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[360px]">
                          {meeting.next_agenda || 'Sem pauta definida'}
                        </p>
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
              <Button asChild variant='outline'><Link to='/app/agenda'>Abrir Agenda</Link></Button>
              <Button asChild><Link to={`/app/startups/${company.id}/counselor`}>Abrir Central do Conselheiro</Link></Button>
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
              Sem ações abertas no momento. Registre ações na Agenda ou na Central do Conselheiro para acompanhar pendências executivas.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
            {relevantActions.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{item.title}</p>
                  {item.status === 'blocked' || (item.due_date && new Date(item.due_date) < new Date()) ? <AlertCircle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="executive-pill">{statusLabel[item.status || ''] || 'Aberta'}</Badge>
                  {item.priority && <Badge variant={item.priority === 'high' ? 'destructive' : 'secondary'} className="executive-pill">Prioridade {priorityLabel[item.priority] || item.priority}</Badge>}
                </div>
                <p className="text-muted-foreground mt-2">Prazo: {formatDateOnlyBR(item.due_date) || '—'}</p>
                <p className="text-muted-foreground">Responsável: {item.owner_name || 'Não definido'}</p>
                <p className="text-muted-foreground">Dimensão: {item.related_dimension || 'Não informada'}</p>
                <div className="mt-2 flex gap-2">
                  <Button asChild size="sm" variant="outline"><Link to={item.meeting_id ? `/app/agenda/${item.meeting_id}` : '/app/agenda'}>Encontro</Link></Button>
                  <Button asChild size="sm"><Link to={`/app/startups/${company.id}/counselor`}>Central</Link></Button>
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
          {lastMeetingProgressSummary.meetingId && <Link className='text-primary underline col-span-full' to={`/app/agenda/${lastMeetingProgressSummary.meetingId}`}>Ver detalhe da última reunião</Link>}
          {recentMeetings.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Sem histórico de reunião para calcular evolução por dimensão.</p>}
        </CardContent>
      </Card>

      {/* Last completed assessment summary */}
      {lastResult && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{lastResult.score100}</p>
                  <p className="text-xs text-muted-foreground">Score</p>
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
              {founders.length > 0 && (
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
                            <span className="text-muted-foreground italic">Sem avaliação</span>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {company.legal_name && <p><span className="text-muted-foreground">Razão Social:</span> {company.legal_name}</p>}
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
                  const pct = Math.min(100, Math.round((count / totalQuestions) * 100));
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.3 }}
                    >
                      <div
                        className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-secondary/50 hover:-translate-y-0.5 transition-all duration-200"
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
                                <span className="text-[10px] text-muted-foreground font-mono">{count}/{totalQuestions}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant={a.status === 'completed' ? 'default' : 'secondary'} className="ml-2 shrink-0">
                          {a.status === 'completed' ? 'Ver relatório' : 'Continuar'}
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Diagnóstico</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configuração do Diagnóstico</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Estágio</Label>
                <Select value={newStage} onValueChange={setNewStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre_seed">Pre-Seed</SelectItem>
                    <SelectItem value="seed">Seed</SelectItem>
                    <SelectItem value="series_a">Series A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Cliente</Label>
                <Select value={newCustomerType} onValueChange={setNewCustomerType}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B2B">B2B</SelectItem>
                    <SelectItem value="B2C">B2C</SelectItem>
                    <SelectItem value="B2B2C">B2B2C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modelo de Receita</Label>
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

            <Separator />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contexto Financeiro e Operacional</p>
            <div className="grid grid-cols-2 gap-3">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateAssessment} disabled={creating}>
              {creating ? 'Criando...' : 'Criar Diagnóstico'}
            </Button>
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
              <Input value={editForm.cnpj} onChange={e => setEditForm(prev => ({ ...prev, cnpj: e.target.value }))} />
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
    </div>
  );
}
