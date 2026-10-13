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
import { friendlySupabaseError } from '@/utils/supabase-errors';
import { Link2, Copy, Inbox, Eye, Trash2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { IntakeSubmission, IntakePayload, InternalNotification } from '@/types/darwin';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  registration_started: 'Cadastro iniciado',
  registration_completed: 'Cadastro concluído',
  diagnosis_started: 'Diagnóstico iniciado',
  diagnosis_completed: 'Diagnóstico concluído',
  submitted: 'Recebido',
  imported: 'Importado',
  expired: 'Expirado',
};

const FIELD_LABELS: [keyof IntakePayload, string][] = [
  ['responsible_name', 'Nome completo do sócio responsável pela participação no programa (ponto focal)'],
  ['company_name', 'Nome da empresa'],
  ['responsible_role', 'Cargo atual na empresa'],
  ['responsible_email', 'E-mail'],
  ['responsible_whatsapp', 'WhatsApp'],
  ['responsible_birthdate', 'Data de nascimento'],
  ['headcount', 'Quantos colaboradores a empresa possui?'],
  ['revenue_2025', 'Faturamento 2025'],
  ['revenue_2026_target', 'Meta de faturamento 2026'],
  ['expectations_text', 'O que você espera obter com a participação no Comitte?'],
];
const SCORING_STAGES: { value: string; label: string }[] = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
];
const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  pending: 'outline',
  registration_started: 'secondary',
  registration_completed: 'secondary',
  diagnosis_started: 'secondary',
  diagnosis_completed: 'default',
  submitted: 'secondary',
  imported: 'default',
  expired: 'destructive',
};
const EXPIRY_DAYS = 14;

