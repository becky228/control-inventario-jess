-- ========================================================================
-- SISTEMA DE INVENTARIO, VENTAS Y CATÁLOGO
-- Script único de base de datos — pegar completo en el SQL Editor de Supabase
-- ========================================================================
-- Este script crea TODO lo necesario: tipos de datos, tablas, funciones,
-- triggers, seguridad a nivel de fila (RLS), vistas públicas del catálogo
-- y el bucket de almacenamiento de imágenes.
--
-- Ejecutar UNA sola vez, de principio a fin, en Supabase → SQL Editor.
-- ========================================================================

create extension if not exists pgcrypto;

-- ========================================================================
-- 1. TIPOS DE DATOS (ENUMS)
-- ========================================================================
create type rol_usuario       as enum ('admin', 'vendedora');
create type estado_usuario    as enum ('activo', 'inactivo');
create type unidad_producto   as enum ('unidad', 'par', 'set');
create type estado_producto   as enum ('activo', 'inactivo', 'descontinuado');
create type tipo_imagen       as enum ('link', 'real');
create type tipo_movimiento   as enum ('ingreso', 'venta', 'devolucion', 'ajuste', 'perdida', 'salida_manual');
create type metodo_pago       as enum ('efectivo', 'qr', 'tarjeta', 'otro');
create type estado_venta      as enum ('confirmada', 'anulada');

-- ========================================================================
-- 2. TABLAS
-- ========================================================================

-- Perfiles de usuario (extiende auth.users)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         rol_usuario not null default 'vendedora',
  estado      estado_usuario not null default 'activo',
  creado_en   timestamptz not null default now()
);

-- Categorías del catálogo
create table categorias (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null unique,
  prefijo              text not null unique check (char_length(prefijo) = 4),
  visible_en_catalogo  boolean not null default true,
  orden                integer not null default 0,
  ultimo_numero        integer not null default 0,
  creado_en            timestamptz not null default now()
);

-- Productos
create table productos (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text unique,
  categoria_id         uuid not null references categorias(id),
  titulo               text not null,
  link                 text,
  descripcion          text,
  cantidad             integer not null default 0 check (cantidad >= 0),
  unidad               unidad_producto not null default 'unidad',
  etiqueta             text,
  precio               numeric(12,2) not null default 0,
  en_oferta            boolean not null default false,
  precio_oferta        numeric(12,2),
  observaciones        text,
  estado               estado_producto not null default 'activo',
  publicado_catalogo   boolean not null default false,
  creado_por           uuid references profiles(id),
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);

-- Imágenes de producto: 2 tipos (link / real), 1 obligatoria + 1 opcional cada una
create table producto_imagenes (
  id            uuid primary key default gen_random_uuid(),
  producto_id   uuid not null references productos(id) on delete cascade,
  tipo          tipo_imagen not null,
  orden         integer not null check (orden in (1,2)),
  url           text not null,
  es_principal  boolean not null default false,
  creado_en     timestamptz not null default now(),
  unique (producto_id, tipo, orden)
);

-- Movimientos de inventario (historial completo)
create table movimientos_inventario (
  id                    uuid primary key default gen_random_uuid(),
  producto_id           uuid not null references productos(id),
  tipo                  tipo_movimiento not null,
  cantidad              integer not null,
  cantidad_anterior     integer not null,
  cantidad_resultante   integer not null,
  usuario_id            uuid not null references profiles(id),
  observacion           text,
  venta_id              uuid,
  creado_en             timestamptz not null default now()
);

-- Ventas (cabecera)
create table ventas (
  id                 uuid primary key default gen_random_uuid(),
  numero             text unique,
  vendedora_id       uuid not null references profiles(id),
  fecha_hora         timestamptz not null default now(),
  subtotal           numeric(12,2) not null default 0,
  descuento          numeric(12,2) not null default 0,
  total              numeric(12,2) not null default 0,
  metodo_pago        metodo_pago not null default 'efectivo',
  observaciones      text,
  estado             estado_venta not null default 'confirmada',
  anulada_por        uuid references profiles(id),
  anulada_en         timestamptz,
  motivo_anulacion   text
);

alter table movimientos_inventario
  add constraint fk_movimiento_venta foreign key (venta_id) references ventas(id);

-- Detalle de venta (líneas de productos vendidos)
create table venta_detalle (
  id                uuid primary key default gen_random_uuid(),
  venta_id          uuid not null references ventas(id) on delete cascade,
  producto_id       uuid not null references productos(id),
  cantidad          integer not null check (cantidad > 0),
  precio_unitario   numeric(12,2) not null,
  subtotal_linea    numeric(12,2) not null
);

