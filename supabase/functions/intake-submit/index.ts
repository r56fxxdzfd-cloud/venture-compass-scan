// Public founder onboarding flow submitter.
// verify_jwt = false. All writes are mediated by token and service role.
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
const RL_MAX = 20;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RL_MAX;
}

const MAX_BYTES = 128 * 1024;
const CALENDLY_URL =
  "https://calendly.com/patricia-sepp-boardwise/diagnostico-inicial-darwin-growth?month=2026-07";

const REQUIRED_REGISTRATION_FIELDS = [
  "responsible_name",
  "company_name",
  "responsible_role",
  "responsible_email",
  "responsible_whatsapp",
  "responsible_birthdate",
  "headcount",
  "revenue_2025",
  "revenue_2026_target",
  "expectations_text",
];

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

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function isLaterOrEqual(current: string | null | undefined, next: string): boolean {
  const currentIndex = PIPELINE_ORDER.indexOf(current || "");
  const nextIndex = PIPELINE_ORDER.indexOf(next);
  return currentIndex >= nextIndex && currentIndex !== -1;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function parseDate(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

function validateRegistration(payload: unknown): { ok: true; data: Record<string, string> } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload inválido" };
  }
  const size = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (size > MAX_BYTES) return { ok: false, error: "payload muito grande" };

  const source = payload as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const field of REQUIRED_REGISTRATION_FIELDS) {
    const value = source[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      return { ok: false, error: `campo obrigatório ausente: ${field}` };
    }
    data[field] = String(value).trim();
  }

  if (!validEmail(data.responsible_email)) return { ok: false, error: "e-mail inválido" };

  const headcount = Number(data.headcount);
  if (!Number.isInteger(headcount) || headcount <= 0) {
    return { ok: false, error: "headcount deve ser um número inteiro positivo" };
  }

  const birthdate = parseDate(data.responsible_birthdate);
  if (!birthdate) return { ok: false, error: "data de nascimento inválida" };
  data.responsible_birthdate = birthdate;

  return { ok: true, data };
}

const MAX_ANSWER_ROWS = 300;
const MAX_NOTE_LEN = 2000;

function normalizeAnswerRows(answers: unknown, assessmentId: string) {
  if (!Array.isArray(answers)) return null;
  if (answers.length > MAX_ANSWER_ROWS) throw new Error("respostas em excesso");
  return answers.map((item) => {
    const row = item as Record<string, unknown>;
    const questionId = typeof row.question_id === "string" ? row.question_id.trim() : "";
    if (!questionId) throw new Error("question_id ausente");
    const isNa = row.is_na === true;
    const rawValue = row.value;
    const value = rawValue === null || rawValue === undefined || isNa ? null : Number(rawValue);
    if (!isNa && (value === null || !Number.isInteger(value) || value < 1 || value > 5)) {
      throw new Error(`resposta inválida para ${questionId}`);
    }
    return {
      assessment_id: assessmentId,
      question_id: questionId,
      value,
      is_na: isNa,
      notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim().slice(0, MAX_NOTE_LEN) : null,
    };
  });
}

function normalizeDemoDayDateIds(body: Record<string, any>): string[] {
  const source = Array.isArray(body?.demo_day_date_ids)
    ? body.demo_day_date_ids
    : typeof body?.demo_day_date_id === "string"
      ? [body.demo_day_date_id]
      : [];
  return [...new Set(
    source
      .filter((id: unknown): id is string => typeof id === "string")
      .map((id: string) => id.trim())
      .filter((id: string) => id.length > 0),
  )];
}

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || /schema cache|does not exist|could not find/i.test(error?.message || "");
}

function priorityFromRedFlags(redFlags: Array<{ severity?: string }> | undefined): "critical" | "high" | "medium" | "low" {
  const severities = new Set((redFlags || []).map((flag) => flag.severity));
  if (severities.has("high") || severities.has("critical")) return "critical";
  if (severities.has("medium_high")) return "high";
  if (severities.has("medium")) return "medium";
  return "low";
}

function scoreTo100(score: number | null | undefined): number | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  if (score <= 1) return 0;
  return Math.max(0, Math.min(100, Math.round(((score - 1) / 4) * 100)));
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

