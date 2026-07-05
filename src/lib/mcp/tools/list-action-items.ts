import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_action_items",
  title: "Listar plano de ação",
  description: "Lista os itens do plano de ação de uma startup, opcionalmente filtrando por status.",
  inputSchema: {
    company_id: z.string().uuid().describe("UUID da startup."),
    status: z.enum(["todo", "doing", "done", "blocked"]).optional().describe("Filtro opcional por status."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de itens (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("action_items")
      .select("id, title, description, status, effort, priority, due_date, dimension_id, owner_label, created_at")
      .eq("company_id", company_id)
      .order("priority", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { action_items: data ?? [] },
    };
  },
});
