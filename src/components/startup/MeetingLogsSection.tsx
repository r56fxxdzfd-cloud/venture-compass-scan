import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Plus } from 'lucide-react';
import { getTodayDateOnly } from '@/lib/dateOnly';
import type { MeetingLog } from '@/types/darwin';

function formatDateOnlyBR(dateString?: string | null) {
  if (!dateString) return '-';
  const [y, m, d] = dateString.split('-');
  if (!y || !m || !d) return '-';
  return `${d}/${m}/${y}`;
}

/**
 * Seção "Reuniões" — registro mínimo de reunião preenchível em <90s
 * (único obrigatório = decisions). Lista cronológica reversa.
 * Ao salvar com "próximos passos", oferece criar action_items (sem obrigar).
 */
export function MeetingLogsSection({ companyId, canManage }: { companyId: string; canManage: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<MeetingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    meeting_date: getTodayDateOnly(),
    attendees: '',
    decisions: '',
    next_steps: '',
    notes: '',
  });

  const load = async () => {
    const { data } = await supabase
      .from('meeting_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('meeting_date', { ascending: false })
      .order('created_at', { ascending: false });
    setLogs((data || []) as MeetingLog[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const resetForm = () => setForm({ meeting_date: getTodayDateOnly(), attendees: '', decisions: '', next_steps: '', notes: '' });

  const maybeCreateActionsFromNextSteps = async (nextSteps: string) => {
    const lines = nextSteps.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const ok = window.confirm(`Criar ${lines.length} ação(ões) no plano de ação a partir dos próximos passos?`);
    if (!ok) return;
    const rows = lines.map((title) => ({ company_id: companyId, title, status: 'todo' as const, created_by: user?.id }));
    const { error } = await supabase.from('action_items').insert(rows);
    if (error) {
      toast({ title: 'Não foi possível criar as ações', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${lines.length} ação(ões) adicionada(s) ao plano` });
    }
  };

  const handleSave = async () => {
    if (!form.decisions.trim()) {
      toast({ title: 'Decisões é obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('meeting_logs').insert({
      company_id: companyId,
      meeting_date: form.meeting_date,
      attendees: form.attendees || null,
      decisions: form.decisions,
      next_steps: form.next_steps || null,
      notes: form.notes || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar reunião', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Reunião registrada' });
    const ns = form.next_steps;
    setShowForm(false);
    resetForm();
    load();
    if (ns.trim()) await maybeCreateActionsFromNextSteps(ns);
  };

  return (
    <Card className="executive-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="executive-section-title text-xs">Acompanhamento</p>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" /> Reuniões
            </CardTitle>
          </div>
          {canManage && !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" /> Registrar reunião</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && showForm && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input type="date" className="h-8" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Participantes</Label>
                <Input className="h-8" value={form.attendees} placeholder="Quem participou" onChange={(e) => setForm({ ...form, attendees: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Decisões <span className="text-destructive">*</span></Label>
              <Textarea rows={2} value={form.decisions} placeholder="O que ficou decidido" onChange={(e) => setForm({ ...form, decisions: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Próximos passos</Label>
              <Textarea rows={2} value={form.next_steps} placeholder="Um por linha (vira ação no plano)" onChange={(e) => setForm({ ...form, next_steps: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Textarea rows={2} value={form.notes} placeholder="Observações livres (opcional)" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar reunião'}</Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Nenhuma reunião registrada ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((m) => (
              <div key={m.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{formatDateOnlyBR(m.meeting_date)}</p>
                  {m.attendees && <p className="text-xs text-muted-foreground">{m.attendees}</p>}
                </div>
                {m.decisions && <p className="text-xs"><span className="font-medium text-primary">Decisões:</span> {m.decisions}</p>}
                {m.next_steps && <p className="text-xs"><span className="font-medium">Próximos passos:</span> {m.next_steps}</p>}
                {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
