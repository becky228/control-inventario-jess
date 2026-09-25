import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Categoria, Producto, ProductoImagen, Unidad } from "../lib/types";

interface Slot {
  tipo: "link" | "real";
  orden: 1 | 2;
  obligatoria: boolean;
  archivo: File | null;
  urlExistente: string | null;
}

function slotsIniciales(): Slot[] {
  return [
    { tipo: "link", orden: 1, obligatoria: true, archivo: null, urlExistente: null },
    { tipo: "link", orden: 2, obligatoria: false, archivo: null, urlExistente: null },
    { tipo: "real", orden: 1, obligatoria: true, archivo: null, urlExistente: null },
    { tipo: "real", orden: 2, obligatoria: false, archivo: null, urlExistente: null },
  ];
}

export function ProductoForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [link, setLink] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState(0);
  const [unidad, setUnidad] = useState<Unidad>("unidad");
  const [etiqueta, setEtiqueta] = useState("");
  const [precio, setPrecio] = useState(0);
  const [enOferta, setEnOferta] = useState(false);
  const [precioOferta, setPrecioOferta] = useState<number | "">("");
  const [observaciones, setObservaciones] = useState("");
  const [publicado, setPublicado] = useState(false);
  const [slots, setSlots] = useState<Slot[]>(slotsIniciales());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigoActual, setCodigoActual] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("categorias")
      .select("*")
      .order("orden")
      .then(({ data }) => setCategorias((data as Categoria[]) ?? []));
  }, []);

  useEffect(() => {
    if (!id) return;
    async function cargar() {
      const { data } = await supabase
        .from("productos")
        .select("*, producto_imagenes(*)")
        .eq("id", id)
        .single();
      if (!data) return;
      const p = data as Producto;
      setCodigoActual(p.codigo);
      setCategoriaId(p.categoria_id);
      setTitulo(p.titulo);
      setLink(p.link ?? "");
      setDescripcion(p.descripcion ?? "");
      setCantidad(p.cantidad);
      setUnidad(p.unidad);
      setEtiqueta(p.etiqueta ?? "");
      setPrecio(Number(p.precio));
      setEnOferta(p.en_oferta);
      setPrecioOferta(p.precio_oferta ?? "");
      setObservaciones(p.observaciones ?? "");
      setPublicado(p.publicado_catalogo);

      const imgs = (p.producto_imagenes as ProductoImagen[]) ?? [];
      setSlots(
        slotsIniciales().map((s) => {
          const existente = imgs.find(
            (i) => i.tipo === s.tipo && i.orden === s.orden
          );
          return existente ? { ...s, urlExistente: existente.url } : s;
        })
      );
    }
    cargar();
  }, [id]);

  function actualizarSlot(index: number, archivo: File | null) {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, archivo } : s))
    );
  }

  function validarImagenesObligatorias() {
    return slots
      .filter((s) => s.obligatoria)
      .every((s) => s.archivo || s.urlExistente);
  }

  async function subirImagen(archivo: File, productoId: string, slot: Slot) {
    const extension = archivo.name.split(".").pop();
    const ruta = `${productoId}/${slot.tipo}-${slot.orden}-${Date.now()}.${extension}`;
    const { error: errSubida } = await supabase.storage
      .from("productos-imagenes")
      .upload(ruta, archivo, { upsert: true });
    if (errSubida) throw errSubida;
    const { data } = supabase.storage
      .from("productos-imagenes")
      .getPublicUrl(ruta);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!categoriaId) {
      setError("Selecciona una categoría.");
      return;
    }
    if (!validarImagenesObligatorias()) {
      setError(
        "Faltan las fotos obligatorias: 1 Imagen Link y 1 Imagen Real como mínimo."
      );
      return;
    }

    setGuardando(true);
    try {
      let productoId = id;

      if (!editando) {
        const { data, error: errIns } = await supabase
          .from("productos")
          .insert({
            categoria_id: categoriaId,
            titulo,
            link: link || null,
            descripcion: descripcion || null,
            cantidad,
            unidad,
            etiqueta: etiqueta || null,
            precio,
            en_oferta: enOferta,
            precio_oferta: enOferta && precioOferta !== "" ? precioOferta : null,
            observaciones: observaciones || null,
            publicado_catalogo: publicado,
          })
          .select("id, codigo")
          .single();
        if (errIns) throw errIns;
        productoId = data.id;
        setCodigoActual(data.codigo);
      } else {
        const { error: errUpd } = await supabase
          .from("productos")
          .update({
            categoria_id: categoriaId,
            titulo,
            link: link || null,
            descripcion: descripcion || null,
            unidad,
            etiqueta: etiqueta || null,
            precio,
            en_oferta: enOferta,
            precio_oferta: enOferta && precioOferta !== "" ? precioOferta : null,
            observaciones: observaciones || null,
            publicado_catalogo: publicado,
          })
          .eq("id", id);
        if (errUpd) throw errUpd;
      }

      // Subir imágenes nuevas y guardar filas en producto_imagenes
      for (const slot of slots) {
        if (!slot.archivo || !productoId) continue;
        const url = await subirImagen(slot.archivo, productoId, slot);
        await supabase.from("producto_imagenes").upsert(
          {
            producto_id: productoId,
            tipo: slot.tipo,
            orden: slot.orden,
            url,
            es_principal: slot.tipo === "real" && slot.orden === 1,
          },
          { onConflict: "producto_id,tipo,orden" }
        );
      }

      navigate("/productos");
    } catch (err: any) {
      setError(err.message ?? "Ocurrió un error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="contenedor-formulario">
      <h1>{editando ? "Editar producto" : "Nuevo producto"}</h1>
      {codigoActual && (
        <p className="texto-suave">
          Código: <strong>{codigoActual}</strong> (automático, no editable)
        </p>
      )}

      <form onSubmit={handleSubmit} className="formulario">
        <label>
          Categoría
          <select
            required
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Título
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>

        <label>
          Link / URL de referencia
          <input value={link} onChange={(e) => setLink(e.target.value)} />
        </label>

        <label>
          Descripción
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
          />
        </label>

        <div className="fila-dos">
          <label>
            Cantidad {editando && "(usa Inventario para modificar el stock)"}
            <input
              type="number"
              min={0}
              value={cantidad}
              disabled={editando}
              onChange={(e) => setCantidad(Number(e.target.value))}
            />
          </label>

          <label>
            Unidad
            <select
              value={unidad}
              onChange={(e) => setUnidad(e.target.value as Unidad)}
            >
              <option value="unidad">Unidad</option>
              <option value="par">Par</option>
              <option value="set">Set</option>
            </select>
          </label>
        </div>

        <div className="fila-dos">
          <label>
            Precio (Bs)
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={precio}
              onChange={(e) => setPrecio(Number(e.target.value))}
            />
          </label>

          <label>
            Etiqueta
            <input
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
            />
          </label>
        </div>

        <fieldset className="fieldset-oferta">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={enOferta}
              onChange={(e) => setEnOferta(e.target.checked)}
            />
            Marcar como oferta
          </label>
          {enOferta && (
            <label>
              Precio de oferta (opcional)
              <input
                type="number"
                min={0}
                step="0.01"
                value={precioOferta}
                onChange={(e) =>
                  setPrecioOferta(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
              />
            </label>
          )}
        </fieldset>

        <label>
          Observaciones (uso interno, no se muestra en el catálogo)
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
          />
        </label>

        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={publicado}
            onChange={(e) => setPublicado(e.target.checked)}
          />
          Publicar en el catálogo público
        </label>

        <h2>Fotografías</h2>
        <p className="texto-suave">
          1 Imagen Link y 1 Imagen Real son obligatorias. Puedes agregar una
          segunda foto opcional de cada tipo.
        </p>
        <div className="grid-imagenes">
          {slots.map((slot, i) => (
            <label key={`${slot.tipo}-${slot.orden}`} className="slot-imagen">
              <span>
                Imagen {slot.tipo === "link" ? "Link" : "Real"} #{slot.orden}{" "}
                {slot.obligatoria ? "(obligatoria)" : "(opcional)"}
              </span>
              {slot.urlExistente && !slot.archivo && (
                <img src={slot.urlExistente} alt="" className="miniatura" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  actualizarSlot(i, e.target.files?.[0] ?? null)
                }
              />
            </label>
          ))}
        </div>

        {error && <div className="mensaje-error">{error}</div>}

        <button type="submit" className="btn-primario" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar producto"}
        </button>
      </form>
    </div>
  );
}
