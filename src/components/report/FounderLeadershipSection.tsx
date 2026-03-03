import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Users, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentSemester, getFounderStageLabel, computePillarScoreUsed, computePriorityScore, PILLARS } from '@/utils/founder-scoring';
import type { Founder, FounderAssessment, FounderPillarScore } from '@/types/founder';

interface Props {
  companyId: string;
}

export function FounderLeadershipSection({ companyId }: Props) {
  const [founders, setFounders] = useState<Founder[]>([]);
  const [assessments, setAssessments] = useState<FounderAssessment[]>([]);
  const [pillarScoresMap, setPillarScoresMap] = useState<Record<string, FounderPillarScore[]>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const semester = getCurrentSemester();
      const [fRes, aRes] = await Promise.all([
        supabase.from('founders').select('*').eq('company_id', companyId).eq('active', true),
        supabase.from('founder_assessments').select('*').eq('company_id', companyId).eq('semester', semester),
      ]);
      const fList = (fRes.data || []) as Founder[];
      const aList = (aRes.data || []) as FounderAssessment[];
      setFounders(fList);
      setAssessments(aList);

      if (aList.length > 0) {
        const { data: pillars } = await supabase
          .from('founder_pillar_scores')
          .select('*')
          .in('founder_assessment_id', aList.map(a => a.id));
        const map: Record<string, FounderPillarScore[]> = {};
        for (const p of (pillars || []) as FounderPillarScore[]) {
          if (!map[p.founder_assessment_id]) map[p.founder_assessment_id] = [];
          map[p.founder_assessment_id].push(p);
        }
        setPillarScoresMap(map);
      }
      setLoaded(true);
    };
    load();
  }, [companyId]);

  if (!loaded || founders.length === 0 || assessments.length === 0) return null;

  const scores = assessments.map(a => a.score_used).filter((s): s is number => s != null);
  if (scores.length === 0) return null;

  const compositeScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
  const compositeStage = getFounderStageLabel(compositeScore);
  const semester = getCurrentSemester();

  // Collect red flags
  const redFlags: { label: string; severity: string }[] = [];
  if (compositeScore < 50) {
    redFlags.push({ label: 'Risco estrutural de liderança no time fundador', severity: 'high' });
  }
  for (const a of assessments) {
    if (a.score_used != null && a.score_used < 50) {
      const f = founders.find(fo => fo.id === a.founder_id);
      redFlags.push({ label: `Risco estrutural: ${f?.name || 'Founder'} com score ${a.score_used.toFixed(1)}`, severity: 'high' });
    }
    // Check deltas
    const pillars = pillarScoresMap[a.id] || [];
    for (const p of pillars) {
      if (p.score_auto != null && p.score_jv != null) {
        const delta = p.score_jv - p.score_auto;
        if (delta < -1.5) {
          const f = founders.find(fo => fo.id === a.founder_id);
          redFlags.push({ label: `Desalinhamento de percepção: ${f?.name || 'Founder'} superestima ${p.pillar_name}`, severity: 'medium' });
        }
      }
    }
  }

  // Top 2 pillar focus from lowest-scoring founder
  const lowestAssessment = assessments.reduce((min, a) => (!min || (a.score_used ?? 100) < (min.score_used ?? 100) ? a : min), assessments[0]);
  const lowestPillars = pillarScoresMap[lowestAssessment.id] || [];
  const focusPillars = lowestPillars
    .filter(p => p.pillar_number >= 1)
    .map(p => {
      const used = computePillarScoreUsed(p.score_auto, p.score_jv);
      const pillar = PILLARS.find(pi => pi.number === p.pillar_number);
      return { number: p.pillar_number, name: p.pillar_name, priority: used != null && pillar ? computePriorityScore(used, pillar.weight) : 0 };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Força da Liderança
        </h3>

        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold">{compositeScore}</p>
            <p className="text-xs text-muted-foreground">Composite Score</p>
          </div>
          <Separator orientation="vertical" className="h-10" />
          <div>
            <p className={`text-sm font-semibold ${compositeStage.color}`}>{compositeStage.label}</p>
            <p className="text-xs text-muted-foreground">{semester} · {scores.length} founder(s)</p>
          </div>
        </div>

        {/* Individual scores table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2">Founder</th>
                <th className="text-left py-2">Cargo</th>
                <th className="text-center py-2">Score</th>
                <th className="text-left py-2">Classificação</th>
              </tr>
            </thead>
            <tbody>
              {founders.map(f => {
                const fa = assessments.find(a => a.founder_id === f.id);
                const stage = fa?.score_used != null ? getFounderStageLabel(fa.score_used) : null;
                return (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{f.name}</td>
                    <td className="py-2 text-muted-foreground">{f.role}</td>
                    <td className="py-2 text-center font-mono font-bold">{fa?.score_used?.toFixed(1) ?? '—'}</td>
                    <td className="py-2">
                      {stage && <Badge variant="outline" className={`text-xs ${stage.color}`}>{stage.label}</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Focus pillars */}
        {focusPillars.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Pilares foco do semestre</p>
            <div className="flex gap-2">
              {focusPillars.map((p, i) => (
                <Badge key={p.number} variant={i === 0 ? 'default' : 'secondary'}>
                  Foco {i + 1}: {p.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Red flags */}
        {redFlags.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-destructive" /> Red Flags de Liderança
            </p>
            {redFlags.map((rf, i) => (
              <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-destructive/5 border border-destructive/15">
                <Badge variant={rf.severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {rf.severity === 'high' ? 'Alto' : 'Médio'}
                </Badge>
                <span>{rf.label}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground italic">
          Avaliação semestral de {semester}. PDF detalhado disponível separadamente.
        </p>
      </CardContent>
    </Card>
  );
}
