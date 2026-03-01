import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, Copy, Zap, AlertCircle } from 'lucide-react';
import type { ConfigJSON, ConfigParetoAction } from '@/types/darwin';
import { DEFAULT_ACTION_LIBRARY } from '@/utils/pareto-engine';

interface Props {
  config: ConfigJSON;
  onChange: (config: ConfigJSON) => void;
}

const EFFORT_LABELS: Record<string, string> = { S: 'Baixo', M: 'Médio', L: 'Alto' };
const EFFORT_COLORS: Record<string, string> = {
  S: 'bg-primary/10 text-primary border-primary/20',
  M: 'bg-warning/10 text-warning border-warning/20',
  L: 'bg-destructive/10 text-destructive border-destructive/20',
};

// ---- Validation (Step 10) ----
interface ActionError {
  title?: string;
  effort?: string;
  impact_weight?: string;
  time_to_impact_days?: string;
  dimension_id?: string;
}

function validateAction(action: ConfigParetoAction): ActionError {
  const errors: ActionError = {};
  if (!action.title?.trim()) errors.title = 'Título obrigatório';
  if (!action.dimension_id?.trim()) errors.dimension_id = 'Dimensão obrigatória';
  if (!['S', 'M', 'L'].includes(action.effort)) errors.effort = 'Esforço deve ser S, M ou L';
  if (!action.impact_weight || action.impact_weight < 1 || action.impact_weight > 5 || !Number.isInteger(action.impact_weight))
    errors.impact_weight = 'Impacto deve ser 1-5';
  if (!action.time_to_impact_days || action.time_to_impact_days < 1 || !Number.isInteger(action.time_to_impact_days))
    errors.time_to_impact_days = 'Deve ser inteiro positivo';
  return errors;
}

function hasErrors(errors: ActionError): boolean {
  return Object.keys(errors).length > 0;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
      <AlertCircle className="h-3 w-3" /> {message}
    </p>
  );
}

