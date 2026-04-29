import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ClipboardList, CheckCircle2, ShieldAlert, TrendingUp } from 'lucide-react';
import { animate } from 'framer-motion';

export interface KpiData {
  companies: number;
  inProgress: number;
  completed: number;
  highRedFlags: number;
  delta7d?: {
    companies?: number;
    inProgress?: number;
    completed?: number;
  };
}

interface KpiCardsProps {
  data: KpiData;
  loading: boolean;
}

const cards = [
  {
    key: 'companies' as keyof KpiData,
    label: 'Startups ativas',
    sublabel: 'no ciclo atual',
    icon: Building2,
    iconClass: 'text-primary bg-primary/10',
    href: '/app/startups',
    deltaKey: 'companies' as string,
  },
  {
    key: 'inProgress' as keyof KpiData,
    label: 'Em andamento',
    sublabel: 'pendentes de finalização',
    icon: ClipboardList,
    iconClass: 'text-accent bg-accent/10',
    href: '/app/startups',
    deltaKey: 'inProgress' as string,
  },
  {
    key: 'completed' as keyof KpiData,
    label: 'Concluídos',
    sublabel: 'prontos para relatório',
    icon: CheckCircle2,
    iconClass: 'text-success bg-success/10',
    href: '/app/startups',
    deltaKey: 'completed' as string,
  },
  {
    key: 'highRedFlags' as keyof KpiData,
    label: 'Risco crítico',
    sublabel: 'startups com alerta alto',
    icon: ShieldAlert,
    iconClass: 'text-destructive bg-destructive/10',
    href: '/app/startups',
    deltaKey: null,
  },
];

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const c = animate(0, value, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate(v) { node.textContent = Math.round(v).toString(); },
    });
    return () => c.stop();
  }, [value]);
  return <span ref={ref} className="text-2xl font-bold tracking-tight">0</span>;
}

export default function KpiCards({ data, loading }: KpiCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="flex items-center gap-3 pt-4 pb-3 px-4">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const value = data[card.key] as number;
        const delta = card.deltaKey && data.delta7d
          ? (data.delta7d as Record<string, number | undefined>)[card.deltaKey]
          : undefined;

        return (
          <Link key={card.key} to={card.href}>
            <Card className="executive-kpi transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer group">
              <CardContent className="flex items-center gap-3 pt-4 pb-3 px-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${card.iconClass}`}>
                  <card.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <AnimatedCounter value={value} />
                  <p className="text-[11px] font-medium text-muted-foreground leading-tight truncate">{card.label}</p>
                  <p className="text-[9px] text-muted-foreground/70 leading-tight truncate">{card.sublabel}</p>
                </div>
                {delta != null && delta > 0 && (
                  <span className="text-[10px] text-success font-medium flex items-center gap-0.5 shrink-0">
                    <TrendingUp className="h-3 w-3" />+{delta} <span className="hidden sm:inline">7d</span>
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
