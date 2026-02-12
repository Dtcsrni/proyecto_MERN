/**
 * [BLOQUE DIDACTICO] client/src/authContexto.ts
 * Que es: contexto React del dominio de autenticacion.
 * Que hace: comparte estado/acciones de sesion sin prop drilling.
 * Como lo hace: crea un contexto tipado con valor inicial `null`.
 */

import { createContext } from "react";
import type { ContextoAutenticacion } from "./authTipos";

/**
 * Contenedor React para compartir estado de autenticacion.
 *
 * Por qué inicia en `null`:
 * - Obliga a consumirlo dentro de `ProveedorAutenticacion`.
 * - Si alguien lo usa fuera, el hook lanza error temprano (fail fast).
 */
export const ContextoAutenticacionApp = createContext<ContextoAutenticacion | null>(null);
