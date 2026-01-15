/**
 * Validaciones de alumnos.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

export const esquemaCrearAlumno = z.object({
  periodoId: esquemaObjectId,
  matricula: z.string().min(1),
  nombreCompleto: z.string().min(1),
  correo: z.string().email().optional(),
  grupo: z.string().optional(),
  activo: z.boolean().optional()
});
