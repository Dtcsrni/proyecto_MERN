import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

export const esquemaMapearClassroom = z
  .object({
    periodoId: esquemaObjectId,
    courseId: z.string().trim().min(1).max(128),
    courseWorkId: z.string().trim().min(1).max(128),
    tituloEvidencia: z.string().trim().min(1).max(180).optional(),
    descripcionEvidencia: z.string().trim().max(600).optional(),
    ponderacion: z.number().min(0).max(100).optional(),
    corte: z.number().int().min(1).max(3).optional(),
    activo: z.boolean().optional(),
    asignacionesAlumnos: z
      .array(
        z
          .object({
            classroomUserId: z.string().trim().min(1).max(128),
            alumnoId: esquemaObjectId
          })
          .strict()
      )
      .max(300)
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

export const esquemaPullClassroom = z
  .object({
    periodoId: esquemaObjectId,
    courseId: z.string().trim().min(1).max(128).optional(),
    courseWorkId: z.string().trim().min(1).max(128).optional(),
    dryRun: z.boolean().optional(),
    limiteSubmissions: z.number().int().min(1).max(500).optional()
  })
  .strict();
