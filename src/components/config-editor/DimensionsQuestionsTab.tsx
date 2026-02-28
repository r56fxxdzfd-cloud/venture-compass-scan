import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Pencil, Plus, Trash2, ArrowUp, ArrowDown, Check, X, AlertTriangle } from 'lucide-react';
import type { ConfigJSON, ConfigQuestion, ConfigDimension } from '@/types/darwin';

interface Props {
  config: ConfigJSON;
  onChange: (config: ConfigJSON) => void;
}

interface QuestionFormData {
  text: string;
  is_active: boolean;
  tooltip_definition: string;
  tooltip_why: string;
  anchor_1: string;
  anchor_3: string;
  anchor_5: string;
}

const emptyForm: QuestionFormData = {
  text: '', is_active: true,
  tooltip_definition: '', tooltip_why: '',
  anchor_1: '', anchor_3: '', anchor_5: '',
};

function questionToForm(q: ConfigQuestion): QuestionFormData {
  return {
    text: q.text,
    is_active: q.is_active !== false,
    tooltip_definition: q.tooltip?.definition || '',
    tooltip_why: q.tooltip?.why || '',
    anchor_1: q.tooltip?.anchors?.[1] as string || '',
    anchor_3: q.tooltip?.anchors?.[3] as string || '',
    anchor_5: q.tooltip?.anchors?.[5] as string || '',
  };
}

function formToQuestion(form: QuestionFormData, base: Partial<ConfigQuestion>): Partial<ConfigQuestion> {
  const anchors: Record<number, string> = {};
  if (form.anchor_1) anchors[1] = form.anchor_1;
  if (form.anchor_3) anchors[3] = form.anchor_3;
  if (form.anchor_5) anchors[5] = form.anchor_5;

  return {
    ...base,
    text: form.text,
    is_active: form.is_active,
    tooltip: {
      definition: form.tooltip_definition || undefined,
      why: form.tooltip_why || undefined,
      anchors: Object.keys(anchors).length > 0 ? anchors : undefined,
    },
  };
}

