# Sistema de Inventario, Ventas y Catálogo

Aplicación web construida con React + TypeScript + Vite, conectada a Supabase
(base de datos, autenticación e imágenes) y lista para publicarse en Netlify.

---

## 1. Base de datos (Supabase)

1. Entra a tu proyecto de Supabase → **SQL Editor**.
2. Pega **todo** el contenido de `schema.sql` (entregado en el mensaje anterior)
   y ejecútalo. Esto crea las tablas, la seguridad (RLS), las 24 categorías,
   el catálogo público y el bucket de imágenes — automáticamente.
3. Ve a **Authentication → Users → Add user** y crea tu usuario administrador
   (correo + contraseña que tú definas).
4. Copia el UUID de ese usuario y ejecuta en el SQL Editor:
   ```sql
   update profiles set rol = 'admin', nombre = 'Tu nombre' where id = 'PEGA-AQUI-EL-UUID';
   ```

## 2. Conectar la aplicación

1. Copia `.env.example` a un archivo nuevo llamado `.env`.
2. Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los datos de
   tu proyecto (Supabase → Project Settings → API).
3. Opcional: completa `VITE_WHATSAPP_NUMERO` con el número de la tienda en
   formato internacional (ej. `59171234567`) para activar el botón de
   WhatsApp en el catálogo.

## 3. Instalar y probar localmente

```bash
npm install
npm run dev
```

Abre la URL que te indique la terminal (normalmente `http://localhost:5173`).

- Panel interno: `/` (pide iniciar sesión).
- Catálogo público: `/catalogo` (sin iniciar sesión).

## 4. Publicar en Netlify

1. Sube este proyecto a un repositorio de GitHub (o arrastra la carpeta
   directamente a Netlify si prefieres no usar Git).
2. En Netlify: **Add new site → Import an existing project**.
3. Build command: `npm run build` — Publish directory: `dist`
   (esto ya está configurado en `netlify.toml`).
4. En **Site settings → Environment variables**, agrega las mismas variables
   de tu archivo `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, y
   `VITE_WHATSAPP_NUMERO` si la usas).
5. Despliega. Netlify te dará una URL pública para la app.

## 5. Creación de vendedoras desde dentro del software

La pantalla **Personal** (solo administrador) invita a nuevas vendedoras por
correo, tal como se definió en la Fase 2/3. Para que el botón "Invitar
vendedora" funcione, hace falta desplegar una pequeña función de servidor
(Edge Function) que ya está escrita en `supabase/functions/invitar-usuario/`.

Esto requiere instalar **una sola vez** la CLI de Supabase (no hace falta
usarla para nada más):

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU-PROJECT-REF
supabase functions deploy invitar-usuario
```

El "PROJECT-REF" lo encuentras en la URL de tu proyecto de Supabase
(`https://TU-PROJECT-REF.supabase.co`). Una vez desplegada, el botón de
invitar vendedoras funciona directamente desde el panel, sin volver a tocar
Supabase.

> Si prefieres evitar este paso por ahora, puedes seguir creando vendedoras
> manualmente desde Supabase → Authentication → Add user (el trigger del
> script SQL les crea automáticamente su perfil con rol "vendedora").

## 6. Qué se implementó (resumen)

- Login y sesión con Supabase Auth.
- Roles: administrador y vendedora, con permisos distintos en cada pantalla.
- Productos: alta con código automático por categoría, 2 imágenes
  obligatorias (Link + Real) y 2 opcionales, edición restringida al dueño
  del registro (o admin), publicación al catálogo, marcado de oferta.
- Inventario: consulta de stock, ingresos, ajustes, pérdidas y salidas
  manuales (exclusivo administrador).
- Historial de movimientos con filtros.
- Ventas: carrito con validación de stock, descuento libre, métodos de
  pago, anulación exclusiva del administrador con reposición de stock.
- Reportes (solo administrador): filtros combinables (fecha, vendedora,
  categoría), tarjetas de resumen, gráficos de ventas por día y por
  vendedora, tabla dinámica categoría × vendedora, exportación a Excel y PDF.
- Personal: invitar vendedoras, activar/desactivar.
- Categorías: alta de categorías nuevas con prefijo propio (fijo).
- Catálogo público sin login: búsqueda, filtro por categoría, sección de
  ofertas, ficha de producto con galería y botón de WhatsApp opcional.
- Auditoría automática de creación/edición de productos, ventas, anulaciones
  y cambios de estado de usuarios (se guarda en la tabla `auditoria`; aún no
  tiene pantalla propia — ver "Pendientes" abajo).

## 7. Pendientes / próximos pasos sugeridos

- Pantalla para que el administrador consulte la tabla `auditoria` desde la
  interfaz (hoy se registra correctamente en la base de datos, pero no hay
  una vista dedicada para navegarla).
- Pantalla de edición de permisos individuales (la tabla `permisos` ya
  existe y está preparada, pero hoy todas las vendedoras comparten el mismo
  set de permisos, tal como se definió).
- Recuperación de contraseña / cambio de contraseña desde el panel.
- Paginación en listados con muchos productos o ventas (hoy se limita a
  200/100 registros recientes; con más de 1.000 productos conviene agregar
  paginación o scroll infinito).
