import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, ArrowUp, ArrowDown, Filter, Eye } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { ConfigJSON, ConfigRedFlag } from '@/types/darwin';

interface DeepDivePrompt {
  prompt: string;
  show_if_rf?: string | null;
  show_if_score_below?: number | null;
}

interface Props {
  config: ConfigJSON;
  onChange: (config: ConfigJSON) => void;
}

/** Coerce legacy string prompts to object format */
function normalizePrompts(raw: any): DeepDivePrompt[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => {
    if (typeof item === 'string') return { prompt: item };
    if (item && typeof item === 'object' && typeof item.prompt === 'string') return item as DeepDivePrompt;
    return { prompt: String(item) };
  });
}

function conditionSummary(p: DeepDivePrompt, redFlags: ConfigRedFlag[]): string {
  const parts: string[] = [];
  if (p.show_if_rf) {
    const rf = redFlags.find(r => r.code === p.show_if_rf);
    parts.push(`Red Flag "${rf?.label || p.show_if_rf}" estiver ativa`);
  }
  if (p.show_if_score_below) {
    parts.push(`score da dimensão for menor que ${p.show_if_score_below}`);
  }
  if (parts.length === 0) return 'Aparece sempre';
  return 'Aparece quando: ' + parts.join(' E ');
}

function isConditional(p: DeepDivePrompt): boolean {
  return !!(p.show_if_rf || p.show_if_score_below);
}

export function DeepDivePromptsTab({ config, onChange }: Props) {
  const dims = [...config.dimensions].sort((a, b) => a.sort_order - b.sort_order);
  const redFlags = config.red_flags || [];

  // Normalize deep_dive_prompts: Record<string, (string | DeepDivePrompt)[]>
  const dd = config.deep_dive_prompts || {};
  const promptsMap: Record<string, DeepDivePrompt[]> = {};
  if (dd && typeof dd === 'object' && !Array.isArray(dd)) {
    Object.entries(dd).forEach(([dimId, list]) => {
      promptsMap[dimId] = normalizePrompts(list);
    });
  }

  const cloneConfig = (): ConfigJSON => JSON.parse(JSON.stringify(config));

  const updatePrompts = (dimId: string, prompts: DeepDivePrompt[]) => {
    const c = cloneConfig();
    if (!c.deep_dive_prompts || typeof c.deep_dive_prompts !== 'object') {
      c.deep_dive_prompts = {};
    }
    // Store as object array (new format)
    (c.deep_dive_prompts as any)[dimId] = prompts;
    onChange(c);
  };

  const addPrompt = (dimId: string) => {
    const current = promptsMap[dimId] || [];
    updatePrompts(dimId, [...current, { prompt: '' }]);
  };

  const removePrompt = (dimId: string, idx: number) => {
    const current = [...(promptsMap[dimId] || [])];
    current.splice(idx, 1);
    updatePrompts(dimId, current);
  };

  const updatePrompt = (dimId: string, idx: number, patch: Partial<DeepDivePrompt>) => {
    const current = [...(promptsMap[dimId] || [])];
    current[idx] = { ...current[idx], ...patch };
    updatePrompts(dimId, current);
  };

  const movePrompt = (dimId: string, idx: number, dir: -1 | 1) => {
    const current = [...(promptsMap[dimId] || [])];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= current.length) return;
    [current[idx], current[swapIdx]] = [current[swapIdx], current[idx]];
    updatePrompts(dimId, current);
  };

  // Migrate all legacy strings on first save
  const migrateAll = () => {
    const c = cloneConfig();
    if (!c.deep_dive_prompts || typeof c.deep_dive_prompts !== 'object') return;
    const ddObj = c.deep_dive_prompts as Record<string, any[]>;
    Object.keys(ddObj).forEach(dimId => {
      ddObj[dimId] = normalizePrompts(ddObj[dimId]);
    });
    onChange(c);
  };

  // Check if any legacy strings exist
  const hasLegacy = Object.values(dd).some((list: any) =>
    Array.isArray(list) && list.some((item: any) => typeof item === 'string')
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Prompts de aprofundamento por dimensão. Prompts condicionais aparecem apenas quando as condições são atendidas.</p>
        {hasLegacy && (
          <Button variant="outline" size="sm" className="text-xs" onClick={migrateAll}>
            Migrar formato legado
          </Button>
        )}
      </div>

      <Accordion type="multiple">
        {dims.map(dim => {
          const prompts = promptsMap[dim.id] || [];
          const conditionalCount = prompts.filter(isConditional).length;

          return (
            <AccordionItem key={dim.id} value={dim.id}>
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-2 flex-1 text-left">
                  <span>{dim.label}</span>
                  <Badge variant="outline" className="text-[10px]">{prompts.length} prompts</Badge>
                  {conditionalCount > 0 && (
                    <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                      <Filter className="h-2.5 w-2.5 mr-0.5" />
                      {conditionalCount} condicional{conditionalCount > 1 ? 'is' : ''}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 mb-3">
                  {prompts.map((p, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-2 bg-background">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground font-mono mt-2 shrink-0">{idx + 1}</span>
                        <div className="flex-1 space-y-2">
                          {/* Tag */}
                          <div className="flex items-center gap-2">
                            {isConditional(p) ? (
                              <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                                <Filter className="h-2.5 w-2.5 mr-0.5" /> Condicional
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                <Eye className="h-2.5 w-2.5 mr-0.5" /> Sempre
                              </Badge>
                            )}
                          </div>

                          {/* Prompt text */}
                          <Textarea
                            value={p.prompt}
                            onChange={e => updatePrompt(dim.id, idx, { prompt: e.target.value })}
                            rows={2}
                            placeholder="Texto do prompt de deep dive..."
                            className="text-sm"
                          />

                          {/* Condition row */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Mostrar se Red Flag ativa</Label>
                              <Select
                                value={p.show_if_rf || '__always__'}
                                onValueChange={v => updatePrompt(dim.id, idx, { show_if_rf: v === '__always__' ? null : v })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__always__">Sempre mostrar</SelectItem>
                                  {redFlags.map(rf => (
                                    <SelectItem key={rf.code} value={rf.code}>
                                      {rf.code} — {rf.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Mostrar se score abaixo de</Label>
                              <Select
                                value={p.show_if_score_below ? String(p.show_if_score_below) : '__always__'}
                                onValueChange={v => updatePrompt(dim.id, idx, { show_if_score_below: v === '__always__' ? null : Number(v) })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__always__">Sempre mostrar</SelectItem>
                                  <SelectItem value="1">1</SelectItem>
                                  <SelectItem value="2">2</SelectItem>
                                  <SelectItem value="3">3</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Human-readable summary */}
                          <p className="text-xs text-muted-foreground italic">
                            {conditionSummary(p, redFlags)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => movePrompt(dim.id, idx, -1)}>
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === prompts.length - 1} onClick={() => movePrompt(dim.id, idx, 1)}>
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover prompt?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removePrompt(dim.id, idx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" size="sm" className="text-xs" onClick={() => addPrompt(dim.id)}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar Prompt
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
