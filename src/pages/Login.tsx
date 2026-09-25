import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const err = await signIn(email, password);
    setEnviando(false);
    if (err) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    navigate("/");
  }

  return (
    <div className="pantalla-login">
      <form className="tarjeta-login" onSubmit={handleSubmit}>
        <h1>Ingresar</h1>
        <p className="texto-suave">Sistema de inventario, ventas y catálogo</p>

        <label>
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && <div className="mensaje-error">{error}</div>}

        <button type="submit" className="btn-primario" disabled={enviando}>
          {enviando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
