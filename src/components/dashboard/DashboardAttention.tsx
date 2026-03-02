import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, ClipboardList } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export interface AttentionItem {
  id: string;
  type: 'low_progress' | 'high_red_flag';
  companyName: string;
  detail: string;
  href: string;
  ctaLabel: string;
  progress?: number;
}

export default function DashboardAttention({ items, loading }: { items: AttentionItem[]; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Requer atenção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Requer atenção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum item requer atenção no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Requer atenção
            <Badge variant="secondary" className="text-[10px] ml-1">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.slice(0, 6).map(item => (
            <Link
              key={item.id}
              to={item.href}
              className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/50 group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-7 w-7 items-center justify-center rounded shrink-0 bg-muted text-muted-foreground">
                  {item.type === 'high_red_flag' ? <AlertTriangle className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.companyName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-muted-foreground truncate">{item.detail}</p>
                    {item.progress != null && (
                      <Progress value={item.progress} className="h-1 w-16 shrink-0" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-[11px] text-muted-foreground hidden sm:inline group-hover:text-primary transition-colors">
                  {item.ctaLabel}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
