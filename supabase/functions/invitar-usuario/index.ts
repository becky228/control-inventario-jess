// Edge Function: invitar-usuario
// Se ejecuta en el servidor de Supabase, no en el navegador. Aquí sí es
// seguro usar la clave de servicio (service role), porque nunca llega al
// cliente. Solo un usuario con rol "admin" puede invocarla.
//
// Despliegue (una sola vez, requiere Supabase CLI):
//   supabase functions deploy invitar-usuario

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente con la sesión del usuario que llama, para verificar que es admin
    const supabaseUsuario = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await supabaseUsuario.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
      });
    }

    const { data: perfil } = await supabaseUsuario
      .from("profiles")
      .select("rol, estado")
      .eq("id", user.id)
      .single();

    if (!perfil || perfil.rol !== "admin" || perfil.estado !== "activo") {
      return new Response(
        JSON.stringify({ error: "Solo el administrador puede invitar usuarios" }),
        { status: 403 }
      );
    }

    const { email, nombre } = await req.json();
    if (!email || !nombre) {
      return new Response(
        JSON.stringify({ error: "Falta el correo o el nombre" }),
        { status: 400 }
      );
    }

    // Cliente con la clave de servicio, para poder invitar usuarios
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { nombre },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
