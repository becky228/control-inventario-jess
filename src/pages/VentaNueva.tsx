import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { MetodoPago, Producto } from "../lib/types";

interface LineaCarrito {
  producto: Producto;
  cantidad: number;
}

export function VentaNueva() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!busqueda) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("productos")
        .select("*")
        .eq("estado", "activo")
        .gt("cantidad", 0)
        .ilike("titulo", `%${busqueda}%`)
        .limit(8);
      setResultados((data as Producto[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  function agregarAlCarrito(p: Producto) {
    setCarrito((prev) => {
      const existente = prev.find((l) => l.producto.id === p.id);
      if (existente) {
        return prev.map((l) =>
          l.producto.id === p.id
            ? { ...l, cantidad: Math.min(l.cantidad + 1, p.cantidad) }
            : l
        );
      }
      return [...prev, { producto: p, cantidad: 1 }];
    });
    setBusqueda("");
    setResultados([]);
  }

  function actualizarCantidad(productoId: string, cantidad: number) {
    setCarrito((prev) =>
      prev.map((l) =>
        l.producto.id === productoId
          ? { ...l, cantidad: Math.max(1, Math.min(cantidad, l.producto.cantidad)) }
          : l
      )
    );
  }

  function quitar(productoId: string) {
    setCarrito((prev) => prev.filter((l) => l.producto.id !== productoId));
  }

  const subtotal = carrito.reduce(
    (acc, l) => acc + l.cantidad * Number(l.producto.precio),
    0
  );
  const total = Math.max(0, subtotal - descuento);

  async function confirmarVenta() {
    if (!profile) return;
    if (carrito.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const items = carrito.map((l) => ({
        producto_id: l.producto.id,
        cantidad: l.cantidad,
        precio_unitario: Number(l.producto.precio),
      }));
      const { error: err } = await supabase.rpc("registrar_venta", {
        p_vendedora_id: profile.id,
        p_items: items,
        p_descuento: descuento,
        p_metodo_pago: metodoPago,
        p_observaciones: observaciones || null,
      });
      if (err) throw err;
      navigate("/ventas");
    } catch (e: any) {
      setError(e.message ?? "No se pudo registrar la venta.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pantalla-venta">
      <div>
        <h1>Nueva venta</h1>
        <input
          className="input-busqueda"
          placeholder="Buscar producto por título…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {resultados.length > 0 && (
          <div className="resultados-busqueda">
            {resultados.map((p) => (
              <button
                key={p.id}
                className="resultado-item"
                onClick={() => agregarAlCarrito(p)}
              >
                <span>
                  {p.codigo} — {p.titulo}
                </span>
                <span>
                  Bs {Number(p.precio).toFixed(2)} · stock {p.cantidad}
                </span>
              </button>
            ))}
          </div>
        )}

        <table className="tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>P. unitario</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {carrito.map((l) => (
              <tr key={l.producto.id}>
                <td>{l.producto.titulo}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={l.producto.cantidad}
                    value={l.cantidad}
                    onChange={(e) =>
                      actualizarCantidad(l.producto.id, Number(e.target.value))
                    }
                  />
                </td>
                <td>Bs {Number(l.producto.precio).toFixed(2)}</td>
                <td>Bs {(l.cantidad * Number(l.producto.precio)).toFixed(2)}</td>
                <td>
                  <button className="btn-texto" onClick={() => quitar(l.producto.id)}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {carrito.length === 0 && (
              <tr>
                <td colSpan={5} className="texto-suave">
                  Aún no agregaste productos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <aside className="resumen-venta">
        <h2>Resumen</h2>
        <label>
          Descuento (Bs)
          <input
            type="number"
            min={0}
            value={descuento}
            onChange={(e) => setDescuento(Number(e.target.value))}
          />
        </label>
        <label>
          Método de pago
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="qr">QR</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label>
          Observaciones
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </label>

        <p>Subtotal: Bs {subtotal.toFixed(2)}</p>
        <p>
          <strong>Total: Bs {total.toFixed(2)}</strong>
        </p>

        {error && <div className="mensaje-error">{error}</div>}

        <button
          className="btn-primario"
          onClick={confirmarVenta}
          disabled={guardando}
        >
          {guardando ? "Registrando…" : "Confirmar venta"}
        </button>
      </aside>
    </div>
  );
}
