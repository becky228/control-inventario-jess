import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Venta } from "../lib/types";

export function Ventas() {
  const { profile } = useAuth();
  const esAdmin = profile?.rol === "admin";
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ventaAbierta, setVentaAbierta] = useState<Venta | null>(null);
  const [motivo, setMotivo] = useState("");

  async function cargar() {
    const { data } = await supabase
      .from("ventas")
      .select("*, profiles(nombre), venta_detalle(*, productos(codigo, titulo))")
      .order("fecha_hora", { ascending: false })
      .limit(100);
    setVentas((data as Venta[]) ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function anular(venta: Venta) {
    if (!motivo) {
      alert("Indica el motivo de la anulación.");
      return;
    }
    const { error } = await supabase.rpc("anular_venta", {
      p_venta_id: venta.id,
      p_motivo: motivo,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setVentaAbierta(null);
    setMotivo("");
    cargar();
  }

  return (
    <div>
      <h1>Ventas</h1>

      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>Vendedora</th>
              <th>Total</th>
              <th>Método</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id}>
                <td>{v.numero}</td>
                <td>{new Date(v.fecha_hora).toLocaleString()}</td>
                <td>{v.profiles?.nombre}</td>
                <td>Bs {Number(v.total).toFixed(2)}</td>
                <td>{v.metodo_pago}</td>
                <td>
                  {v.estado === "anulada" ? (
                    <span className="etiqueta-agotado">Anulada</span>
                  ) : (
                    "Confirmada"
                  )}
                </td>
                <td>
                  <button className="btn-texto" onClick={() => setVentaAbierta(v)}>
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ventaAbierta && (
        <div className="modal-fondo" onClick={() => setVentaAbierta(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Venta #{ventaAbierta.numero}</h2>
            <p className="texto-suave">
              {ventaAbierta.profiles?.nombre} —{" "}
              {new Date(ventaAbierta.fecha_hora).toLocaleString()}
            </p>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>P. unitario</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {ventaAbierta.venta_detalle?.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.productos?.codigo} — {d.productos?.titulo}
                    </td>
                    <td>{d.cantidad}</td>
                    <td>Bs {Number(d.precio_unitario).toFixed(2)}</td>
                    <td>Bs {Number(d.subtotal_linea).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Subtotal: Bs {Number(ventaAbierta.subtotal).toFixed(2)}</p>
            <p>Descuento: Bs {Number(ventaAbierta.descuento).toFixed(2)}</p>
            <p>
              <strong>Total: Bs {Number(ventaAbierta.total).toFixed(2)}</strong>
            </p>

            {ventaAbierta.estado === "anulada" ? (
              <p className="mensaje-error">
                Anulada: {ventaAbierta.motivo_anulacion}
              </p>
            ) : (
              esAdmin && (
                <div className="anular-venta">
                  <input
                    placeholder="Motivo de anulación"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <button
                    className="btn-peligro"
                    onClick={() => anular(ventaAbierta)}
                  >
                    Anular venta
                  </button>
                </div>
              )
            )}

            <button className="btn-texto" onClick={() => setVentaAbierta(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
