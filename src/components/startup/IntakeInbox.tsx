import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Link2, Copy, Inbox, Eye, Trash2, Loader2 } from 'lucide-react';
import type { IntakeSubmission, IntakePayload } from '@/types/darwin';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando', submitted: 'Recebido', imported: 'Importado', expired: 'Expirado',
};

// Rótulos amigáveis das 11 perguntas do Formulário Inicial Darwin Growth (na ordem)
const FIELD_LABELS: [keyof IntakePayload, string][] = [
  ['full_name', 'Nome completo'],
  ['role', 'Cargo atual'],
  ['email', 'E-mail'],
  ['whatsapp', 'WhatsApp'],
  ['birth_date', 'Data de nascimento'],
  ['company_name', 'Nome da empresa'],
  ['summary', 'Resumo da empresa'],
  ['stage_label', 'Estágio informado'],
  ['headcount', 'Colaboradores'],
  ['revenue_2025', 'Faturamento 2025'],
  ['revenue_goal_2026', 'Meta de faturamento 2026'],
];
const SCORING_STAGES: { value: string; label: string }[] = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
];
const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  pending: 'outline', submitted: 'secondary', imported: 'default', expired: 'destructive',
};
const EXPIRY_DAYS = 14;

function randomToken(): string {
  const bytes = new Uint8Array(24); // 24 bytes -> 48 hex chars
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Inbox JV de intakes: gerar link, acompanhar status, revisar e importar. */
export function IntakeInbox({ onImported }: { onImported?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<IntakeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [review, setReview] = useState<IntakeSubmission | null>(null);
  const [importStage, setImportStage] = useState('');
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('intake_submissions').select('*').order('created_at', { ascending: false });
    setRows((data || []) as IntakeSubmission[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/intake/${token}`;
    try { await navigator.clipboard.writeText(url); toast({ title: 'Link copiado', description: url }); }
    catch { toast({ title: 'Link', description: url }); }
  };

  const generate = async () => {
    setCreating(true);
    const token = randomToken();
    const expires = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('intake_submissions').insert({
      token, status: 'pending', label: label || null, expires_at: expires, created_by: user?.id,
    });
    setCreating(false);
    if (error) { toast({ title: 'Erro ao gerar link', description: error.message, variant: 'destructive' }); return; }
    setLabel('');
    await copyLink(token);
    load();
  };

  const expire = async (id: string) => {
    const { error } = await supabase.from('intake_submissions').update({ status: 'expired' }).eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const importIntake = async () => {
    if (!review) return;
    const payload = (review.payload || {}) as IntakePayload;
    if (!payload.company_name) { toast({ title: 'Payload sem nome de empresa', variant: 'destructive' }); return; }
    setImporting(true);
    // Estágio de diagnóstico é escolhido pelo JV (não derivado do rótulo do formulário,
    // que usa outra taxonomia). Sem escolha => fica nulo e pode ser definido depois.
    const stage = (importStage || null) as 'pre_seed' | 'seed' | 'series_a' | null;
    const { data: comp, error: compErr } = await supabase.from('companies').insert({
      name: payload.company_name,
      business_model: payload.summary || payload.business_model || null,
      stage,
    }).select().single();
    if (compErr || !comp) {
      setImporting(false);
      toast({ title: 'Erro ao criar organização', description: compErr?.message, variant: 'destructive' });
      return;
    }
    const { error: upErr } = await supabase.from('intake_submissions')
      .update({ status: 'imported', company_id: comp.id, imported_at: new Date().toISOString() })
      .eq('id', review.id);
    setImporting(false);
    if (upErr) { toast({ title: 'Organização criada, mas falha ao marcar intake', description: upErr.message, variant: 'destructive' }); }
    else { toast({ title: `Organização "${payload.company_name}" importada` }); }
    setReview(null);
    load();
    onImported?.();
  };

  return (
    <div className="space-y-4">
      <Card className="executive-panel">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold">Gerar link de cadastro</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Crie um link público para o fundador preencher sem login. Expira em {EXPIRY_DAYS} dias.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Rótulo (opcional)</Label>
              <Input className="h-9 w-64" value={label} placeholder="Ex: Startup indicada por X" onChange={(e) => setLabel(e.target.value)} />
            </div>
            <Button onClick={generate} disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando...</> : <><Link2 className="h-4 w-4 mr-1" /> Gerar e copiar link</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <div className="executive-surface rounded-xl text-center py-12">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum intake ainda. Gere um link para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[r.status] || 'outline'} className="text-xs">{STATUS_LABEL[r.status] || r.status}</Badge>
                  <p className="text-sm font-medium truncate">{r.label || (r.payload as IntakePayload)?.company_name || 'Intake sem rótulo'}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Criado em {new Date(r.created_at).toLocaleDateString('pt-BR')}
                  {r.submitted_at && ` · enviado em ${new Date(r.submitted_at).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {r.status === 'pending' && (
                  <Button variant="outline" size="sm" onClick={() => copyLink(r.token)}><Copy className="h-3.5 w-3.5 mr-1" /> Copiar link</Button>
                )}
                {r.status === 'submitted' && (
                  <Button size="sm" onClick={() => { setImportStage(''); setReview(r); }}><Eye className="h-3.5 w-3.5 mr-1" /> Revisar</Button>
                )}
                {(r.status === 'pending' || r.status === 'submitted') && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => expire(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revisão + importação */}
      <Dialog open={!!review} onOpenChange={(open) => !open && setReview(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Revisar intake</DialogTitle></DialogHeader>
          {review && (() => {
            const p = (review.payload || {}) as IntakePayload;
            return (
              <div className="space-y-3 text-sm">
                <div className="space-y-2">
                  {FIELD_LABELS.filter(([k]) => p[k] && String(p[k]).trim() !== '').map(([k, lbl]) => (
                    <div key={k} className="flex gap-2 border-b border-border/50 py-1.5">
                      <span className="w-40 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{lbl}</span>
                      <span className="flex-1 break-words">{String(p[k])}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 space-y-1.5">
                  <Label className="text-xs">Estágio para diagnóstico</Label>
                  <Select value={importStage} onValueChange={setImportStage}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Definir agora (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {SCORING_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    O estágio informado pelo fundador (“{p.stage_label || '—'}”) usa outra escala. Escolha aqui o estágio da metodologia — ou deixe em branco e defina depois no cadastro.
                  </p>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>Fechar</Button>
            <Button onClick={importIntake} disabled={importing}>
              {importing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando...</> : 'Importar como organização'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
