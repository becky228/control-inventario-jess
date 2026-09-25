import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export function Dashboard() {
  const { profile } = useAuth();
  const esAdmin = profile?.rol === "admin";
  const [totalProductos, setTotalProductos] = useState<number | null>(null);
  const [totalAgotados, setTotalAgotados] = useState<number | null>(null);
  const [ventasHoy, setVentasHoy] = useState<number | null>(null);

  useEffect(() => {
    async function cargar() {
      const { count: total } = await supabase
        .from("productos")
        .select("*", { count: "exact", head: true })
        .eq("estado", "activo");
      setTotalProductos(total ?? 0);

      const { count: agotados } = await supabase
        .from("productos")
        .select("*", { count: "exact", head: true })
        .eq("estado", "activo")
        .eq("cantidad", 0);
      setTotalAgotados(agotados ?? 0);

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const { count: ventas } = await supabase
        .from("ventas")
        .select("*", { count: "exact", head: true })
        .eq("estado", "confirmada")
        .gte("fecha_hora", hoy.toISOString());
      setVentasHoy(ventas ?? 0);
    }
    cargar();
  }, []);

  return (
    <div>
      <h1>Hola, {profile?.nombre}</h1>
      <p className="texto-suave">Este es el resumen rápido de la tienda.</p>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="metrica-numero">{totalProductos ?? "…"}</span>
          <span className="metrica-etiqueta">Productos activos</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="metrica-numero">{totalAgotados ?? "…"}</span>
          <span className="metrica-etiqueta">Productos agotados</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="metrica-numero">{ventasHoy ?? "…"}</span>
          <span className="metrica-etiqueta">Ventas de hoy</span>
        </div>
      </div>

      <div className="accesos-rapidos">
        <Link to="/productos/nuevo" className="btn-primario">
          + Registrar producto
        </Link>
        <Link to="/ventas/nueva" className="btn-secundario">
          + Registrar venta
        </Link>
        {esAdmin && (
          <Link to="/reportes" className="btn-secundario">
            Ver reportes
          </Link>
        )}
      </div>
    </div>
  );
}
