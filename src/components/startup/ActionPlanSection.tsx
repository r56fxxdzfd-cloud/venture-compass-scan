import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { friendlySupabaseError } from '@/utils/supabase-errors';
import { CheckCircle2, ListChecks, Loader2, Trash2 } from 'lucide-react';
import type { ActionItem, ActionItemStatus } from '@/types/darwin';

const STATUS_LABELS: Record<ActionItemStatus, string> = {
  todo: 'A fazer', doing: 'Em andamento', done: 'Concluída', blocked: 'Travada',
};
const STATUS_VARIANT: Record<ActionItemStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  todo: 'outline', doing: 'secondary', done: 'default', blocked: 'destructive',
};
const OPEN_STATUSES: ActionItemStatus[] = ['todo', 'doing', 'blocked'];

/**
 * Seção "Plano de ação" — lista de action_items da company com edição inline de
 * status / responsável / prazo, filtro por status e contador abertas/concluídas.
 * Escaneável em <2 min. canManage controla a escrita (admin/analyst/advisor atribuído).
 */
export function ActionPlanSection({ companyId, canManage }: { companyId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | ActionItemStatus>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('action_items')
      .select('*')
      .eq('company_id', companyId)
      .order('status', { ascending: true })
      .order('priority', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    setItems((data || []) as ActionItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const patch = async (id: string, changes: Partial<ActionItem>) => {
    // Otimista
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));
    setSavingId(id);
    const { error } = await supabase.from('action_items').update(changes).eq('id', id);
    setSavingId(null);
    if (error) {
      toast({ title: 'Erro ao salvar', description: friendlySupabaseError(error.message), variant: 'destructive' });
      load();
      return;
    }
    setSavedAt(Date.now());
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('action_items').delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      toast({ title: 'Erro ao excluir', description: friendlySupabaseError(error.message), variant: 'destructive' });
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSavedAt(Date.now());
  };

  const openCount = items.filter((i) => OPEN_STATUSES.includes(i.status)).length;
  const doneCount = items.filter((i) => i.status === 'done').length;

  const visible = items.filter((i) => {
    if (filter === 'all') return true;
    if (filter === 'open') return OPEN_STATUSES.includes(i.status);
    return i.status === filter;
  });

  return (
    <Card className="executive-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="executive-section-title text-xs">Execução</p>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-primary" /> Plano de ação
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="executive-pill">Abertas: {openCount}</Badge>
            <Badge variant="default" className="executive-pill">Concluídas: {doneCount}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="open">Abertas</SelectItem>
              <SelectItem value="todo">A fazer</SelectItem>
              <SelectItem value="doing">Em andamento</SelectItem>
              <SelectItem value="blocked">Travadas</SelectItem>
              <SelectItem value="done">Concluídas</SelectItem>
            </SelectContent>
          </Select>
          {canManage && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {savingId || deletingId ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : savedAt ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Salvo
                </>
              ) : null}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {items.length === 0
              ? 'Nenhuma ação no plano. Adicione quick wins do relatório de diagnóstico ou crie ações na reunião.'
              : 'Nenhuma ação para este filtro.'}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((it) => (
              <div key={it.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{it.title}</p>
                    {it.first_step && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="text-primary font-medium">Primeiro passo:</span> {it.first_step}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {it.dimension_id && <Badge variant="secondary" className="text-xs">{it.dimension_id}</Badge>}
                    {it.effort && <Badge variant="outline" className="text-xs">{it.effort}</Badge>}
                    {!canManage && <Badge variant={STATUS_VARIANT[it.status]} className="text-xs">{STATUS_LABELS[it.status]}</Badge>}
                  </div>
                </div>

                {canManage ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-0.5">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</label>
                      <Select value={it.status} disabled={!!savingId || !!deletingId} onValueChange={(v) => patch(it.id, { status: v as ActionItemStatus })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABELS) as ActionItemStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Responsável</label>
                      <Input
                        className="h-8 text-xs"
                        defaultValue={it.owner_label || ''}
                        placeholder="Ex: fundador, time..."
                        disabled={!!savingId || !!deletingId}
                        onBlur={(e) => { if (e.target.value !== (it.owner_label || '')) patch(it.id, { owner_label: e.target.value || null }); }}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Prazo</label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        defaultValue={it.due_date || ''}
                        disabled={!!savingId || !!deletingId}
                        onChange={(e) => patch(it.id, { due_date: e.target.value || null })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Responsável: {it.owner_label || '—'}</span>
                    <span>Prazo: {it.due_date || '—'}</span>
                  </div>
                )}

                {canManage && (
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" disabled={!!savingId || !!deletingId} onClick={() => remove(it.id)}>
                      {deletingId === it.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                      Excluir
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
