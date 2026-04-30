import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { CouncilAgendaTemplate, CouncilAgendaTemplatePriority } from '@/types/council';

const priorityLabel: Record<CouncilAgendaTemplatePriority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };

const parseCsv = (v: string) => v.split('\n').map(s => s.trim()).filter(Boolean);

export default function AgendaTemplatesPage() {
  const { toast } = useToast();
  const { isAdmin, isAnalyst } = useAuth();
  const canWrite = isAdmin || isAnalyst;
  const [items, setItems] = useState<CouncilAgendaTemplate[]>([]);
  const [dimensionFilter, setDimensionFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [editing, setEditing] = useState<Partial<CouncilAgendaTemplate> | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('council_agenda_templates').select('*').order('sort_order').order('dimension_label').order('title');
    if (error) return toast({ title: 'Erro ao carregar templates', description: error.message, variant: 'destructive' });
    setItems((data || []) as CouncilAgendaTemplate[]);
  };

  useEffect(() => { load(); }, []);

  const dimensions = useMemo(() => Array.from(new Set(items.map(i => i.dimension_label))), [items]);
  const filtered = useMemo(() => items.filter(i =>
    (dimensionFilter === 'all' || i.dimension_label === dimensionFilter) &&
    (priorityFilter === 'all' || i.priority === priorityFilter) && i.is_active
  ), [items, dimensionFilter, priorityFilter]);

  const grouped = useMemo(() => filtered.reduce((acc, item) => {
    (acc[item.dimension_label] ||= []).push(item);
    return acc;
  }, {} as Record<string, CouncilAgendaTemplate[]>), [filtered]);

  const save = async () => {
    if (!editing?.title || !editing.dimension_id || !editing.dimension_label || !editing.objective) {
      return toast({ title: 'Preencha dimensão, título e objetivo', variant: 'destructive' });
    }
    const payload = {
      ...editing,
      key_questions: parseCsv((editing.key_questions || []).join('\n')),
      expected_evidence: parseCsv((editing.expected_evidence || []).join('\n')),
      suggested_actions: parseCsv((editing.suggested_actions || []).join('\n')),
      associated_red_flags: editing.associated_red_flags || [],
      priority: editing.priority || 'medium',
      is_active: editing.is_active ?? true,
      sort_order: editing.sort_order ?? 0,
    };
    const query = editing.id ? supabase.from('council_agenda_templates').update(payload as any).eq('id', editing.id) : supabase.from('council_agenda_templates').insert([payload as any]);
    const { error } = await query;
    if (error) return toast({ title: 'Erro ao salvar template', description: error.message, variant: 'destructive' });
    setEditing(null);
    load();
  };

  return <div className='space-y-6'>
    <div className='executive-header flex flex-wrap items-center justify-between gap-3'>
      <div className='space-y-1'>
        <Button variant='ghost' asChild className='px-0 text-muted-foreground hover:text-foreground'>
          <Link to='/app/agenda'>
            <ArrowLeft className='h-4 w-4' />
            Voltar para Agenda
          </Link>
        </Button>
        <h1 className='executive-section-title text-2xl font-bold'>Templates de Pauta</h1>
      </div>
      {canWrite && <div className='flex gap-2'><Button variant='outline' asChild><Link to='/app/agenda'>Abrir Agenda de Evolução</Link></Button><Button onClick={() => setEditing({ priority: 'medium', is_active: true, sort_order: 0, key_questions: [], expected_evidence: [], suggested_actions: [], associated_red_flags: [] })}>Adicionar template</Button></div>}
    </div>

    <Card className='executive-panel'><CardContent className='pt-6 grid md:grid-cols-2 gap-3'>
      <div><Label>Dimensão</Label><Select value={dimensionFilter} onValueChange={setDimensionFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todas</SelectItem>{dimensions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Prioridade</Label><Select value={priorityFilter} onValueChange={setPriorityFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todas</SelectItem><SelectItem value='low'>Baixa</SelectItem><SelectItem value='medium'>Média</SelectItem><SelectItem value='high'>Alta</SelectItem></SelectContent></Select></div>
    </CardContent></Card>

    <div className='space-y-4'>{Object.entries(grouped).map(([dimension, templates]) => <Card key={dimension} className='executive-panel'>
      <CardHeader><CardTitle>{dimension}</CardTitle></CardHeader>
      <CardContent className='space-y-3'>{templates.map(t => <div key={t.id} className='executive-card rounded-lg p-3 space-y-2'>
        <div className='flex items-center justify-between gap-2'><p className='font-semibold'>{t.title}</p><p className='text-xs text-muted-foreground'>Prioridade: {priorityLabel[t.priority]}</p></div>
        <p><strong>Objetivo:</strong> {t.objective}</p>
        <p><strong>Quando usar:</strong> {t.when_to_use || '—'}</p>
        <p><strong>Perguntas-chave:</strong></p><ul className='list-disc pl-5 text-sm'>{t.key_questions.map((q, idx) => <li key={idx}>{q}</li>)}</ul>
        <p><strong>Evidências esperadas:</strong></p><ul className='list-disc pl-5 text-sm'>{t.expected_evidence.map((q, idx) => <li key={idx}>{q}</li>)}</ul>
        <p><strong>Ações sugeridas:</strong></p><ul className='list-disc pl-5 text-sm'>{t.suggested_actions.map((q, idx) => <li key={idx}>{q}</li>)}</ul>
        {canWrite && <div className='flex gap-2'><Button size='sm' variant='outline' onClick={() => setEditing(t)}>Editar</Button><Button size='sm' variant='secondary' onClick={async () => { await supabase.from('council_agenda_templates').update({ is_active: false }).eq('id', t.id); load(); }}>Desativar</Button></div>}
      </div>)}</CardContent>
    </Card>)}</div>

    {editing && canWrite && <Card className='executive-panel'><CardHeader><CardTitle>{editing.id ? 'Editar template' : 'Novo template'}</CardTitle></CardHeader><CardContent className='space-y-3'>
      <div className='grid md:grid-cols-2 gap-2'>
        <div><Label>ID da dimensão</Label><Input value={editing.dimension_id || ''} onChange={e => setEditing({ ...editing, dimension_id: e.target.value })} /></div>
        <div><Label>Nome da dimensão</Label><Input value={editing.dimension_label || ''} onChange={e => setEditing({ ...editing, dimension_label: e.target.value })} /></div>
      </div>
      <div><Label>Título</Label><Input value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} /></div>
      <div><Label>Objetivo</Label><Textarea value={editing.objective || ''} onChange={e => setEditing({ ...editing, objective: e.target.value })} /></div>
      <div><Label>Quando usar</Label><Textarea value={editing.when_to_use || ''} onChange={e => setEditing({ ...editing, when_to_use: e.target.value })} /></div>
      <div className='grid md:grid-cols-3 gap-2'>
        <div><Label>Perguntas-chave (1 por linha)</Label><Textarea value={(editing.key_questions || []).join('\n')} onChange={e => setEditing({ ...editing, key_questions: parseCsv(e.target.value) })} /></div>
        <div><Label>Evidências esperadas (1 por linha)</Label><Textarea value={(editing.expected_evidence || []).join('\n')} onChange={e => setEditing({ ...editing, expected_evidence: parseCsv(e.target.value) })} /></div>
        <div><Label>Ações sugeridas (1 por linha)</Label><Textarea value={(editing.suggested_actions || []).join('\n')} onChange={e => setEditing({ ...editing, suggested_actions: parseCsv(e.target.value) })} /></div>
      </div>
      <div className='grid md:grid-cols-3 gap-2'>
        <div><Label>Prioridade</Label><Select value={editing.priority || 'medium'} onValueChange={(v: CouncilAgendaTemplatePriority) => setEditing({ ...editing, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='low'>Baixa</SelectItem><SelectItem value='medium'>Média</SelectItem><SelectItem value='high'>Alta</SelectItem></SelectContent></Select></div>
        <div><Label>Ordem</Label><Input type='number' value={editing.sort_order ?? 0} onChange={e => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })} /></div>
        <div className='flex items-center gap-2 pt-8'><Switch checked={editing.is_active ?? true} onCheckedChange={v => setEditing({ ...editing, is_active: v })} /><Label>Ativo</Label></div>
      </div>
      <div className='flex gap-2 justify-end'><Button variant='outline' onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></div>
    </CardContent></Card>}
  </div>;
}
