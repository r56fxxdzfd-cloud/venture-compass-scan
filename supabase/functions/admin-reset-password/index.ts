import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const email = "nilsig23@gmail.com";
  const password = "Teste4321";
  const { data: list, error: e1 } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (e1) return new Response(JSON.stringify({ error: e1.message }), { status: 500 });
  const user = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true, id: user.id, email: user.email }));
});
