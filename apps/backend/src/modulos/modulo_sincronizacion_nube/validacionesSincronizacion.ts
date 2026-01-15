/**
 * Validaciones de sincronizacion a nube.
 *
 * Nota:
 * - Se valida lo minimo necesario para mantener contract tests estables.
 * - La autorizacion por objeto (docenteId) se aplica via middleware JWT y
 *   filtros en queries (ver `controladorSincronizacion.ts`).
 */
import { z } from 'zod';

export const esquemaPublicarResultados = z.object({
  periodoId: z.string().min(1)
});

export const esquemaGenerarCodigoAcceso = z.object({
  periodoId: z.string().min(1)
});
