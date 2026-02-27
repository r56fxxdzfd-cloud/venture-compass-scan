import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Plus, ClipboardList, ArrowLeft, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Company, Assessment } from '@/types/darwin';

const stageLabels: Record<string, string> = { pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A' };

export default function StartupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isAnalyst, user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

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
    supabase.from('companies').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setCompany(data as Company);
    });
    supabase.from('assessments').select('*').eq('company_id', id).order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setAssessments(data as Assessment[]);
    });
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
    const { data: config } = await supabase
      .from('config_versions')
      .select('id')
      .eq('status', 'published')
      .single();

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
      toast({ title: 'Startup atualizada' });
    } else {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  if (!company) return null;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/startups')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{company.name}</h1>
            {canWrite && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEditDialog}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="flex gap-2 mt-1">
            {company.stage && <Badge variant="secondary">{stageLabels[company.stage] || company.stage}</Badge>}
            {company.sector && <Badge variant="outline">{company.sector}</Badge>}
          </div>
        </div>
      </div>

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
            <CardTitle className="text-sm">Diagnósticos</CardTitle>
            {canWrite && (
              <Button size="sm" onClick={openNewDialog}>
                <Plus className="mr-1 h-3 w-3" /> Novo
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {assessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum diagnóstico ainda</p>
            ) : (
              <div className="space-y-2">
                {assessments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => navigate(
                      a.status === 'completed'
                        ? `/app/assessments/${a.id}/report`
                        : `/app/assessments/${a.id}/questionnaire`
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm">
                          {new Date(a.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        {a.stage && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {stageLabels[a.stage] || a.stage}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.status === 'completed' ? 'default' : 'secondary'}>
                        {a.status === 'completed' ? 'Ver relatório' : 'Em andamento'}
                      </Badge>
                    </div>
                  </div>
                ))}
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
            <DialogTitle>Editar Startup</DialogTitle>
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
