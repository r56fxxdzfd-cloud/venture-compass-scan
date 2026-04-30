import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { CouncilAction, CouncilMeeting, MeetingType } from '@/types/council';

type Company = { id: string; name: string };
const mt = { collective: 'Coletivo', individual: 'Individual', extraordinary: 'Extraordinário' } as const;

export default function AgendaPage() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [meetings, setMeetings] = useState<CouncilMeeting[]>([]);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [progressCountByMeeting, setProgressCountByMeeting] = useState<Record<string, number>>({});
  const [companyId, setCompanyId] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [actionStatus, setActionStatus] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ meeting_type: 'collective' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [c, m, a, p] = await Promise.all([
      supabase.from('companies').select('id,name').order('name'),
      supabase.from('council_meetings').select('*').order('meeting_date', { ascending: false }),
      supabase.from('council_actions').select('*'),
      supabase.from('council_dimension_progress').select('meeting_id'),
    ]);
    if (c.error) toast({ title: 'Erro ao carregar empresas', description: c.error.message, variant: 'destructive' });
    if (m.error) toast({ title: 'Erro ao carregar encontros', description: m.error.message, variant: 'destructive' });
    if (a.error) toast({ title: 'Erro ao carregar ações', description: a.error.message, variant: 'destructive' });
    if (p.error) toast({ title: 'Erro ao carregar evolução por dimensão', description: p.error.message, variant: 'destructive' });
    if (c.data) setCompanies(c.data as Company[]);
    if (m.data) setMeetings(m.data as CouncilMeeting[]);
    if (a.data) setActions(a.data as CouncilAction[]);
    if (p.data) {
      const counts = (p.data as { meeting_id: string }[]).reduce((acc, row) => {
        acc[row.meeting_id] = (acc[row.meeting_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      setProgressCountByMeeting(counts);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => meetings.filter(m => {
    if (companyId !== 'all' && m.company_id !== companyId) return false;
    if (typeFilter !== 'all' && m.meeting_type !== typeFilter) return false;
    if (actionStatus !== 'all') {
      const meetingActions = actions.filter(a => a.meeting_id === m.id);
      if (!meetingActions.some(a => a.status === actionStatus)) return false;
    }
    return true;
  }), [meetings, companyId, typeFilter, actionStatus, actions]);

  const saveMeeting = async () => {
    if (!form.company_id || !form.meeting_date || !form.meeting_type) return toast({ title: 'Preencha empresa, data e tipo', variant: 'destructive' });
    const payload = {
      ...form,
      related_dimensions: form.related_dimensions?.split(',').map((s: string) => s.trim()).filter(Boolean) || null,
      attendees_counselors: form.attendees_counselors?.split(',').map((s: string) => s.trim()).filter(Boolean) || null,
      attendees_founders: form.attendees_founders?.split(',').map((s: string) => s.trim()).filter(Boolean) || null,
    };
    const { error } = await supabase.from('council_meetings').insert(payload);
    if (error) return toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    setOpen(false); setForm({ meeting_type: 'collective' }); load();
  };

  return <div className='space-y-6'>
    <div className='executive-header flex flex-wrap items-center justify-between gap-3'><div><h1 className='executive-section-title text-2xl font-bold'>Agenda de Evolução</h1><p className='text-sm text-muted-foreground'>Organize encontros, decisões e execução contínua do conselho.</p><Link className='text-sm text-primary underline print:hidden' to='/app/agenda/templates'>Consultar Templates de Pauta</Link></div><Button className='print:hidden' onClick={() => setOpen(true)}>Registrar novo encontro</Button></div>
    <Card className='executive-panel'><CardContent className='pt-6 grid md:grid-cols-3 gap-3'>
      <Select value={companyId} onValueChange={setCompanyId}><SelectTrigger><SelectValue placeholder='Empresa/OS' /></SelectTrigger><SelectContent><SelectItem value='all'>Todas</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todos os tipos</SelectItem><SelectItem value='collective'>Coletivo</SelectItem><SelectItem value='individual'>Individual</SelectItem><SelectItem value='extraordinary'>Extraordinário</SelectItem></SelectContent></Select>
      <Select value={actionStatus} onValueChange={setActionStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='all'>Todos status de ação</SelectItem><SelectItem value='not_started'>Não iniciada</SelectItem><SelectItem value='in_progress'>Em andamento</SelectItem><SelectItem value='completed'>Concluída</SelectItem><SelectItem value='blocked'>Travada</SelectItem></SelectContent></Select>
    </CardContent></Card>
    {loading ? <Card className='executive-panel'><CardContent className='py-10 text-center'>Carregando agenda...</CardContent></Card> : filtered.length === 0 ? <Card className='executive-panel'><CardContent className='py-10 text-center'>Nenhum encontro registrado ainda. Sem encontros, não há histórico de decisões, evolução e ações acompanháveis.<div className='mt-3'><Button onClick={() => setOpen(true)}>Registrar novo encontro</Button></div></CardContent></Card> :
      <div className='grid gap-3'>{filtered.map(m => {
        const comp = companies.find(c => c.id === m.company_id)?.name || '—'; const am = actions.filter(a => a.meeting_id === m.id);
        return <Card key={m.id} className='executive-panel'><CardHeader><CardTitle className='flex justify-between'><span>{m.title || m.main_topic || 'Encontro de conselho'}</span><Badge className='executive-pill'>{mt[m.meeting_type as MeetingType]}</Badge></CardTitle></CardHeader><CardContent className='text-sm space-y-2'>
          <div className='flex flex-wrap gap-2'><Badge variant='outline' className='executive-pill'>{new Date(m.meeting_date).toLocaleDateString('pt-BR')}</Badge><Badge variant='secondary' className='executive-pill'>{comp}</Badge>{(m.related_dimensions || []).map(d => <Badge key={d} variant='outline'>{d}</Badge>)}</div>
          <p><strong>Tema:</strong> {m.main_topic || '—'}</p><p><strong>Ações:</strong> {am.filter(a => a.status !== 'completed').length} abertas / {am.filter(a => a.status === 'completed').length} concluídas</p>
          <p><strong>Próxima pauta:</strong> {m.next_agenda || '—'}</p>
          <p><strong>Dimensões avaliadas:</strong> {progressCountByMeeting[m.id] || 0}</p>
          <Link className='text-primary underline' to={`/app/agenda/${m.id}`}>Abrir detalhe do encontro</Link>
        </CardContent></Card>;
      })}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className='max-w-3xl'><DialogHeader><DialogTitle>Registrar novo encontro</DialogTitle></DialogHeader>
      <div className='grid md:grid-cols-2 gap-3'>
        <div><Label>Empresa*</Label><Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v })}><SelectTrigger><SelectValue placeholder='Selecione' /></SelectTrigger><SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Data*</Label><Input type='date' value={form.meeting_date || ''} onChange={e => setForm({ ...form, meeting_date: e.target.value })} /></div>
        <div><Label>Tipo*</Label><Select value={form.meeting_type || 'collective'} onValueChange={v => setForm({ ...form, meeting_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='collective'>Coletivo</SelectItem><SelectItem value='individual'>Individual</SelectItem><SelectItem value='extraordinary'>Extraordinário</SelectItem></SelectContent></Select></div>
        <div><Label>Tema principal</Label><Input value={form.main_topic || ''} onChange={e => setForm({ ...form, main_topic: e.target.value })} /></div>
        <div className='md:col-span-2'><Label>Resumo executivo</Label><Input value={form.executive_summary || ''} onChange={e => setForm({ ...form, executive_summary: e.target.value })} /></div>
      </div>
      <div className='flex justify-end'><Button onClick={saveMeeting}>Salvar encontro</Button></div>
    </DialogContent></Dialog>
  </div>;
}
