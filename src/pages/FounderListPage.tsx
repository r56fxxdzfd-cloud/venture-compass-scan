import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Plus, UserPlus, ClipboardCheck, Users, Inbox, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCurrentSemester, getFounderStageLabel, computeFounderScore, PILLARS } from '@/utils/founder-scoring';
import type { Founder, FounderAssessment, FounderPillarScore } from '@/types/founder';
import type { Company } from '@/types/darwin';

export default function FounderListPage() {
  const { id: companyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isAnalyst } = useAuth();
  const canWrite = isAdmin || isAnalyst;

  const [company, setCompany] = useState<Company | null>(null);
  const [founders, setFounders] = useState<Founder[]>([]);
  const [assessments, setAssessments] = useState<FounderAssessment[]>([]);
  const [pillarScoresMap, setPillarScoresMap] = useState<Record<string, FounderPillarScore[]>>({});
  const [loading, setLoading] = useState(true);

  // Add founder dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [adding, setAdding] = useState(false);

  const currentSemester = getCurrentSemester();

  useEffect(() => {
    if (!companyId) return;
    loadData();
  }, [companyId]);

  const loadData = async () => {
    setLoading(true);
    const [compRes, foundersRes, assessRes] = await Promise.all([
      supabase.from('companies').select('*').eq('id', companyId!).single(),
      supabase.from('founders').select('*').eq('company_id', companyId!).eq('active', true).order('created_at'),
      supabase.from('founder_assessments').select('*').eq('company_id', companyId!).order('created_at', { ascending: false }),
    ]);

    if (compRes.data) setCompany(compRes.data as Company);
    if (foundersRes.data) setFounders(foundersRes.data as Founder[]);
    
    const assessData = (assessRes.data || []) as FounderAssessment[];
    setAssessments(assessData);

    // Load pillar scores for current semester assessments
    const currentAssessments = assessData.filter(a => a.semester === currentSemester);
    if (currentAssessments.length > 0) {
      const { data: pillars } = await supabase
        .from('founder_pillar_scores')
        .select('*')
        .in('founder_assessment_id', currentAssessments.map(a => a.id));
      
      const map: Record<string, FounderPillarScore[]> = {};
      for (const p of (pillars || []) as FounderPillarScore[]) {
        if (!map[p.founder_assessment_id]) map[p.founder_assessment_id] = [];
        map[p.founder_assessment_id].push(p);
      }
      setPillarScoresMap(map);
    }

    setLoading(false);
  };

  const handleAddFounder = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const { error } = await supabase.from('founders').insert({
      company_id: companyId!,
      name: newName.trim(),
      role: newRole.trim(),
    });
    setAdding(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setAddOpen(false);
      setNewName('');
      setNewRole('');
      toast({ title: 'Founder adicionado' });
      loadData();
    }
  };

  // Composite score
  const currentAssessments = assessments.filter(a => a.semester === currentSemester);
  const compositeScores = currentAssessments
    .map(a => a.score_used)
    .filter((s): s is number => s != null);
  const compositeScore = compositeScores.length > 0
    ? Math.round(compositeScores.reduce((a, b) => a + b, 0) / compositeScores.length * 10) / 10
    : null;

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2">{[1, 2].map(i => <Skeleton key={i} className="h-40" />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => navigate(`/app/startups/${companyId}`)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Voltar para startup</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Founders — {company?.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Founder Score · Semestre {currentSemester}</p>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus className="mr-1 h-3 w-3" /> Adicionar Founder
              </Button>
              {founders.length > 0 && (
                <Button size="sm" onClick={() => navigate(`/app/founder-assessments/new?company=${companyId}`)}>
                  <ClipboardCheck className="mr-1 h-3 w-3" /> Nova Avaliação Semestral
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Composite Score Card */}
      {compositeScore != null && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold">{compositeScore}</p>
                <p className="text-xs text-muted-foreground">Composite Score</p>
              </div>
              <div>
                <p className={`text-sm font-semibold ${getFounderStageLabel(compositeScore).color}`}>
                  {getFounderStageLabel(compositeScore).label}
                </p>
                <p className="text-xs text-muted-foreground">{currentSemester} · {compositeScores.length} founder(s) avaliado(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Founders list */}
      {founders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">Nenhum founder cadastrado ainda.</p>
            {canWrite && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus className="mr-1 h-3 w-3" /> Adicionar Founder
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {founders.map((f, i) => {
            const assessment = currentAssessments.find(a => a.founder_id === f.id);
            const stage = assessment?.score_used != null ? getFounderStageLabel(assessment.score_used) : null;

            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                  if (assessment) navigate(`/app/founder-assessments/${assessment.id}`);
                }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{f.name}</CardTitle>
                      {f.role && <Badge variant="outline" className="text-xs">{f.role}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {assessment ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">{assessment.score_used ?? '—'}</span>
                          {stage && <span className={`text-xs font-medium ${stage.color}`}>{stage.label}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{assessment.semester}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem avaliação no semestre atual</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Past assessments */}
      {assessments.filter(a => a.semester !== currentSemester).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assessments.filter(a => a.semester !== currentSemester).map(a => {
                const founder = founders.find(f => f.id === a.founder_id);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => navigate(`/app/founder-assessments/${a.id}`)}
                  >
                    <div>
                      <span className="text-sm font-medium">{founder?.name || 'Founder'}</span>
                      <span className="text-xs text-muted-foreground ml-2">{a.semester}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{a.score_used ?? '—'}</span>
                      {a.stage_label && <Badge variant="secondary" className="text-xs">{a.stage_label}</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Founder Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Founder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: João Silva" />
            </div>
            <div className="space-y-1">
              <Label>Cargo / Papel</Label>
              <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Ex: CEO, CTO, CPO" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddFounder} disabled={adding || !newName.trim()}>
              {adding ? 'Salvando…' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