export function ActionLibraryTab({ config, onChange }: Props) {
  const library = config.action_library || {};
  const [expandedDim, setExpandedDim] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, ActionError[]>>({});

  const validate = (lib: Record<string, ConfigParetoAction[]>): boolean => {
    const errors: Record<string, ActionError[]> = {};
    let valid = true;
    for (const [dimId, actions] of Object.entries(lib)) {
      errors[dimId] = actions.map(a => {
        const e = validateAction(a);
        if (hasErrors(e)) valid = false;
        return e;
      });
    }
    setValidationErrors(errors);
    return valid;
  };

  const updateLibrary = (newLib: Record<string, ConfigParetoAction[]>) => {
    if (validate(newLib)) {
      onChange({ ...config, action_library: newLib });
    } else {
      // Still update to show errors, but mark with validation
      onChange({ ...config, action_library: newLib });
    }
  };

  const seedDefaults = () => {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_ACTION_LIBRARY));
    setValidationErrors({});
    onChange({ ...config, action_library: defaults });
  };

  const addAction = (dimId: string) => {
    const existing = library[dimId] || [];
    const idx = existing.length + 1;
    const newAction: ConfigParetoAction = {
      id: `${dimId}-${String(idx).padStart(2, '0')}`,
      title: '',
      description: '',
      first_step: '',
      done_definition: '',
      effort: 'S',
      time_to_impact_days: 7,
      impact_weight: 3,
      stage_tags: ['seed'],
      business_model_tags: [],
      dimension_id: dimId,
    };
    updateLibrary({ ...library, [dimId]: [...existing, newAction] });
  };

  const updateAction = (dimId: string, actionIdx: number, updates: Partial<ConfigParetoAction>) => {
    const actions = [...(library[dimId] || [])];
    actions[actionIdx] = { ...actions[actionIdx], ...updates };
    updateLibrary({ ...library, [dimId]: actions });
  };

  const removeAction = (dimId: string, actionIdx: number) => {
    const actions = (library[dimId] || []).filter((_, i) => i !== actionIdx);
    updateLibrary({ ...library, [dimId]: actions });
  };

  const duplicateAction = (dimId: string, actionIdx: number) => {
    const actions = [...(library[dimId] || [])];
    const source = actions[actionIdx];
    const newAction = { ...source, id: `${dimId}-${String(actions.length + 1).padStart(2, '0')}`, title: `${source.title} (cópia)` };
    updateLibrary({ ...library, [dimId]: [...actions, newAction] });
  };

  const totalActions = Object.values(library).reduce((s, arr) => s + arr.length, 0);
  const hasLibrary = totalActions > 0;

  // Count total validation errors
  const totalErrors = Object.values(validationErrors).reduce(
    (sum, arr) => sum + arr.filter(e => hasErrors(e)).length, 0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {hasLibrary
              ? `${totalActions} ações em ${Object.keys(library).length} dimensões`
              : 'Nenhuma ação configurada. Carregue os defaults para começar.'}
          </p>
          {totalErrors > 0 && (
            <p className="text-xs text-destructive mt-1">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              {totalErrors} ação(ões) com erros de validação
            </p>
          )}
        </div>
        {!hasLibrary && (
          <Button size="sm" variant="outline" onClick={seedDefaults}>
            <Zap className="mr-1 h-3 w-3" /> Carregar defaults
          </Button>
        )}
      </div>

      <Accordion type="single" collapsible value={expandedDim} onValueChange={setExpandedDim}>
        {config.dimensions.map((dim) => {
          const actions = library[dim.id] || [];
          const dimErrors = validationErrors[dim.id] || [];
          const dimHasErrors = dimErrors.some(e => hasErrors(e));
          return (
            <AccordionItem key={dim.id} value={dim.id}>
              <AccordionTrigger className="text-sm py-2">
                <div className="flex items-center gap-2">
                  <span>{dim.label}</span>
                  <Badge variant="secondary" className="text-xs">{actions.length}</Badge>
                  {dimHasErrors && <AlertCircle className="h-3 w-3 text-destructive" />}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {actions.map((action, idx) => {
                  const errors = dimErrors[idx] || {};
                  return (
                    <Card key={action.id} className={`border-border/50 ${hasErrors(errors) ? 'border-destructive/40' : ''}`}>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 space-y-2">
                            <div>
                              <Input
                                value={action.title}
                                onChange={(e) => updateAction(dim.id, idx, { title: e.target.value })}
                                placeholder="Título da ação"
                                className={`text-sm font-semibold ${errors.title ? 'border-destructive' : ''}`}
                              />
                              <FieldError message={errors.title} />
                            </div>
                            <Textarea
                              value={action.description}
                              onChange={(e) => updateAction(dim.id, idx, { description: e.target.value })}
                              placeholder="Descrição"
                              rows={2}
                              className="text-xs"
                            />
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateAction(dim.id, idx)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeAction(dim.id, idx)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Primeiro passo</label>
                            <Input
                              value={action.first_step}
                              onChange={(e) => updateAction(dim.id, idx, { first_step: e.target.value })}
                              placeholder="Primeiro passo concreto"
                              className="text-xs h-8"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Definição de pronto</label>
                            <Input
                              value={action.done_definition}
                              onChange={(e) => updateAction(dim.id, idx, { done_definition: e.target.value })}
                              placeholder="Quando está feito?"
                              className="text-xs h-8"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Esforço</label>
                            <Select value={action.effort} onValueChange={(v) => updateAction(dim.id, idx, { effort: v as 'S' | 'M' | 'L' })}>
                              <SelectTrigger className={`h-8 text-xs ${errors.effort ? 'border-destructive' : ''}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="S">Baixo</SelectItem>
                                <SelectItem value="M">Médio</SelectItem>
                                <SelectItem value="L">Alto</SelectItem>
                              </SelectContent>
                            </Select>
                            <FieldError message={errors.effort} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Dias p/ impacto</label>
                            <Input
                              type="number"
                              value={action.time_to_impact_days}
                              onChange={(e) => updateAction(dim.id, idx, { time_to_impact_days: Number(e.target.value) })}
                              className={`text-xs h-8 ${errors.time_to_impact_days ? 'border-destructive' : ''}`}
                              min={1}
                            />
                            <FieldError message={errors.time_to_impact_days} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Peso impacto (1-5)</label>
                            <Input
                              type="number"
                              value={action.impact_weight}
                              onChange={(e) => updateAction(dim.id, idx, { impact_weight: Math.min(5, Math.max(1, Number(e.target.value))) })}
                              className={`text-xs h-8 ${errors.impact_weight ? 'border-destructive' : ''}`}
                              min={1}
                              max={5}
                            />
                            <FieldError message={errors.impact_weight} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">KPI (opcional)</label>
                            <Input
                              value={action.kpi_hint || ''}
                              onChange={(e) => updateAction(dim.id, idx, { kpi_hint: e.target.value || undefined })}
                              placeholder="Ex: LTV/CAC"
                              className="text-xs h-8"
                            />
                          </div>
                        </div>

                        {/* Red Flags selector */}
                        {(config.red_flags?.length ?? 0) > 0 && (
                          <div>
                            <label className="text-[10px] text-muted-foreground">Red Flags endereçados</label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {config.red_flags!.map((rf) => {
                                const isSelected = action.addresses_red_flags?.includes(rf.code) ?? false;
                                return (
                                  <Badge
                                    key={rf.code}
                                    variant={isSelected ? 'default' : 'outline'}
                                    className={`text-[10px] cursor-pointer select-none ${isSelected ? '' : 'opacity-50'}`}
                                    onClick={() => {
                                      const current = action.addresses_red_flags || [];
                                      const next = isSelected
                                        ? current.filter((c) => c !== rf.code)
                                        : [...current, rf.code];
                                      updateAction(dim.id, idx, { addresses_red_flags: next.length ? next : undefined });
                                    }}
                                  >
                                    {rf.code}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className={`text-[10px] ${EFFORT_COLORS[action.effort]}`}>
                            {EFFORT_LABELS[action.effort]}
                          </Badge>
                          <span>{action.time_to_impact_days}d</span>
                          <span>•</span>
                          <span>Impacto: {action.impact_weight}/5</span>
                          {action.addresses_red_flags?.length ? (
                            <>
                              <span>•</span>
                              <span>Red Flags: {action.addresses_red_flags.join(', ')}</span>
                            </>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <Button size="sm" variant="outline" className="w-full" onClick={() => addAction(dim.id)}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar ação em {dim.label}
                </Button>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
