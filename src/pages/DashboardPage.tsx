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
  const [configVersion, setConfigVersion] = useState<{ name: string; publishedAt: string } | null>(null);
  const [assessmentRows, setAssessmentRows] = useState<AssessmentRow[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      // Parallel KPI counts + config + assessments
      const [companiesRes, inProgressRes, completedRes, assessmentsRes, configRes] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('assessments').select('id', { count: 'exact', head: true })
          .eq('status', 'in_progress').eq('is_simulation', false),
        supabase.from('assessments').select('id', { count: 'exact', head: true })
          .eq('status', 'completed').eq('is_simulation', false),
        supabase.from('assessments')
          .select('id, created_at, stage, status, company:companies(name)')
          .eq('is_simulation', false)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('config_versions').select('version_name, published_at')
          .eq('status', 'published').order('published_at', { ascending: false }).limit(1),
      ]);

      // High red flags: distinct companies with high-severity triggered flags
      const { data: highFlags } = await supabase
        .from('assessment_red_flags')
        .select('assessment_id')
        .eq('status', 'triggered');

      let highRedFlagCompanyCount = 0;
      if (highFlags && highFlags.length > 0) {
        const flagAssessmentIds = [...new Set(highFlags.map(f => f.assessment_id))];
        // Get the red_flag codes for these and check severity
        const { data: redFlagDetails } = await supabase
          .from('assessment_red_flags')
          .select('assessment_id, red_flag_code')
          .in('assessment_id', flagAssessmentIds)
          .eq('status', 'triggered');

        if (redFlagDetails && redFlagDetails.length > 0) {
          // Get the published config to check severity
          const pubConfigId = configRes.data?.[0]
            ? (configRes.data[0] as any).id
            : null;

          // Fetch red_flags definitions to check severity
          const { data: redFlagDefs } = await supabase
            .from('red_flags')
            .select('code, severity');

          const highSeverityCodes = new Set(
            (redFlagDefs || []).filter(rf => rf.severity === 'high').map(rf => rf.code)
          );

          const assessmentIdsWithHigh = new Set(
            redFlagDetails
              .filter(rd => highSeverityCodes.has(rd.red_flag_code))
              .map(rd => rd.assessment_id)
          );

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
      }

      setKpi({
        companies: companiesRes.count || 0,
        inProgress: inProgressRes.count || 0,
        completed: completedRes.count || 0,
        highRedFlags: highRedFlagCompanyCount,
      });

      if (configRes.data?.[0]) {
        const cv = configRes.data[0] as any;
        setConfigVersion({ name: cv.version_name, publishedAt: cv.published_at });
      }

      // Process assessment rows
      const rawAssessments = (assessmentsRes.data || []) as unknown as Array<{
        id: string; created_at: string; stage: string | null; status: string | null;
        company: { name: string } | null;
      }>;

      if (rawAssessments.length > 0) {
        const allIds = rawAssessments.map(a => a.id);

        // Fetch answer counts and scores in parallel
        const { data: answers } = await supabase
          .from('answers')
          .select('assessment_id, value, is_na')
          .in('assessment_id', allIds);

        // Fetch red flags for attention section
        const { data: assessmentFlags } = await supabase
          .from('assessment_red_flags')
          .select('assessment_id, red_flag_code')
          .in('assessment_id', allIds)
          .eq('status', 'triggered');

        const { data: redFlagDefs } = await supabase
          .from('red_flags')
          .select('code, severity, label');

        const highSeverityCodes = new Set(
          (redFlagDefs || []).filter(rf => rf.severity === 'high').map(rf => rf.code)
        );

        const answersByAssessment: Record<string, typeof answers> = {};
        (answers || []).forEach(a => {
          if (!answersByAssessment[a.assessment_id]) answersByAssessment[a.assessment_id] = [];
          answersByAssessment[a.assessment_id]!.push(a);
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
          };
        });

        setAssessmentRows(rows);

        // Attention items
        const attention: AttentionItem[] = [];

        // Low progress in-progress assessments
        rawAssessments
          .filter(a => a.status === 'in_progress')
          .forEach(a => {
            const answered = (answersByAssessment[a.id] || []).length;
            const pct = Math.round((answered / 45) * 100);
            if (pct < 50) {
              attention.push({
                id: a.id,
                companyName: a.company?.name || 'Startup',
                type: 'low_progress',
                detail: `Progresso: ${answered}/45 (${pct}%)`,
                href: `/app/assessments/${a.id}/questionnaire`,
                ctaLabel: 'Continuar',
                progress: pct,
              });
            }
          });

        // High red flags
        const flagsByAssessment: Record<string, string[]> = {};
        (assessmentFlags || []).forEach(f => {
          if (highSeverityCodes.has(f.red_flag_code)) {
            if (!flagsByAssessment[f.assessment_id]) flagsByAssessment[f.assessment_id] = [];
            flagsByAssessment[f.assessment_id].push(f.red_flag_code);
          }
        });

        const redFlagLabelMap = Object.fromEntries(
          (redFlagDefs || []).map(rf => [rf.code, rf.label])
        );

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
          });
        });

        setAttentionItems(attention);
      }

      setLoading(false);
    };

    fetchAll();
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHeader configVersion={configVersion} />
      <KpiCards data={kpi} loading={loading} />
      <AttentionSection items={attentionItems} loading={loading} />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <AssessmentsTable rows={assessmentRows} loading={loading} />
        <div className="hidden lg:block">
          <QuickActionsPanel />
        </div>
      </div>
      {/* Mobile quick actions */}
      <div className="lg:hidden">
        <QuickActionsPanel />
      </div>
    </div>
  );
}