function randomToken(): string {
  const bytes = new Uint8Array(24); // 24 bytes -> 48 hex chars
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Cópia robusta: tenta a Clipboard API (contexto seguro) e cai para o método
// legado (execCommand) — funciona mesmo quando a ativação por gesto é perdida.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* tenta o fallback abaixo */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Inbox JV de intakes: gerar link, acompanhar status, revisar e importar. */
export function IntakeInbox({ onImported }: { onImported?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<IntakeSubmission[]>([]);
  const [notifications, setNotifications] = useState<InternalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [review, setReview] = useState<IntakeSubmission | null>(null);
  const [importStage, setImportStage] = useState('');
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [events, setEvents] = useState<{ id: string; name: string; description: string | null; public_token: string }[]>([]);

  const load = async () => {
    const [{ data, error }, { data: notificationRows }, { data: eventRows }] = await Promise.all([
      supabase.from('intake_submissions').select('*').order('created_at', { ascending: false }),
      supabase.from('internal_notifications').select('*').eq('type', 'diagnosis_completed').order('created_at', { ascending: false }).limit(10),
      supabase.from('intake_events').select('id, name, description, public_token').eq('is_active', true).order('created_at', { ascending: false }),
    ]);
    setEvents(eventRows || []);
    if (error) {
      toast({ title: 'Erro ao carregar intakes', description: friendlySupabaseError(error.message), variant: 'destructive' });
      setLoading(false);
      return;
    }
    setRows((data || []) as IntakeSubmission[]);
    setNotifications((notificationRows || []) as unknown as InternalNotification[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/intake/${token}`;
    const copied = await copyToClipboard(url);
    toast(copied
      ? { title: 'Link copiado', description: url }
      : { title: 'Copie o link manualmente', description: url });
  };

  const generate = async () => {
    setCreating(true);
    const token = randomToken();
    const url = `${window.location.origin}/intake/${token}`;
    // Copia DENTRO do gesto do clique, antes de qualquer await de rede — senão o
    // navegador (ex.: Safari) perde a ativação por gesto e bloqueia a cópia.
    const copied = await copyToClipboard(url);
    const expires = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('intake_submissions').insert({
      token, status: 'pending', label: label || null, expires_at: expires, created_by: user?.id,
    });
    setCreating(false);
    if (error) { toast({ title: 'Erro ao gerar link', description: friendlySupabaseError(error.message), variant: 'destructive' }); return; }
    setLabel('');
    toast(copied
      ? { title: 'Link gerado e copiado', description: url }
      : { title: 'Link gerado (copie manualmente)', description: url });
    load();
  };

  const remove = async (id: string, hasData: boolean) => {
    if (hasData && !window.confirm('Excluir este intake? Os dados enviados pelo fundador serão removidos permanentemente.')) return;
    setDeletingId(id);
    const { error } = await supabase.from('intake_submissions').delete().eq('id', id);
    setDeletingId(null);
    if (error) { toast({ title: 'Erro ao excluir', description: friendlySupabaseError(error.message), variant: 'destructive' }); return; }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast({ title: 'Intake excluído' });
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
      company_name: payload.company_name,
      responsible_name: payload.responsible_name || payload.full_name || null,
      responsible_role: payload.responsible_role || payload.role || null,
      responsible_email: payload.responsible_email || payload.email || null,
      responsible_whatsapp: payload.responsible_whatsapp || payload.whatsapp || null,
      responsible_birthdate: payload.responsible_birthdate || payload.birth_date || null,
      headcount: payload.headcount ? Number(String(payload.headcount).replace(/\D/g, '')) || null : null,
      revenue_2025: payload.revenue_2025 || null,
      revenue_2026_target: payload.revenue_2026_target || payload.revenue_goal_2026 || null,
      expectations_text: payload.expectations_text || null,
      business_model: payload.summary || payload.business_model || null,
      stage,
    }).select().single();
    if (compErr || !comp) {
      setImporting(false);
      toast({ title: 'Erro ao criar organização', description: friendlySupabaseError(compErr?.message), variant: 'destructive' });
      return;
    }
    const { error: upErr } = await supabase.from('intake_submissions')
      .update({ status: 'imported', company_id: comp.id, imported_at: new Date().toISOString() })
      .eq('id', review.id);
    setImporting(false);
    if (upErr) { toast({ title: 'Organização criada, mas falha ao marcar intake', description: friendlySupabaseError(upErr.message), variant: 'destructive' }); }
    else { toast({ title: `Organização "${payload.company_name}" importada` }); }
    setReview(null);
    load();
    onImported?.();
  };

  return (
    <div className="space-y-4">
      {notifications.length > 0 && (
        <Card className="executive-panel">
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold">Diagnósticos concluídos</h3>
            </div>
            <div className="space-y-2">
              {notifications.map((notification) => {
                const data = (notification.data || {}) as any;
                return (
                  <div key={notification.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!notification.read_at && <Badge className="text-xs">Novo</Badge>}
                        <p className="truncate text-sm font-medium">{notification.title}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleString('pt-BR')}
                        {data?.priority_level ? ` · prioridade ${data.priority_level}` : ''}
                        {typeof data?.score_100 === 'number' ? ` · score ${data.score_100}/100` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {notification.assessment_id && (
                        <Button asChild size="sm">
                          <Link to={`/app/assessments/${notification.assessment_id}/report`}>Abrir diagnóstico</Link>
                        </Button>
                      )}
                      {!notification.read_at && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await supabase.from('internal_notifications').update({ read_at: new Date().toISOString(), read_by: user?.id || null }).eq('id', notification.id);
                            load();
                          }}
                        >
                          Marcar lida
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {events.map((event) => {
        const eventUrl = `${window.location.origin}/evento/${event.public_token}`;
        const eventCount = rows.filter((r) => (r as { event_id?: string | null }).event_id === event.id).length;
        return (
          <Card key={event.id} className="executive-panel">
            <CardContent className="pt-6 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold">Link do evento — {event.name}</h3>
                {event.description && <Badge variant="secondary">{event.description}</Badge>}
                <Badge variant="outline">{eventCount} inscrição(ões)</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Link único e compartilhável: cada participante faz o cadastro, o diagnóstico e confirma a(s) data(s).
                Abrir o link não cria nada — a inscrição aparece aqui só após o envio do cadastro.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={eventUrl} className="h-9 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button
                  variant="outline"
                  onClick={async () => {
                    const copied = await copyToClipboard(eventUrl);
                    toast(copied ? { title: 'Link do evento copiado', description: eventUrl } : { title: 'Copie o link manualmente', description: eventUrl });
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copiar link
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

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
                {r.company_id && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/app/startups/${r.company_id}`}>Abrir startup</Link>
                  </Button>
                )}
                {r.status === 'submitted' && !r.company_id && (
                  <Button size="sm" onClick={() => { setImportStage(''); setReview(r); }}><Eye className="h-3.5 w-3.5 mr-1" /> Revisar</Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  title="Excluir intake"
                  disabled={deletingId === r.id}
                  onClick={() => remove(r.id, r.status === 'submitted' || r.status === 'imported')}
                >
                  {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
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
