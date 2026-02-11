import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAutenticacion } from "./useAutenticacion";

/**
 * Pantalla de creación de cuenta.
 *
 * Flujo:
 * - Valida formato básico en cliente.
 * - Crea cuenta en backend.
 * - Si registro fue exitoso, entra a la app con sesión iniciada.
 */
export default function Register() {
  const { registrarCuenta } = useAutenticacion();
  const navegar = useNavigate();

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function alEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    const correoNormalizado = correo.trim().toLowerCase();
    if (!correoNormalizado) {
      setError("El correo es obligatorio.");
      return;
    }
    if (contrasena.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (contrasena !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      await registrarCuenta(correoNormalizado, contrasena);
      navegar("/", { replace: true });
    } catch (errorDesconocido: unknown) {
      const mensaje =
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No se pudo crear la cuenta.";
      setError(mensaje);
    }
  }

  return (
    <section className="panel login-panel">
      <h1>Crear cuenta</h1>

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
          autoComplete="new-password"
          minLength={8}
          required
        />

        <label htmlFor="confirmacion">Confirmar contraseña</label>
        <input
          id="confirmacion"
          type="password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />

        <button type="submit">Crear cuenta</button>
      </form>

      {error && <p className="error-message">{error}</p>}
      <p className="aux-link">
        ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
      </p>
    </section>
  );
}
