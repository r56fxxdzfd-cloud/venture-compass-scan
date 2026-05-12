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

type CardDef = {
  key: keyof KpiData;
  label: string;
  sublabel: string;
  icon: typeof Building2;
  iconWrap: string;
  iconColor: string;
  hoverBorder: string;
  hoverShadow: string;
  pillClass: string;
  barClass: string;
  href: string;
  deltaKey: string | null;
  critical?: boolean;
};

const cards: CardDef[] = [
  {
    key: 'companies',
    label: 'ORGANIZAÇÕES ATIVAS',
    sublabel: 'em acompanhamento no ciclo atual',
    icon: Building2,
    iconWrap: 'bg-primary/10 border border-primary/25',
    iconColor: 'text-primary',
    hoverBorder: 'hover:border-primary/50',
    hoverShadow: 'hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.35)]',
    pillClass: 'bg-primary/15 border border-primary/25 text-primary',
    barClass: 'bg-gradient-to-r from-primary/80 to-primary',
    href: '/app/startups',
    deltaKey: 'companies',
  },
  {
    key: 'inProgress',
    label: 'DIAGNÓSTICOS EM CURSO',
    sublabel: 'com coleta e validação em andamento',
    icon: ClipboardList,
    iconWrap: 'bg-cyan-500/10 border border-cyan-500/25',
    iconColor: 'text-cyan-300',
    hoverBorder: 'hover:border-cyan-400/50',
    hoverShadow: 'hover:shadow-[0_0_40px_-10px_rgba(34,211,238,0.3)]',
    pillClass: 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-300',
    barClass: 'bg-gradient-to-r from-cyan-500/80 to-cyan-300',
    href: '/app/startups',
    deltaKey: 'inProgress',
  },
  {
    key: 'completed',
    label: 'DIAGNÓSTICOS CONCLUÍDOS',
    sublabel: 'prontos para leitura estratégica',
    icon: CheckCircle2,
    iconWrap: 'bg-emerald-500/10 border border-emerald-500/25',
    iconColor: 'text-emerald-300',
    hoverBorder: 'hover:border-emerald-400/50',
    hoverShadow: 'hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]',
    pillClass: 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-300',
    barClass: 'bg-gradient-to-r from-emerald-500/80 to-emerald-300',
    href: '/app/startups',
    deltaKey: 'completed',
  },
  {
    key: 'highRedFlags',
    label: 'RISCOS CRÍTICOS',
    sublabel: 'organizações com red flags de alta severidade',
    icon: ShieldAlert,
    iconWrap: 'bg-red-500/10 border border-red-500/30',
    iconColor: 'text-red-300',
    hoverBorder: 'hover:border-red-400/50',
    hoverShadow: 'hover:shadow-[0_0_40px_-10px_rgba(239,68,68,0.35)]',
    pillClass: 'bg-red-500/15 border border-red-500/25 text-red-300',
    barClass: 'bg-gradient-to-r from-red-500/80 to-red-400',
    href: '/app/startups',
    deltaKey: null,
    critical: true,
  },
];

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const c = animate(0, value, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate(v) { node.textContent = Math.round(v).toString(); },
    });
    return () => c.stop();
  }, [value]);
  return (
    <span
      ref={ref}
      className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-none text-foreground tabular-nums"
    >
      0
    </span>
  );
}

export default function KpiCards({ data, loading }: KpiCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="executive-card rounded-3xl">
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <Skeleton className="h-12 w-20" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-1 w-full rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Progress bar fractions: scale each value vs max non-critical KPI for context.
  const baseMax = Math.max(data.companies, data.inProgress, data.completed, 1);

  const fractionFor = (card: CardDef, value: number) => {
    if (card.critical) {
      // Risk: 0 → empty; scale relative to total companies, capped.
      if (!value) return 0;
      return Math.min(100, Math.round((value / Math.max(data.companies, 1)) * 100));
    }
    if (!value) return 0;
    return Math.max(6, Math.min(100, Math.round((value / baseMax) * 100)));
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card) => {
        const value = data[card.key] as number;
        const delta = card.deltaKey && data.delta7d ? (data.delta7d as Record<string, number | undefined>)[card.deltaKey] : undefined;
        const pct = fractionFor(card, value);

        return (
          <Link key={card.key} to={card.href} className="group">
            <Card
              className={`executive-card relative overflow-hidden rounded-3xl h-full transition-all duration-500 hover:-translate-y-1 ${card.hoverBorder} ${card.hoverShadow}`}
            >
              <CardContent className="p-6 sm:p-7 flex h-full flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 transition-transform duration-500 group-hover:scale-110 ${card.iconWrap} ${card.iconColor}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  {delta != null && delta > 0 ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${card.pillClass}`}>
                      <TrendingUp className="h-3 w-3" /> +{delta} / 7d
                    </span>
                  ) : card.critical && value > 0 ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${card.pillClass}`}>
                      Atenção
                    </span>
                  ) : null}
                </div>

                <div className="space-y-2 mt-auto">
                  <AnimatedCounter value={value} />
                  <p className="text-[11px] tracking-[0.16em] font-semibold text-muted-foreground">{card.label}</p>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">{card.sublabel}</p>
                </div>

                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ease-out ${card.barClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
