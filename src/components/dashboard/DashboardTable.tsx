import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Search, Inbox } from 'lucide-react';

export interface AssessmentRow {
  id: string;
  companyName: string;
  stage: string | null;
  status: string | null;
  answered: number;
  score: number | null;
  updatedAt: string;
}

const stageLabels: Record<string, string> = { pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A' };
const statusLabels: Record<string, string> = { in_progress: 'Em andamento', completed: 'Concluído' };

function getScoreBadge(_score: number) {
  return 'bg-muted text-foreground border-border';
}

export default function DashboardTable({ rows, loading }: { rows: AssessmentRow[]; loading: boolean }) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const totalQuestions = 45;

  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => r.companyName.toLowerCase().includes(q));
    }
    if (stageFilter !== 'all') result = result.filter(r => r.stage === stageFilter);
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    return result;
  }, [rows, search, stageFilter, statusFilter]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm font-semibold">Diagnósticos</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar startup..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 w-[180px] pl-8 text-xs"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Estágio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos estágios</SelectItem>
                <SelectItem value="pre_seed">Pre-Seed</SelectItem>
                <SelectItem value="seed">Seed</SelectItem>
                <SelectItem value="series_a">Series A</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 px-4">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {rows.length === 0 ? 'Nenhum diagnóstico criado ainda.' : 'Nenhum resultado para os filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Startup</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Estágio</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Progresso</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Score</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Atualizado</TableHead>
                  <TableHead className="text-xs w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(row => {
                  const isCompleted = row.status === 'completed';
                  const progressPct = Math.min(Math.round((row.answered / totalQuestions) * 100), 100);
                  const href = isCompleted
                    ? `/app/assessments/${row.id}/report`
                    : `/app/assessments/${row.id}/questionnaire`;

                  return (
                    <TableRow key={row.id} className="group cursor-pointer" onClick={() => window.location.href = href}>
                      <TableCell className="font-medium text-sm py-3">{row.companyName}</TableCell>
                      <TableCell className="hidden sm:table-cell py-3">
                        {row.stage && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {stageLabels[row.stage] || row.stage}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {statusLabels[row.status || ''] || row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-3">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={progressPct} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground w-8 text-right font-mono">{row.answered}/{totalQuestions}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-3">
                        {isCompleted && row.score != null ? (
                          <Badge variant="outline" className={`text-xs font-bold ${getScoreBadge(row.score)}`}>
                            {row.score}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-3 text-xs text-muted-foreground">
                        {new Date(row.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </TableCell>
                      <TableCell className="py-3">
                        <Button variant="ghost" size="sm" asChild className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to={href}>
                            {isCompleted ? 'Relatório' : 'Continuar'}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