-- Permisos individuales (estructura preparada para el futuro)
create table permisos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references profiles(id) on delete cascade,
  clave_permiso  text not null,
  valor          boolean not null default true,
  unique (usuario_id, clave_permiso)
);

-- Auditoría de operaciones sensibles
create table auditoria (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid references profiles(id),
  accion       text not null,
  entidad      text not null,
  entidad_id   uuid,
  detalle      jsonb,
  creado_en    timestamptz not null default now()
);

create sequence ventas_numero_seq start 1;

-- ========================================================================
-- 3. FUNCIONES DE APOYO (roles)
-- ========================================================================

create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and rol = 'admin' and estado = 'activo'
  );
$$;

create or replace function is_usuario_activo()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and estado = 'activo'
  );
$$;

-- ========================================================================
-- 4. TRIGGERS: generación automática de código de producto + creado_por
-- ========================================================================

create or replace function before_insert_producto()
returns trigger language plpgsql security definer as $$
declare
  v_prefijo text;
  v_siguiente integer;
begin
  if new.creado_por is null then
    new.creado_por := auth.uid();
  end if;

  if new.codigo is null then
    select prefijo, ultimo_numero + 1 into v_prefijo, v_siguiente
      from categorias where id = new.categoria_id for update;

    if v_prefijo is null then
      raise exception 'Categoría no válida';
    end if;

    update categorias set ultimo_numero = v_siguiente where id = new.categoria_id;
    new.codigo := v_prefijo || '-' || lpad(v_siguiente::text, 4, '0');
  end if;

  return new;
end;
$$;

create trigger trg_before_insert_producto
before insert on productos
for each row execute function before_insert_producto();

-- Movimiento inicial de stock si el producto se crea con cantidad > 0
create or replace function crear_movimiento_inicial()
returns trigger language plpgsql security definer as $$
begin
  if new.cantidad > 0 then
    insert into movimientos_inventario
      (producto_id, tipo, cantidad, cantidad_anterior, cantidad_resultante, usuario_id, observacion)
    values
      (new.id, 'ingreso', new.cantidad, 0, new.cantidad, new.creado_por, 'Stock inicial al registrar producto');
  end if;
  return new;
end;
$$;

create trigger trg_movimiento_inicial
after insert on productos
for each row execute function crear_movimiento_inicial();

-- Timestamp de actualización
create or replace function actualizar_timestamp()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger trg_productos_actualizado
before update on productos
for each row execute function actualizar_timestamp();

-- Auditoría automática de productos
create or replace function auditar_producto_insert()
returns trigger language plpgsql security definer as $$
begin
  insert into auditoria(usuario_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), 'producto_creado', 'productos', new.id, to_jsonb(new));
  return new;
end;
$$;

create trigger trg_auditar_producto_insert
after insert on productos
for each row execute function auditar_producto_insert();

create or replace function auditar_producto_update()
returns trigger language plpgsql security definer as $$
begin
  insert into auditoria(usuario_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), 'producto_editado', 'productos', new.id,
    jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new)));
  return new;
end;
$$;

create trigger trg_auditar_producto_update
after update on productos
for each row execute function auditar_producto_update();

-- Crear automáticamente el perfil (rol vendedora) cuando se invita a un usuario nuevo desde Supabase Auth
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nombre, rol, estado)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email), 'vendedora', 'activo')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- ========================================================================
-- 5. FUNCIONES PRINCIPALES DEL NEGOCIO (RPC — llamadas desde el frontend)
-- ========================================================================

-- Tipo auxiliar para las líneas de una venta
create type venta_item as (
  producto_id      uuid,
  cantidad         integer,
  precio_unitario  numeric
);

-- Registrar una venta completa (cabecera + detalle + descuento de stock + movimientos)
create or replace function registrar_venta(
  p_vendedora_id   uuid,
  p_items          venta_item[],
  p_descuento      numeric,
  p_metodo_pago    metodo_pago,
  p_observaciones  text
)
returns uuid language plpgsql security definer as $$
declare
  v_venta_id uuid;
  v_subtotal numeric := 0;
  v_total numeric;
  v_item venta_item;
  v_stock_actual integer;
  v_numero text;
