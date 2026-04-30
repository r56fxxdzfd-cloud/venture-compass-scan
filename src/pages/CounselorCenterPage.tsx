import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CouncilAction, CouncilAgendaTemplate, CouncilDimensionProgress, CouncilMeeting } from '@/types/council';

type Company = { id: string; name: string };

const openStatuses = new Set(['not_started', 'in_progress', 'blocked']);
const statusLabel: Record<string, string> = { not_started: 'Não iniciada', in_progress: 'Em andamento', completed: 'Concluída', blocked: 'Travada', cancelled: 'Cancelada' };
const trendLabel: Record<string, string> = { improving: 'Melhorando', stable: 'Estável', worsening: 'Piorando', insufficient_evidence: 'Sem evidência' };
const priorityLabel: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };


export default function CounselorCenterPage() {
  const { id } = useParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [meetings, setMeetings] = useState<CouncilMeeting[]>([]);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [progress, setProgress] = useState<CouncilDimensionProgress[]>([]);
  const [templates, setTemplates] = useState<CouncilAgendaTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const [c, m, a, p, t] = await Promise.all([
        supabase.from('companies').select('id,name').eq('id', id).single(),
        supabase.from('council_meetings').select('*').eq('company_id', id).order('meeting_date', { ascending: false }),
        supabase.from('council_actions').select('*').eq('company_id', id),
        supabase.from('council_dimension_progress').select('*').eq('company_id', id).order('updated_at', { ascending: false }),
        supabase.from('council_agenda_templates').select('*').eq('is_active', true).order('sort_order'),
      ]);
      if (c.data) setCompany(c.data as Company);
      if (m.data) setMeetings(m.data as CouncilMeeting[]);
      if (a.data) setActions(a.data as CouncilAction[]);
      if (p.data) setProgress(p.data as CouncilDimensionProgress[]);
      if (t.data) setTemplates(t.data as CouncilAgendaTemplate[]);
      setLoading(false);
    };
    load();
  }, [id]);

  const latestMeeting = meetings[0];
  const openActions = actions.filter(a => openStatuses.has(a.status));
  const overdueActions = actions.filter(a => a.due_date && new Date(a.due_date) < new Date() && !['completed', 'cancelled'].includes(a.status));
  const latestProgressByDimension = useMemo(() => {
    const map = new Map<string, CouncilDimensionProgress>();
    for (const row of progress) {
      if (!map.has(row.dimension_id)) map.set(row.dimension_id, row);
    }
    return Array.from(map.values());
  }, [progress]);

  const criticalDimensions = latestProgressByDimension.filter(d => d.trend === 'worsening' || (d.trend === 'stable' && (d.current_perceived_score ?? 999) <= 2.5));
  const lowStableDimensions = latestProgressByDimension.filter(d => d.trend === 'stable' && (d.current_perceived_score ?? 999) <= 2.5);
  const worseningDimensions = latestProgressByDimension.filter(d => d.trend === 'worsening');

  const relatedDimensionIds = useMemo(() => {
    const set = new Set<string>();
    (latestMeeting?.related_dimensions || []).forEach(d => set.add(d));
    latestProgressByDimension.forEach(p => set.add(p.dimension_id));
    worseningDimensions.forEach(p => set.add(p.dimension_id));
    lowStableDimensions.forEach(p => set.add(p.dimension_id));
    return set;
  }, [latestMeeting, latestProgressByDimension, worseningDimensions, lowStableDimensions]);

  const suggestedTemplates = templates.filter(t => relatedDimensionIds.has(t.dimension_id));
  const recentMeetings = meetings.slice(0, 3);

  if (loading) return <Card className='executive-surface'><CardContent className='py-10 text-center'>Carregando Central do Conselheiro...</CardContent></Card>;
  if (!company) return <Card className='executive-surface'><CardContent className='py-10 text-center'>Empresa não encontrada.</CardContent></Card>;

  return <div className='space-y-6'>
    <div className='executive-header flex flex-wrap items-center justify-between gap-3'>
      <div>
        <h1 className='text-2xl font-bold'>Central do Conselheiro</h1>
        <p className='text-muted-foreground'>{company.name}</p>
      </div>
      <div className='flex gap-2'>
        <Badge variant='outline'>Encontros: {meetings.length}</Badge>
        <Badge variant='secondary'>Abertas: {openActions.length}</Badge>
        <Badge variant={overdueActions.length ? 'destructive' : 'outline'}>Atrasadas: {overdueActions.length}</Badge>
      </div>
    </div>

    {!latestMeeting ? <Card className='executive-surface print-safe'><CardContent className='py-8 text-center space-y-2'>
      <p className='font-medium'>Sem encontros registrados para esta empresa.</p>
      <p className='text-sm text-muted-foreground'>Registre o primeiro encontro para iniciar o acompanhamento da organização e liberar a visão executiva do conselho.</p>
      <Button asChild><Link to='/app/agenda'>Registrar primeiro encontro</Link></Button>
    </CardContent></Card> : <>
      <Card className='executive-surface print-safe'>
        <CardHeader><CardTitle>Antes da próxima reunião</CardTitle></CardHeader>
        <CardContent className='grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm'>
          <div><p className='text-muted-foreground'>Última reunião</p><p className='font-medium'>{new Date(latestMeeting.meeting_date).toLocaleDateString('pt-BR')}</p></div>
          <div><p className='text-muted-foreground'>Próxima pauta</p><p className='font-medium'>{latestMeeting.next_agenda || 'Não registrada'}</p></div>
          <div><p className='text-muted-foreground'>Decisões recentes</p><p>{recentMeetings.map(m => m.decisions).filter(Boolean).join(' • ') || 'Sem decisões registradas'}</p></div>
          <div><p className='text-muted-foreground'>Recomendações recentes</p><p>{recentMeetings.map(m => m.recommendations).filter(Boolean).join(' • ') || 'Sem recomendações recentes'}</p></div>
          <div><p className='text-muted-foreground'>Principais travas</p><p>{recentMeetings.map(m => m.key_blockers).filter(Boolean).join(' • ') || 'Sem travas registradas'}</p></div>
          <div><p className='text-muted-foreground'>Ações em aberto</p><p className='font-semibold'>{openActions.length}</p></div>
          <div><p className='text-muted-foreground'>Ações atrasadas</p><p className='font-semibold'>{overdueActions.length}</p></div>
          <div><p className='text-muted-foreground'>Dimensões críticas</p><p className='font-semibold'>{criticalDimensions.length}</p></div>
        </CardContent>
      </Card>

      <Card className='executive-surface'>
        <CardHeader><CardTitle>Pauta sugerida</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          {suggestedTemplates.length === 0 ? <p className='text-sm'>Nenhum template relacionado às dimensões atuais. Isso reduz a qualidade da preparação do encontro. <Link to='/app/agenda/templates' className='text-primary underline'>Consultar templates de pauta</Link>.</p> : suggestedTemplates.map(t => <div key={t.id} className='rounded-md border p-3 space-y-1 text-sm'>
            <div className='flex flex-wrap items-center gap-2'><Badge variant='outline'>{t.dimension_label}</Badge><p className='font-medium'>{t.title}</p></div>
            <p><strong>Objetivo:</strong> {t.objective}</p>
            <p><strong>Perguntas-chave:</strong> {t.key_questions.join(' • ') || '—'}</p>
            <p><strong>Evidências esperadas:</strong> {t.expected_evidence.join(' • ') || '—'}</p>
            <p><strong>Ações sugeridas:</strong> {t.suggested_actions.join(' • ') || '—'}</p>
          </div>)}
        </CardContent>
      </Card>

      <Card className='executive-surface'>
        <CardHeader><CardTitle>Ações pendentes</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          {openActions.length === 0 ? <p className='text-sm text-muted-foreground'>Nenhuma ação de conselho em aberto. Mantenha o registro atualizado para sustentar a execução entre encontros.</p> : openActions.map(a => {
            const overdue = a.due_date && new Date(a.due_date) < new Date();
            const quickWin = a.impact === 'high' && a.effort === 'low';
            return <div key={a.id} className='rounded-md border p-3 text-sm'>
              <div className='flex flex-wrap items-center gap-2'>
                <p className='font-medium'>{a.title}</p>
                {overdue && <Badge variant='destructive'>Atrasada</Badge>}
                {a.status === 'blocked' && <Badge variant='destructive'>Travada</Badge>}
                {quickWin && <Badge variant='secondary'>Alto impacto / baixo esforço</Badge>}
              </div>
              <p>Dimensão: {a.related_dimension || '—'} • Responsável: {a.owner_name || '—'} • Prazo: {a.due_date ? new Date(a.due_date).toLocaleDateString('pt-BR') : '—'}</p>
              <p>Status: {statusLabel[a.status] || a.status} • Prioridade: {priorityLabel[a.priority] || a.priority} • Impacto: {a.impact || '—'} • Esforço: {a.effort || '—'}</p>
              <p>Evidência esperada: {a.expected_evidence || '—'}</p>
            </div>;
          })}
        </CardContent>
      </Card>

      <Card className='executive-surface'>
        <CardHeader><CardTitle>Evolução recente por dimensão</CardTitle></CardHeader>
        <CardContent className='space-y-3 text-sm'>
          {latestProgressByDimension.length === 0 ? <p className='text-muted-foreground'>Ainda não há leitura de evolução por dimensão. Registre a evolução das dimensões discutidas no encontro para orientar decisões.</p> : latestProgressByDimension.map(d => <div key={d.id} className='rounded-md border p-3'>
            <div className='flex flex-wrap gap-2 items-center'><Badge variant='outline'>{d.dimension_label}</Badge><Badge>{trendLabel[d.trend] || d.trend}</Badge><span>Score atual: <strong>{d.current_perceived_score ?? '—'}</strong></span></div>
            <p>Evidência: {d.evidence_note || '—'}</p>
            <p>Comentário: {d.counselor_comment || '—'}</p>
            <p className='text-muted-foreground'>Última atualização: {d.updated_at ? new Date(d.updated_at).toLocaleDateString('pt-BR') : '—'}</p>
          </div>)}
        </CardContent>
      </Card>
    </>}

    <Card className='executive-surface'>
      <CardHeader><CardTitle>Ações rápidas</CardTitle></CardHeader>
      <CardContent className='flex flex-wrap gap-2'>
        <Button asChild><Link to='/app/agenda'>Registrar novo encontro</Link></Button>
        <Button variant='secondary' asChild><Link to={`/app/startups/${company.id}/progress`}>Ver Relatório de Progresso</Link></Button>
        <Button variant='outline' asChild><Link to='/app/agenda/templates'>Consultar Templates de Pauta</Link></Button>
        <Button variant='ghost' asChild><Link to={`/app/startups/${company.id}`}>Voltar para empresa</Link></Button>
      </CardContent>
    </Card>
  </div>;
}
