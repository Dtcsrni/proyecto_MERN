import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usarAutenticacion } from "./autenticacion";

/**
 * UI de login (2.5.1 Aplicaciones para usuarios):
 * - Captura correo y contraseña
 * - Llama iniciarSesion
 * - Si ok: redirige a /
 */
export default function Login() {
  const { iniciarSesion } = usarAutenticacion();
  const navegar = useNavigate();

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function alEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    try {
      await iniciarSesion(correo, contrasena);
      navegar("/", { replace: true });
    } catch (e: any) {
      setError(e.message || "No se pudo iniciar sesión.");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2>Iniciar sesión</h2>

      <form onSubmit={alEnviar}>
        <label>Correo</label>
        <input value={correo} onChange={(e) => setCorreo(e.target.value)} />

        <label>Contraseña</label>
        <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} />

        <button type="submit">Entrar</button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}