begin
  if not is_usuario_activo() then
    raise exception 'Usuario no autorizado';
  end if;

  if p_vendedora_id <> auth.uid() and not is_admin() then
    raise exception 'No puede registrar ventas a nombre de otro usuario';
  end if;

  foreach v_item in array p_items loop
    select cantidad into v_stock_actual from productos where id = v_item.producto_id for update;
    if v_stock_actual is null then
      raise exception 'Producto % no existe', v_item.producto_id;
    end if;
    if v_stock_actual < v_item.cantidad then
      raise exception 'Stock insuficiente para el producto %', v_item.producto_id;
    end if;
    v_subtotal := v_subtotal + (v_item.cantidad * v_item.precio_unitario);
  end loop;

  v_total := v_subtotal - coalesce(p_descuento, 0);
  v_numero := lpad(nextval('ventas_numero_seq')::text, 6, '0');

  insert into ventas (numero, vendedora_id, subtotal, descuento, total, metodo_pago, observaciones)
  values (v_numero, p_vendedora_id, v_subtotal, coalesce(p_descuento,0), v_total, p_metodo_pago, p_observaciones)
  returning id into v_venta_id;

  foreach v_item in array p_items loop
    insert into venta_detalle(venta_id, producto_id, cantidad, precio_unitario, subtotal_linea)
    values (v_venta_id, v_item.producto_id, v_item.cantidad, v_item.precio_unitario,
            v_item.cantidad * v_item.precio_unitario);

    update productos set cantidad = cantidad - v_item.cantidad
      where id = v_item.producto_id
      returning cantidad into v_stock_actual;

    insert into movimientos_inventario
      (producto_id, tipo, cantidad, cantidad_anterior, cantidad_resultante, usuario_id, venta_id)
    values
      (v_item.producto_id, 'venta', v_item.cantidad, v_stock_actual + v_item.cantidad, v_stock_actual,
       auth.uid(), v_venta_id);
  end loop;

  insert into auditoria(usuario_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), 'venta_creada', 'ventas', v_venta_id, jsonb_build_object('numero', v_numero, 'total', v_total));

  return v_venta_id;
end;
$$;

-- Anular una venta (solo administrador) sin borrar el historial
create or replace function anular_venta(p_venta_id uuid, p_motivo text)
returns void language plpgsql security definer as $$
declare
  v_detalle record;
  v_stock_actual integer;
begin
  if not is_admin() then
    raise exception 'Solo el administrador puede anular ventas';
  end if;

  update ventas
    set estado = 'anulada', anulada_por = auth.uid(), anulada_en = now(), motivo_anulacion = p_motivo
    where id = p_venta_id and estado = 'confirmada';

  if not found then
    raise exception 'Venta no encontrada o ya anulada';
  end if;

  for v_detalle in select * from venta_detalle where venta_id = p_venta_id loop
    update productos set cantidad = cantidad + v_detalle.cantidad
      where id = v_detalle.producto_id
      returning cantidad into v_stock_actual;

    insert into movimientos_inventario
      (producto_id, tipo, cantidad, cantidad_anterior, cantidad_resultante, usuario_id, venta_id, observacion)
    values
      (v_detalle.producto_id, 'devolucion', v_detalle.cantidad, v_stock_actual - v_detalle.cantidad, v_stock_actual,
       auth.uid(), p_venta_id, 'Reposición por anulación de venta');
  end loop;

  insert into auditoria(usuario_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), 'venta_anulada', 'ventas', p_venta_id, jsonb_build_object('motivo', p_motivo));
end;
$$;

-- Ingreso de mercadería (solo administrador)
create or replace function registrar_ingreso(
  p_producto_id  uuid,
  p_cantidad     integer,
  p_observacion  text
)
returns void language plpgsql security definer as $$
declare
  v_stock_actual integer;
  v_nuevo_stock integer;
begin
  if not is_admin() then
    raise exception 'Solo el administrador puede registrar ingresos de mercadería';
  end if;
  if p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  select cantidad into v_stock_actual from productos where id = p_producto_id for update;
  v_nuevo_stock := v_stock_actual + p_cantidad;

  update productos set cantidad = v_nuevo_stock where id = p_producto_id;

  insert into movimientos_inventario
    (producto_id, tipo, cantidad, cantidad_anterior, cantidad_resultante, usuario_id, observacion)
  values
    (p_producto_id, 'ingreso', p_cantidad, v_stock_actual, v_nuevo_stock, auth.uid(), p_observacion);
end;
$$;

-- Movimientos manuales: ajuste / pérdida / salida manual (solo administrador)
create or replace function registrar_movimiento_manual(
  p_producto_id   uuid,
  p_tipo          tipo_movimiento,
  p_cantidad      integer,
  p_observacion   text
)
returns void language plpgsql security definer as $$
declare
  v_stock_actual integer;
  v_nuevo_stock integer;
