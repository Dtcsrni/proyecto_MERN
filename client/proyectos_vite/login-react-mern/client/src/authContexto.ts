/**
 * [BLOQUE DIDACTICO] client/src/authContexto.ts
 * Que es: Contexto React para compartir estado de auth.
 * Que hace: Permite que cualquier componente consuma la sesion sin prop drilling.
 * Como lo hace: Crea un contexto tipado inicializado en null para uso con Provider.
 */

import { createContext } from "react";
import type { ContextoAutenticacion } from "./authTipos";

/**
 * Contenedor React para compartir estado de autenticación.
 *
 * Por qué inicia en `null`:
 * - Obliga a consumirlo dentro de `ProveedorAutenticacion`.
 * - Si alguien lo usa fuera, el hook lanza error temprano (fail fast).
 */
export const ContextoAutenticacionApp = createContext<ContextoAutenticacion | null>(null);
