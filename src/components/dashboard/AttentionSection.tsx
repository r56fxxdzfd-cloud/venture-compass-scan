import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export interface AttentionItem {
  id: string;
  companyName: string;
  type: 'low_progress' | 'high_red_flag';
  detail: string;
  href: string;
  ctaLabel: string;
  progress?: number;
  reasonChips?: string[];
  nextStep?: string;
}

interface AttentionSectionProps {
  items: AttentionItem[];
  loading: boolean;
}

export default function AttentionSection({ items, loading }: AttentionSectionProps) {
  if (loading || items.length === 0) return null;

  const displayed = items.slice(0, 3);
  const remaining = items.length - displayed.length;

  return (
    <Card>
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
          {displayed.map((item) => (
            <div key={item.id} className="rounded-md border p-3 transition-all hover:border-primary/30">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-sm font-medium truncate">{item.companyName}</span>
                <div className="flex gap-1 shrink-0">
                  {(item.reasonChips || []).map((chip, i) => (
                    <Badge
                      key={i}
                      variant={item.type === 'high_red_flag' ? 'destructive' : 'secondary'}
                      className="text-[9px] px-1.5 py-0"
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
          ))}
        </div>
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
