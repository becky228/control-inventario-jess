import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Categoria } from "../lib/types";

export function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [prefijo, setPrefijo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const { data } = await supabase.from("categorias").select("*").order("orden");
    setCategorias((data as Categoria[]) ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (prefijo.length !== 4) {
      setError("El prefijo debe tener exactamente 4 letras.");
      return;
    }
    setGuardando(true);
    const { error: err } = await supabase.rpc("crear_categoria", {
      p_nombre: nombre,
      p_prefijo: prefijo,
    });
    setGuardando(false);
    if (err) {
      setError(
        err.message.includes("duplicate")
          ? "Ya existe una categoría con ese nombre o prefijo."
          : err.message
      );
      return;
    }
    setNombre("");
    setPrefijo("");
    cargar();
  }

  return (
    <div>
      <h1>Categorías</h1>
      <p className="texto-suave">
        El prefijo se define una sola vez y no se puede editar después, para
        no romper los códigos de productos ya generados.
      </p>

      <form onSubmit={crear} className="formulario formulario-linea">
        <label>
          Nombre de la categoría
          <input required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label>
          Prefijo (4 letras)
          <input
            required
            maxLength={4}
            value={prefijo}
            onChange={(e) => setPrefijo(e.target.value.toUpperCase())}
          />
        </label>
        <button className="btn-primario" type="submit" disabled={guardando}>
          {guardando ? "Creando…" : "Crear categoría"}
        </button>
      </form>
      {error && <p className="mensaje-error">{error}</p>}

      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Prefijo</th>
              <th>Visible en catálogo</th>
              <th>Últ. número usado</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                <td>{c.prefijo}</td>
                <td>{c.visible_en_catalogo ? "Sí" : "No"}</td>
                <td>{c.ultimo_numero}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
