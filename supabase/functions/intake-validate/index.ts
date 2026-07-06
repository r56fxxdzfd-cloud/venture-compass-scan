// Public onboarding flow validator.
// verify_jwt = false. Uses service role so the entrepreneur never receives
// direct table permissions or the complete internal report.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RL_MAX;
}

const PIPELINE_ORDER = [
  "invited",
  "registration_started",
  "registration_completed",
  "diagnosis_started",
  "diagnosis_completed",
  "debrief_scheduled",
  "debrief_completed",
  "selected_for_pilot",
  "standby",
  "in_followup",
];

function isLaterOrEqual(current: string | null | undefined, next: string): boolean {
  const currentIndex = PIPELINE_ORDER.indexOf(current || "");
  const nextIndex = PIPELINE_ORDER.indexOf(next);
  return currentIndex >= nextIndex && currentIndex !== -1;
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function recordEvent(
  admin: ReturnType<typeof adminClient>,
  startupId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
  assessmentId?: string | null,
) {
  await admin.from("startup_events").insert({
    startup_id: startupId,
    assessment_id: assessmentId || null,
    event_type: eventType,
    metadata,
  });
}

async function advancePipelineStatus(
  admin: ReturnType<typeof adminClient>,
  company: Record<string, unknown>,
  nextStatus: string,
) {
  const current = String(company.pipeline_status || "invited");
  if (isLaterOrEqual(current, nextStatus)) return company;

  const { data } = await admin
    .from("companies")
    .update({ pipeline_status: nextStatus })
    .eq("id", company.id)
    .select("*")
    .single();

  return data || { ...company, pipeline_status: nextStatus };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return json({ error: "Too many requests" }, 429);

  try {
    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== "string" || token.length < 32) {
      return json({ valid: false, status: null });
    }

    const admin = adminClient();
    const { data: row, error } = await admin
      .from("intake_submissions")
      .select("id, token, status, label, payload, company_id, assessment_id, expires_at, flow_completed_at")
      .eq("token", token)
      .maybeSingle();

    if (error) return json({ error: "internal" }, 500);
    if (!row) return json({ valid: false, status: null });

    const expired = !!row.expires_at && new Date(row.expires_at).getTime() < Date.now();
    if (expired && row.status !== "diagnosis_completed") {
      await admin.from("intake_submissions").update({ status: "expired" }).eq("id", row.id);
      return json({ valid: false, status: "expired" });
    }

    let company: Record<string, unknown> | null = null;
    if (row.company_id) {
      const { data } = await admin.from("companies").select("*").eq("id", row.company_id).maybeSingle();
      company = data;
    }

    if (!company) {
      const placeholderName = row.label?.trim() || "Cadastro em andamento";
      const { data: created, error: createErr } = await admin
        .from("companies")
        .insert({
          name: placeholderName,
          company_name: placeholderName,
          pipeline_status: "registration_started",
          diagnosis_status: "not_started",
        })
        .select("*")
        .single();

      if (createErr || !created) return json({ error: "internal" }, 500);

      company = created;
      const { error: intakeUpdateErr } = await admin
        .from("intake_submissions")
        .update({ status: "registration_started", company_id: created.id })
        .eq("id", row.id);
      if (intakeUpdateErr) return json({ error: "não foi possível iniciar cadastro" }, 500);
      row.status = "registration_started";
      row.company_id = created.id;
      await recordEvent(admin, created.id, "registration_started", { source: "public_intake_opened" });
    } else {
      const beforeStatus = String(company.pipeline_status || "invited");
      const advancedCompany = await advancePipelineStatus(admin, company, "registration_started");
      company = advancedCompany;
      if (beforeStatus !== advancedCompany.pipeline_status) {
        await recordEvent(admin, String(advancedCompany.id), "registration_started", { source: "public_intake_opened" });
      }
      if (row.status === "pending") {
        const { error: intakeUpdateErr } = await admin
          .from("intake_submissions")
          .update({ status: "registration_started" })
          .eq("id", row.id);
        if (intakeUpdateErr) return json({ error: "não foi possível iniciar cadastro" }, 500);
        row.status = "registration_started";
      }
    }

    if (!company) return json({ error: "internal" }, 500);
    const companyId = String(company.id);

    const [
      questionsRes,
      demoDatesRes,
      settingRes,
      onboardingAnswersRes,
    ] = await Promise.all([
      admin
        .from("onboarding_questions")
        .select("id, question_key, question_text, field_type, is_required, display_order")
        .eq("source", "darwin_growth_initial_form")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      admin
        .from("demo_day_dates")
        .select("*")
        .eq("is_active", true)
        .order("date", { ascending: true }),
      admin
        .from("app_settings")
        .select("value")
        .eq("key", "debrief_calendar_url")
        .maybeSingle(),
      admin
        .from("onboarding_answers")
        .select("question_id, answer_text, question:onboarding_questions(question_key)")
        .eq("startup_id", companyId),
    ]);

    let assessment: Record<string, unknown> | null = null;
    let config: Record<string, unknown> | null = null;
    let answers: unknown[] = [];
    if (row.assessment_id) {
      const { data: assessmentRow } = await admin
        .from("assessments")
        .select("*")
        .eq("id", row.assessment_id)
        .maybeSingle();
      assessment = assessmentRow;
      if (assessmentRow?.config_version_id) {
        const { data: configRow } = await admin
          .from("config_versions")
          .select("id, version_name, config_json")
          .eq("id", assessmentRow.config_version_id)
          .maybeSingle();
        config = configRow;
      }
      const { data: answerRows } = await admin
        .from("answers")
        .select("*")
        .eq("assessment_id", row.assessment_id);
      answers = answerRows || [];
    }

    const onboardingAnswers: Record<string, string> = {};
    (onboardingAnswersRes.data || []).forEach((answer: any) => {
      const question = Array.isArray(answer.question) ? answer.question[0] : answer.question;
      if (question?.question_key) onboardingAnswers[question.question_key] = answer.answer_text;
    });

    return json({
      valid: true,
      status: row.status,
      intake: {
        id: row.id,
        status: row.status,
        company_id: row.company_id,
        assessment_id: row.assessment_id,
        flow_completed_at: row.flow_completed_at,
      },
      company,
      onboarding_questions: questionsRes.data || [],
      onboarding_answers: onboardingAnswers,
      demo_day_dates: demoDatesRes.data || [],
      debrief_calendar_url: settingRes.data?.value ||
        "https://calendly.com/patricia-sepp-boardwise/diagnostico-inicial-darwin-growth?month=2026-07",
      assessment,
      config,
      answers,
    });
  } catch (_e) {
    return json({ error: "internal" }, 500);
  }
});
