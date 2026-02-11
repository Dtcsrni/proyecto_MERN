import { useContext } from "react";
import { ContextoAutenticacionApp } from "./authContexto";

/**
 * Hook de acceso al contexto de autenticación.
 *
 * Qué hace:
 * - Devuelve el contexto ya tipado para usarlo en componentes.
 *
 * Por qué lanza error:
 * - Si se usa fuera del Provider, preferimos fallar de inmediato y con mensaje claro
 *   en lugar de generar bugs silenciosos en tiempo de ejecución.
 */
export function useAutenticacion() {
  const contexto = useContext(ContextoAutenticacionApp);
  if (!contexto) throw new Error("useAutenticacion debe usarse dentro de ProveedorAutenticacion");
  return contexto;
}
