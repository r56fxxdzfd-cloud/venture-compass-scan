import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Settings } from 'lucide-react';

import DashboardKPICards from '@/components/dashboard/DashboardKPICards';
import DashboardAttention, { type AttentionItem } from '@/components/dashboard/DashboardAttention';
import DashboardTable, { type AssessmentRow } from '@/components/dashboard/DashboardTable';
import DashboardQuickActions from '@/components/dashboard/DashboardQuickActions';

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({ companies: 0, inProgress: 0, completed: 0, highRedFlagCompanies: 0 });
  const [tableRows, setTableRows] = useState<AssessmentRow[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [configVersion, setConfigVersion] = useState<{ name: string; publishedAt: string } | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [
      companiesRes,
      inProgressRes,
      completedRes,
      assessmentsRes,
      configRes,
      redFlagsRes,
    ] = await Promise.all([
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('status', 'in_progress').eq('is_simulation', false),
      supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('status', 'completed').eq('is_simulation', false),
      supabase.from('assessments').select('id, created_at, stage, status, company:companies(name)').eq('is_simulation', false).order('created_at', { ascending: false }).limit(50),
      supabase.from('config_versions').select('version_name, published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(1),
      supabase.from('assessment_red_flags').select('assessment_id, red_flag_code, status'),
    ]);

    // Config version
    if (configRes.data && configRes.data.length > 0) {
      setConfigVersion({
        name: (configRes.data[0] as any).version_name,
        publishedAt: (configRes.data[0] as any).published_at,
      });
    }

    // High red flag companies: get red_flag codes with severity=high from red_flags table
    // Then count distinct companies from assessment_red_flags matching those codes
    let highRFCompanies = 0;
    if (redFlagsRes.data && assessmentsRes.data) {
      // Get high severity codes
      const { data: rfDefs } = await supabase.from('red_flags').select('code, severity');
      const highCodes = new Set((rfDefs || []).filter((r: any) => r.severity === 'high').map((r: any) => r.code));

      // Map assessment_id -> company_id from assessmentsRes
      const assessmentCompanyMap = new Map<string, string>();
      for (const a of assessmentsRes.data as any[]) {
        assessmentCompanyMap.set(a.id, a.company?.name || '');
      }

      const companiesWithHighRF = new Set<string>();
      for (const rf of redFlagsRes.data as any[]) {
        if (rf.status === 'triggered' && highCodes.has(rf.red_flag_code)) {
          const companyName = assessmentCompanyMap.get(rf.assessment_id);
          if (companyName) companiesWithHighRF.add(companyName);
        }
      }
      highRFCompanies = companiesWithHighRF.size;
    }

    setKpi({
      companies: companiesRes.count || 0,
      inProgress: inProgressRes.count || 0,
      completed: completedRes.count || 0,
      highRedFlagCompanies: highRFCompanies,
    });

    // Build table rows + attention items
    if (assessmentsRes.data) {
      const assessmentIds = (assessmentsRes.data as any[]).map(a => a.id);

      // Fetch answer counts per assessment
      const { data: answers } = await supabase
        .from('answers')
        .select('assessment_id, value, is_na')
        .in('assessment_id', assessmentIds);

      const answerCountMap = new Map<string, number>();
      const scoreMap = new Map<string, number>();

      if (answers) {
        for (const a of assessmentIds) {
          const aAnswers = answers.filter((ans: any) => ans.assessment_id === a);
          answerCountMap.set(a, aAnswers.length);

          // Calculate score for completed
          const scored = aAnswers.filter((ans: any) => !ans.is_na && ans.value != null);
          if (scored.length > 0) {
            const avg = scored.reduce((s: number, ans: any) => s + (ans.value || 0), 0) / scored.length;
            scoreMap.set(a, Math.round((avg / 5) * 100));
          }
        }
      }

      // Red flags per assessment
      const rfByAssessment = new Map<string, string[]>();
      if (redFlagsRes.data) {
        const { data: rfDefs } = await supabase.from('red_flags').select('code, severity');
        const highCodes = new Set((rfDefs || []).filter((r: any) => r.severity === 'high').map((r: any) => r.code));

        for (const rf of redFlagsRes.data as any[]) {
          if (rf.status === 'triggered' && highCodes.has(rf.red_flag_code)) {
            if (!rfByAssessment.has(rf.assessment_id)) rfByAssessment.set(rf.assessment_id, []);
            rfByAssessment.get(rf.assessment_id)!.push(rf.red_flag_code);
          }
        }
      }

      const rows: AssessmentRow[] = [];
      const attention: AttentionItem[] = [];
      const totalQ = 45;

      for (const a of assessmentsRes.data as any[]) {
        const answered = answerCountMap.get(a.id) || 0;
        const score = a.status === 'completed' ? (scoreMap.get(a.id) ?? null) : null;

        rows.push({
          id: a.id,
          companyName: a.company?.name || 'Startup',
          stage: a.stage,
          status: a.status,
          answered,
          score,
          updatedAt: a.created_at,
        });

        // Attention: low progress (< 50% and in_progress)
        if (a.status === 'in_progress') {
          const pct = Math.round((answered / totalQ) * 100);
          if (pct < 50) {
            attention.push({
              id: `prog-${a.id}`,
              type: 'low_progress',
              companyName: a.company?.name || 'Startup',
              detail: `Progresso: ${answered}/${totalQ}`,
              href: `/app/assessments/${a.id}/questionnaire`,
              ctaLabel: 'Continuar',
              progress: pct,
            });
          }
        }

        // Attention: high red flags
        const flags = rfByAssessment.get(a.id);
        if (flags && flags.length > 0) {
          attention.push({
            id: `rf-${a.id}`,
            type: 'high_red_flag',
            companyName: a.company?.name || 'Startup',
            detail: `${flags.length} red flag${flags.length > 1 ? 's' : ''} de alta severidade`,
            href: a.status === 'completed' ? `/app/assessments/${a.id}/report` : `/app/assessments/${a.id}/questionnaire`,
            ctaLabel: a.status === 'completed' ? 'Ver relatório' : 'Ver alertas',
          });
        }
      }

      setTableRows(rows);
      setAttentionItems(attention);
    }

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">CMJ/Darwin Startup Readiness</h1>
          <p className="text-sm text-muted-foreground">Visão geral do programa</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {configVersion && (
            <Link to="/app/admin/config">
              <Badge variant="outline" className="text-[10px] gap-1.5 px-2.5 py-1 cursor-pointer hover:bg-muted transition-colors font-normal">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                {configVersion.name}
              </Badge>
            </Link>
          )}
          <Button onClick={() => navigate('/app/startups')} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Novo Diagnóstico
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <DashboardKPICards data={kpi} loading={loading} />

      {/* Attention + Table + Quick Actions */}
      {attentionItems.length > 0 && (
        <DashboardAttention items={attentionItems} loading={loading} />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <DashboardTable rows={tableRows} loading={loading} />
        <div className="space-y-4">
          <DashboardQuickActions isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}
