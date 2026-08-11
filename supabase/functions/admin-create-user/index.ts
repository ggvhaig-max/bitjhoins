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
    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return new Response(JSON.stringify({ error: "No autorizado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const serviceClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: callerData } = await callerClient.auth.getUser();
    if (!callerData.user) {
      return new Response(JSON.stringify({ error: "No autorizado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerProfile } = await serviceClient
      .from("user_profiles")
      .select("role")
      .eq("user_id", callerData.user.id)
      .maybeSingle();
    if (callerProfile?.role !== "superadmin") {
      return new Response(JSON.stringify({ error: "No autorizado." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, password, display_name, role } = await req.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedName = String(display_name ?? "").trim();
    const requestedRole = role === "superadmin" || role === "user" ? role : "admin";
    if (!normalizedEmail || password.length < 8 || !normalizedName) {
      return new Response(JSON.stringify({ error: "Datos de usuario inválidos." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: normalizedName },
      app_metadata: { role: requestedRole },
    });
    if (createError || !created.user) {
      const msg = createError?.message ?? '';
      let friendly = "No se pudo crear la cuenta.";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        friendly = "Ya existe una cuenta con ese correo.";
      } else if (msg.includes("password")) {
        friendly = "La contraseña no cumple los requisitos (mínimo 8 caracteres).";
      } else if (msg.includes("email")) {
        friendly = "El correo no es válido.";
      }
      return new Response(JSON.stringify({ error: friendly }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await serviceClient.from("user_profiles").upsert({
      user_id: created.user.id,
      email: normalizedEmail,
      display_name: normalizedName,
      role: requestedRole,
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ error: "No se pudo crear la cuenta." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
