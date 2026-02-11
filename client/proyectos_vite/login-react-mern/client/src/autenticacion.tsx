import React, { useEffect, useState } from "react";
import { consultarApi } from "./api";
import { ContextoAutenticacionApp } from "./authContexto";
import type { UsuarioToken } from "./authTipos";

/**
 * GUIA (Frontend) - modulo de sesion
 *
 * 1) Que es:
 * - Este Provider es la "fuente de verdad" del estado de autenticacion en React.
 *
 * 2) Que hace:
 * - Guarda `usuario` y `cargando`.
 * - Consulta `/api/auth/me` al iniciar para saber si ya existe sesion.
 * - Expone acciones de negocio: `iniciarSesion` y `cerrarSesion`.
 *
 * 3) Por que se disena asi:
 * - Los componentes de UI no deben repetir logica de auth.
 * - Rutas protegidas y vistas leen un estado centralizado y consistente.
 */
export function ProveedorAutenticacion({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioToken | null>(null);
  // Paso 0 del flujo: mientras verificamos cookie, la app no decide redirecciones.
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Flujo SESION - Paso 1:
    // Al montar, preguntamos al backend por la sesion actual.
    (async () => {
      try {
        // Paso 2a (sesion valida): backend devuelve usuario.
        const respuesta = await consultarApi<{ usuario: UsuarioToken }>("/api/auth/me");
        setUsuario(respuesta.usuario);
      } catch {
        // Paso 2b (sin sesion o token invalido): se trabaja como invitado.
        setUsuario(null);
      } finally {
        // Paso 3: termina fase de carga y ya se puede decidir navegacion.
        setCargando(false);
      }
    })();
  }, []);

  // Flujo LOGIN - Paso 1:
  // La UI envia correo/contrasena y este modulo coordina la llamada.
  async function iniciarSesion(correo: string, contrasena: string) {
    const respuesta = await consultarApi<{ usuario: UsuarioToken }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ correo, contrasena })
    });
    // Paso 2:
    // Si login fue exitoso, backend ya dejo cookie HttpOnly y devolvio usuario.
    setUsuario(respuesta.usuario);
  }

  // Flujo LOGOUT - Paso 1:
  // Se invalida/borrar cookie en servidor.
  // Paso 2:
  // Se limpia estado local para reflejar salida inmediata en UI.
  async function cerrarSesion() {
    await consultarApi("/api/auth/logout", { method: "POST" });
    setUsuario(null);
  }

  return (
    <ContextoAutenticacionApp.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </ContextoAutenticacionApp.Provider>
  );
}
