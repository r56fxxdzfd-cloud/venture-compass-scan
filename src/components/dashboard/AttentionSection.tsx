import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

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

export default function AttentionSection({ items, loading }: AttentionSectionProps) {
  if (loading || items.length === 0) return null;

  const displayed = items.slice(0, 6);
  const remaining = items.length - displayed.length;

  const displayedDiagnostic = displayed.filter(i => i.category !== 'founder');
  const displayedFounder = displayed.filter(i => i.category === 'founder');

  const renderItem = (item: AttentionItem) => (
    <div key={item.id} className="rounded-lg border border-border/70 bg-background/80 p-3 transition-all hover:border-primary/30 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium truncate">{item.companyName}</span>
        <div className="flex gap-1 shrink-0">
          {(item.reasonChips || []).map((chip, i) => (
            <Badge
              key={i}
              variant={severityVariant(item.type)}
              className={`text-[9px] px-1.5 py-0 ${item.type === 'founder_outdated' ? 'border-orange-500 text-orange-600 dark:text-orange-400' : ''}`}
            >
              {chip}
            </Badge>
          ))}
        </div>
      </div>
      {item.progress !== undefined && (
        <Progress value={item.progress} className="h-1 mb-1.5" />
      )}
      {item.nextStep && (
        <p className="text-[10px] text-muted-foreground mb-2 leading-tight">
          <span className="font-medium text-foreground/70">Próximo passo:</span> {item.nextStep}
        </p>
      )}
      <Button asChild variant="ghost" size="sm" className="h-6 text-[11px] px-2 gap-1 -ml-2">
        <Link to={item.href}>
          {item.ctaLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    </div>
  );

  return (
    <Card className="executive-surface">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Requer atenção
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">
            {items.length} {items.length === 1 ? 'item requer' : 'itens requerem'} atenção
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-1">
        <div className="space-y-2">
          {displayedDiagnostic.map(renderItem)}
        </div>
        {displayedFounder.length > 0 && (
          <>
            {displayedDiagnostic.length > 0 && <Separator className="my-3" />}
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Founders</span>
            </div>
            <div className="space-y-2">
              {displayedFounder.map(renderItem)}
            </div>
          </>
        )}
        {remaining > 0 && (
          <div className="text-center mt-2">
            <Button asChild variant="link" size="sm" className="text-[11px] h-6">
              <Link to="/app/startups">Ver todos ({items.length})</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
