import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import KpiCards, { KpiData } from '@/components/dashboard/KpiCards';
import AttentionSection, { AttentionItem } from '@/components/dashboard/AttentionSection';
import AssessmentsTable, { AssessmentRow } from '@/components/dashboard/AssessmentsTable';
import QuickActionsPanel from '@/components/dashboard/QuickActionsPanel';
import { Building2, CalendarRange, Users, FileText, FileStack } from 'lucide-react';
import { BackToTopFooter } from '@/components/BackToTopFooter';


const executiveShortcuts = [
  { label: 'Organizações', description: 'Acompanhar portfólio e diagnósticos', href: '/app/startups', icon: Building2 },
  { label: 'Agenda de Evolução', description: 'Planejar ritos de acompanhamento', href: '/app/agenda', icon: CalendarRange },
  { label: 'Central do Conselheiro', description: 'Acessar materiais e registros de apoio', href: '/app/startups', icon: Users },
  { label: 'Relatório de Progresso', description: 'Ler evolução e próximos focos', href: '/app/startups', icon: FileText },
  { label: 'Templates de Pauta', description: 'Estruturar encontros executivos', href: '/app/agenda/templates', icon: FileStack },
];

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

        // ── Founder alerts ──
        const founderAttention: AttentionItem[] = [];

        const now = new Date();
        const currentSemester = `${now.getFullYear()}-S${now.getMonth() < 6 ? 1 : 2}`;
        const prevSemesterYear = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
        const prevSemesterNum = now.getMonth() < 6 ? 2 : 1;
        const prevSemester = `${prevSemesterYear}-S${prevSemesterNum}`;

        const [{ data: founders }, { data: founderAssessments }] = await Promise.all([
          supabase.from('founders').select('id, name, company_id, active, company:companies(name)').eq('active', true),
          supabase.from('founder_assessments').select('id, founder_id, company_id, semester, score_used, company:companies(name)'),
        ]);

        const foundersArr = (founders || []) as unknown as Array<{
          id: string; name: string; company_id: string; active: boolean; company: { name: string } | null;
        }>;
        const assessmentsArr = (founderAssessments || []) as unknown as Array<{
          id: string; founder_id: string; company_id: string; semester: string; score_used: number | null; company: { name: string } | null;
        }>;

        const cutoff180 = new Date(Date.now() - 180 * 86400000);

        for (const f of foundersArr) {
          const fAssessments = assessmentsArr.filter(a => a.founder_id === f.id);
          const currentAss = fAssessments.find(a => a.semester === currentSemester);
          const prevAss = fAssessments.find(a => a.semester === prevSemester);
          const companyName = f.company?.name || 'Startup';

          // Rule 1: score < 50
          if (currentAss && currentAss.score_used != null && currentAss.score_used < 50) {
            founderAttention.push({
              id: `fr-${currentAss.id}`,
              companyName: 'Risco estrutural de liderança',
              type: 'founder_risk',
              detail: `${f.name} · ${companyName}`,
              href: `/app/founder-assessments/${currentAss.id}`,
              ctaLabel: 'Ver avaliação',
              reasonChips: ['Risco estrutural'],
              nextStep: `Score ${currentAss.score_used} — avaliar plano de ação imediato.`,
              category: 'founder',
            });
          }

          // Rule 3: regression > 10 points
          if (currentAss && prevAss && currentAss.score_used != null && prevAss.score_used != null) {
            if (prevAss.score_used - currentAss.score_used > 10) {
              founderAttention.push({
                id: `freg-${currentAss.id}`,
                companyName: 'Regressão no Founder Score',
                type: 'founder_regression',
                detail: `${f.name} · ${companyName} · ${prevAss.score_used} → ${currentAss.score_used}`,
                href: `/app/founder-assessments/${currentAss.id}`,
                ctaLabel: 'Ver avaliação',
                reasonChips: ['Regressão'],
                nextStep: `Queda de ${Math.round(prevAss.score_used - currentAss.score_used)} pontos vs semestre anterior.`,
                category: 'founder',
              });
            }
          }

          // Rule 2: no assessment in last 180 days
          if (!currentAss) {
            const lastAss = fAssessments.sort((a, b) => b.semester.localeCompare(a.semester))[0];
            const lastSemLabel = lastAss ? lastAss.semester : 'Nunca avaliado';
            founderAttention.push({
              id: `fout-${f.id}`,
              companyName: 'Founder Score desatualizado',
              type: 'founder_outdated',
              detail: `${f.name} · ${companyName} · Última avaliação: ${lastSemLabel}`,
              href: `/app/startups/${f.company_id}/founders`,
              ctaLabel: 'Avaliar founder',
              reasonChips: ['Desatualizado'],
              nextStep: 'Registrar avaliação semestral do founder.',
              category: 'founder',
            });
          }
        }

        setAttentionItems([...attention, ...founderAttention]);
      }

      setLoading(false);
    };

    fetchAll();
  }, []);

  return (
    <div className="space-y-5 lg:space-y-6">
      <DashboardHeader configVersion={configVersion} />

      <section className="executive-panel rounded-2xl p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {executiveShortcuts.map((shortcut) => (
            <Link key={shortcut.label} to={shortcut.href} className="executive-card rounded-xl px-3.5 py-3.5 hover:border-primary/35 transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <shortcut.icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-medium">{shortcut.label}</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{shortcut.description}</p>
            </Link>
          ))}
        </div>
      </section>

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
      <BackToTopFooter />
    </div>
  );
}
