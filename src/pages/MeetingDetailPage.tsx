import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { CouncilAction, CouncilMeeting } from '@/types/council';

export default function MeetingDetailPage() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState<CouncilMeeting | null>(null);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [newAction, setNewAction] = useState<any>({ priority: 'medium', status: 'not_started' });

  const load = async () => {
    const { data: m } = await supabase.from('council_meetings').select('*').eq('id', id).single();
    const { data: a } = await supabase.from('council_actions').select('*').eq('meeting_id', id);
    if (m) setMeeting(m as CouncilMeeting); if (a) setActions(a as CouncilAction[]);
  };
  useEffect(() => { load(); }, [id]);

  const addAction = async () => {
    if (!meeting || !newAction.title) return;
    await supabase.from('council_actions').insert({ ...newAction, meeting_id: meeting.id, company_id: meeting.company_id });
    setNewAction({ priority: 'medium', status: 'not_started' }); load();
  };

  const updateStatus = async (action: CouncilAction, status: string) => {
    await supabase.from('council_actions').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', action.id);
    load();
  };

  if (!meeting) return null;
  return <div className='space-y-4'>
    <Card className='executive-surface'><CardHeader><CardTitle>Ata estruturada</CardTitle></CardHeader><CardContent className='space-y-2 text-sm'>
      <Badge>{meeting.meeting_type}</Badge>
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
