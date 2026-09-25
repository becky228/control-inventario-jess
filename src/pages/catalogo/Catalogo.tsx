import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { VistaCatalogoItem } from "../../lib/types";

export function Catalogo() {
  const [params, setParams] = useSearchParams();
  const categoriaParam = params.get("categoria") ?? "";
  const soloOfertas = params.get("ofertas") === "true";

  const [productos, setProductos] = useState<VistaCatalogoItem[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase
      .from("vista_categorias_publico")
      .select("*")
      .then(({ data }) => setCategorias(data ?? []));
  }, []);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      let query = supabase.from("vista_catalogo").select("*").order("titulo");
      if (categoriaParam) query = query.eq("categoria", categoriaParam);
      if (soloOfertas) query = query.eq("en_oferta", true);
      if (busqueda) query = query.ilike("titulo", `%${busqueda}%`);
      const { data } = await query;
      setProductos((data as VistaCatalogoItem[]) ?? []);
      setCargando(false);
    }
    cargar();
  }, [categoriaParam, soloOfertas, busqueda]);

  return (
    <div className="catalogo">
      <header className="catalogo-header">
        <h1>Nuestro catálogo</h1>
        <input
          type="search"
          placeholder="Buscar productos…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="catalogo-buscador"
        />
      </header>

      <div className="catalogo-chips">
        <button
          className={!categoriaParam && !soloOfertas ? "chip chip-activo" : "chip"}
          onClick={() => setParams({})}
        >
          Todos
        </button>
        <button
          className={soloOfertas ? "chip chip-activo" : "chip"}
          onClick={() => setParams({ ofertas: "true" })}
        >
          Ofertas
        </button>
        {categorias.map((c) => (
          <button
            key={c.id}
            className={categoriaParam === c.nombre ? "chip chip-activo" : "chip"}
            onClick={() => setParams({ categoria: c.nombre })}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="texto-suave">Cargando productos…</p>
      ) : (
        <div className="grid-catalogo">
          {productos.map((p) => {
            const principal =
              p.imagenes?.find((i) => i.es_principal)?.url ?? p.imagenes?.[0]?.url;
            return (
              <Link
                to={`/catalogo/producto/${p.id}`}
                key={p.id}
                className="tarjeta-producto"
              >
                {principal ? (
                  <img src={principal} alt={p.titulo} />
                ) : (
                  <div className="sin-imagen">Sin foto</div>
                )}
                {p.en_oferta && <span className="cinta-oferta">Oferta</span>}
                <div className="tarjeta-producto-info">
                  <span className="categoria-chip-texto">{p.categoria}</span>
                  <h3>{p.titulo}</h3>
                  <div className="precio-linea">
                    {p.en_oferta && p.precio_oferta ? (
                      <>
                        <span className="precio-tachado">Bs {Number(p.precio).toFixed(2)}</span>
                        <span className="precio-oferta">
                          Bs {Number(p.precio_oferta).toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span>Bs {Number(p.precio).toFixed(2)}</span>
                    )}
                  </div>
                  <span
                    className={
                      p.disponibilidad === "disponible"
                        ? "estado-disponible"
                        : "estado-agotado"
                    }
                  >
                    {p.disponibilidad === "disponible" ? "Disponible" : "Agotado"}
                  </span>
                </div>
              </Link>
            );
          })}
          {productos.length === 0 && (
            <p className="texto-suave">No se encontraron productos.</p>
          )}
        </div>
      )}
    </div>
  );
}