async function loadIntake(admin: ReturnType<typeof adminClient>, token: string) {
  const { data: row, error } = await admin
    .from("intake_submissions")
    .select("id, token, status, payload, company_id, assessment_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error("internal");
  if (!row) return null;
  const expired = !!row.expires_at && new Date(row.expires_at).getTime() < Date.now();
  if (expired && row.status !== "diagnosis_completed") {
    await admin.from("intake_submissions").update({ status: "expired" }).eq("id", row.id);
    throw new Error("link expirado");
  }
  return row as Record<string, any>;
}

async function loadCompany(admin: ReturnType<typeof adminClient>, companyId: string | null | undefined) {
  if (!companyId) return null;
  const { data } = await admin.from("companies").select("*").eq("id", companyId).maybeSingle();
  return data as Record<string, unknown> | null;
}

async function getDebriefUrl(admin: ReturnType<typeof adminClient>) {
  const { data } = await admin.from("app_settings").select("value").eq("key", "debrief_calendar_url").maybeSingle();
  return data?.value || CALENDLY_URL;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return json({ ok: false, error: "Too many requests" }, 429);

  try {
    const body = await req.json().catch(() => null);
    const token = body?.token;
    const action = body?.action || "registration";
    if (!token || typeof token !== "string" || token.length < 32) {
      return json({ ok: false, error: "token inválido" }, 400);
    }

    const admin = adminClient();
    const row = await loadIntake(admin, token);
    if (!row) return json({ ok: false, error: "token não encontrado" }, 404);
    if (row.status === "diagnosis_completed" && action !== "debrief_link_clicked") {
      return json({ ok: false, error: "diagnóstico já concluído" }, 409);
    }

    let company = await loadCompany(admin, row.company_id);
    // Registration is the only action that may create the company.
    // All other actions require an existing company.
    if (!company && action !== "registration") {
      return json({ ok: false, error: "cadastro não iniciado" }, 409);
    }
    let companyId = company ? String(company.id) : "";

    if (action === "registration") {
      const check = validateRegistration(body?.payload);
      if (!check.ok) return json({ ok: false, error: check.error }, 400);
      const data = check.data;
      const payloadForInbox = {
        ...data,
        full_name: data.responsible_name,
        role: data.responsible_role,
        email: data.responsible_email,
        whatsapp: data.responsible_whatsapp,
        birth_date: data.responsible_birthdate,
        revenue_goal_2026: data.revenue_2026_target,
      };

      const basePayload = {
        name: data.company_name,
        company_name: data.company_name,
        responsible_name: data.responsible_name,
        responsible_role: data.responsible_role,
        responsible_email: data.responsible_email,
        responsible_whatsapp: data.responsible_whatsapp,
        responsible_birthdate: data.responsible_birthdate,
        headcount: Number(data.headcount),
        revenue_2025: data.revenue_2025,
        revenue_2026_target: data.revenue_2026_target,
        expectations_text: data.expectations_text,
      };

      let updatedCompany: Record<string, unknown> | null = null;

      if (!company) {
        const { data: createdCompany, error: createErr } = await admin
          .from("companies")
          .insert({
            ...basePayload,
            pipeline_status: "registration_completed",
            diagnosis_status: "not_started",
          })
          .select("*")
          .single();
        if (createErr || !createdCompany) {
          return json({ ok: false, error: "não foi possível criar cadastro" }, 500);
        }
        updatedCompany = createdCompany;
        company = createdCompany;
        companyId = String(createdCompany.id);
        const { error: linkErr } = await admin
          .from("intake_submissions")
          .update({ company_id: companyId })
          .eq("id", row.id);
        if (linkErr) return json({ ok: false, error: "não foi possível vincular cadastro" }, 500);
        await recordEvent(admin, companyId, "registration_started", { source: "public_intake_submit" });
      } else {
        const { data: updated, error: companyErr } = await admin
          .from("companies")
          .update({
            ...basePayload,
            pipeline_status: isLaterOrEqual(String(company.pipeline_status), "registration_completed")
              ? company.pipeline_status
              : "registration_completed",
          })
          .eq("id", companyId)
          .select("*")
          .single();
        if (companyErr) return json({ ok: false, error: "não foi possível salvar cadastro" }, 500);
        updatedCompany = updated;
      }

      const { data: questions } = await admin
        .from("onboarding_questions")
        .select("id, question_key")
        .eq("source", "darwin_growth_initial_form")
        .eq("is_active", true);
      const questionByKey = new Map((questions || []).map((q: any) => [q.question_key, q.id]));
      const answers = REQUIRED_REGISTRATION_FIELDS
        .map((key) => {
          const questionId = questionByKey.get(key);
          if (!questionId) return null;
          return {
            startup_id: companyId,
            question_id: questionId,
            answer_text: data[key],
            answer_json: key === "headcount"
              ? { value: Number(data[key]) }
              : key === "responsible_birthdate"
                ? { value: data[key], type: "date" }
                : null,
          };
        })
        .filter(Boolean);

      if (answers.length > 0) {
        const { error: answersErr } = await admin
          .from("onboarding_answers")
          .upsert(answers, { onConflict: "startup_id,question_id" });
        if (answersErr) return json({ ok: false, error: "não foi possível salvar respostas iniciais" }, 500);
      }

      const { error: intakeUpdateErr } = await admin
        .from("intake_submissions")
        .update({ status: "registration_completed", payload: payloadForInbox })
        .eq("id", row.id);
      if (intakeUpdateErr) return json({ ok: false, error: "não foi possível avançar cadastro" }, 500);
      await recordEvent(admin, companyId, "registration_completed", { source: "public_intake" });

      return json({ ok: true, company: updatedCompany });
    }

    if (action === "demo_day") {
      const demoDayDateIds = normalizeDemoDayDateIds(body);
      if (demoDayDateIds.length > 0) {
        const { data: demoDates } = await admin
          .from("demo_day_dates")
          .select("id")
          .in("id", demoDayDateIds)
          .eq("is_active", true);
        if ((demoDates || []).length !== demoDayDateIds.length) {
          return json({ ok: false, error: "data de Demo Day inválida" }, 400);
        }
      }

      const { error: deletePreferencesErr } = await admin
        .from("company_demo_day_preferences")
        .delete()
        .eq("company_id", companyId);
      const preferencesTableAvailable = !isMissingRelationError(deletePreferencesErr);
      if (deletePreferencesErr && preferencesTableAvailable) {
        return json({ ok: false, error: "não foi possível atualizar preferências de Demo Day" }, 500);
      }

      if (preferencesTableAvailable && demoDayDateIds.length > 0) {
        const { error: insertPreferencesErr } = await admin
          .from("company_demo_day_preferences")
          .insert(demoDayDateIds.map((demoDayDateId) => ({
            company_id: companyId,
            demo_day_date_id: demoDayDateId,
          })));
        if (insertPreferencesErr && !isMissingRelationError(insertPreferencesErr)) {
          return json({ ok: false, error: "não foi possível salvar preferências de Demo Day" }, 500);
        }
      }

      const { data: updatedCompany, error } = await admin
        .from("companies")
        .update({
          demo_day_preferred_date_id: demoDayDateIds[0] || null,
          demo_day_selected: demoDayDateIds.length > 0,
        })
        .eq("id", companyId)
        .select("*")
        .single();
      if (error) {
        await recordEvent(admin, companyId, "demo_day_preference_save_failed", {
          demo_day_date_ids: demoDayDateIds,
          code: error.code,
          message: error.message,
        });
        return json({
          ok: true,
          warning: "preferência de Demo Day não foi salva no schema legado",
          company: {
            ...company,
            demo_day_preferred_date_ids: demoDayDateIds,
          },
        });
      }
      await recordEvent(admin, companyId, "demo_day_preferred_date_selected", { demo_day_date_ids: demoDayDateIds });
      return json({
        ok: true,
        company: {
          ...updatedCompany,
          demo_day_preferred_date_ids: demoDayDateIds,
        },
      });
    }

    if (action === "diagnosis_start") {
      if (!company) return json({ ok: false, error: "cadastro não concluído" }, 409);
      const { data: publishedConfig, error: configErr } = await admin
        .from("config_versions")
        .select("id, version_name, config_json")
        .eq("status", "published")
        .single();
      if (configErr || !publishedConfig) return json({ ok: false, error: "nenhuma configuração publicada encontrada" }, 500);

      let assessmentId = row.assessment_id as string | null;
      let assessment: Record<string, unknown> | null = null;

      if (assessmentId) {
        const { data } = await admin.from("assessments").select("*").eq("id", assessmentId).maybeSingle();
        assessment = data;
      }

      if (!assessment) {
        const contextNumeric: Record<string, number> = {};
        if (typeof company.headcount === "number") contextNumeric.headcount = company.headcount;

        const { data: createdAssessment, error: assessmentErr } = await admin
          .from("assessments")
          .insert({
            company_id: companyId,
            config_version_id: publishedConfig.id,
            stage: company.stage || "seed",
            business_model: company.business_model || null,
            context_numeric: contextNumeric,
          })
          .select("*")
          .single();
        if (assessmentErr || !createdAssessment) return json({ ok: false, error: "não foi possível iniciar diagnóstico" }, 500);
        assessment = createdAssessment;
        assessmentId = createdAssessment.id;
        const { error: intakeAssessmentErr } = await admin
          .from("intake_submissions")
          .update({ assessment_id: assessmentId })
          .eq("id", row.id);
        if (intakeAssessmentErr) return json({ ok: false, error: "não foi possível vincular diagnóstico" }, 500);
      }

      const companyAfterPipeline = await advancePipelineStatus(admin, company, "diagnosis_started");
      const { error: companyDiagnosisErr } = await admin
        .from("companies")
        .update({ diagnosis_status: "started", pipeline_status: companyAfterPipeline.pipeline_status })
        .eq("id", companyId);
      if (companyDiagnosisErr) return json({ ok: false, error: "não foi possível marcar diagnóstico iniciado" }, 500);
      const { error: intakeDiagnosisErr } = await admin
        .from("intake_submissions")
        .update({ status: "diagnosis_started" })
        .eq("id", row.id);
      if (intakeDiagnosisErr) return json({ ok: false, error: "não foi possível avançar intake" }, 500);
      await recordEvent(admin, companyId, "diagnosis_started", { source: "public_intake" }, assessmentId);

      const { data: answers } = await admin.from("answers").select("*").eq("assessment_id", assessmentId);
      return json({ ok: true, assessment, config: publishedConfig, answers: answers || [] });
    }

    if (action === "save_diagnosis") {
      const assessmentId = row.assessment_id as string | null;
      if (!assessmentId) return json({ ok: false, error: "diagnóstico não iniciado" }, 409);
      const rows = normalizeAnswerRows(body?.answers, assessmentId);
      if (!rows) return json({ ok: false, error: "respostas inválidas" }, 400);
      if (rows.length > 0) {
        const { error } = await admin.from("answers").upsert(rows, { onConflict: "assessment_id,question_id" });
        if (error) return json({ ok: false, error: "não foi possível salvar respostas" }, 500);
      }
      return json({ ok: true });
    }

    if (action === "complete_diagnosis") {
      if (!company) return json({ ok: false, error: "cadastro não concluído" }, 409);
      const assessmentId = row.assessment_id as string | null;
      if (!assessmentId) return json({ ok: false, error: "diagnóstico não iniciado" }, 409);

      const rows = normalizeAnswerRows(body?.answers, assessmentId);
      if (!rows) return json({ ok: false, error: "respostas inválidas" }, 400);
      if (rows.length > 0) {
        const { error: upsertErr } = await admin.from("answers").upsert(rows, { onConflict: "assessment_id,question_id" });
        if (upsertErr) return json({ ok: false, error: "não foi possível salvar respostas" }, 500);
      }

      const { data: savedAnswers } = await admin.from("answers").select("*").eq("assessment_id", assessmentId);
      const answeredByQuestion = new Map(
        (savedAnswers || []).map((answer: any) => [
          answer.question_id,
          answer.value !== null || answer.is_na === true,
        ]),
      );
      const expectedIds = Array.isArray(body?.answerable_question_ids)
        ? body.answerable_question_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
        : [];
      const missing = expectedIds.filter((questionId: string) => !answeredByQuestion.get(questionId));
      if (missing.length > 0) {
        return json({ ok: false, error: `faltam respostas obrigatórias: ${missing.length}` }, 400);
      }

      const summary = body?.result_summary && typeof body.result_summary === "object"
        ? body.result_summary as Record<string, any>
        : {};
      const redFlags = Array.isArray(summary.red_flags) ? summary.red_flags : [];
      const priorityLevel = priorityFromRedFlags(redFlags);
      const completedAt = new Date().toISOString();

      const { error: assessmentErr } = await admin
        .from("assessments")
        .update({ status: "completed", completed_at: completedAt, priority_level: priorityLevel })
        .eq("id", assessmentId);
      if (assessmentErr) return json({ ok: false, error: "não foi possível finalizar diagnóstico" }, 500);

      const { error: companyCompleteErr } = await admin
        .from("companies")
        .update({
          diagnosis_status: "completed",
          pipeline_status: isLaterOrEqual(String(company.pipeline_status), "diagnosis_completed")
            ? company.pipeline_status
            : "diagnosis_completed",
          diagnosis_completed_at: completedAt,
        })
        .eq("id", companyId);
      if (companyCompleteErr) return json({ ok: false, error: "não foi possível marcar diagnóstico concluído" }, 500);

      const { error: intakeCompleteErr } = await admin
        .from("intake_submissions")
        .update({ status: "diagnosis_completed", flow_completed_at: completedAt })
        .eq("id", row.id);
      if (intakeCompleteErr) return json({ ok: false, error: "não foi possível concluir intake" }, 500);

      await recordEvent(
        admin,
        companyId,
        "diagnosis_completed",
        {
          source: "public_intake",
          score_general: summary.overall_score ?? null,
          score_100: scoreTo100(summary.overall_score),
          red_flags: redFlags,
          priority_level: priorityLevel,
        },
        assessmentId,
      );

      const { data: demoPreferenceRows } = await admin
        .from("company_demo_day_preferences")
        .select("demo_day_date:demo_day_dates(title, date, date_label, start_time, end_time, location_or_format)")
        .eq("company_id", companyId);
      const demoDates = (demoPreferenceRows || [])
        .map((row: any) => Array.isArray(row.demo_day_date) ? row.demo_day_date[0] : row.demo_day_date)
        .filter(Boolean);
      const { data: fallbackDemoDate } = demoDates.length === 0 && company.demo_day_preferred_date_id
        ? await admin.from("demo_day_dates").select("title, date, date_label, start_time, end_time, location_or_format").eq("id", company.demo_day_preferred_date_id).maybeSingle()
        : { data: null };
      const debriefUrl = await getDebriefUrl(admin);
      const appOrigin = typeof body?.app_origin === "string" ? body.app_origin : "";
      const adminPath = `/app/assessments/${assessmentId}/report`;
      const adminUrl = appOrigin ? `${appOrigin}${adminPath}` : adminPath;
      const notificationData = {
        company: {
          id: companyId,
          company_name: company.company_name || company.name,
          responsible_name: company.responsible_name,
          responsible_role: company.responsible_role,
          responsible_email: company.responsible_email,
          responsible_whatsapp: company.responsible_whatsapp,
          responsible_birthdate: company.responsible_birthdate,
          headcount: company.headcount,
          revenue_2025: company.revenue_2025,
          revenue_2026_target: company.revenue_2026_target,
          expectations_text: company.expectations_text,
        },
        demo_day_preferred_date: demoDates[0] || fallbackDemoDate,
        demo_day_preferred_dates: demoDates.length > 0 ? demoDates : fallbackDemoDate ? [fallbackDemoDate] : [],
        score_general: summary.overall_score ?? null,
        score_100: scoreTo100(summary.overall_score),
        red_flags: redFlags,
        priority_level: priorityLevel,
        admin_url: adminUrl,
        debrief_calendar_url: debriefUrl,
      };

      // Idempotente: não cria segunda notificação para o mesmo assessment (retry/duplo submit).
      const { data: existingNotif } = await admin
        .from("internal_notifications")
        .select("id")
        .eq("assessment_id", assessmentId)
        .eq("type", "diagnosis_completed")
        .maybeSingle();
      if (!existingNotif) {
        await admin.from("internal_notifications").insert({
          type: "diagnosis_completed",
          title: `Diagnóstico concluído: ${company.company_name || company.name}`,
          body: "Diagnóstico recebido pelo fluxo público do empreendedor.",
          data: notificationData,
          startup_id: companyId,
          assessment_id: assessmentId,
        });
      }

      return json({ ok: true, debrief_calendar_url: debriefUrl, priority_level: priorityLevel });
    }

    if (action === "debrief_link_clicked") {
      await recordEvent(admin, companyId, "debrief_link_clicked", { source: "public_completion" }, row.assessment_id || null);
      return json({ ok: true });
    }

    return json({ ok: false, error: "ação inválida" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal";
    const status = message === "link expirado" ? 409 : message === "internal" ? 500 : 400;
    return json({ ok: false, error: message }, status);
  }
});
