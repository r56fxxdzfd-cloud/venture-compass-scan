import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  startups: 'Startups',
  simulator: 'Simulador',
  methodology: 'Metodologia',
  admin: 'Admin',
  config: 'Configuração',
  users: 'Usuários',
  assessments: 'Diagnósticos',
  questionnaire: 'Questionário',
  report: 'Relatório',
};

export function AppBreadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.replace('/app/', '').split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs: { label: string; href: string }[] = [];
  let path = '/app';

  segments.forEach((seg, i) => {
    path += `/${seg}`;
    const isUuid = seg.length > 20;
    const label = isUuid ? '...' : (routeLabels[seg] || seg);
    if (i < segments.length - 1) {
      crumbs.push({ label, href: path });
    } else {
      crumbs.push({ label, href: '' });
    }
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <BreadcrumbItem key={i}>
            {i > 0 && <BreadcrumbSeparator />}
            {crumb.href ? (
              <BreadcrumbLink asChild>
                <Link to={crumb.href}>{crumb.label}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
