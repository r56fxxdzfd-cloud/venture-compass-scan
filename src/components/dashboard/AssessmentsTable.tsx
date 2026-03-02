import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, ArrowRight, Inbox, ArrowUpDown } from 'lucide-react';

export interface AssessmentRow {
  id: string;
  companyName: string;
  stage: string | null;
  status: string | null;
  answeredCount: number;
  score: number | null;
  updatedAt: string;
}

interface AssessmentsTableProps {
  rows: AssessmentRow[];
  loading: boolean;
}

const stageLabels: Record<string, string> = {
  pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A',
};
const statusLabels: Record<string, string> = {
  in_progress: 'Em andamento', completed: 'Concluído',
};

const TOTAL_QUESTIONS = 45;

type SortField = 'updatedAt' | 'score' | 'progress';

export default function AssessmentsTable({ rows, loading }: AssessmentsTableProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => r.companyName.toLowerCase().includes(q));
    }
    if (stageFilter !== 'all') {
      result = result.filter(r => r.stage === stageFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'updatedAt') {
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (sortField === 'score') {
        cmp = (a.score ?? -1) - (b.score ?? -1);
      } else {
        cmp = a.answeredCount - b.answeredCount;
      }
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [rows, search, stageFilter, statusFilter, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const getScoreBadge = (score: number) => {
    if (score < 35) return 'bg-destructive text-destructive-foreground';
    if (score < 55) return 'bg-accent text-accent-foreground';
    if (score < 75) return 'bg-primary text-primary-foreground';
    return 'bg-success text-success-foreground';
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Diagnósticos</CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar startup..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue placeholder="Estágio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pre_seed">Pre-Seed</SelectItem>
              <SelectItem value="seed">Seed</SelectItem>
              <SelectItem value="series_a">Series A</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-2 w-24" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum diagnóstico encontrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Startup</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Estágio</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">
                  <button
                    onClick={() => toggleSort('progress')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Progresso <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-xs hidden sm:table-cell">
                  <button
                    onClick={() => toggleSort('score')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Score <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-xs hidden lg:table-cell">
                  <button
                    onClick={() => toggleSort('updatedAt')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Atualizado <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="text-xs w-[100px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const isCompleted = row.status === 'completed';
                const progressPct = Math.min(Math.round((row.answeredCount / TOTAL_QUESTIONS) * 100), 100);
                const href = isCompleted
                  ? `/app/assessments/${row.id}/report`
                  : `/app/assessments/${row.id}/questionnaire`;

                return (
                  <TableRow key={row.id} className="group">
                    <TableCell className="text-sm font-medium py-3">{row.companyName}</TableCell>
                    <TableCell className="hidden md:table-cell py-3">
                      {row.stage ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {stageLabels[row.stage] || row.stage}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant={isCompleted ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {statusLabels[row.status || ''] || row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={progressPct} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground w-8 text-right font-mono">
                          {row.answeredCount}/{TOTAL_QUESTIONS}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell py-3">
                      {isCompleted && row.score != null ? (
                        <Badge className={`text-xs font-bold ${getScoreBadge(row.score)}`}>
                          {row.score}/100
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell py-3">
                      <span className="text-xs text-muted-foreground">
                        {new Date(row.updatedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'short',
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 group-hover:text-primary"
                      >
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
        )}
      </CardContent>
    </Card>
  );
}
