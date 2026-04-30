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
  { key: 'companies' as keyof KpiData, label: 'ORGANIZAÇÕES ATIVAS', sublabel: 'em acompanhamento no ciclo atual', icon: Building2, iconClass: 'text-primary bg-primary/12 ring-1 ring-primary/25', href: '/app/startups', deltaKey: 'companies' as string },
  { key: 'inProgress' as keyof KpiData, label: 'DIAGNÓSTICOS EM CURSO', sublabel: 'com coleta e validação em andamento', icon: ClipboardList, iconClass: 'text-cyan-300 bg-cyan-500/10 ring-1 ring-cyan-500/30', href: '/app/startups', deltaKey: 'inProgress' as string },
  { key: 'completed' as keyof KpiData, label: 'DIAGNÓSTICOS CONCLUÍDOS', sublabel: 'prontos para leitura estratégica', icon: CheckCircle2, iconClass: 'text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-500/30', href: '/app/startups', deltaKey: 'completed' as string },
  { key: 'highRedFlags' as keyof KpiData, label: 'RISCOS CRÍTICOS', sublabel: 'organizações com red flags de alta severidade', icon: ShieldAlert, iconClass: 'text-red-300 bg-red-500/10 ring-1 ring-red-500/30', href: '/app/startups', deltaKey: null, critical: true },
];

function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const c = animate(0, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate(v) { node.textContent = Math.round(v).toString(); },
    });
    return () => c.stop();
  }, [value]);
  return <span ref={ref} className="text-4xl sm:text-5xl font-semibold tracking-tight leading-none">0</span>;
}

export default function KpiCards({ data, loading }: KpiCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="executive-card">
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-11 w-16" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card) => {
        const value = data[card.key] as number;
        const delta = card.deltaKey && data.delta7d ? (data.delta7d as Record<string, number | undefined>)[card.deltaKey] : undefined;

        return (
          <Link key={card.key} to={card.href}>
            <Card className={`executive-card h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${card.critical ? 'border-red-500/30 hover:border-red-400/40' : ''}`}>
              <CardContent className="p-5 sm:p-6 flex h-full flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${card.iconClass}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  {delta != null && delta > 0 && (
                    <span className="executive-pill text-[11px] text-success border-success/20 bg-success/10 inline-flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> +{delta} em 7 dias
                    </span>
                  )}
                </div>
                <div className="space-y-2 mt-auto">
                  <AnimatedCounter value={value} />
                  <p className="text-[11px] tracking-[0.14em] font-medium text-muted-foreground">{card.label}</p>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">{card.sublabel}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
