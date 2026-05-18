import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/integrations/supabase/types';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing env vars. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon/publishable key).');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const COMPANY_NAME = 'Instituto Ponte Futuro';

async function main() {
  await supabase.from('companies').select('id', { head: true, count: 'exact' });

  const { data: existingCompany } = await supabase.from('companies').select('*').eq('name', COMPANY_NAME).maybeSingle();
  let companyId = existingCompany?.id;

  if (companyId) {
    await supabase.from('companies').update({ legal_name: 'Instituto Ponte Futuro Educação e Inovação Social', sector: 'Educação e Impacto Social', stage: 'Tração', business_model: 'B2B2G + B2C (assinatura institucional e programas patrocinados)' }).eq('id', companyId);
  } else {
    const { data, error } = await supabase.from('companies').insert({ name: COMPANY_NAME, legal_name: 'Instituto Ponte Futuro Educação e Inovação Social', sector: 'Educação e Impacto Social', stage: 'Tração', business_model: 'B2B2G + B2C (assinatura institucional e programas patrocinados)' }).select('id').single();
    if (error) throw error;
    companyId = data.id;
  }

  const { data: config } = await supabase.from('config_versions').select('id').order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (config) {
    const { data: lastAssessment } = await supabase.from('assessments').select('id').eq('company_id', companyId!).eq('status', 'completed').order('completed_at', { ascending: false }).limit(1).maybeSingle();
    if (!lastAssessment) {
      await supabase.from('assessments').insert({
        company_id: companyId!, config_version_id: config.id, status: 'completed', completed_at: '2026-04-25T14:00:00Z',
        stage: 'Tração', business_model: 'B2B2G', customer_type: 'Escolas, mantenedoras e famílias', revenue_model: 'Licença anual + programa de aceleração',
        context_numeric: { monthly_revenue_brl: 420000, active_students: 18200, nps: 61, churn_pct: 2.1, gross_margin_pct: 57 }, is_simulation: false,
      });
    }
  }

  const founders = [{ name: 'Carla Menezes', role: 'CEO' }, { name: 'Rafael Duarte', role: 'COO' }];
  const founderRows: Array<{ id: string; name: string }> = [];
  for (const founder of founders) {
    const { data: existing } = await supabase.from('founders').select('id,name').eq('company_id', companyId!).eq('name', founder.name).maybeSingle();
    if (existing) {
      founderRows.push(existing);
      continue;
    }
    const { data, error } = await supabase.from('founders').insert({ company_id: companyId!, name: founder.name, role: founder.role, active: true }).select('id,name').single();
    if (error) throw error;
    founderRows.push(data);
  }

  for (const founder of founderRows) {
    const semester = '2026.1';
    const { data: fa } = await supabase.from('founder_assessments').select('id').eq('company_id', companyId!).eq('founder_id', founder.id).eq('semester', semester).maybeSingle();
    let faId = fa?.id;
    if (!faId) {
      const { data } = await supabase.from('founder_assessments').insert({ company_id: companyId!, founder_id: founder.id, semester, assessment_date: '2026-04-20', score_auto: founder.name === 'Carla Menezes' ? 82 : 78, score_jv: founder.name === 'Carla Menezes' ? 84 : 79, score_used: founder.name === 'Carla Menezes' ? 84 : 79, notes: `Avaliação semestral demo (${founder.name}).`, stage_label: 'Tração' }).select('id').single();
      faId = data?.id;
    }
    if (!faId) continue;

    for (const p of [
      { n: 1, name: 'Visão e Estratégia', s: founder.name === 'Carla Menezes' ? 8.6 : 7.8 },
      { n: 2, name: 'Execução e Ritmo', s: founder.name === 'Carla Menezes' ? 8.2 : 8.1 },
      { n: 3, name: 'Liderança de Pessoas', s: founder.name === 'Carla Menezes' ? 8.4 : 7.6 },
      { n: 4, name: 'Disciplina de Dados', s: founder.name === 'Carla Menezes' ? 7.9 : 7.7 },
    ]) {
      const { data: existing } = await supabase.from('founder_pillar_scores').select('id').eq('founder_assessment_id', faId).eq('pillar_number', p.n).maybeSingle();
      if (!existing) await supabase.from('founder_pillar_scores').insert({ founder_assessment_id: faId, pillar_number: p.n, pillar_name: p.name, weight: 0.25, score_auto: p.s, score_jv: p.s, delta: 0, evidence_auto: 'Evidências coletadas em rituais semanais e OKRs.' });
    }
  }

  // meeting_date is a date-only field; never persist via Date.toISOString().
  const meetings = [
    { date: '2026-03-14', title: 'Conselho Março - Eficiência Operacional' },
    { date: '2026-04-18', title: 'Conselho Abril - Escala Comercial' },
    { date: '2026-05-02', title: 'Conselho Maio - Governança de Dados' },
  ];
  const meetingMap = new Map<string, string>();
  for (const m of meetings) {
    const { data: existing } = await supabase.from('council_meetings').select('id').eq('company_id', companyId!).eq('meeting_date', m.date).eq('title', m.title).maybeSingle();
    if (existing) { meetingMap.set(m.date, existing.id); continue; }
    const { data } = await supabase.from('council_meetings').insert({ company_id: companyId!, meeting_date: m.date, title: m.title, meeting_type: 'ordinária', main_topic: 'Evolução de desempenho e pactuação de ações', attendees_founders: ['Carla Menezes', 'Rafael Duarte'], attendees_counselors: ['Ana Paula Nogueira', 'Marcos Lima'], perceived_progress_score: 7.8, counselor_confidence_score: 8.1, related_dimensions: ['Estratégia', 'Produto', 'Comercial', 'Dados'] }).select('id').single();
    if (data?.id) meetingMap.set(m.date, data.id);
  }

  for (const [d, t, owner, due] of [
    ['2026-03-14', 'Padronizar onboarding em 3 trilhas', 'Carla Menezes', '2026-04-05'],
    ['2026-04-18', 'Rodar piloto em 2 novas redes escolares', 'Rafael Duarte', '2026-05-10'],
    ['2026-05-02', 'Publicar painel de coorte semanal', 'Time de Dados', '2026-05-20'],
  ] as const) {
    const mid = meetingMap.get(d);
    if (!mid) continue;
    const { data: existing } = await supabase.from('council_actions').select('id').eq('company_id', companyId!).eq('meeting_id', mid).eq('title', t).maybeSingle();
    if (!existing) await supabase.from('council_actions').insert({ company_id: companyId!, meeting_id: mid, title: t, owner_name: owner, due_date: due, priority: 'high', status: 'in_progress', impact: 'high', effort: 'medium', related_dimension: 'Execução' });
  }

  for (const [meetingDate, meetingId] of meetingMap.entries()) {
    for (const [id, label, initial, current] of [
      ['strategy', 'Estratégia', 6.8, 7.5],
      ['product', 'Produto', 6.9, 7.6],
      ['commercial', 'Comercial', 6.5, 7.4],
      ['data', 'Dados', 5.8, 7.0],
    ] as const) {
      const { data: existing } = await supabase.from('council_dimension_progress').select('id').eq('company_id', companyId!).eq('meeting_id', meetingId).eq('dimension_id', id).maybeSingle();
      if (!existing) await supabase.from('council_dimension_progress').insert({ company_id: companyId!, meeting_id: meetingId, dimension_id: id, dimension_label: label, initial_score: initial, current_perceived_score: current + (meetingDate === '2026-03-14' ? 0 : meetingDate === '2026-04-18' ? 0.2 : 0.4), trend: 'up', evidence_note: 'Evidências em atas e KPIs semanais.', counselor_comment: 'Progressão consistente.' });
    }
  }

  console.log(`✅ Seed finalizado. company_id=${companyId}`);
}

main().catch((error) => {
  console.error('❌ Seed falhou:', error);
  process.exit(1);
});
