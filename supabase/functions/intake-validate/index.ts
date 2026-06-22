// FASE 2 — Edge function pública: valida um token de intake.
// verify_jwt = false (configurado em supabase/config.toml).
// Usa service role para consultar; NUNCA vaza payload nem lista outras linhas.
// Recusa token inexistente, expirado ou já consumido.
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

// Rate limit best-effort por IP (janela de 60s, 30 req).
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await admin
      .from("intake_submissions")
      .select("id, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (error) return json({ error: "internal" }, 500);
    if (!row) return json({ valid: false, status: null });

    const expired = !!row.expires_at && new Date(row.expires_at).getTime() < Date.now();

    // Marca como expirado de forma oportunista (apenas se ainda pendente).
    if (expired && row.status === "pending") {
      await admin.from("intake_submissions").update({ status: "expired" }).eq("id", row.id);
      return json({ valid: false, status: "expired" });
    }

    const valid = row.status === "pending" && !expired;
    return json({ valid, status: row.status });
  } catch (_e) {
    return json({ error: "internal" }, 500);
  }
});