export function DimensionsQuestionsTab({ config, onChange }: Props) {
  const [editingDimId, setEditingDimId] = useState<string | null>(null);
  const [dimLabelDraft, setDimLabelDraft] = useState('');
  const [questionModal, setQuestionModal] = useState<{ dimId: string; questionId: string | null } | null>(null);
  const [form, setForm] = useState<QuestionFormData>(emptyForm);

  const dims = [...config.dimensions].sort((a, b) => a.sort_order - b.sort_order);

  const getQuestionsForDim = (dimId: string) =>
    config.questions
      .filter(q => q.dimension_id === dimId && q.is_active !== false)
      .length;

  const getAllQuestionsForDim = (dimId: string) =>
    [...config.questions.filter(q => q.dimension_id === dimId)].sort((a, b) => a.sort_order - b.sort_order);

  const cloneConfig = (): ConfigJSON => JSON.parse(JSON.stringify(config));

  // ---- Dimension editing ----
  const startEditDim = (dim: ConfigDimension) => {
    setEditingDimId(dim.id);
    setDimLabelDraft(dim.label);
  };

  const saveDimLabel = () => {
    if (!editingDimId || !dimLabelDraft.trim()) return;
    const c = cloneConfig();
    const dim = c.dimensions.find(d => d.id === editingDimId);
    if (dim) dim.label = dimLabelDraft.trim();
    setEditingDimId(null);
    onChange(c);
  };

  // ---- Question toggle active ----
  const toggleActive = (qId: string) => {
    const c = cloneConfig();
    const q = c.questions.find(q => q.id === qId);
    if (q) q.is_active = q.is_active === false ? true : false;
    onChange(c);
  };

  // ---- Question reorder ----
  const moveQuestion = (dimId: string, qId: string, dir: -1 | 1) => {
    const c = cloneConfig();
    const dimQs = c.questions
      .filter(q => q.dimension_id === dimId)
      .sort((a, b) => a.sort_order - b.sort_order);

    const idx = dimQs.findIndex(q => q.id === qId);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= dimQs.length) return;

    const tempOrder = dimQs[idx].sort_order;
    dimQs[idx].sort_order = dimQs[swapIdx].sort_order;
    dimQs[swapIdx].sort_order = tempOrder;

    // Apply back to config questions
    dimQs.forEach(dq => {
      const cq = c.questions.find(q => q.id === dq.id);
      if (cq) cq.sort_order = dq.sort_order;
    });

    onChange(c);
  };

  // ---- Delete question ----
  const deleteQuestion = (qId: string) => {
    const c = cloneConfig();
    c.questions = c.questions.filter(q => q.id !== qId);
    onChange(c);
  };

  // ---- Open question modal ----
  const openQuestionModal = (dimId: string, questionId: string | null) => {
    if (questionId) {
      const q = config.questions.find(q => q.id === questionId);
      if (q) setForm(questionToForm(q));
    } else {
      setForm(emptyForm);
    }
    setQuestionModal({ dimId, questionId });
  };

  // ---- Save question from modal ----
  const saveQuestion = () => {
    if (!questionModal || !form.text.trim()) return;
    const c = cloneConfig();
    const { dimId, questionId } = questionModal;

    if (questionId) {
      // Edit existing
      const idx = c.questions.findIndex(q => q.id === questionId);
      if (idx >= 0) {
        const updated = formToQuestion(form, c.questions[idx]);
        c.questions[idx] = { ...c.questions[idx], ...updated } as ConfigQuestion;
      }
    } else {
      // New question
      const dimQs = c.questions.filter(q => q.dimension_id === dimId);
      const maxNum = dimQs.reduce((max, q) => {
        const match = q.id.match(/(\d+)$/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      const newId = `${dimId}${String(maxNum + 1).padStart(2, '0')}`;
      const maxSort = dimQs.reduce((max, q) => Math.max(max, q.sort_order), 0);

      const newQ: ConfigQuestion = {
        id: newId,
        dimension_id: dimId,
        text: form.text,
        type: 'likert',
        scale_id: 'likert_1_5',
        is_active: form.is_active,
        sort_order: maxSort + 1,
        tooltip: {
          definition: form.tooltip_definition || undefined,
          why: form.tooltip_why || undefined,
          anchors: {},
        },
      };
      if (form.anchor_1) (newQ.tooltip!.anchors as any)[1] = form.anchor_1;
      if (form.anchor_3) (newQ.tooltip!.anchors as any)[3] = form.anchor_3;
      if (form.anchor_5) (newQ.tooltip!.anchors as any)[5] = form.anchor_5;

      c.questions.push(newQ);
    }

    setQuestionModal(null);
    onChange(c);
  };

  return (
    <div className="space-y-2">
      <Accordion type="multiple">
        {dims.map(dim => {
          const dimQuestions = getAllQuestionsForDim(dim.id);
          const activeCount = getQuestionsForDim(dim.id);
          const isEditingThisDim = editingDimId === dim.id;

          return (
            <AccordionItem key={dim.id} value={dim.id}>
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-2 flex-1 text-left">
                  {isEditingThisDim ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Input
                        value={dimLabelDraft}
                        onChange={e => setDimLabelDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveDimLabel(); if (e.key === 'Escape') setEditingDimId(null); }}
                        className="h-7 text-sm w-48"
                        autoFocus
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveDimLabel}><Check className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingDimId(null)}><X className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <>
                      <span>{dim.label}</span>
                      <Badge variant="outline" className="text-[10px]">{activeCount} perguntas</Badge>
                      {activeCount === 0 && (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" /> sem perguntas
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 mb-3">
                  <div className="flex gap-1 mb-2">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); startEditDim(dim); }}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar Nome
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => openQuestionModal(dim.id, null)}>
                      <Plus className="h-3 w-3 mr-1" /> Pergunta
                    </Button>
                  </div>

                  {dimQuestions.map((q, idx) => (
                    <div key={q.id} className={`flex items-center gap-2 p-2 rounded-md border text-sm ${q.is_active === false ? 'opacity-50 bg-muted/30' : 'bg-background'}`}>
                      <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">{idx + 1}</span>
                      <p className="flex-1 truncate text-sm">{q.text}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={q.is_active !== false}
                          onCheckedChange={() => toggleActive(q.id)}
                          className="scale-75"
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveQuestion(dim.id, q.id, -1)}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === dimQuestions.length - 1} onClick={() => moveQuestion(dim.id, q.id, 1)}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openQuestionModal(dim.id, q.id)}>
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
                              <AlertDialogTitle>Remover pergunta?</AlertDialogTitle>
                              <AlertDialogDescription>Ela não poderá ser recuperada nesta versão.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteQuestion(q.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Question Edit/Create Modal */}
      <Dialog open={!!questionModal} onOpenChange={open => { if (!open) setQuestionModal(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{questionModal?.questionId ? 'Editar Pergunta' : 'Nova Pergunta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Texto da pergunta *</Label>
              <Textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Pergunta ativa</Label>
            </div>
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Tooltip</p>
              <div>
                <Label className="text-xs">Definição — "O que significa esta pergunta?"</Label>
                <Textarea value={form.tooltip_definition} onChange={e => setForm(f => ({ ...f, tooltip_definition: e.target.value }))} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Por que importa</Label>
                <Textarea value={form.tooltip_why} onChange={e => setForm(f => ({ ...f, tooltip_why: e.target.value }))} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Âncora 1</Label>
                  <Input value={form.anchor_1} onChange={e => setForm(f => ({ ...f, anchor_1: e.target.value }))} placeholder="Nota 1 significa..." />
                </div>
                <div>
                  <Label className="text-xs">Âncora 3</Label>
                  <Input value={form.anchor_3} onChange={e => setForm(f => ({ ...f, anchor_3: e.target.value }))} placeholder="Nota 3 significa..." />
                </div>
                <div>
                  <Label className="text-xs">Âncora 5</Label>
                  <Input value={form.anchor_5} onChange={e => setForm(f => ({ ...f, anchor_5: e.target.value }))} placeholder="Nota 5 significa..." />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionModal(null)}>Cancelar</Button>
            <Button onClick={saveQuestion} disabled={!form.text.trim()}>Salvar Pergunta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
