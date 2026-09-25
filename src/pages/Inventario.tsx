import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Producto, TipoMovimiento } from "../lib/types";

export function Inventario() {
  const { profile } = useAuth();
  const esAdmin = profile?.rol === "admin";
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<{
    producto: Producto;
    tipo: TipoMovimiento;
  } | null>(null);

  async function cargar() {
    let query = supabase
      .from("productos")
      .select("*, categorias(*)")
      .eq("estado", "activo")
      .order("titulo");
    if (busqueda) query = query.ilike("titulo", `%${busqueda}%`);
    const { data } = await query;
    setProductos((data as Producto[]) ?? []);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  return (
    <div>
      <h1>Inventario</h1>
      <p className="texto-suave">
        {esAdmin
          ? "Puedes registrar ingresos, ajustes, pérdidas o salidas manuales."
          : "Consulta de stock. Solo el administrador puede modificar cantidades manualmente."}
      </p>

      <input
        type="search"
        placeholder="Buscar producto…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="input-busqueda"
      />

      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Stock</th>
              {esAdmin && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id}>
                <td>{p.codigo}</td>
                <td>{p.titulo}</td>
                <td>{p.categorias?.nombre}</td>
                <td>
                  {p.cantidad > 0 ? (
                    p.cantidad
                  ) : (
                    <span className="etiqueta-agotado">Agotado</span>
                  )}
                </td>
                {esAdmin && (
                  <td className="acciones-inventario">
                    <button onClick={() => setModal({ producto: p, tipo: "ingreso" })}>
                      Ingreso
                    </button>
                    <button onClick={() => setModal({ producto: p, tipo: "ajuste" })}>
                      Ajuste
                    </button>
                    <button onClick={() => setModal({ producto: p, tipo: "perdida" })}>
                      Pérdida
                    </button>
                    <button onClick={() => setModal({ producto: p, tipo: "salida_manual" })}>
                      Salida
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <ModalMovimiento
          producto={modal.producto}
          tipo={modal.tipo}
          onClose={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function ModalMovimiento({
  producto,
  tipo,
  onClose,
  onGuardado,
}: {
  producto: Producto;
  tipo: TipoMovimiento;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [cantidad, setCantidad] = useState(0);
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const titulos: Record<string, string> = {
    ingreso: "Registrar ingreso de mercadería",
    ajuste: "Ajustar stock (cantidad final real)",
    perdida: "Registrar pérdida o daño",
    salida_manual: "Registrar salida manual",
  };

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      if (tipo === "ingreso") {
        const { error: err } = await supabase.rpc("registrar_ingreso", {
          p_producto_id: producto.id,
          p_cantidad: cantidad,
          p_observacion: observacion || null,
        });
        if (err) throw err;
      } else {
        if ((tipo === "perdida" || tipo === "salida_manual") && !observacion) {
          throw new Error("La observación es obligatoria para este movimiento.");
        }
        const { error: err } = await supabase.rpc("registrar_movimiento_manual", {
          p_producto_id: producto.id,
          p_tipo: tipo,
          p_cantidad: cantidad,
          p_observacion: observacion || null,
        });
        if (err) throw err;
      }
      onGuardado();
    } catch (e: any) {
      setError(e.message ?? "No se pudo registrar el movimiento.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-fondo" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{titulos[tipo]}</h2>
        <p className="texto-suave">
          {producto.titulo} — stock actual: {producto.cantidad}
        </p>

        <label>
          {tipo === "ajuste" ? "Cantidad final (nuevo stock)" : "Cantidad"}
          <input
            type="number"
            min={0}
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
          />
        </label>

        <label>
          Observación {(tipo === "perdida" || tipo === "salida_manual") && "(obligatoria)"}
          <textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={2}
          />
        </label>

        {error && <div className="mensaje-error">{error}</div>}

        <div className="modal-acciones">
          <button className="btn-texto" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primario" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
