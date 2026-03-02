import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';
import { animate } from 'framer-motion';

interface KPIData {
  companies: number;
  inProgress: number;
  completed: number;
  highRedFlagCompanies: number;
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(0, value, {
      duration: 0.7,
      ease: 'easeOut',
      onUpdate(v) { node.textContent = Math.round(v).toString(); },
    });
    return () => controls.stop();
  }, [value]);
  return <span ref={ref} className="text-3xl font-bold tracking-tight">0</span>;
}

const cards = [
  {
    key: 'companies',
    label: 'Startups ativas',
    icon: Building2,
    href: '/app/startups',
    iconClass: 'text-foreground bg-muted',
  },
  {
    key: 'inProgress',
    label: 'Em andamento',
    icon: ClipboardList,
    href: '/app/startups',
    iconClass: 'text-foreground bg-muted',
  },
  {
    key: 'completed',
    label: 'Concluídos',
    icon: CheckCircle2,
    href: '/app/startups',
    iconClass: 'text-foreground bg-muted',
  },
  {
    key: 'highRedFlagCompanies',
    label: 'Red flags (high)',
    icon: AlertTriangle,
    href: '/app/startups',
    iconClass: 'text-foreground bg-muted',
  },
] as const;

export default function DashboardKPICards({ data, loading }: { data: KPIData; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="h-10 w-10 rounded-lg bg-muted" />
              <div className="space-y-2">
                <div className="h-7 w-12 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map(card => (
        <Link key={card.key} to={card.href}>
          <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 group cursor-pointer">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 transition-transform group-hover:scale-110 ${card.iconClass}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <AnimatedNumber value={data[card.key]} />
                <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
