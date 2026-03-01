import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, Copy, Zap } from 'lucide-react';
import type { ConfigJSON, ConfigParetoAction } from '@/types/darwin';

// Default action library to seed from
const DEFAULT_ACTION_LIBRARY: Record<string, ConfigParetoAction[]> = {
  MN: [
    { id: 'MN-01', title: 'Validar unit economics com dados reais', description: 'Calcular CAC, LTV e payback com métricas atuais.', first_step: 'Levantar CAC dos últimos 3 meses por canal.', done_definition: 'Planilha com unit economics por cohort.', effort: 'S', time_to_impact_days: 7, impact_weight: 5, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'MN', kpi_hint: 'LTV/CAC ratio' },
    { id: 'MN-02', title: 'Testar novo canal de aquisição', description: 'Experimentar canal não explorado para diversificar.', first_step: 'Selecionar 1 canal e definir budget de teste.', done_definition: 'Teste de 2 semanas com CAC medido.', effort: 'M', time_to_impact_days: 21, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'MN' },
    { id: 'MN-03', title: 'Documentar pricing strategy', description: 'Formalizar lógica de precificação e margens.', first_step: 'Mapear preços atuais vs concorrentes.', done_definition: 'Documento de pricing aprovado.', effort: 'S', time_to_impact_days: 5, impact_weight: 3, stage_tags: ['pre_seed', 'seed'], business_model_tags: [], dimension_id: 'MN' },
  ],
  GT: [
    { id: 'GT-01', title: 'Definir North Star Metric', description: 'Alinhar time em torno de métrica principal de crescimento.', first_step: 'Reunião de alinhamento sobre métrica candidata.', done_definition: 'NSM definida e visível em dashboard.', effort: 'S', time_to_impact_days: 3, impact_weight: 5, stage_tags: ['pre_seed', 'seed', 'series_a'], business_model_tags: [], dimension_id: 'GT' },
    { id: 'GT-02', title: 'Implementar growth loop principal', description: 'Criar ciclo viral ou de retenção.', first_step: 'Mapear loops existentes e identificar o principal.', done_definition: 'Loop implementado e métrica de ciclo medida.', effort: 'L', time_to_impact_days: 45, impact_weight: 5, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GT' },
    { id: 'GT-03', title: 'Criar dashboard de métricas semanais', description: 'Visibilidade sobre KPIs de crescimento.', first_step: 'Listar top 5 métricas e fonte de dados.', done_definition: 'Dashboard atualizado automaticamente.', effort: 'M', time_to_impact_days: 14, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GT' },
  ],
  EE: [
    { id: 'EE-01', title: 'Mapear jornada do cliente end-to-end', description: 'Identificar pontos de fricção e oportunidades.', first_step: 'Entrevistar 5 clientes sobre experiência.', done_definition: 'Mapa de jornada com pain points priorizados.', effort: 'M', time_to_impact_days: 14, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'EE' },
    { id: 'EE-02', title: 'Implementar NPS ou CSAT', description: 'Medir satisfação de forma recorrente.', first_step: 'Escolher ferramenta e criar survey.', done_definition: 'Primeira rodada de NPS coletada.', effort: 'S', time_to_impact_days: 7, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'EE' },
  ],
  FS: [
    { id: 'FS-01', title: 'Projetar runway com cenários', description: 'Modelar otimista, base e pessimista.', first_step: 'Atualizar planilha financeira com 3 cenários.', done_definition: 'Projeção de 12 meses com cenários.', effort: 'S', time_to_impact_days: 5, impact_weight: 5, stage_tags: ['pre_seed', 'seed', 'series_a'], business_model_tags: [], dimension_id: 'FS', kpi_hint: 'Runway em meses', addresses_red_flags: ['RF_RUNWAY'] },
    { id: 'FS-02', title: 'Reduzir burn rate em 15%', description: 'Identificar gastos cortáveis sem impacto no crescimento.', first_step: 'Categorizar despesas por essencialidade.', done_definition: 'Burn reduzido e validado por 1 mês.', effort: 'M', time_to_impact_days: 30, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'FS', addresses_red_flags: ['RF_RUNWAY', 'RF_BURN'] },
  ],
  PM: [
    { id: 'PM-01', title: 'Validar product-market fit com dados', description: 'Aplicar Sean Ellis test ou análise de retenção.', first_step: 'Enviar survey para 40+ users.', done_definition: 'Score PMF calculado.', effort: 'S', time_to_impact_days: 10, impact_weight: 5, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PM' },
    { id: 'PM-02', title: 'Criar roadmap baseado em feedback', description: 'Priorizar features com framework ICE/RICE.', first_step: 'Compilar top 10 pedidos de clientes.', done_definition: 'Roadmap de 3 meses priorizado.', effort: 'M', time_to_impact_days: 14, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PM' },
  ],
  GR: [
    { id: 'GR-01', title: 'Formalizar governança mínima', description: 'Board advisory, cap table limpo, acordos de sócios.', first_step: 'Revisar cap table e identificar pendências.', done_definition: 'Documentação de governança atualizada.', effort: 'M', time_to_impact_days: 21, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GR' },
    { id: 'GR-02', title: 'Implementar report mensal para stakeholders', description: 'Transparência com investidores e advisors.', first_step: 'Criar template de update mensal.', done_definition: 'Primeiro report enviado.', effort: 'S', time_to_impact_days: 7, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GR' },
  ],
  PT: [
    { id: 'PT-01', title: 'Adotar metodologia ágil simplificada', description: 'Sprints de 2 semanas com retro.', first_step: 'Definir cadência e ferramentas.', done_definition: 'Primeira sprint completa com retro.', effort: 'M', time_to_impact_days: 14, impact_weight: 4, stage_tags: ['pre_seed', 'seed'], business_model_tags: [], dimension_id: 'PT' },
    { id: 'PT-02', title: 'Definir OKRs trimestrais', description: 'Alinhar time com objetivos claros.', first_step: 'Workshop de OKRs com founders.', done_definition: 'OKRs Q+1 definidos e comunicados.', effort: 'S', time_to_impact_days: 5, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PT' },
  ],
  PL: [
    { id: 'PL-01', title: 'Criar plano de hiring para próximos 6 meses', description: 'Priorizar contratações críticas.', first_step: 'Mapear gaps de competência vs roadmap.', done_definition: 'Plano de hiring aprovado.', effort: 'S', time_to_impact_days: 7, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PL' },
    { id: 'PL-02', title: 'Implementar 1:1s semanais', description: 'Melhorar feedback loop com o time.', first_step: 'Agendar 1:1s recorrentes.', done_definition: 'Cadência mantida por 4 semanas.', effort: 'S', time_to_impact_days: 3, impact_weight: 3, stage_tags: ['pre_seed', 'seed', 'series_a'], business_model_tags: [], dimension_id: 'PL' },
  ],
  IC: [
    { id: 'IC-01', title: 'Documentar cultura e valores', description: 'Formalizar princípios do time.', first_step: 'Workshop com founders sobre valores.', done_definition: 'Documento de cultura publicado.', effort: 'S', time_to_impact_days: 7, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'IC' },
    { id: 'IC-02', title: 'Criar onboarding estruturado', description: 'Reduzir time-to-productivity de novos membros.', first_step: 'Documentar processos chave e checklist de onboarding.', done_definition: 'Próximo hire passa pelo onboarding novo.', effort: 'M', time_to_impact_days: 21, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'IC' },
  ],
};

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

export function ActionLibraryTab({ config, onChange }: Props) {
  const library = config.action_library || {};
  const [expandedDim, setExpandedDim] = useState<string>('');

  const updateLibrary = (newLib: Record<string, ConfigParetoAction[]>) => {
    onChange({ ...config, action_library: newLib });
  };

  const seedDefaults = () => {
    updateLibrary(JSON.parse(JSON.stringify(DEFAULT_ACTION_LIBRARY)));
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {hasLibrary
              ? `${totalActions} ações em ${Object.keys(library).length} dimensões`
              : 'Nenhuma ação configurada. Carregue os defaults para começar.'}
          </p>
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
          return (
            <AccordionItem key={dim.id} value={dim.id}>
              <AccordionTrigger className="text-sm py-2">
                <div className="flex items-center gap-2">
                  <span>{dim.label}</span>
                  <Badge variant="secondary" className="text-xs">{actions.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {actions.map((action, idx) => (
                  <Card key={action.id} className="border-border/50">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <Input
                            value={action.title}
                            onChange={(e) => updateAction(dim.id, idx, { title: e.target.value })}
                            placeholder="Título da ação"
                            className="text-sm font-semibold"
                          />
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
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="S">Baixo</SelectItem>
                              <SelectItem value="M">Médio</SelectItem>
                              <SelectItem value="L">Alto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Dias p/ impacto</label>
                          <Input
                            type="number"
                            value={action.time_to_impact_days}
                            onChange={(e) => updateAction(dim.id, idx, { time_to_impact_days: Number(e.target.value) })}
                            className="text-xs h-8"
                            min={1}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Peso impacto (1-5)</label>
                          <Input
                            type="number"
                            value={action.impact_weight}
                            onChange={(e) => updateAction(dim.id, idx, { impact_weight: Math.min(5, Math.max(1, Number(e.target.value))) })}
                            className="text-xs h-8"
                            min={1}
                            max={5}
                          />
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
                ))}

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
