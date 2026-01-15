/**
 * Validaciones de banderas de revision.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

export const esquemaCrearBandera = z.object({
  examenGeneradoId: esquemaObjectId,
  alumnoId: esquemaObjectId,
  tipo: z.enum(['similitud', 'patron', 'duplicado', 'otro']),
  severidad: z.enum(['baja', 'media', 'alta']).optional(),
  descripcion: z.string().optional(),
  sugerencia: z.string().optional()
});

export const esquemaExportarCsv = z.object({
  columnas: z.array(z.string().trim().min(1)).min(1),
  filas: z.array(z.record(z.string(), z.unknown()))
});
