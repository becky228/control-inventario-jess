import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const esAdmin = profile?.rol === "admin";

  async function handleSalir() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-marca">Tienda</div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          <NavLink to="/productos">Productos</NavLink>
          <NavLink to="/productos/nuevo">Nuevo producto</NavLink>
          <NavLink to="/inventario">Inventario</NavLink>
          <NavLink to="/movimientos">Movimientos</NavLink>
          <NavLink to="/ventas">Ventas</NavLink>
          <NavLink to="/ventas/nueva">Nueva venta</NavLink>
          {esAdmin && <NavLink to="/reportes">Reportes</NavLink>}
          {esAdmin && <NavLink to="/personal">Personal</NavLink>}
          {esAdmin && <NavLink to="/categorias">Categorías</NavLink>}
          <a href="/catalogo" target="_blank" rel="noreferrer">
            Ver catálogo público ↗
          </a>
        </nav>
        <div className="sidebar-usuario">
          <div>
            <strong>{profile?.nombre}</strong>
            <div className="rol-badge">{profile?.rol}</div>
          </div>
          <button onClick={handleSalir} className="btn-texto">
            Salir
          </button>
        </div>
      </aside>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