begin
  if not is_admin() then
    raise exception 'Solo el administrador puede registrar este tipo de movimiento';
  end if;

  if p_tipo not in ('ajuste', 'perdida', 'salida_manual') then
    raise exception 'Tipo de movimiento no válido para esta función';
  end if;

  select cantidad into v_stock_actual from productos where id = p_producto_id for update;

  if p_tipo = 'ajuste' then
    v_nuevo_stock := p_cantidad; -- cantidad final luego del ajuste físico
  else
    v_nuevo_stock := v_stock_actual - p_cantidad;
    if v_nuevo_stock < 0 then
      raise exception 'La cantidad supera el stock disponible';
    end if;
  end if;

  update productos set cantidad = v_nuevo_stock where id = p_producto_id;

  insert into movimientos_inventario
    (producto_id, tipo, cantidad, cantidad_anterior, cantidad_resultante, usuario_id, observacion)
  values
    (p_producto_id, p_tipo, abs(v_nuevo_stock - v_stock_actual), v_stock_actual, v_nuevo_stock,
     auth.uid(), p_observacion);

  insert into auditoria(usuario_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), 'movimiento_manual', 'movimientos_inventario', p_producto_id,
          jsonb_build_object('tipo', p_tipo, 'observacion', p_observacion));
end;
$$;

-- Cambiar estado de un producto (activo/inactivo/descontinuado) — solo administrador
create or replace function cambiar_estado_producto(p_producto_id uuid, p_estado estado_producto)
returns void language plpgsql security definer as $$
begin
  if not is_admin() then
    raise exception 'Solo el administrador puede cambiar el estado de un producto';
  end if;
  update productos set estado = p_estado where id = p_producto_id;

  insert into auditoria(usuario_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), 'producto_estado_cambiado', 'productos', p_producto_id,
          jsonb_build_object('nuevo_estado', p_estado));
end;
$$;

-- Activar/desactivar un usuario (vendedora) — solo administrador
create or replace function cambiar_estado_usuario(p_usuario_id uuid, p_estado estado_usuario)
returns void language plpgsql security definer as $$
begin
  if not is_admin() then
    raise exception 'Solo el administrador puede cambiar el estado de un usuario';
  end if;
  update profiles set estado = p_estado where id = p_usuario_id;

  insert into auditoria(usuario_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(),
          case when p_estado = 'inactivo' then 'usuario_desactivado' else 'usuario_reactivado' end,
          'profiles', p_usuario_id, jsonb_build_object('nuevo_estado', p_estado));
end;
$$;

-- Crear una categoría nueva con prefijo propio — solo administrador
create or replace function crear_categoria(p_nombre text, p_prefijo text)
returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'Solo el administrador puede crear categorías';
  end if;
  insert into categorias(nombre, prefijo) values (p_nombre, upper(p_prefijo))
  returning id into v_id;
  return v_id;
end;
$$;

-- ========================================================================
-- 6. SEGURIDAD A NIVEL DE FILA (ROW LEVEL SECURITY)
-- ========================================================================

alter table profiles                enable row level security;
alter table categorias              enable row level security;
alter table productos               enable row level security;
alter table producto_imagenes       enable row level security;
alter table movimientos_inventario  enable row level security;
alter table ventas                  enable row level security;
alter table venta_detalle           enable row level security;
alter table permisos                enable row level security;
alter table auditoria               enable row level security;

-- profiles
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_admin());
create policy profiles_update_admin on profiles for update
  using (is_admin());

-- categorias
create policy categorias_select on categorias for select
  using (is_usuario_activo());
create policy categorias_insert_admin on categorias for insert
  with check (is_admin());
create policy categorias_update_admin on categorias for update
  using (is_admin());

-- productos
create policy productos_select on productos for select
  using (is_usuario_activo());
create policy productos_insert on productos for insert
  with check (is_usuario_activo());
create policy productos_update on productos for update
  using (is_admin() or (creado_por = auth.uid() and is_usuario_activo()));
-- No hay política de UPDATE de "estado" para vendedoras: el cambio de estado
-- (desactivar/eliminar) sólo puede hacerse mediante cambiar_estado_producto(),
-- que valida is_admin() internamente. La política de arriba permite editar
-- otros campos del producto propio, incluyendo "estado" a nivel de fila —
-- si se desea impedir por completo que la vendedora toque "estado" desde una
-- edición normal, controlarlo también en el formulario del frontend.

-- producto_imagenes
create policy imagenes_select on producto_imagenes for select using (is_usuario_activo());
create policy imagenes_insert on producto_imagenes for insert
  with check (
    is_admin() or exists (select 1 from productos p where p.id = producto_id and p.creado_por = auth.uid())
  );
