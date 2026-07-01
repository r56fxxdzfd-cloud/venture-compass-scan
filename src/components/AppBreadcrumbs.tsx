import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { supabase } from '@/integrations/supabase/client';

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  startups: 'Organizações',
  simulator: 'Simulador',
  agenda: 'Agenda de Evolução',
  templates: 'Templates de Pauta',
  methodology: 'Metodologia',
  admin: 'Admin',
  config: 'Configuração',
  users: 'Usuários',
  assessments: 'Diagnósticos',
  questionnaire: 'Questionário',
  report: 'Relatório',
  progress: 'Relatório de Progresso',
  counselor: 'Central do Comitê de Crescimento',
  founders: 'Lideranças',
  'founder-assessments': 'Avaliação de Liderança',
  new: 'Nova Avaliação',
  pdf: 'PDF',
};

export function AppBreadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.replace('/app/', '').split('/').filter(Boolean);
  const [dynamicLabels, setDynamicLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const loadLabels = async () => {
      const nextLabels: Record<string, string> = {};
      const jobs: Promise<void>[] = [];

      segments.forEach((seg, index) => {
        if (seg.length <= 20) return;
        const previous = segments[index - 1];

        if (previous === 'startups') {
          jobs.push(
            supabase.from('companies').select('name').eq('id', seg).maybeSingle().then(({ data }) => {
              if (data?.name) nextLabels[seg] = data.name;
            })
          );
        }

        if (previous === 'agenda') {
          jobs.push(
            supabase.from('council_meetings').select('title, main_topic, meeting_date, company:companies(name)').eq('id', seg).maybeSingle().then(({ data }) => {
              if (!data) return;
              const company = Array.isArray((data as any).company) ? (data as any).company[0]?.name : (data as any).company?.name;
              nextLabels[seg] = data.title || data.main_topic || (company ? `Encontro · ${company}` : `Encontro ${data.meeting_date || ''}`.trim());
            })
          );
        }

        if (previous === 'assessments') {
          jobs.push(
            supabase.from('assessments').select('created_at, company:companies(name)').eq('id', seg).maybeSingle().then(({ data }) => {
              if (!data) return;
              const company = Array.isArray((data as any).company) ? (data as any).company[0]?.name : (data as any).company?.name;
              const date = data.created_at ? new Date(data.created_at).toLocaleDateString('pt-BR') : '';
              nextLabels[seg] = company ? `${company} · ${date}` : `Diagnóstico ${date}`.trim();
            })
          );
        }

        if (previous === 'founder-assessments') {
          jobs.push(
            supabase.from('founder_assessments').select('semester, founder:founders(name)').eq('id', seg).maybeSingle().then(({ data }) => {
              if (!data) return;
              const founder = Array.isArray((data as any).founder) ? (data as any).founder[0]?.name : (data as any).founder?.name;
              nextLabels[seg] = founder ? `${founder} · ${data.semester || ''}`.trim() : 'Avaliação de Liderança';
            })
          );
        }
      });

      await Promise.all(jobs);
      if (!cancelled) setDynamicLabels(nextLabels);
    };

    if (segments.some((seg) => seg.length > 20)) {
      loadLabels();
    } else {
      setDynamicLabels({});
    }

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (segments.length === 0) return null;

  const crumbs: { label: string; href: string }[] = [];
  let path = '/app';

  segments.forEach((seg, i) => {
    path += `/${seg}`;
    const isUuid = seg.length > 20;
    const label = isUuid ? (dynamicLabels[seg] || 'Carregando...') : (routeLabels[seg] || seg);
    if (i < segments.length - 1) {
      crumbs.push({ label, href: path });
    } else {
      crumbs.push({ label, href: '' });
    }
  });

  return (
    <Breadcrumb className="min-w-0 max-w-full">
      <BreadcrumbList className="min-w-0 max-w-full flex-nowrap overflow-x-auto">
        {crumbs.map((crumb, i) => (
          <BreadcrumbItem key={i}>
            {i > 0 && <BreadcrumbSeparator />}
            {crumb.href ? (
              <BreadcrumbLink asChild>
                <Link to={crumb.href} className="truncate max-w-[9rem] sm:max-w-none">{crumb.label}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage className="truncate max-w-[9rem] sm:max-w-none">{crumb.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
