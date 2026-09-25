import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { MovimientoInventario } from "../lib/types";

const ETIQUETAS: Record<string, string> = {
  ingreso: "Ingreso",
  venta: "Venta",
  devolucion: "Devolución",
  ajuste: "Ajuste",
  perdida: "Pérdida",
  salida_manual: "Salida manual",
};

export function Movimientos() {
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");

  useEffect(() => {
    async function cargar() {
      let query = supabase
        .from("movimientos_inventario")
        .select("*, productos(codigo, titulo), profiles(nombre)")
        .order("creado_en", { ascending: false })
        .limit(200);
      if (tipo) query = query.eq("tipo", tipo);
      const { data } = await query;
      let lista = (data as MovimientoInventario[]) ?? [];
      if (busqueda) {
        lista = lista.filter((m) =>
          m.productos?.titulo.toLowerCase().includes(busqueda.toLowerCase())
        );
      }
      setMovimientos(lista);
    }
    cargar();
  }, [busqueda, tipo]);

  return (
    <div>
      <h1>Movimientos de inventario</h1>

      <div className="barra-filtros">
        <input
          type="search"
          placeholder="Buscar por producto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(ETIQUETAS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Anterior → Resultante</th>
              <th>Usuario</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.creado_en).toLocaleString()}</td>
                <td>
                  {m.productos?.codigo} — {m.productos?.titulo}
                </td>
                <td>{ETIQUETAS[m.tipo]}</td>
                <td>{m.cantidad}</td>
                <td>
                  {m.cantidad_anterior} → {m.cantidad_resultante}
                </td>
                <td>{m.profiles?.nombre}</td>
                <td>{m.observacion}</td>
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={7} className="texto-suave">
                  Sin movimientos registrados con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
