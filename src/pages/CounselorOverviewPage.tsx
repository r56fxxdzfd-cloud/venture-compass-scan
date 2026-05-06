import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DimensionBadge } from '@/components/DimensionBadge';
import type { CouncilAction, CouncilDimensionProgress, CouncilMeeting } from '@/types/council';

type Company = { id: string; name: string };

const openStatuses = new Set(['not_started', 'in_progress', 'blocked']);
const closedStatuses = new Set(['completed', 'cancelled']);

const statusLabel: Record<string, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  blocked: 'Travada',
  cancelled: 'Cancelada',
};

export default function CounselorOverviewPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [meetings, setMeetings] = useState<CouncilMeeting[]>([]);
  const [actions, setActions] = useState<CouncilAction[]>([]);
  const [progress, setProgress] = useState<CouncilDimensionProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [c, m, a, p] = await Promise.all([
        supabase.from('companies').select('id,name').order('name'),
        supabase.from('council_meetings').select('*').order('meeting_date', { ascending: false }),
        supabase.from('council_actions').select('*'),
        supabase.from('council_dimension_progress').select('*').order('updated_at', { ascending: false }),
      ]);

      setCompanies((c.data || []) as Company[]);
      setMeetings((m.data || []) as CouncilMeeting[]);
      setActions((a.data || []) as CouncilAction[]);
      setProgress((p.data || []) as CouncilDimensionProgress[]);
      setLoading(false);
    };
    load();
  }, []);

  const today = new Date();

  const latestMeetingByCompany = useMemo(() => {
    const map = new Map<string, CouncilMeeting>();
    for (const meeting of meetings) {
      if (!map.has(meeting.company_id)) map.set(meeting.company_id, meeting);
    }
    return map;
  }, [meetings]);

  const latestProgressByCompanyAndDimension = useMemo(() => {
    const map = new Map<string, CouncilDimensionProgress>();
    for (const row of progress) {
      const key = `${row.company_id}:${row.dimension_id}`;
      if (!map.has(key)) map.set(key, row);
    }
    return Array.from(map.values());
  }, [progress]);

  const attentionByCompany = useMemo(() => {
    const map = new Map<string, { overdue: number; blocked: number; worsening: number; noAgenda: boolean; noEvolution: boolean }>();
    for (const company of companies) {
      const companyActions = actions.filter((a) => a.company_id === company.id);
      const companyProgress = latestProgressByCompanyAndDimension.filter((p) => p.company_id === company.id);
      const latestMeeting = latestMeetingByCompany.get(company.id);
      const overdue = companyActions.filter((a) => a.due_date && new Date(a.due_date) < today && !closedStatuses.has(a.status)).length;
      const blocked = companyActions.filter((a) => a.status === 'blocked').length;
      const worsening = companyProgress.filter((p) => p.trend === 'worsening').length;
      const noAgenda = !!latestMeeting && !latestMeeting.next_agenda;
      const noEvolution = companyProgress.length === 0;
      map.set(company.id, { overdue, blocked, worsening, noAgenda, noEvolution });
    }
    return map;
  }, [companies, actions, latestProgressByCompanyAndDimension, latestMeetingByCompany]);

  const kpis = useMemo(() => {
    const open = actions.filter((a) => openStatuses.has(a.status)).length;
    const overdue = actions.filter((a) => a.due_date && new Date(a.due_date) < today && !closedStatuses.has(a.status)).length;
    const blocked = actions.filter((a) => a.status === 'blocked').length;
    const inAttention = latestProgressByCompanyAndDimension.filter((p) => p.trend === 'worsening' || (p.trend === 'stable' && (p.current_perceived_score ?? 999) <= 2.5)).length;
    const noAgenda = Array.from(latestMeetingByCompany.values()).filter((m) => !m.next_agenda).length;
    return { open, overdue, blocked, inAttention, noAgenda };
  }, [actions, latestProgressByCompanyAndDimension, latestMeetingByCompany]);

  const companiesRequiringAttention = useMemo(() => companies.map((company) => {
    const reasons = attentionByCompany.get(company.id)!;
    const weight = reasons.overdue * 2 + reasons.blocked * 2 + reasons.worsening * 2 + (reasons.noAgenda ? 1 : 0) + (reasons.noEvolution ? 1 : 0);
    const level = weight >= 5 ? 'Crítico' : weight >= 2 ? 'Atenção' : 'Saudável';
    return { company, reasons, level, weight };
  }).sort((a, b) => b.weight - a.weight), [companies, attentionByCompany]);

  const criticalActions = useMemo(() => actions
    .filter((a) => openStatuses.has(a.status))
    .sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    }), [actions]);

  if (loading) return <Card className='executive-panel'><CardContent className='py-10 text-center'>Carregando visão consolidada...</CardContent></Card>;

  return (
    <div className='space-y-6'>
      <Card className='executive-panel'>
        <CardHeader>
          <CardTitle className='executive-section-title text-2xl'>Central do Conselheiro</CardTitle>
          <p className='text-muted-foreground'>Priorize organizações, pendências e próximos encontros a partir de uma visão consolidada do acompanhamento.</p>
        </CardHeader>
      </Card>

      <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        <Card className='executive-card'><CardContent className='pt-5'>Organizações acompanhadas: <strong>{companies.length}</strong></CardContent></Card>
        <Card className='executive-card'><CardContent className='pt-5'>Ações abertas: <strong>{kpis.open}</strong></CardContent></Card>
        <Card className='executive-card'><CardContent className='pt-5'>Ações atrasadas: <strong>{kpis.overdue}</strong></CardContent></Card>
        <Card className='executive-card'><CardContent className='pt-5'>Ações travadas: <strong>{kpis.blocked}</strong></CardContent></Card>
        <Card className='executive-card'><CardContent className='pt-5'>Dimensões em atenção: <strong>{kpis.inAttention}</strong></CardContent></Card>
        <Card className='executive-card'><CardContent className='pt-5'>Encontros sem próxima pauta: <strong>{kpis.noAgenda}</strong></CardContent></Card>
      </section>

      <Card className='executive-panel'>
        <CardHeader><CardTitle>Organizações que exigem atenção</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          {companies.length === 0 ? <p className='text-sm text-muted-foreground'>Sem organizações cadastradas. Cadastre uma organização para iniciar o acompanhamento.</p> : companiesRequiringAttention.map((row) => {
            const motives = [
              row.reasons.overdue > 0 && `${row.reasons.overdue} ações atrasadas`,
              row.reasons.blocked > 0 && `${row.reasons.blocked} ações travadas`,
              row.reasons.worsening > 0 && `${row.reasons.worsening} dimensão(ões) piorando`,
              row.reasons.noAgenda && 'sem próxima pauta',
              row.reasons.noEvolution && 'sem evolução registrada',
            ].filter(Boolean);
            return <div key={row.company.id} className='rounded-md border p-3 flex items-center justify-between gap-3'>
              <div>
                <p className='font-medium'>{row.company.name}</p>
                <div className='flex flex-wrap items-center gap-2 mt-1'>
                  <Badge variant={row.level === 'Crítico' ? 'destructive' : row.level === 'Atenção' ? 'secondary' : 'outline'}>{row.level}</Badge>
                  <p className='text-sm text-muted-foreground'>{motives.length ? motives.join(' • ') : 'Sem alertas críticos no momento'}</p>
                </div>
              </div>
              <Button asChild size='sm'><Link to={`/app/startups/${row.company.id}/counselor`}>Abrir Central</Link></Button>
            </div>;
          })}
        </CardContent>
      </Card>

      <Card className='executive-panel'>
        <CardHeader><CardTitle>Próximas pautas e últimos encontros</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          {companies.length === 0 ? <p className='text-sm text-muted-foreground'>Sem organizações para exibir encontros.</p> : companies.map((company) => {
            const lastMeeting = latestMeetingByCompany.get(company.id);
            return <div key={company.id} className='rounded-md border p-3 flex items-center justify-between gap-3'>
              <div className='text-sm'>
                <p className='font-medium'>{company.name}</p>
                <p>Última reunião: {lastMeeting ? new Date(lastMeeting.meeting_date).toLocaleDateString('pt-BR') : '—'} • Tipo: {lastMeeting?.meeting_type || '—'}</p>
                <p>Próxima pauta: {lastMeeting?.next_agenda || 'Não registrada'}</p>
              </div>
              {lastMeeting && <Button asChild variant='outline' size='sm'><Link to={`/app/agenda/${lastMeeting.id}`}>Abrir encontro</Link></Button>}
            </div>;
          })}
        </CardContent>
      </Card>

      <Card className='executive-panel'>
        <CardHeader><CardTitle>Pendências críticas</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          {criticalActions.length === 0 ? <p className='text-sm text-emerald-600 dark:text-emerald-400'>Nenhuma pendência crítica em aberto. Ótimo trabalho no acompanhamento!</p> : criticalActions.map((action) => {
            const companyName = companies.find((c) => c.id === action.company_id)?.name || '—';
            return <div key={action.id} className='rounded-md border p-3 text-sm'>
              <p className='font-medium'>{action.title}</p>
              <p>Organização: {companyName} • Responsável: {action.owner_name || '—'} • Prazo: {action.due_date ? new Date(action.due_date).toLocaleDateString('pt-BR') : '—'}</p>
              <p>Status: {statusLabel[action.status] || action.status} • Prioridade: {action.priority} • Dimensão: {action.related_dimension ? <DimensionBadge code={action.related_dimension} /> : '—'}</p>
              <div className='mt-2'>
                <Button asChild variant='outline' size='sm'><Link to={`/app/startups/${action.company_id}/counselor`}>Abrir organização</Link></Button>
              </div>
            </div>;
          })}
        </CardContent>
      </Card>

      <Card className='executive-panel'>
        <CardHeader><CardTitle>Mapa de foco do conselheiro</CardTitle></CardHeader>
        <CardContent>
          {latestProgressByCompanyAndDimension.length === 0 ? <p className='text-sm text-muted-foreground'>Sem progresso por dimensão. Registre evolução nos encontros para liberar o mapa de foco.</p> :
            Object.entries(latestProgressByCompanyAndDimension.reduce((acc, item) => {
              const key = item.dimension_id;
              if (!acc[key]) acc[key] = { label: item.dimension_label, count: 0, trends: [] as string[] };
              if (item.trend === 'worsening' || (item.trend === 'stable' && (item.current_perceived_score ?? 999) <= 2.5)) {
                acc[key].count += 1;
                acc[key].trends.push(item.trend);
              }
              return acc;
            }, {} as Record<string, { label: string; count: number; trends: string[] }>))
              .filter(([, value]) => value.count > 0)
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 6)
              .map(([key, value]) => {
                const trend = value.trends.filter((t) => t === 'worsening').length >= value.trends.filter((t) => t === 'stable').length ? 'worsening' : 'stable';
                return <div key={key} className='rounded-md border p-3 mb-2 text-sm flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <DimensionBadge code={key} label={value.label} />
                    <span>{value.count} organização(ões) afetadas</span>
                  </div>
                  <Badge variant={trend === 'worsening' ? 'destructive' : 'secondary'}>{trend === 'worsening' ? 'Piorando' : 'Estável (baixo score)'}</Badge>
                </div>;
              })}
        </CardContent>
      </Card>

      <Card className='executive-panel border-primary/30'>
        <CardHeader><CardTitle className='flex items-center gap-2'><FileText className='h-4 w-4' />Assistente de Ata do Conselho</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-sm text-muted-foreground'>Cole a transcrição de uma reunião para gerar uma pré-ata revisável com decisões, ações e evolução por dimensão.</p>
          <div className='flex flex-wrap gap-2'>
            <Button asChild><Link to='/app/agenda'>Criar encontro a partir de transcrição</Link></Button>
            <Button asChild variant='outline'><Link to='/app/agenda'>Ver Agenda de Evolução</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
