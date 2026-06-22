// FASE 2 — Edge function pública: recebe o preenchimento do fundador.
// verify_jwt = false (configurado em supabase/config.toml).
// Grava o payload SOMENTE se o token estiver pending e não expirado.
// Valida tamanho e campos mínimos. Usa service role.
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
const RL_MAX = 15;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RL_MAX;
}

const MAX_BYTES = 64 * 1024; // 64KB
const REQUIRED_FIELDS = ["company_name", "founders", "stage", "business_model", "contact"];

function validatePayload(payload: unknown): { ok: boolean; reason?: string } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: "payload inválido" };
  }
  const size = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (size > MAX_BYTES) return { ok: false, reason: "payload muito grande" };
  const p = payload as Record<string, unknown>;
  for (const f of REQUIRED_FIELDS) {
    const v = p[f];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      return { ok: false, reason: `campo obrigatório ausente: ${f}` };
    }
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return json({ error: "Too many requests" }, 429);

  try {
    const body = await req.json().catch(() => null);
    const token = body?.token;
    const payload = body?.payload;
    if (!token || typeof token !== "string" || token.length < 32) {
      return json({ ok: false, error: "token inválido" }, 400);
    }
    const check = validatePayload(payload);
    if (!check.ok) return json({ ok: false, error: check.reason }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await admin
      .from("intake_submissions")
      .select("id, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (error) return json({ ok: false, error: "internal" }, 500);
    if (!row) return json({ ok: false, error: "token não encontrado" }, 404);

    const expired = !!row.expires_at && new Date(row.expires_at).getTime() < Date.now();
    if (expired) {
      if (row.status === "pending") {
        await admin.from("intake_submissions").update({ status: "expired" }).eq("id", row.id);
      }
      return json({ ok: false, error: "link expirado" }, 409);
    }
    if (row.status !== "pending") {
      return json({ ok: false, error: "este link já foi utilizado" }, 409);
    }

    // Atualização condicional: só grava se ainda estiver pending (evita corrida).
    const { data: updated, error: upErr } = await admin
      .from("intake_submissions")
      .update({ payload, status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (upErr) return json({ ok: false, error: "internal" }, 500);
    if (!updated) return json({ ok: false, error: "este link já foi utilizado" }, 409);

    return json({ ok: true });
  } catch (_e) {
    return json({ ok: false, error: "internal" }, 500);
  }
});
