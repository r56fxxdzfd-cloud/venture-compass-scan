import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import type { ConfigJSON, ConfigRedFlag } from '@/types/darwin';

interface Props {
  config: ConfigJSON;
  onChange: (config: ConfigJSON) => void;
}

interface TriggerForm {
  type: string;
  dimension_id?: string;
  threshold?: number;
  field?: string;
}

interface RedFlagForm {
  code: string;
  label: string;
  severity: string;
  triggers: TriggerForm[];
  actions: string[];
}

const emptyForm: RedFlagForm = { code: '', label: '', severity: 'medium', triggers: [], actions: [] };

function triggerSummary(t: TriggerForm, dims: { id: string; label: string }[]): string {
  const dimLabel = dims.find(d => d.id === t.dimension_id)?.label || t.dimension_id || '—';
  switch (t.type) {
    case 'score_threshold':
    case 'dimension_score_below':
      return `Score ${dimLabel} ≤ ${t.threshold ?? '—'}`;
    case 'numeric_threshold':
    case 'context_field_below':
      return `${t.field || '—'} < ${t.threshold ?? '—'}`;
    case 'numeric_missing':
    case 'context_field_missing':
      return `${t.field || '—'} não informado`;
    default:
      return t.type?.replace(/_/g, ' ') || '—';
  }
}

const severityBadge = (s: string) => {
  if (['critical', 'high'].includes(s)) return 'destructive' as const;
  return 'secondary' as const;
};

export function RedFlagsTab({ config, onChange }: Props) {
  const [modal, setModal] = useState<{ editCode: string | null } | null>(null);
  const [form, setForm] = useState<RedFlagForm>(emptyForm);

  const redFlags = config.red_flags || [];
  const dims = config.dimensions;

  const cloneConfig = (): ConfigJSON => JSON.parse(JSON.stringify(config));

  const openNew = () => {
    setForm(emptyForm);
    setModal({ editCode: null });
  };

  const openEdit = (rf: ConfigRedFlag) => {
    setForm({
      code: rf.code,
      label: rf.label,
      severity: rf.severity,
      triggers: rf.triggers.map(t => ({ ...t })),
      actions: [...rf.actions],
    });
    setModal({ editCode: rf.code });
  };

  const deleteRedFlag = (code: string) => {
    const c = cloneConfig();
    c.red_flags = (c.red_flags || []).filter(rf => rf.code !== code);
    onChange(c);
  };

  const saveRedFlag = () => {
    if (!form.code.trim() || !form.label.trim()) return;
    const c = cloneConfig();
    if (!c.red_flags) c.red_flags = [];

    const rf: ConfigRedFlag = {
      code: form.code.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
      label: form.label,
      severity: form.severity,
      triggers: form.triggers as any,
      actions: form.actions.filter(a => a.trim()),
    };

    if (modal?.editCode) {
      const idx = c.red_flags.findIndex(r => r.code === modal.editCode);
      if (idx >= 0) c.red_flags[idx] = rf;
      else c.red_flags.push(rf);
    } else {
      c.red_flags.push(rf);
    }

    setModal(null);
    onChange(c);
  };

  // ---- Trigger helpers ----
  const addTrigger = () => setForm(f => ({ ...f, triggers: [...f.triggers, { type: 'score_threshold' }] }));
  const removeTrigger = (i: number) => setForm(f => ({ ...f, triggers: f.triggers.filter((_, idx) => idx !== i) }));
  const updateTrigger = (i: number, patch: Partial<TriggerForm>) => {
    setForm(f => ({ ...f, triggers: f.triggers.map((t, idx) => idx === i ? { ...t, ...patch } : t) }));
  };

  const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, ''] }));
  const removeAction = (i: number) => setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
  const updateAction = (i: number, val: string) => setForm(f => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? val : a) }));

  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" className="text-xs" onClick={openNew}>
        <Plus className="h-3 w-3 mr-1" /> Nova Red Flag
      </Button>

      {redFlags.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum red flag configurado.</p>
      )}

      {redFlags.map(rf => (
        <div key={rf.code} className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={severityBadge(rf.severity)} className="text-xs">{rf.severity}</Badge>
              <span className="text-xs font-mono text-muted-foreground">{rf.code}</span>
              <span className="text-sm font-medium">{rf.label}</span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(rf)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover red flag "{rf.code}"?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteRedFlag(rf.code)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {rf.triggers.map((t, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">{triggerSummary(t as any, dims)}</Badge>
            ))}
          </div>
        </div>
      ))}

      {/* Red Flag Modal */}
      <Dialog open={!!modal} onOpenChange={open => { if (!open) setModal(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal?.editCode ? 'Editar Red Flag' : 'Nova Red Flag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Código *</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))} placeholder="RF_EXEMPLO" />
              </div>
              <div>
                <Label className="text-xs">Severidade</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Label *</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Título legível do red flag" />
            </div>

            {/* Triggers */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Triggers</p>
                <Button variant="outline" size="sm" className="text-xs h-6" onClick={addTrigger}><Plus className="h-3 w-3 mr-1" /> Trigger</Button>
              </div>
              {form.triggers.map((t, i) => (
                <div key={i} className="rounded border p-2 space-y-2 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Select value={t.type} onValueChange={v => updateTrigger(i, { type: v, dimension_id: undefined, threshold: undefined, field: undefined })}>
                      <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="score_threshold">Score abaixo de threshold</SelectItem>
                        <SelectItem value="numeric_threshold">Campo numérico abaixo</SelectItem>
                        <SelectItem value="numeric_missing">Campo não informado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => removeTrigger(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  {t.type === 'score_threshold' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={t.dimension_id || ''} onValueChange={v => updateTrigger(i, { dimension_id: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Dimensão" /></SelectTrigger>
                        <SelectContent>
                          {dims.map(d => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" step={0.1} value={t.threshold ?? ''} onChange={e => updateTrigger(i, { threshold: parseFloat(e.target.value) || 0 })} placeholder="Threshold" className="h-7 text-xs" />
                    </div>
                  )}
                  {t.type === 'numeric_threshold' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={t.field || ''} onChange={e => updateTrigger(i, { field: e.target.value })} placeholder="Nome do campo" className="h-7 text-xs" />
                      <Input type="number" step={0.1} value={t.threshold ?? ''} onChange={e => updateTrigger(i, { threshold: parseFloat(e.target.value) || 0 })} placeholder="Threshold" className="h-7 text-xs" />
                    </div>
                  )}
                  {t.type === 'numeric_missing' && (
                    <Input value={t.field || ''} onChange={e => updateTrigger(i, { field: e.target.value })} placeholder="Nome do campo" className="h-7 text-xs" />
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Ações</p>
                <Button variant="outline" size="sm" className="text-xs h-6" onClick={addAction}><Plus className="h-3 w-3 mr-1" /> Ação</Button>
              </div>
              {form.actions.map((a, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input value={a} onChange={e => updateAction(i, e.target.value)} placeholder="Recomendação..." className="h-7 text-xs" />
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => removeAction(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={saveRedFlag} disabled={!form.code.trim() || !form.label.trim()}>Salvar Red Flag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
