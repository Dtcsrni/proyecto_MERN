/**
 * [BLOQUE DIDACTICO] client/src/RutaProtegida.tsx
 * Que es: Componente guard para rutas privadas.
 * Que hace: Bloquea acceso sin sesion o sin rol y redirige segun politica.
 * Como lo hace: Lee contexto de auth y decide entre children o Navigate.
 */

import React from "react";
import { Navigate } from "react-router-dom";
import type { Rol } from "./authTipos";
import { useAutenticacion } from "./useAutenticacion";

/**
 * GUIA (Frontend) - guard de ruta protegida
 *
 * 1) Que es:
 * - Componente que decide si una vista privada se puede mostrar.
 *
 * 2) Que hace:
 * - Espera a que termine la validacion de sesion.
 * - Si no hay usuario, redirige a `/login`.
 * - Si la ruta pide roles, valida si el rol del usuario aplica.
 * - Si todo esta bien, renderiza `children`.
 *
 * 3) Por que se disena asi:
 * - Evita duplicar checks de sesion/roles en cada pagina.
 * - Hace consistente la seguridad de navegacion en todo el frontend.
 */
export function RutaProtegida({
  children,
  rolesPermitidos
}: {
  children: React.ReactNode;
  rolesPermitidos?: Rol[];
}) {
  const { usuario, cargando } = useAutenticacion();

  // Paso 1: aun no sabemos si hay sesion, por eso no redirigimos todavia.
  if (cargando) {
    return <div className="panel">Cargando sesión...</div>;
  }

  // Paso 2: sin sesion -> enviar al login.
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  // Paso 3: si la ruta exige rol, validar autorizacion.
  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/" replace />;
  }

  // Paso 4: usuario autenticado/autorizado -> mostrar contenido.
  return <>{children}</>;
}
