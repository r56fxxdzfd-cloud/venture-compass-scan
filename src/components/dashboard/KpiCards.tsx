import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ClipboardList, CheckCircle2, ShieldAlert, ListChecks, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { animate } from 'framer-motion';

export interface KpiData {
  companies: number;
  inProgress: number;
  completed: number;
  openActions: number;
  criticalActions: number;
  highRedFlags: number;
}

interface KpiCardsProps {
  data: KpiData;
  loading: boolean;
}

type CardDef = {
  key: keyof KpiData;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  iconWrap: string;
  iconColor: string;
  href: string;
  critical?: boolean;
};

const cards: CardDef[] = [
  {
    key: 'companies',
    label: 'Organizações acompanhadas',
    sublabel: 'portfólio ativo no Conselho OS',
    icon: Building2,
    iconWrap: 'bg-primary/10 border border-primary/25',
    iconColor: 'text-primary',
    href: '/app/startups',
  },
  {
    key: 'inProgress',
    label: 'Diagnósticos em andamento',
    sublabel: 'coleta ou validação pendente',
    icon: ClipboardList,
    iconWrap: 'bg-cyan-500/10 border border-cyan-500/25',
    iconColor: 'text-cyan-600 dark:text-cyan-300',
    href: '/app/startups',
  },
  {
    key: 'completed',
    label: 'Diagnósticos concluídos',
    sublabel: 'leituras prontas para decisão',
    icon: CheckCircle2,
    iconWrap: 'bg-emerald-500/10 border border-emerald-500/25',
    iconColor: 'text-emerald-600 dark:text-emerald-300',
    href: '/app/startups',
  },
  {
    key: 'openActions',
    label: 'Ações abertas',
    sublabel: 'encaminhamentos em acompanhamento',
    icon: ListChecks,
    iconWrap: 'bg-blue-500/10 border border-blue-500/25',
    iconColor: 'text-blue-600 dark:text-blue-300',
    href: '/app/counselor',
  },
  {
    key: 'criticalActions',
    label: 'Ações críticas',
    sublabel: 'travadas, atrasadas ou prioritárias',
    icon: AlertTriangle,
    iconWrap: 'bg-amber-500/10 border border-amber-500/25',
    iconColor: 'text-amber-700 dark:text-amber-300',
    href: '/app/counselor',
    critical: true,
  },
  {
    key: 'highRedFlags',
    label: 'Riscos críticos',
    sublabel: 'organizações com red flags altas',
    icon: ShieldAlert,
    iconWrap: 'bg-red-500/10 border border-red-500/30',
    iconColor: 'text-red-700 dark:text-red-300',
    href: '/app/startups',
    critical: true,
  },
];

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(0, value, {
      duration: 0.75,
      ease: 'easeOut',
      onUpdate(current) {
        node.textContent = Math.round(current).toString();
      },
    });
    return () => controls.stop();
  }, [value]);
  return <span ref={ref} className="text-3xl font-extrabold leading-none tracking-tight text-foreground tabular-nums">0</span>;
}

export default function KpiCards({ data, loading }: KpiCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <Card key={item} className="executive-card rounded-3xl">
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-9 w-9 rounded-2xl" />
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => {
        const value = data[card.key];
        return (
          <Link key={card.key} to={card.href} className="group">
            <Card className={`executive-card h-full rounded-3xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 ${card.critical && value > 0 ? 'ring-1 ring-red-500/15' : ''}`}>
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${card.iconWrap} ${card.iconColor}`}>
                    <card.icon className="h-4 w-4" />
                  </div>
                  {card.critical && value > 0 ? <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-700 dark:text-red-300">Atenção</span> : null}
                </div>
                <div className="mt-auto space-y-1">
                  <AnimatedCounter value={value} />
                  <p className="text-xs font-semibold leading-tight">{card.label}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{card.sublabel}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
