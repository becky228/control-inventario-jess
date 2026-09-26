import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabaseConfigError =
  !url || !anonKey
    ? "Faltan las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Revisa la configuración del sitio."
    : null;

if (supabaseConfigError) {
  // eslint-disable-next-line no-console
  console.error(supabaseConfigError);
}

// Se usan valores de relleno cuando falta la configuración para evitar que
// createClient lance una excepción durante la carga del módulo (lo que
// dejaría la página completamente en blanco antes de poder mostrar un aviso).
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "clave-anonima-de-relleno"
);
