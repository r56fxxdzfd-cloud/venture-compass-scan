import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Building2, Sparkles, ArrowRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { Company } from '@/types/darwin';
import { motion } from 'framer-motion';
import { BackToTopFooter } from '@/components/BackToTopFooter';
import { IntakeInbox } from '@/components/startup/IntakeInbox';

export default function StartupsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [portfolioMetrics, setPortfolioMetrics] = useState<Record<string, { diagnostics: number; lastAssessmentStatus: string; lastAssessmentDate: string; meetings: number; openActions: number; criticalActions: number }>>({});
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', legal_name: '', cnpj: '', sector: '', stage: '', business_model: '' });
  const { canOperatePlatform, canOperateDemo, isDemoUser, isAnalyst } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const canWrite = canOperatePlatform || canOperateDemo;
  const isOperator = canOperatePlatform || isAnalyst; // admin/analyst → acesso a Intakes

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    if (!data) return;
    const companiesData = data as Company[];
    setCompanies(companiesData);

    const companyIds = companiesData.map((c) => c.id);
    if (companyIds.length === 0) {
      setPortfolioMetrics({});
      return;
    }

    const [{ data: assessmentsData }, { data: meetingsData }] = await Promise.all([
      supabase.from('assessments').select('id,company_id,status,created_at').in('company_id', companyIds).order('created_at', { ascending: false }),
      supabase.from('council_meetings').select('id,company_id').in('company_id', companyIds),
    ]);

    const meetingIds = (meetingsData || []).map((m: any) => m.id);
    const { data: actionsData } = meetingIds.length
      ? await supabase.from('council_actions').select('meeting_id,status,due_date').in('meeting_id', meetingIds)
      : { data: [] as any[] };

    const meetingsByCompany = new Map<string, any[]>();
    (meetingsData || []).forEach((m: any) => {
      const list = meetingsByCompany.get(m.company_id) || [];
      list.push(m);
      meetingsByCompany.set(m.company_id, list);
    });

    const actionsByMeeting = new Map<string, any[]>();
    (actionsData || []).forEach((a: any) => {
      const list = actionsByMeeting.get(a.meeting_id) || [];
      list.push(a);
      actionsByMeeting.set(a.meeting_id, list);
    });

    const assessmentsByCompany = new Map<string, any[]>();
    (assessmentsData || []).forEach((a: any) => {
      const list = assessmentsByCompany.get(a.company_id) || [];
      list.push(a);
      assessmentsByCompany.set(a.company_id, list);
    });

    const metrics: Record<string, { diagnostics: number; lastAssessmentStatus: string; lastAssessmentDate: string; meetings: number; openActions: number; criticalActions: number }> = {};
    companiesData.forEach((company) => {
      const compAssess = assessmentsByCompany.get(company.id) || [];
      const compMeetings = meetingsByCompany.get(company.id) || [];
      const relatedActions = compMeetings.flatMap((m: any) => actionsByMeeting.get(m.id) || []);
      const openActions = relatedActions.filter((a: any) => a.status !== 'completed').length;
      const criticalActions = relatedActions.filter((a: any) => a.status === 'blocked' || a.status === 'overdue').length;
      metrics[company.id] = {
        diagnostics: compAssess.length,
        lastAssessmentStatus: compAssess[0]?.status || 'none',
        lastAssessmentDate: compAssess[0]?.created_at || '',
        meetings: compMeetings.length,
        openActions,
        criticalActions,
      };
    });

    setPortfolioMetrics(metrics);
  };

  useEffect(() => { fetchCompanies(); }, []);

  const handleCreate = async () => {
    const { error } = await supabase.from('companies').insert({
      name: form.name,
      legal_name: form.legal_name || null,
      cnpj: form.cnpj || null,
      sector: form.sector || null,
      stage: form.stage || null,
      business_model: form.business_model || null,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Organização '${form.name}' criada com sucesso.` });
      setOpen(false);
      setForm({ name: '', legal_name: '', cnpj: '', sector: '', stage: '', business_model: '' });
      fetchCompanies();
    }
  };

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const stageLabels: Record<string, string> = {
    pre_seed: 'Pre-Seed',
    seed: 'Seed',
    series_a: 'Series A',
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent p-7 sm:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              <Sparkles className="h-3 w-3" /> Portfólio
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Portfólio de Organizações</h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Empresas e instituições acompanhadas pelo Conselho OS.</p>
          </div>
          {canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full rounded-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" /> Nova Organização
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Organização</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Razão Social</Label>
                  <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={form.cnpj}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
                      let formatted = digits;
                      if (digits.length > 2) formatted = digits.slice(0, 2) + '.' + digits.slice(2);
                      if (digits.length > 5) formatted = formatted.slice(0, 6) + '.' + digits.slice(5);
                      if (digits.length > 8) formatted = formatted.slice(0, 10) + '/' + digits.slice(8);
                      if (digits.length > 12) formatted = formatted.slice(0, 15) + '-' + digits.slice(12);
                      setForm({ ...form, cnpj: formatted });
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Setor</Label>
                    <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fintech">Fintech</SelectItem>
                        <SelectItem value="healthtech">Healthtech</SelectItem>
                        <SelectItem value="edtech">Edtech</SelectItem>
                        <SelectItem value="agtech">Agtech</SelectItem>
                        <SelectItem value="retailtech">Retailtech</SelectItem>
                        <SelectItem value="logtech">Logtech</SelectItem>
                        <SelectItem value="proptech">Proptech</SelectItem>
                        <SelectItem value="legaltech">Legaltech</SelectItem>
                        <SelectItem value="hrtech">HRtech</SelectItem>
                        <SelectItem value="martech">Martech</SelectItem>
                        <SelectItem value="foodtech">Foodtech</SelectItem>
                        <SelectItem value="cleantech">Cleantech</SelectItem>
                        <SelectItem value="insurtech">Insurtech</SelectItem>
                        <SelectItem value="deeptech">Deeptech</SelectItem>
                        <SelectItem value="saas">SaaS</SelectItem>
                        <SelectItem value="marketplace">Marketplace</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estágio</Label>
                    <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pre_seed">Pre-Seed</SelectItem>
                        <SelectItem value="seed">Seed</SelectItem>
                        <SelectItem value="series_a">Series A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!form.name}>
                  Criar Organização
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          )}
        </div>
      </section>

      <Tabs defaultValue="portfolio" className="space-y-6">
        {isOperator && (
          <TabsList>
            <TabsTrigger value="portfolio">Portfólio</TabsTrigger>
            <TabsTrigger value="intakes">Intakes</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="portfolio" className="space-y-6">
      {companies.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar organização..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {companies.length === 0 ? (
        <div className="executive-surface rounded-xl text-center py-16">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground mb-2">
            {isDemoUser ? 'Nenhum dado demo disponível.' : 'Seu portfólio ainda está vazio.'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {isDemoUser
              ? 'Quando houver empresas marcadas como demo (is_demo = true), elas aparecerão aqui.'
              : 'Comece cadastrando uma organização para iniciar diagnósticos, agenda e acompanhamento executivo.'}
          </p>
          {canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nova Organização
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((company, i) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="executive-card executive-panel h-full rounded-2xl border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                  <Link to={`/app/startups/${company.id}`} className="block">
                    <CardContent className="flex h-full flex-col gap-4 p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="break-words text-base font-semibold leading-tight">{company.name}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {company.stage && (
                              <span className="executive-pill badge-success text-xs">{stageLabels[company.stage] || company.stage}</span>
                            )}
                            {company.sector && (
                              <span className="executive-pill text-xs text-muted-foreground">{company.sector}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Último diagnóstico</p>
                        <p className="mt-1 text-sm text-foreground">
                          {portfolioMetrics[company.id]?.lastAssessmentDate
                            ? `Último diagnóstico: ${new Date(portfolioMetrics[company.id].lastAssessmentDate).toLocaleDateString('pt-BR')}`
                            : 'Último diagnóstico: não disponível'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Conselho</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-lg border border-border/60 bg-background/60 p-2">
                            <p className="text-[11px] text-muted-foreground">Encontros</p>
                            <p className="text-sm font-semibold">Encontros: {portfolioMetrics[company.id]?.meetings ?? 0}</p>
                          </div>
                          <div className="rounded-lg border border-border/60 bg-background/60 p-2">
                            <p className="text-[11px] text-muted-foreground">Ações abertas</p>
                            <p className="text-sm font-semibold">Ações abertas: {portfolioMetrics[company.id]?.openActions ?? 0}</p>
                          </div>
                          <div className="rounded-lg border border-border/60 bg-background/60 p-2">
                            <p className="text-[11px] text-muted-foreground">Críticas</p>
                            <p className="text-sm font-semibold text-destructive">Críticas: {portfolioMetrics[company.id]?.criticalActions ?? 0}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-end pt-1">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-primary">
                          Abrir organização <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </CardContent>
                  </Link>
                  <div className="mt-1 flex flex-col gap-2 px-5 pb-5 sm:flex-row sm:flex-wrap">
                    <Button asChild size="sm" variant="secondary" className="w-full sm:w-auto">
                      <Link to={`/app/startups/${company.id}/progress`}>Relatório de Progresso</Link>
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 && companies.length > 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p>Nenhuma organização encontrada para "{search}"</p>
            </div>
          )}
        </>
      )}
        </TabsContent>
        {isOperator && (
          <TabsContent value="intakes">
            <IntakeInbox onImported={fetchCompanies} />
          </TabsContent>
        )}
      </Tabs>
      <BackToTopFooter />
    </div>
  );
}
