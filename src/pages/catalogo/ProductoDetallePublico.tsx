import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { VistaCatalogoItem } from "../../lib/types";

export function ProductoDetallePublico() {
  const { id } = useParams();
  const [producto, setProducto] = useState<VistaCatalogoItem | null>(null);
  const [imagenActiva, setImagenActiva] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("vista_catalogo")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        const p = data as VistaCatalogoItem;
        setProducto(p);
        setImagenActiva(p?.imagenes?.[0]?.url ?? null);
      });
  }, [id]);

  if (!producto) return <p className="texto-suave">Cargando…</p>;

  const numeroTienda = import.meta.env.VITE_WHATSAPP_NUMERO as string | undefined;
  const mensajeWhatsapp = encodeURIComponent(
    `Hola, quisiera consultar sobre el producto ${producto.codigo} - ${producto.titulo}`
  );

  return (
    <div className="ficha-producto">
      <Link to="/catalogo" className="volver-link">
        ← Volver al catálogo
      </Link>

      <div className="ficha-grid">
        <div className="ficha-galeria">
          <div className="ficha-imagen-grande">
            {imagenActiva ? (
              <img src={imagenActiva} alt={producto.titulo} />
            ) : (
              <div className="sin-imagen">Sin foto</div>
            )}
          </div>
          <div className="ficha-miniaturas">
            {producto.imagenes?.map((img) => (
              <button
                key={img.url}
                onClick={() => setImagenActiva(img.url)}
                className="miniatura-boton"
              >
                <img src={img.url} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div className="ficha-info">
          <span className="categoria-chip-texto">{producto.categoria}</span>
          <h1>{producto.titulo}</h1>
          <p className="texto-suave">Código: {producto.codigo}</p>

          <div className="precio-linea precio-linea-grande">
            {producto.en_oferta && producto.precio_oferta ? (
              <>
                <span className="precio-tachado">Bs {Number(producto.precio).toFixed(2)}</span>
                <span className="precio-oferta">
                  Bs {Number(producto.precio_oferta).toFixed(2)}
                </span>
              </>
            ) : (
              <span>Bs {Number(producto.precio).toFixed(2)}</span>
            )}
          </div>

          <span
            className={
              producto.disponibilidad === "disponible"
                ? "estado-disponible"
                : "estado-agotado"
            }
          >
            {producto.disponibilidad === "disponible" ? "Disponible" : "Agotado"}
          </span>

          <p>{producto.descripcion}</p>

          {numeroTienda && (
            <a
              href={`https://wa.me/${numeroTienda}?text=${mensajeWhatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="btn-whatsapp"
            >
              Consultar por WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
