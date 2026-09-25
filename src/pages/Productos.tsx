import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Categoria, Producto } from "../lib/types";

export function Productos() {
  const { profile } = useAuth();
  const esAdmin = profile?.rol === "admin";

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [soloMios, setSoloMios] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase
      .from("categorias")
      .select("*")
      .order("orden")
      .then(({ data }) => setCategorias((data as Categoria[]) ?? []));
  }, []);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      let query = supabase
        .from("productos")
        .select("*, categorias(*)")
        .neq("estado", "descontinuado")
        .order("creado_en", { ascending: false });

      if (busqueda) query = query.ilike("titulo", `%${busqueda}%`);
      if (categoriaId) query = query.eq("categoria_id", categoriaId);
      if (soloMios && profile) query = query.eq("creado_por", profile.id);

      const { data } = await query;
      setProductos((data as Producto[]) ?? []);
      setCargando(false);
    }
    cargar();
  }, [busqueda, categoriaId, soloMios, profile]);

  return (
    <div>
      <div className="encabezado-pagina">
        <h1>Productos</h1>
        <Link to="/productos/nuevo" className="btn-primario">
          + Nuevo producto
        </Link>
      </div>

      <div className="barra-filtros">
        <input
          type="search"
          placeholder="Buscar por título…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={soloMios}
            onChange={(e) => setSoloMios(e.target.checked)}
          />
          Solo lo que yo registré
        </label>
      </div>

      {cargando ? (
        <p className="texto-suave">Cargando…</p>
      ) : (
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Título</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Catálogo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const puedeEditar = esAdmin || p.creado_por === profile?.id;
                return (
                  <tr key={p.id}>
                    <td>{p.codigo}</td>
                    <td>{p.titulo}</td>
                    <td>{p.categorias?.nombre}</td>
                    <td>Bs {Number(p.precio).toFixed(2)}</td>
                    <td>
                      {p.cantidad > 0 ? (
                        p.cantidad
                      ) : (
                        <span className="etiqueta-agotado">Agotado</span>
                      )}
                    </td>
                    <td>{p.publicado_catalogo ? "Publicado" : "—"}</td>
                    <td>
                      {puedeEditar ? (
                        <Link to={`/productos/${p.id}/editar`}>Editar</Link>
                      ) : (
                        <span className="texto-suave">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {productos.length === 0 && (
                <tr>
                  <td colSpan={7} className="texto-suave">
                    No hay productos que coincidan con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
