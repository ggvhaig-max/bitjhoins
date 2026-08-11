import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.display_name ?? "").trim();

    if (!email || !email.includes("@") || password.length < 6 || !displayName) {
      return new Response(JSON.stringify({ error: "Revisa los datos ingresados." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const serviceClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
      app_metadata: { role: "user" },
    });

    if (createError || !created.user) {
      const msg = createError?.message ?? '';
      let friendly = "No se pudo crear la cuenta.";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        friendly = "Ya existe una cuenta con ese correo.";
      } else if (msg.includes("password")) {
        friendly = "La contraseña debe tener al menos 6 caracteres.";
      } else if (msg.includes("email")) {
        friendly = "El correo no es válido.";
      }
      return new Response(JSON.stringify({ error: friendly }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await serviceClient.from("user_profiles").upsert({
      user_id: created.user.id,
      email,
      display_name: displayName,
      role: "user",
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "No se pudo crear la cuenta." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
