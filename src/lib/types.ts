export type Rol = "admin" | "vendedora";
export type EstadoUsuario = "activo" | "inactivo";
export type Unidad = "unidad" | "par" | "set";
export type EstadoProducto = "activo" | "inactivo" | "descontinuado";
export type TipoImagen = "link" | "real";
export type TipoMovimiento =
  | "ingreso"
  | "venta"
  | "devolucion"
  | "ajuste"
  | "perdida"
  | "salida_manual";
export type MetodoPago = "efectivo" | "qr" | "tarjeta" | "otro";
export type EstadoVenta = "confirmada" | "anulada";

export interface Profile {
  id: string;
  nombre: string;
  rol: Rol;
  estado: EstadoUsuario;
  creado_en: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  prefijo: string;
  visible_en_catalogo: boolean;
  orden: number;
  ultimo_numero: number;
}

export interface ProductoImagen {
  id: string;
  producto_id: string;
  tipo: TipoImagen;
  orden: number;
  url: string;
  es_principal: boolean;
}

export interface Producto {
  id: string;
  codigo: string;
  categoria_id: string;
  titulo: string;
  link: string | null;
  descripcion: string | null;
  cantidad: number;
  unidad: Unidad;
  etiqueta: string | null;
  precio: number;
  en_oferta: boolean;
  precio_oferta: number | null;
  observaciones: string | null;
  estado: EstadoProducto;
  publicado_catalogo: boolean;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
  categorias?: Categoria;
  producto_imagenes?: ProductoImagen[];
}

export interface MovimientoInventario {
  id: string;
  producto_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  cantidad_anterior: number;
  cantidad_resultante: number;
  usuario_id: string;
  observacion: string | null;
  venta_id: string | null;
  creado_en: string;
  productos?: Producto;
  profiles?: Profile;
}

export interface Venta {
  id: string;
  numero: string;
  vendedora_id: string;
  fecha_hora: string;
  subtotal: number;
  descuento: number;
  total: number;
  metodo_pago: MetodoPago;
  observaciones: string | null;
  estado: EstadoVenta;
  anulada_por: string | null;
  anulada_en: string | null;
  motivo_anulacion: string | null;
  profiles?: Profile;
  venta_detalle?: VentaDetalle[];
}

export interface VentaDetalle {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal_linea: number;
  productos?: Producto;
}

export interface VistaCatalogoItem {
  id: string;
  codigo: string;
  categoria: string;
  titulo: string;
  descripcion: string | null;
  precio: number;
  en_oferta: boolean;
  precio_oferta: number | null;
  disponibilidad: "disponible" | "agotado";
  imagenes: { url: string; tipo: TipoImagen; es_principal: boolean }[] | null;
}
