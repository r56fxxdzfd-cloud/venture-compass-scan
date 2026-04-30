import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { CouncilAction, CouncilMeeting, CouncilDimensionProgress, CouncilAgendaTemplate, DimensionTrend } from '@/types/council';

type DimensionOption = { id: string; label: string };
type DimensionForm = Omit<CouncilDimensionProgress, 'id' | 'meeting_id' | 'company_id' | 'created_at' | 'updated_at'>;

const trendLabel: Record<DimensionTrend, string> = {
  improving: 'Melhorando',
  stable: 'Estável',
  worsening: 'Piorando',
  insufficient_evidence: 'Sem evidência',
};

const trendVariant: Record<DimensionTrend, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  improving: 'default',
  stable: 'secondary',
  worsening: 'destructive',
  insufficient_evidence: 'outline',
};

export default function MeetingDetailPage() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState<CouncilMeeting | null>(null);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [progressRows, setProgressRows] = useState<CouncilDimensionProgress[]>([]);
  const [agendaTemplates, setAgendaTemplates] = useState<CouncilAgendaTemplate[]>([]);
  const [formByDimension, setFormByDimension] = useState<Record<string, DimensionForm>>({});
  const { toast } = useToast();
  const [newAction, setNewAction] = useState<any>({ priority: 'medium', status: 'not_started' });
  const [companyName, setCompanyName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: m, error: meetingError } = await supabase.from('council_meetings').select('*').eq('id', id).single();
    if (meetingError) {
      toast({ title: 'Erro ao carregar encontro', description: meetingError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const [{ data: a, error: actionError }, { data: company, error: companyError }, { data: publishedConfig }, { data: progress, error: progressError }, { data: templates, error: templatesError }] = await Promise.all([
      supabase.from('council_actions').select('*').eq('meeting_id', id),
      supabase.from('companies').select('name').eq('id', m.company_id).single(),
      supabase.from('config_versions').select('id').eq('status', 'published').single(),
      supabase.from('council_dimension_progress').select('*').eq('meeting_id', id),
      supabase.from('council_agenda_templates').select('*').eq('is_active', true).order('sort_order'),
    ]);

    if (actionError) toast({ title: 'Erro ao carregar ações', description: actionError.message, variant: 'destructive' });
    if (companyError) toast({ title: 'Erro ao carregar empresa', description: companyError.message, variant: 'destructive' });
    if (progressError) toast({ title: 'Erro ao carregar evolução por dimensão', description: progressError.message, variant: 'destructive' });
    if (templatesError) toast({ title: 'Erro ao carregar templates de pauta', description: templatesError.message, variant: 'destructive' });

    let dimensionData: DimensionOption[] = [];
    if (publishedConfig?.id) {
      const { data: dims, error: dimError } = await supabase.from('dimensions').select('id,label').eq('config_version_id', publishedConfig.id).order('sort_order', { ascending: true });
      if (dimError) toast({ title: 'Erro ao carregar dimensões', description: dimError.message, variant: 'destructive' });
      dimensionData = (dims || []) as DimensionOption[];
    }

    const rows = (progress || []) as CouncilDimensionProgress[];
    const formState: Record<string, DimensionForm> = {};

    for (const dim of dimensionData) {
      const existing = rows.find(r => r.dimension_id === dim.id);
      formState[dim.id] = existing ? {
        dimension_id: existing.dimension_id,
        dimension_label: existing.dimension_label,
        initial_score: existing.initial_score,
        current_perceived_score: existing.current_perceived_score,
        trend: existing.trend,
        evidence_note: existing.evidence_note,
        counselor_comment: existing.counselor_comment,
      } : {
        dimension_id: dim.id,
        dimension_label: dim.label,
        initial_score: null,
        current_perceived_score: null,
        trend: 'stable',
        evidence_note: null,
        counselor_comment: null,
      };
    }

    setMeeting(m as CouncilMeeting);
    setActions((a || []) as CouncilAction[]);
    setCompanyName(company?.name || '');
    setDimensions(dimensionData);
    setProgressRows(rows);
    setAgendaTemplates((templates || []) as CouncilAgendaTemplate[]);
    setFormByDimension(formState);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const addAction = async () => {
    if (!meeting || !newAction.title) {
      toast({ title: 'Informe ao menos o título da ação', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('council_actions').insert({ ...newAction, meeting_id: meeting.id, company_id: meeting.company_id });
    if (error) return toast({ title: 'Erro ao criar ação', description: error.message, variant: 'destructive' });
    setNewAction({ priority: 'medium', status: 'not_started' });
    load();
  };

  const saveDimensionProgress = async (dimensionId: string) => {
    if (!meeting) return;
    const current = formByDimension[dimensionId];
    if (!current) return;
    const payload = {
      meeting_id: meeting.id,
      company_id: meeting.company_id,
      ...current,
      evidence_note: current.evidence_note || null,
      counselor_comment: current.counselor_comment || null,
    };
    const { error } = await supabase.from('council_dimension_progress').upsert(payload, { onConflict: 'meeting_id,dimension_id' });
    if (error) return toast({ title: 'Erro ao salvar evolução', description: error.message, variant: 'destructive' });
    toast({ title: 'Evolução por dimensão atualizada' });
    load();
  };

  const updateStatus = async (action: CouncilAction, status: string) => {
    const { error } = await supabase.from('council_actions').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', action.id);
    if (error) return toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    load();
  };

  if (loading) return <div className='text-sm text-muted-foreground'>Carregando encontro...</div>;
  if (!meeting) return <div className='text-sm text-muted-foreground'>Encontro não encontrado.</div>;

  const discussedDimensionIds = new Set([
    ...(meeting.related_dimensions || []),
    ...progressRows.map(p => p.dimension_id),
  ]);
  const suggestedTemplates = agendaTemplates.filter(t =>
    discussedDimensionIds.has(t.dimension_id) ||
    Array.from(discussedDimensionIds).some(id => id.toLowerCase() === t.dimension_label.toLowerCase())
  );

  return <div className='space-y-4'>
    <Card className='executive-surface'><CardHeader><CardTitle>Ata estruturada</CardTitle></CardHeader><CardContent className='space-y-2 text-sm'>
      <Badge>{meeting.meeting_type === 'collective' ? 'Coletivo' : meeting.meeting_type === 'individual' ? 'Individual' : 'Extraordinário'}</Badge>
      <p><strong>Empresa:</strong> {companyName || '—'}</p>
      <p><strong>Resumo:</strong> {meeting.executive_summary || '—'}</p>
      <p><strong>Decisões:</strong> {meeting.decisions || '—'}</p>
      <p><strong>Recomendações:</strong> {meeting.recommendations || '—'}</p>
      <p><strong>Travas:</strong> {meeting.key_blockers || '—'}</p>
      <p><strong>Próxima pauta:</strong> {meeting.next_agenda || '—'}</p>
    <div className='pt-1'><Link to='/app/agenda/templates' className='text-sm text-primary underline'>Consultar Templates de Pauta</Link></div></CardContent></Card>


    <Card className='executive-surface'><CardHeader><CardTitle>Pautas sugeridas para este encontro</CardTitle></CardHeader><CardContent className='space-y-3'>
      {suggestedTemplates.length === 0 ? <p className='text-sm text-muted-foreground'>Nenhum template relacionado às dimensões deste encontro. Consulte a biblioteca de templates para qualificar a pauta.</p> :
      suggestedTemplates.map(t => <div key={t.id} className='border rounded-lg p-3 space-y-2'>
        <p className='font-medium'>{t.dimension_label} • {t.title}</p>
        <p className='text-sm'><strong>Objetivo:</strong> {t.objective}</p>
        <ul className='list-disc pl-5 text-sm'>{t.key_questions.map((q, idx) => <li key={idx}>{q}</li>)}</ul>
      </div>)}
    </CardContent></Card>

    <Card className='executive-surface'><CardHeader><CardTitle>Evolução por Dimensão</CardTitle></CardHeader><CardContent className='space-y-3'>
      {dimensions.length === 0 ? <p className='text-sm text-muted-foreground'>Nenhuma dimensão ativa encontrada na metodologia publicada.</p> : <>
        <p className='text-sm text-muted-foreground'>Registre apenas as dimensões discutidas neste encontro.</p>
        <div className='space-y-4'>{dimensions.map((d) => {
          const row = formByDimension[d.id];
          if (!row) return null;
          const existing = progressRows.find(p => p.dimension_id === d.id);
          return <div key={d.id} className='border rounded-lg p-3 space-y-3'>
            <div className='flex items-center justify-between'>
              <p className='font-medium'>{d.label}</p>
              <Badge variant={trendVariant[row.trend]}>{trendLabel[row.trend]}</Badge>
            </div>
            <div className='grid md:grid-cols-3 gap-2'>
              <div><Label>Score inicial</Label><Input type='number' min={1} max={5} step='0.1' value={row.initial_score ?? ''} onChange={e => setFormByDimension(prev => ({ ...prev, [d.id]: { ...prev[d.id], initial_score: e.target.value ? Number(e.target.value) : null } }))} /></div>
              <div><Label>Score percebido atual</Label><Input type='number' min={1} max={5} step='0.1' value={row.current_perceived_score ?? ''} onChange={e => setFormByDimension(prev => ({ ...prev, [d.id]: { ...prev[d.id], current_perceived_score: e.target.value ? Number(e.target.value) : null } }))} /></div>
              <div><Label>Tendência</Label><Select value={row.trend} onValueChange={(v: DimensionTrend) => setFormByDimension(prev => ({ ...prev, [d.id]: { ...prev[d.id], trend: v } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='improving'>Melhorando</SelectItem><SelectItem value='stable'>Estável</SelectItem><SelectItem value='worsening'>Piorando</SelectItem><SelectItem value='insufficient_evidence'>Sem evidência</SelectItem></SelectContent></Select></div>
            </div>
            <div className='grid md:grid-cols-2 gap-2'>
              <div><Label>Evidência</Label><Textarea value={row.evidence_note ?? ''} onChange={e => setFormByDimension(prev => ({ ...prev, [d.id]: { ...prev[d.id], evidence_note: e.target.value || null } }))} /></div>
              <div><Label>Comentário do conselheiro</Label><Textarea value={row.counselor_comment ?? ''} onChange={e => setFormByDimension(prev => ({ ...prev, [d.id]: { ...prev[d.id], counselor_comment: e.target.value || null } }))} /></div>
            </div>
            <div className='flex items-center justify-between'>
              <p className='text-xs text-muted-foreground'>{existing ? 'Registro existente: atualização incremental.' : 'Sem registro ainda para esta dimensão.'}</p>
              <Button size='sm' onClick={() => saveDimensionProgress(d.id)}>{existing ? 'Atualizar dimensão' : 'Salvar dimensão'}</Button>
            </div>
          </div>;
        })}</div>
      </>}
    </CardContent></Card>

    <Card className='executive-surface'><CardHeader><CardTitle>Ações combinadas</CardTitle></CardHeader><CardContent className='space-y-3'>
      <div className='grid md:grid-cols-5 gap-2'>
        <div className='md:col-span-2'><Label>Ação</Label><Input value={newAction.title || ''} onChange={e => setNewAction({ ...newAction, title: e.target.value })} /></div>
        <div><Label>Responsável</Label><Input value={newAction.owner_name || ''} onChange={e => setNewAction({ ...newAction, owner_name: e.target.value })} /></div>
        <div><Label>Prazo</Label><Input type='date' value={newAction.due_date || ''} onChange={e => setNewAction({ ...newAction, due_date: e.target.value })} /></div>
        <div><Label>Status</Label><Select value={newAction.status} onValueChange={v => setNewAction({ ...newAction, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em andamento</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Travada</SelectItem></SelectContent></Select></div>
      </div><Button onClick={addAction}>Adicionar ação de conselho</Button>
      <div className='space-y-2'>{actions.map(a => <div key={a.id} className='border rounded p-3 flex items-center justify-between gap-2'>
        <div><p className='font-medium'>{a.title}</p><p className='text-xs text-muted-foreground'>{a.owner_name || 'Sem responsável'} • {a.due_date || 'Sem prazo'}</p>{a.impact === 'high' && a.effort === 'low' && <Badge className='mt-1'>Prioridade imediata</Badge>}</div>
        <Select value={a.status} onValueChange={(v) => updateStatus(a, v)}><SelectTrigger className='w-40'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em andamento</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Travada</SelectItem><SelectItem value='cancelled'>Cancelada</SelectItem></SelectContent></Select>
      </div>)}</div>
    </CardContent></Card>
  </div>;
}
