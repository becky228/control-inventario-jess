import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { supabaseConfigError } from "./lib/supabase";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (supabaseConfigError) {
  root.render(
    <div className="pantalla-carga">
      {supabaseConfigError} Contacta al administrador del sitio.
    </div>
  );
} else {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
