import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import KpiCards, { KpiData } from '@/components/dashboard/KpiCards';
import AttentionSection, { AttentionItem } from '@/components/dashboard/AttentionSection';
import AssessmentsTable, { AssessmentRow } from '@/components/dashboard/AssessmentsTable';
import QuickActionsPanel from '@/components/dashboard/QuickActionsPanel';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KpiData>({ companies: 0, inProgress: 0, completed: 0, highRedFlags: 0 });
  const [configVersion, setConfigVersion] = useState<{ name: string; publishedAt: string; id?: string } | null>(null);
  const [assessmentRows, setAssessmentRows] = useState<AssessmentRow[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [companiesRes, inProgressRes, completedRes, assessmentsRes, configRes,
             newCompanies7d, newInProgress7d, newCompleted7d] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('assessments').select('id', { count: 'exact', head: true })
          .eq('status', 'in_progress').eq('is_simulation', false),
        supabase.from('assessments').select('id', { count: 'exact', head: true })
          .eq('status', 'completed').eq('is_simulation', false),
        supabase.from('assessments')
          .select('id, created_at, stage, status, company:companies(name), company_id')
          .eq('is_simulation', false)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('config_versions').select('id, version_name, published_at')
          .eq('status', 'published').order('published_at', { ascending: false }).limit(1),
        // 7-day deltas
        supabase.from('companies').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
        supabase.from('assessments').select('id', { count: 'exact', head: true })
          .eq('status', 'in_progress').eq('is_simulation', false).gte('created_at', sevenDaysAgo),
        supabase.from('assessments').select('id', { count: 'exact', head: true })
          .eq('status', 'completed').eq('is_simulation', false).gte('created_at', sevenDaysAgo),
      ]);

      // High red flags count
      let highRedFlagCompanyCount = 0;
      const highFlagAssessmentIds = new Set<string>();

      const { data: highFlags } = await supabase
        .from('assessment_red_flags')
        .select('assessment_id')
        .eq('status', 'triggered');

      if (highFlags && highFlags.length > 0) {
        const flagAssessmentIds = [...new Set(highFlags.map(f => f.assessment_id))];
        const { data: redFlagDetails } = await supabase
          .from('assessment_red_flags')
          .select('assessment_id, red_flag_code')
          .in('assessment_id', flagAssessmentIds)
          .eq('status', 'triggered');

        const { data: redFlagDefs } = await supabase
          .from('red_flags')
          .select('code, severity');

        const highSeverityCodes = new Set(
          (redFlagDefs || []).filter(rf => rf.severity === 'high').map(rf => rf.code)
        );

        const assessmentIdsWithHigh = new Set(
          (redFlagDetails || [])
            .filter(rd => highSeverityCodes.has(rd.red_flag_code))
            .map(rd => rd.assessment_id)
        );

        assessmentIdsWithHigh.forEach(id => highFlagAssessmentIds.add(id));

        if (assessmentIdsWithHigh.size > 0) {
          const { data: assWithCompany } = await supabase
            .from('assessments')
            .select('id, company_id')
            .in('id', [...assessmentIdsWithHigh])
            .eq('is_simulation', false);
          const uniqueCompanies = new Set((assWithCompany || []).map(a => a.company_id));
          highRedFlagCompanyCount = uniqueCompanies.size;
        }
      }

      setKpi({
        companies: companiesRes.count || 0,
        inProgress: inProgressRes.count || 0,
        completed: completedRes.count || 0,
        highRedFlags: highRedFlagCompanyCount,
        delta7d: {
          companies: newCompanies7d.count || 0,
          inProgress: newInProgress7d.count || 0,
          completed: newCompleted7d.count || 0,
        },
      });

      if (configRes.data?.[0]) {
        const cv = configRes.data[0] as any;
        setConfigVersion({ name: cv.version_name, publishedAt: cv.published_at, id: cv.id });
      }

      // Process assessment rows
      const rawAssessments = (assessmentsRes.data || []) as unknown as Array<{
        id: string; created_at: string; stage: string | null; status: string | null;
        company: { name: string } | null; company_id: string;
      }>;

      if (rawAssessments.length > 0) {
        const allIds = rawAssessments.map(a => a.id);

        const [{ data: answers }, { data: assessmentFlags }, { data: redFlagDefs }] = await Promise.all([
          supabase.from('answers').select('assessment_id, value, is_na').in('assessment_id', allIds),
          supabase.from('assessment_red_flags').select('assessment_id, red_flag_code')
            .in('assessment_id', allIds).eq('status', 'triggered'),
          supabase.from('red_flags').select('code, severity, label'),
        ]);

        const highSeverityCodes = new Set(
          (redFlagDefs || []).filter(rf => rf.severity === 'high').map(rf => rf.code)
        );

        const answersByAssessment: Record<string, typeof answers> = {};
        (answers || []).forEach(a => {
          if (!answersByAssessment[a.assessment_id]) answersByAssessment[a.assessment_id] = [];
          answersByAssessment[a.assessment_id]!.push(a);
        });

        // Check which assessments have high red flags
        const flagsByAssessment: Record<string, string[]> = {};
        (assessmentFlags || []).forEach(f => {
          if (highSeverityCodes.has(f.red_flag_code)) {
            if (!flagsByAssessment[f.assessment_id]) flagsByAssessment[f.assessment_id] = [];
            flagsByAssessment[f.assessment_id].push(f.red_flag_code);
          }
        });

        const rows: AssessmentRow[] = rawAssessments.map(a => {
          const aAnswers = answersByAssessment[a.id] || [];
          const answeredCount = aAnswers.length;
          let score: number | null = null;
          if (a.status === 'completed') {
            const scored = aAnswers.filter(ans => !ans.is_na && ans.value != null);
            if (scored.length > 0) {
              const avg = scored.reduce((s, ans) => s + (ans.value || 0), 0) / scored.length;
              score = Math.round((avg / 5) * 100);
            }
          }
          return {
            id: a.id,
            companyName: a.company?.name || 'Startup',
            stage: a.stage,
            status: a.status,
            answeredCount,
            score,
            updatedAt: a.created_at,
            hasHighRedFlags: !!flagsByAssessment[a.id],
          };
        });

        setAssessmentRows(rows);

        // Attention items (priority ordered)
        const attention: AttentionItem[] = [];
        const redFlagLabelMap = Object.fromEntries(
          (redFlagDefs || []).map(rf => [rf.code, rf.label])
        );

        // 1) High red flags first
        Object.entries(flagsByAssessment).forEach(([assessmentId, codes]) => {
          const a = rawAssessments.find(r => r.id === assessmentId);
          if (!a) return;
          attention.push({
            id: `rf-${assessmentId}`,
            companyName: a.company?.name || 'Startup',
            type: 'high_red_flag',
            detail: codes.map(c => redFlagLabelMap[c] || c).join(', '),
            href: a.status === 'completed'
              ? `/app/assessments/${assessmentId}/report`
              : `/app/assessments/${assessmentId}/questionnaire`,
            ctaLabel: a.status === 'completed' ? 'Ver relatório' : 'Ver alertas',
            reasonChips: codes.map(c => `Red flag: ${(redFlagLabelMap[c] || c).substring(0, 20)}`),
            nextStep: 'Avaliar riscos críticos e definir plano de mitigação.',
          });
        });

        // 2) Low progress
        rawAssessments
          .filter(a => a.status === 'in_progress')
          .forEach(a => {
            const answered = (answersByAssessment[a.id] || []).length;
            const pct = Math.round((answered / 45) * 100);
            if (pct < 50) {
              const chips: string[] = [];
              if (answered === 0) chips.push('Cobertura 0%');
              else chips.push('Baixa completude');

              attention.push({
                id: a.id,
                companyName: a.company?.name || 'Startup',
                type: 'low_progress',
                detail: `Progresso: ${answered}/45 (${pct}%)`,
                href: `/app/assessments/${a.id}/questionnaire`,
                ctaLabel: 'Continuar diagnóstico',
                progress: pct,
                reasonChips: chips,
                nextStep: answered === 0
                  ? 'Iniciar o preenchimento do questionário.'
                  : `Responder pelo menos ${Math.max(10, 23 - answered)} perguntas para liberar análise inicial.`,
              });
            }
          });

        setAttentionItems(attention);
      }

      setLoading(false);
    };

    fetchAll();
  }, []);

  return (
    <div className="space-y-4">
      <DashboardHeader configVersion={configVersion} />
      <KpiCards data={kpi} loading={loading} />
      <AttentionSection items={attentionItems} loading={loading} />
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <AssessmentsTable rows={assessmentRows} loading={loading} />
        <div className="hidden lg:block">
          <QuickActionsPanel />
        </div>
      </div>
      <div className="lg:hidden">
        <QuickActionsPanel />
      </div>
    </div>
  );
}
