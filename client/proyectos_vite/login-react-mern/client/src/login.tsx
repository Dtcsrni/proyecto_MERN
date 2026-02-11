/**
 * [BLOQUE DIDACTICO] client/src/login.tsx
 * Que es: Pantalla de inicio de sesion.
 * Que hace: Captura credenciales, autentica usuario y redirige en exito.
 * Como lo hace: Maneja formulario con estado local y llama iniciarSesion del contexto.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAutenticacion } from "./useAutenticacion";

/**
 * GUIA (Frontend) - pantalla de login
 *
 * 1) Que es:
 * - Componente de interfaz para iniciar sesion.
 *
 * 2) Que hace:
 * - Lee correo y contrasena del formulario.
 * - Llama `iniciarSesion` del Provider.
 * - Redirige al inicio en exito.
 * - Muestra mensaje si hay error.
 *
 * 3) Por que se disena asi:
 * - Este componente solo maneja experiencia de usuario.
 * - La logica de autenticacion real vive en el Provider/API.
 */
export default function Login() {
  const { iniciarSesion } = useAutenticacion();
  const navegar = useNavigate();

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Flujo LOGIN UI - Paso 1: interceptar submit del formulario.
  async function alEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    try {
      // Paso 2: delegar autenticacion al caso de uso del contexto.
      await iniciarSesion(correo, contrasena);
      // Paso 3: entrar al home; `replace` evita volver al login con "atras".
      navegar("/", { replace: true });
    } catch (error: unknown) {
      // Paso 4 (error): mensaje amigable para usuario.
      const mensaje = error instanceof Error ? error.message : "No se pudo iniciar sesión.";
      setError(mensaje);
    }
  }

  return (
    <section className="panel login-panel">
      <h1>Iniciar sesión</h1>

      <form onSubmit={alEnviar}>
        <label htmlFor="correo">Correo</label>
        <input
          id="correo"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          autoComplete="email"
          required
        />

        <label htmlFor="contrasena">Contraseña</label>
        <input
          id="contrasena"
          type="password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          autoComplete="current-password"
          required
        />

        <button type="submit">Entrar</button>
      </form>

      {error && <p className="error-message">{error}</p>}
      <p className="aux-link">
        ¿No tienes cuenta? <Link to="/register">Crear cuenta</Link>
      </p>
    </section>
  );
}
