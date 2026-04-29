import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { CouncilAction, CouncilMeeting } from '@/types/council';

export default function MeetingDetailPage() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState<CouncilMeeting | null>(null);
  const [actions, setActions] = useState<CouncilAction[]>([]);
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

    const [{ data: a, error: actionError }, { data: company, error: companyError }] = await Promise.all([
      supabase.from('council_actions').select('*').eq('meeting_id', id),
      supabase.from('companies').select('name').eq('id', m.company_id).single(),
    ]);

    if (actionError) toast({ title: 'Erro ao carregar ações', description: actionError.message, variant: 'destructive' });
    if (companyError) toast({ title: 'Erro ao carregar empresa', description: companyError.message, variant: 'destructive' });

    setMeeting(m as CouncilMeeting);
    setActions((a || []) as CouncilAction[]);
    setCompanyName(company?.name || '');
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

  const updateStatus = async (action: CouncilAction, status: string) => {
    const { error } = await supabase.from('council_actions').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', action.id);
    if (error) return toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    load();
  };

  if (loading) return <div className='text-sm text-muted-foreground'>Carregando encontro...</div>;
  if (!meeting) return <div className='text-sm text-muted-foreground'>Encontro não encontrado.</div>;
  return <div className='space-y-4'>
    <Card className='executive-surface'><CardHeader><CardTitle>Ata estruturada</CardTitle></CardHeader><CardContent className='space-y-2 text-sm'>
      <Badge>{meeting.meeting_type}</Badge>
      <p><strong>Empresa:</strong> {companyName || '—'}</p>
      <p><strong>Resumo:</strong> {meeting.executive_summary || '—'}</p>
      <p><strong>Decisões:</strong> {meeting.decisions || '—'}</p>
      <p><strong>Recomendações:</strong> {meeting.recommendations || '—'}</p>
      <p><strong>Travas:</strong> {meeting.key_blockers || '—'}</p>
      <p><strong>Próxima pauta:</strong> {meeting.next_agenda || '—'}</p>
    </CardContent></Card>

    <Card className='executive-surface'><CardHeader><CardTitle>Ações combinadas</CardTitle></CardHeader><CardContent className='space-y-3'>
      <div className='grid md:grid-cols-5 gap-2'>
        <div className='md:col-span-2'><Label>Ação</Label><Input value={newAction.title || ''} onChange={e => setNewAction({ ...newAction, title: e.target.value })} /></div>
        <div><Label>Responsável</Label><Input value={newAction.owner_name || ''} onChange={e => setNewAction({ ...newAction, owner_name: e.target.value })} /></div>
        <div><Label>Prazo</Label><Input type='date' value={newAction.due_date || ''} onChange={e => setNewAction({ ...newAction, due_date: e.target.value })} /></div>
        <div><Label>Status</Label><Select value={newAction.status} onValueChange={v => setNewAction({ ...newAction, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em progresso</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Bloqueada</SelectItem></SelectContent></Select></div>
      </div><Button onClick={addAction}>Adicionar ação</Button>
      <div className='space-y-2'>{actions.map(a => <div key={a.id} className='border rounded p-3 flex items-center justify-between gap-2'>
        <div><p className='font-medium'>{a.title}</p><p className='text-xs text-muted-foreground'>{a.owner_name || 'Sem responsável'} • {a.due_date || 'Sem prazo'}</p>{a.impact === 'high' && a.effort === 'low' && <Badge className='mt-1'>Prioridade imediata</Badge>}</div>
        <Select value={a.status} onValueChange={(v) => updateStatus(a, v)}><SelectTrigger className='w-40'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em progresso</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Bloqueada</SelectItem><SelectItem value='cancelled'>Cancelada</SelectItem></SelectContent></Select>
      </div>)}</div>
    </CardContent></Card>
  </div>;
}
