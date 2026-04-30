import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, ShieldAlert, ClipboardList, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export interface AttentionItem {
  id: string;
  companyName: string;
  type: 'low_progress' | 'high_red_flag' | 'founder_risk' | 'founder_outdated' | 'founder_regression';
  detail: string;
  href: string;
  ctaLabel: string;
  progress?: number;
  reasonChips?: string[];
  nextStep?: string;
  category?: 'diagnostic' | 'founder';
}

interface AttentionSectionProps {
  items: AttentionItem[];
  loading: boolean;
}

const severityVariant = (type: AttentionItem['type']): 'destructive' | 'secondary' | 'outline' => {
  if (type === 'high_red_flag' || type === 'founder_risk' || type === 'founder_regression') return 'destructive';
  if (type === 'founder_outdated') return 'outline';
  return 'secondary';
};

const panels = [
  { id: 'diagnosticos', title: 'Diagnósticos pendentes', icon: ClipboardList, matches: (item: AttentionItem) => item.type === 'low_progress' },
  { id: 'avaliacoes', title: 'Founders e avaliações', icon: Users, matches: (item: AttentionItem) => item.category === 'founder' },
  { id: 'riscos', title: 'Riscos críticos', icon: ShieldAlert, matches: (item: AttentionItem) => item.type === 'high_red_flag' || item.type === 'founder_risk' || item.type === 'founder_regression' },
];

export default function AttentionSection({ items, loading }: AttentionSectionProps) {
  if (loading || items.length === 0) return null;

  const renderItem = (item: AttentionItem) => (
    <div key={item.id} className="rounded-xl border border-border/60 bg-background/70 p-3.5 lg:p-4 space-y-2.5 transition-all hover:border-primary/35 hover:bg-background/90">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{item.companyName}</p>
        <div className="flex gap-1 shrink-0 flex-wrap justify-end">
          {(item.reasonChips || []).slice(0, 2).map((chip, i) => (
            <Badge
              key={i}
              variant={severityVariant(item.type)}
              className="text-[10px] px-1.5 py-0 h-5"
            >
              {chip}
            </Badge>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.detail}</p>
      {item.progress !== undefined && <Progress value={item.progress} className="h-1.5" />}
      {item.nextStep && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground/80">Próximo passo:</span> {item.nextStep}
        </p>
      )}
      <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] px-2 gap-1 -ml-2">
        <Link to={item.href}>{item.ctaLabel} <ArrowRight className="h-3 w-3" /></Link>
      </Button>
    </div>
  );

  return (
    <Card className="executive-panel">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="executive-section-title text-base flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Prioridades do Conselho
          </CardTitle>
          <Badge variant="outline" className="executive-pill">{items.length} itens de atenção</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-1">
        <div className="grid gap-3 lg:grid-cols-3">
          {panels.map((panel) => {
            const sectionItems = items.filter(panel.matches).slice(0, 3);
            return (
              <div key={panel.id} className="executive-card p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <panel.icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs font-medium tracking-wide">{panel.title}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{sectionItems.length}</span>
                </div>
                <div className="space-y-2.5">
                  {sectionItems.length > 0
                    ? sectionItems.map(renderItem)
                    : <p className="text-xs text-muted-foreground px-1 py-4">Sem pendências nesta frente.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
