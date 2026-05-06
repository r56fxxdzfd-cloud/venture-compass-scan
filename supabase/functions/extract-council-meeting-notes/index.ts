import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OFFICIAL_DIMENSIONS = ['IC', 'PL', 'GR', 'EE', 'PM', 'FS', 'MN', 'GT', 'PT'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) return new Response(JSON.stringify({ error: 'OPENAI_API_KEY ausente no ambiente' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { mode, meeting_id, company_id, transcript_text, context } = await req.json();
    const isNewMeetingMode = mode === 'new_meeting';
    if ((!isNewMeetingMode && !meeting_id) || !company_id || !transcript_text?.trim()) {
      return new Response(JSON.stringify({ error: 'company_id e transcript_text são obrigatórios; meeting_id é obrigatório quando mode != new_meeting' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `Você é Assistente de Ata do Conselho. Gere JSON estritamente válido, sem markdown, com o schema exigido.
Regras: extraia apenas fatos suportados pela transcrição; não invente prazos; owner_name/due_date vazios se incertos; use dimensões oficiais (${OFFICIAL_DIMENSIONS.join(', ')}); inferências devem ter confiança média/baixa; diferencie fatos explícitos de inferências em evidências; linguagem portuguesa executiva e conservadora; inclua source_excerpt curto para rastreabilidade.`;

    const payload = {
      model: 'gpt-4.1-mini',
      input: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify({ meeting_id, company_id, transcript_text, context }) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'council_meeting_notes_draft',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              executive_summary: { type: 'string' }, key_progress: { type: 'string' }, key_blockers: { type: 'string' }, decisions: { type: 'string' }, recommendations: { type: 'string' }, next_agenda: { type: 'string' },
              related_dimensions: { type: 'array', items: { type: 'string', enum: OFFICIAL_DIMENSIONS } },
              suggested_actions: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, description: { type: 'string' }, owner_name: { type: 'string' }, due_date: { type: 'string' }, related_dimension: { type: 'string' }, priority: { type: 'string', enum: ['low', 'medium', 'high'] }, impact: { type: 'string', enum: ['low', 'medium', 'high'] }, effort: { type: 'string', enum: ['low', 'medium', 'high'] }, expected_evidence: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, source_excerpt: { type: 'string' } }, required: ['title','description','owner_name','due_date','related_dimension','priority','impact','effort','expected_evidence','confidence','source_excerpt'] } },
              dimension_progress_suggestions: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { dimension_id: { type: 'string' }, dimension_label: { type: 'string' }, current_perceived_score: { type: ['number', 'null'] }, trend: { type: 'string', enum: ['improving', 'stable', 'worsening', 'insufficient_evidence'] }, evidence_note: { type: 'string' }, counselor_comment: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, source_excerpt: { type: 'string' } }, required: ['dimension_id','dimension_label','current_perceived_score','trend','evidence_note','counselor_comment','confidence','source_excerpt'] } },
              uncertain_items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { type: { type: 'string', enum: ['owner','deadline','decision','action','dimension','other'] }, note: { type: 'string' }, source_excerpt: { type: 'string' } }, required: ['type','note','source_excerpt'] } },
            },
            required: ['executive_summary','key_progress','key_blockers','decisions','recommendations','next_agenda','related_dimensions','suggested_actions','dimension_progress_suggestions','uncertain_items'],
          },
        },
      },
    };

    const aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify(payload),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: `Falha IA: ${txt}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiRes.json();
    const content = aiData?.output?.[0]?.content?.[0]?.text || '{}';
    return new Response(JSON.stringify({ draft: JSON.parse(content) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