create policy imagenes_delete on producto_imagenes for delete
  using (
    is_admin() or exists (select 1 from productos p where p.id = producto_id and p.creado_por = auth.uid())
  );

-- movimientos_inventario (solo lectura directa; las escrituras van por las funciones RPC)
create policy movimientos_select on movimientos_inventario for select using (is_usuario_activo());

-- ventas (solo lectura directa; crear/anular van por registrar_venta / anular_venta)
create policy ventas_select on ventas for select using (is_usuario_activo());

-- venta_detalle
create policy venta_detalle_select on venta_detalle for select using (is_usuario_activo());

-- permisos
create policy permisos_select on permisos for select using (is_admin() or usuario_id = auth.uid());
create policy permisos_admin_todo on permisos for all using (is_admin());

-- auditoria (solo administrador)
create policy auditoria_select_admin on auditoria for select using (is_admin());

-- ========================================================================
-- 7. VISTAS PÚBLICAS DEL CATÁLOGO (sin login, para clientes)
-- ========================================================================
-- Estas vistas exponen SOLO los campos pensados para el cliente. Nunca
-- incluyen observaciones, usuario que registró, costos ni datos internos.

create or replace view vista_catalogo as
select
  p.id,
  p.codigo,
  c.nombre as categoria,
  p.titulo,
  p.descripcion,
  p.precio,
  p.en_oferta,
  p.precio_oferta,
  case when p.cantidad > 0 then 'disponible' else 'agotado' end as disponibilidad,
  (
    select json_agg(json_build_object('url', pi.url, 'tipo', pi.tipo, 'es_principal', pi.es_principal)
           order by pi.es_principal desc, pi.tipo, pi.orden)
    from producto_imagenes pi where pi.producto_id = p.id
  ) as imagenes
from productos p
join categorias c on c.id = p.categoria_id
where p.estado = 'activo' and p.publicado_catalogo = true;

grant select on vista_catalogo to anon, authenticated;

create or replace view vista_categorias_publico as
select id, nombre from categorias where visible_en_catalogo = true order by orden;

grant select on vista_categorias_publico to anon, authenticated;

-- ========================================================================
-- 8. ALMACENAMIENTO DE IMÁGENES (Supabase Storage)
-- ========================================================================

insert into storage.buckets (id, name, public)
values ('productos-imagenes', 'productos-imagenes', true)
on conflict (id) do nothing;

create policy "lectura publica productos imagenes"
on storage.objects for select
using (bucket_id = 'productos-imagenes');

create policy "usuarios activos suben imagenes"
on storage.objects for insert
with check (bucket_id = 'productos-imagenes' and is_usuario_activo());

create policy "admin o dueno elimina imagenes"
on storage.objects for delete
using (bucket_id = 'productos-imagenes' and (is_admin() or owner = auth.uid()));

-- ========================================================================
-- 9. CATEGORÍAS INICIALES (24 categorías confirmadas)
-- ========================================================================

insert into categorias (nombre, prefijo, orden) values
  ('Cocina',                  'COCI', 1),
  ('Herramientas',            'HERR', 2),
  ('Juguetes',                'JUGU', 3),
  ('Automóvil',               'AUTO', 4),
  ('Camping',                 'CAMP', 5),
  ('Jardinería',              'JARD', 6),
  ('Manualidades',            'MANU', 7),
  ('Decoración',               'DECO', 8),
  ('Pesca',                   'PESC', 9),
  ('Parrilla',                'PARR', 10),
  ('Otros',                   'OTRO', 11),
  ('Muebles',                 'MUEB', 12),
  ('Piscina',                 'PISC', 13),
  ('Ropa de cama',            'ROPA', 14),
  ('Cosméticos',               'COSM', 15),
  ('Cotillón',                 'COTI', 16),
  ('Bebé',                     'BEBE', 17),
  ('Prohibidos',              'PROH', 18),
  ('Salud',                   'SALU', 19),
  ('Mascotas',                'MASC', 20),
  ('Material de escritorio',  'MATE', 21),
  ('Halloween',                'HALL', 22),
  ('Navidad',                  'NAVI', 23),
  ('Deporte',                 'DEPO', 24);

-- ========================================================================
-- FIN DEL SCRIPT
-- ========================================================================
-- Próximos pasos manuales (fuera de este script):
-- 1) Crear el usuario administrador en Supabase → Authentication → Users.
-- 2) Ejecutar el UPDATE indicado en la guía para convertirlo en admin.
-- Ver la guía de instalación para el detalle paso a paso.
-- ========================================================================
