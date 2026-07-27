import { supabase } from '@/integrations/supabase/client';

const HEADER_LABELS: Record<string, string> = {
  id: 'ID',
  name: 'Nome comercial',
  company_name: 'Razão / Nome da empresa',
  legal_name: 'Razão social',
  cnpj: 'CNPJ',
  sector: 'Setor',
  stage: 'Estágio',
  business_model: 'Modelo de negócio',
  responsible_name: 'Responsável',
  responsible_role: 'Cargo do responsável',
  responsible_email: 'E-mail do responsável',
  responsible_whatsapp: 'WhatsApp do responsável',
  responsible_birthdate: 'Nascimento do responsável',
  headcount: 'Headcount',
  revenue_2025: 'Receita 2025',
  revenue_2026_target: 'Meta receita 2026',
  expectations_text: 'Expectativas',
  diagnosis_status: 'Status do diagnóstico',
  diagnosis_completed_at: 'Diagnóstico concluído em',
  pipeline_status: 'Status do pipeline',
  demo_day_selected: 'Selecionada Demo Day',
  demo_day_preferred_date_id: 'Data preferida Demo Day (ID)',
  is_demo: 'Ambiente demo',
  logo_url: 'Logo',
  archived_at: 'Arquivada em',
  created_at: 'Criada em',
};

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

/** Baixa todos os dados cadastrais das organizações visíveis ao usuário em CSV. */
export async function downloadCompaniesCsv(opts: { onlyDemoDay?: boolean } = {}) {
  let query = supabase.from('companies').select('*').order('name', { ascending: true });
  if (opts.onlyDemoDay) query = query.eq('demo_day_selected', true);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];

  const keys = Object.keys(HEADER_LABELS).filter((k) => rows.some((r) => k in (r as Record<string, unknown>)));
  const extra = rows.length
    ? Object.keys(rows[0] as Record<string, unknown>).filter((k) => !keys.includes(k))
    : [];
  const allKeys = [...keys, ...extra];

  const header = allKeys.map((k) => csvCell(HEADER_LABELS[k] || k)).join(';');
  const body = rows
    .map((r) => allKeys.map((k) => csvCell((r as Record<string, unknown>)[k])).join(';'))
    .join('\n');

  // BOM para o Excel reconhecer acentuação
  const blob = new Blob([`\uFEFF${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `organizacoes${opts.onlyDemoDay ? '-demo-day' : ''}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return rows.length;
}
