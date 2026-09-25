import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";
import type { Profile, Venta } from "../lib/types";

interface LineaReporte {
  fecha: string;
  vendedora: string;
  categoria: string;
  producto: string;
  cantidad: number;
  subtotal: number;
  metodoPago: string;
  numeroVenta: string;
}

export function Reportes() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [vendedoras, setVendedoras] = useState<Profile[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [vendedoraId, setVendedoraId] = useState("");
  const [categoria, setCategoria] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("rol", "vendedora")
      .then(({ data }) => setVendedoras((data as Profile[]) ?? []));
  }, []);

  useEffect(() => {
    async function cargar() {
      let query = supabase
        .from("ventas")
        .select(
          "*, profiles(nombre), venta_detalle(*, productos(titulo, categorias(nombre)))"
        )
        .eq("estado", "confirmada")
        .order("fecha_hora", { ascending: false });

      if (desde) query = query.gte("fecha_hora", `${desde}T00:00:00`);
      if (hasta) query = query.lte("fecha_hora", `${hasta}T23:59:59`);
      if (vendedoraId) query = query.eq("vendedora_id", vendedoraId);

      const { data } = await query;
      setVentas((data as Venta[]) ?? []);
    }
    cargar();
  }, [desde, hasta, vendedoraId]);

  // "Aplanamos" las ventas a nivel de línea de producto para poder filtrar por categoría y armar la tabla dinámica
  const lineas: LineaReporte[] = useMemo(() => {
    const filas: LineaReporte[] = [];
    for (const v of ventas) {
      for (const d of v.venta_detalle ?? []) {
        const cat = d.productos?.categorias?.nombre ?? "Sin categoría";
        if (categoria && cat !== categoria) continue;
        filas.push({
          fecha: new Date(v.fecha_hora).toLocaleDateString(),
          vendedora: v.profiles?.nombre ?? "",
          categoria: cat,
          producto: d.productos?.titulo ?? "",
          cantidad: d.cantidad,
          subtotal: Number(d.subtotal_linea),
          metodoPago: v.metodo_pago,
          numeroVenta: v.numero,
        });
      }
    }
    return filas;
  }, [ventas, categoria]);

  const categoriasDisponibles = useMemo(
    () => Array.from(new Set(lineas.map((l) => l.categoria))).sort(),
    [lineas]
  );

  const totalVentas = ventas.length;
  const totalUnidades = lineas.reduce((a, l) => a + l.cantidad, 0);
  const totalImporte = lineas.reduce((a, l) => a + l.subtotal, 0);

  // Gráfico: ventas por día
  const porDia = useMemo(() => {
    const mapa = new Map<string, number>();
    lineas.forEach((l) => mapa.set(l.fecha, (mapa.get(l.fecha) ?? 0) + l.subtotal));
    return Array.from(mapa.entries())
      .map(([fecha, total]) => ({ fecha, total }))
      .sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
  }, [lineas]);

  // Gráfico: ventas por vendedora
  const porVendedora = useMemo(() => {
    const mapa = new Map<string, number>();
    lineas.forEach((l) => mapa.set(l.vendedora, (mapa.get(l.vendedora) ?? 0) + l.subtotal));
    return Array.from(mapa.entries()).map(([vendedora, total]) => ({ vendedora, total }));
  }, [lineas]);

  // Tabla dinámica: categoría x vendedora (importe)
  const tablaDinamica = useMemo(() => {
    const vendedorasSet = Array.from(new Set(lineas.map((l) => l.vendedora)));
    const filas = categoriasDisponibles.map((cat) => {
      const fila: Record<string, number | string> = { categoria: cat };
      let total = 0;
      vendedorasSet.forEach((vend) => {
        const suma = lineas
          .filter((l) => l.categoria === cat && l.vendedora === vend)
          .reduce((a, l) => a + l.subtotal, 0);
        fila[vend] = suma;
        total += suma;
      });
      fila["Total"] = total;
      return fila;
    });
    return { columnas: vendedorasSet, filas };
  }, [lineas, categoriasDisponibles]);

  function exportarExcel() {
    const hoja = XLSX.utils.json_to_sheet(
      lineas.map((l) => ({
        Fecha: l.fecha,
        "N° Venta": l.numeroVenta,
        Vendedora: l.vendedora,
        Categoría: l.categoria,
        Producto: l.producto,
        Cantidad: l.cantidad,
        Subtotal: l.subtotal,
        "Método de pago": l.metodoPago,
      }))
    );
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Reporte");
    XLSX.writeFile(libro, `reporte-ventas-${Date.now()}.xlsx`);
  }

  function exportarPDF() {
    const doc = new jsPDF();
    doc.text("Reporte de ventas", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [["Fecha", "N° Venta", "Vendedora", "Categoría", "Producto", "Cant.", "Subtotal"]],
      body: lineas.map((l) => [
        l.fecha,
        l.numeroVenta,
        l.vendedora,
        l.categoria,
        l.producto,
        String(l.cantidad),
        `Bs ${l.subtotal.toFixed(2)}`,
      ]),
    });
    doc.save(`reporte-ventas-${Date.now()}.pdf`);
  }

  return (
    <div>
      <h1>Reportes</h1>

      <div className="barra-filtros">
        <label>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <select value={vendedoraId} onChange={(e) => setVendedoraId(e.target.value)}>
          <option value="">Todas las vendedoras</option>
          {vendedoras.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categoriasDisponibles.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="tarjetas-resumen">
        <div className="tarjeta-metrica">
          <span className="metrica-numero">{totalVentas}</span>
          <span className="metrica-etiqueta">Ventas</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="metrica-numero">{totalUnidades}</span>
          <span className="metrica-etiqueta">Unidades vendidas</span>
        </div>
        <div className="tarjeta-metrica">
          <span className="metrica-numero">Bs {totalImporte.toFixed(2)}</span>
          <span className="metrica-etiqueta">Importe total</span>
        </div>
      </div>

      <div className="acciones-exportar">
        <button className="btn-secundario" onClick={exportarExcel}>
          Exportar Excel
        </button>
        <button className="btn-secundario" onClick={exportarPDF}>
          Exportar PDF
        </button>
      </div>

      <div className="grafico-caja">
        <h2>Ventas por día</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porDia}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fecha" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="total" fill="#2F8F6B" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grafico-caja">
        <h2>Ventas por vendedora</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porVendedora}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="vendedora" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" fill="#16243D" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h2>Tabla dinámica — Categoría × Vendedora (importe)</h2>
      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th>Categoría</th>
              {tablaDinamica.columnas.map((c) => (
                <th key={c}>{c}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {tablaDinamica.filas.map((f) => (
              <tr key={f.categoria as string}>
                <td>{f.categoria}</td>
                {tablaDinamica.columnas.map((c) => (
                  <td key={c}>Bs {Number(f[c] ?? 0).toFixed(2)}</td>
                ))}
                <td>
                  <strong>Bs {Number(f["Total"]).toFixed(2)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Detalle</h2>
      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>N° Venta</th>
              <th>Vendedora</th>
              <th>Categoría</th>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Subtotal</th>
              <th>Método</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i}>
                <td>{l.fecha}</td>
                <td>{l.numeroVenta}</td>
                <td>{l.vendedora}</td>
                <td>{l.categoria}</td>
                <td>{l.producto}</td>
                <td>{l.cantidad}</td>
                <td>Bs {l.subtotal.toFixed(2)}</td>
                <td>{l.metodoPago}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
