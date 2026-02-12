/**
 * [BLOQUE DIDACTICO] client/src/useAutenticacion.ts
 * Que es: hook de acceso al contexto de autenticacion.
 * Que hace: evita importar/usear `useContext` en cada componente consumidor.
 * Como lo hace: encapsula lectura del contexto y valida que exista Provider.
 */

import { useContext } from "react";
import { ContextoAutenticacionApp } from "./authContexto";

/**
 * Hook de acceso al contexto de autenticacion.
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
