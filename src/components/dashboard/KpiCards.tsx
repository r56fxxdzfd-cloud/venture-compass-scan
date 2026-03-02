import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';
import { animate } from 'framer-motion';

export interface KpiData {
  companies: number;
  inProgress: number;
  completed: number;
  highRedFlags: number;
}

interface KpiCardsProps {
  data: KpiData;
  loading: boolean;
}

const cards = [
  {
    key: 'companies' as keyof KpiData,
    label: 'Startups ativas',
    icon: Building2,
    iconClass: 'text-primary bg-primary/10',
    href: '/app/startups',
  },
  {
    key: 'inProgress' as keyof KpiData,
    label: 'Em andamento',
    icon: ClipboardList,
    iconClass: 'text-accent bg-accent/10',
    href: '/app/startups',
  },
  {
    key: 'completed' as keyof KpiData,
    label: 'Concluídos',
    icon: CheckCircle2,
    iconClass: 'text-success bg-success/10',
    href: '/app/startups',
  },
  {
    key: 'highRedFlags' as keyof KpiData,
    label: 'Red flags (high)',
    icon: AlertTriangle,
    iconClass: 'text-destructive bg-destructive/10',
    href: '/app/startups',
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
  return <span ref={ref} className="text-3xl font-bold tracking-tight">0</span>;
}

export default function KpiCards({ data, loading }: KpiCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 pt-5 pb-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Link key={card.key} to={card.href}>
          <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer group">
            <CardContent className="flex items-center gap-4 pt-5 pb-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${card.iconClass}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <AnimatedCounter value={data[card.key]} />
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
