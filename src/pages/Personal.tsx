import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

export function Personal() {
  const [personal, setPersonal] = useState<Profile[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    const { data } = await supabase.from("profiles").select("*").order("nombre");
    setPersonal((data as Profile[]) ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      // Requiere la Edge Function "invitar-usuario" (ver README, sección Fase 3).
      const { error: err } = await supabase.functions.invoke("invitar-usuario", {
        body: { email, nombre },
      });
      if (err) throw err;
      setMensaje(`Invitación enviada a ${email}.`);
      setNombre("");
      setEmail("");
      cargar();
    } catch (e: any) {
      setError(
        e.message ??
          "No se pudo enviar la invitación. Verifica que la función 'invitar-usuario' esté desplegada."
      );
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarEstado(p: Profile) {
    const nuevoEstado = p.estado === "activo" ? "inactivo" : "activo";
    const { error } = await supabase.rpc("cambiar_estado_usuario", {
      p_usuario_id: p.id,
      p_estado: nuevoEstado,
    });
    if (error) {
      alert(error.message);
      return;
    }
    cargar();
  }

  return (
    <div>
      <h1>Personal</h1>

      <form onSubmit={invitar} className="formulario formulario-linea">
        <label>
          Nombre
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label>
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button className="btn-primario" type="submit" disabled={enviando}>
          {enviando ? "Enviando…" : "Invitar vendedora"}
        </button>
      </form>
      {mensaje && <p className="mensaje-ok">{mensaje}</p>}
      {error && <p className="mensaje-error">{error}</p>}

      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {personal.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{p.rol}</td>
                <td>{p.estado}</td>
                <td>
                  {p.rol !== "admin" && (
                    <button className="btn-texto" onClick={() => cambiarEstado(p)}>
                      {p.estado === "activo" ? "Desactivar" : "Reactivar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
