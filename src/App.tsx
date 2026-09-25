import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Productos } from "./pages/Productos";
import { ProductoForm } from "./pages/ProductoForm";
import { Inventario } from "./pages/Inventario";
import { Movimientos } from "./pages/Movimientos";
import { Ventas } from "./pages/Ventas";
import { VentaNueva } from "./pages/VentaNueva";
import { Reportes } from "./pages/Reportes";
import { Personal } from "./pages/Personal";
import { Categorias } from "./pages/Categorias";
import { Catalogo } from "./pages/catalogo/Catalogo";
import { ProductoDetallePublico } from "./pages/catalogo/ProductoDetallePublico";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Público — catálogo sin login */}
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/catalogo/producto/:id" element={<ProductoDetallePublico />} />

          {/* Autenticación */}
          <Route path="/login" element={<Login />} />

          {/* Panel interno (admin + vendedora) */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/productos/nuevo" element={<ProductoForm />} />
            <Route path="/productos/:id/editar" element={<ProductoForm />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/movimientos" element={<Movimientos />} />
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/ventas/nueva" element={<VentaNueva />} />
          </Route>

          {/* Solo administrador */}
          <Route
            element={
              <ProtectedRoute soloAdmin>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/personal" element={<Personal />} />
            <Route path="/categorias" element={<Categorias />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
