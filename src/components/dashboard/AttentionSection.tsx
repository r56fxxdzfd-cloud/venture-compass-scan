import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ClipboardList, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export interface AttentionItem {
  id: string;
  companyName: string;
  type: 'low_progress' | 'high_red_flag';
  detail: string;
  href: string;
  ctaLabel: string;
  progress?: number;
}

interface AttentionSectionProps {
  items: AttentionItem[];
  loading: boolean;
}

export default function AttentionSection({ items, loading }: AttentionSectionProps) {
  if (loading || items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Requer atenção
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((item) => (
            <Link key={item.id} to={item.href} className="block">
              <div className="rounded-lg border p-3 transition-all hover:shadow-sm hover:border-primary/30 group">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{item.companyName}</span>
                  </div>
                  <Badge
                    variant={item.type === 'high_red_flag' ? 'destructive' : 'secondary'}
                    className="text-[10px] shrink-0"
                  >
                    {item.type === 'high_red_flag' ? 'Red Flag' : 'Baixo progresso'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{item.detail}</p>
                {item.progress !== undefined && (
                  <Progress value={item.progress} className="h-1.5 mb-2" />
                )}
                <span className="text-xs text-primary font-medium inline-flex items-center gap-1 group-hover:underline">
                  {item.ctaLabel} <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
