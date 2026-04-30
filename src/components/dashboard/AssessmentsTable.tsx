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

export interface AssessmentRow { id: string; companyName: string; stage: string | null; status: string | null; answeredCount: number; score: number | null; updatedAt: string; hasHighRedFlags?: boolean; }
interface AssessmentsTableProps { rows: AssessmentRow[]; loading: boolean; }
const stageLabels: Record<string, string> = { pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A' };
const statusLabels: Record<string, string> = { in_progress: 'Em andamento', completed: 'Concluído' };
const TOTAL_QUESTIONS = 45;
function scoreLabel(score: number): string { if (score < 35) return 'Inicial'; if (score < 55) return 'Em evolução'; if (score < 75) return 'Estruturado'; return 'Avançado'; }
type SortField = 'updatedAt' | 'score' | 'progress';

export default function AssessmentsTable({ rows, loading }: AssessmentsTableProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let result = rows;
    if (search) result = result.filter(r => r.companyName.toLowerCase().includes(search.toLowerCase()));
    if (stageFilter !== 'all') result = result.filter(r => r.stage === stageFilter);
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'updatedAt') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      else if (sortField === 'score') cmp = (a.score ?? -1) - (b.score ?? -1);
      else cmp = a.answeredCount - b.answeredCount;
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [rows, search, stageFilter, statusFilter, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const getScoreBadge = (score: number) => {
    if (score < 35) return 'bg-destructive/15 text-destructive border-destructive/20';
    if (score < 55) return 'bg-accent/15 text-accent-foreground border-accent/20';
    if (score < 75) return 'bg-primary/15 text-primary border-primary/20';
    return 'bg-success/15 text-success border-success/20';
  };

  const getNextAction = (row: AssessmentRow): { label: string; href: string } => {
    if (row.status === 'completed' && row.hasHighRedFlags) return { label: 'Ver alertas', href: `/app/assessments/${row.id}/report` };
    if (row.status === 'completed') return { label: 'Relatório', href: `/app/assessments/${row.id}/report` };
    return { label: 'Continuar', href: `/app/assessments/${row.id}/questionnaire` };
  };

  return (
    <Card className="executive-panel flex flex-col h-full">
      <CardHeader className="pb-3 pt-5 px-5 border-b border-border/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="executive-section-title text-base">Portfólio de Diagnósticos</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Acompanhe progresso, risco e maturidade por organização.</p>
          </div>
          <Badge variant="outline" className="executive-pill">{filtered.length} registros</Badge>
        </div>
        <div className="grid gap-2.5 mt-4 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar organização..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-background/70" />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full md:w-[150px] h-9 text-xs"><SelectValue placeholder="Estágio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Estágio: Todos</SelectItem><SelectItem value="pre_seed">Pre-Seed</SelectItem><SelectItem value="seed">Seed</SelectItem><SelectItem value="series_a">Series A</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[150px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: Todos</SelectItem><SelectItem value="in_progress">Em andamento</SelectItem><SelectItem value="completed">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        {loading ? <div className="p-5 space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-20" /><Skeleton className="h-2 w-24" /></div>)}</div> : filtered.length === 0 ? <div className="text-center py-14 px-4"><Inbox className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" /><p className="text-sm text-muted-foreground">Nenhum diagnóstico encontrado.</p></div> : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px]">Organização</TableHead>
                <TableHead className="text-[11px] hidden md:table-cell">Estágio</TableHead>
                <TableHead className="text-[11px]">Status</TableHead>
                <TableHead className="text-[11px]"><button onClick={() => toggleSort('progress')} className="inline-flex items-center gap-1 hover:text-foreground">Cobertura <ArrowUpDown className="h-3 w-3" /></button></TableHead>
                <TableHead className="text-[11px] hidden sm:table-cell"><button onClick={() => toggleSort('score')} className="inline-flex items-center gap-1 hover:text-foreground">Maturidade <ArrowUpDown className="h-3 w-3" /></button></TableHead>
                <TableHead className="text-[11px] hidden lg:table-cell"><button onClick={() => toggleSort('updatedAt')} className="inline-flex items-center gap-1 hover:text-foreground">Atualização <ArrowUpDown className="h-3 w-3" /></button></TableHead>
                <TableHead className="text-[11px] w-[122px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const progressPct = Math.min(Math.round((row.answeredCount / TOTAL_QUESTIONS) * 100), 100);
                const action = getNextAction(row);
                return (
                  <TableRow key={row.id} className="group hover:bg-muted/25">
                    <TableCell className="py-3"><p className="text-sm font-semibold leading-tight">{row.companyName}</p></TableCell>
                    <TableCell className="hidden md:table-cell py-3">{row.stage ? <Badge variant="outline" className="text-[10px] font-normal">{stageLabels[row.stage] || row.stage}</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="py-3"><Badge variant={row.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">{statusLabels[row.status || ''] || row.status}</Badge></TableCell>
                    <TableCell className="py-3"><div className="flex items-center gap-2 min-w-[110px]"><Progress value={progressPct} className="h-1.5 flex-1" /><span className="text-[10px] text-muted-foreground w-9 text-right font-mono">{row.answeredCount}/{TOTAL_QUESTIONS}</span></div></TableCell>
                    <TableCell className="hidden sm:table-cell py-3">{row.status === 'completed' && row.score != null ? <Badge variant="outline" className={`text-[10px] font-medium ${getScoreBadge(row.score)}`}>{row.score}/100 · {scoreLabel(row.score)}</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="hidden lg:table-cell py-3"><span className="text-[10px] text-muted-foreground">{new Date(row.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span></TableCell>
                    <TableCell className="py-3"><Button asChild variant="outline" size="sm" className="h-7 text-[11px] gap-1 border-border/70"><Link to={action.href}>{action.label}<ArrowRight className="h-3 w-3" /></Link></Button></TableCell>
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
