import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Rol } from "../lib/types";

export function ProtectedRoute({
  children,
  soloAdmin = false,
}: {
  children: ReactNode;
  soloAdmin?: boolean;
}) {
  const { profile, loading } = useAuth();

  if (loading) return <div className="pantalla-carga">Cargando…</div>;

  if (!profile) return <Navigate to="/login" replace />;

  if (profile.estado !== "activo") {
    return (
      <div className="pantalla-carga">
        Tu usuario está desactivado. Contacta al administrador.
      </div>
    );
  }

  const rolPermitido: Rol[] = soloAdmin ? ["admin"] : ["admin", "vendedora"];
  if (!rolPermitido.includes(profile.rol)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
