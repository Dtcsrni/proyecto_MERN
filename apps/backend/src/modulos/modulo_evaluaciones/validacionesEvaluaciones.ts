import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

const esquemaFecha = z
  .string()
  .trim()
  .datetime({ offset: true })
  .or(z.string().trim().date())
  .transform((value) => new Date(value).toISOString());

export const esquemaCrearPolitica = z
  .object({
    codigo: z.enum(['POLICY_SV_EXCEL_2026', 'POLICY_LISC_ENCUADRE_2026']),
    version: z.number().int().min(1),
    nombre: z.string().trim().min(3).max(120),
    descripcion: z.string().trim().max(400).optional(),
    activa: z.boolean().optional(),
    parametros: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

export const esquemaConfigurarPeriodo = z
  .object({
    periodoId: esquemaObjectId,
    politicaCodigo: z.enum(['POLICY_SV_EXCEL_2026', 'POLICY_LISC_ENCUADRE_2026']),
    politicaVersion: z.number().int().min(1).optional(),
    cortes: z
      .array(
        z
          .object({
            numero: z.number().int().min(1).max(3),
            nombre: z.string().trim().min(1).max(120).optional(),
            fechaCorte: esquemaFecha,
            pesoContinua: z.number().min(0).max(1).optional(),
            pesoExamen: z.number().min(0).max(1).optional(),
            pesoBloqueExamenes: z.number().min(0).max(1).optional()
          })
          .strict()
      )
      .max(3)
      .optional(),
    pesosGlobales: z
      .object({
        continua: z.number().min(0).max(1),
        examenes: z.number().min(0).max(1)
      })
      .strict()
      .optional(),
    pesosExamenes: z
      .object({
        parcial1: z.number().min(0).max(1),
        parcial2: z.number().min(0).max(1),
        global: z.number().min(0).max(1)
      })
      .strict()
      .optional(),
    reglasCierre: z
      .object({
        requiereTeorico: z.boolean().optional(),
        requierePractica: z.boolean().optional(),
        requiereContinuaMinima: z.boolean().optional(),
        continuaMinima: z.number().min(0).max(10).optional()
      })
      .strict()
      .optional(),
    activo: z.boolean().optional()
  })
  .strict();

export const esquemaCrearEvidencia = z
  .object({
    periodoId: esquemaObjectId,
    alumnoId: esquemaObjectId,
    titulo: z.string().trim().min(3).max(180),
    descripcion: z.string().trim().max(600).optional(),
    calificacionDecimal: z.number().min(0).max(10),
    ponderacion: z.number().min(0).max(10).optional(),
    fechaEvidencia: esquemaFecha.optional(),
    corte: z.number().int().min(1).max(3).optional(),
    fuente: z.enum(['manual', 'classroom']).optional(),
    classroom: z
      .object({
        courseId: z.string().trim().min(1).max(128).optional(),
        courseWorkId: z.string().trim().min(1).max(128).optional(),
        submissionId: z.string().trim().min(1).max(128).optional(),
        classroomUserId: z.string().trim().min(1).max(128).optional(),
        pulledAt: esquemaFecha.optional()
      })
      .strict()
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

export const esquemaComponenteExamen = z
  .object({
    periodoId: esquemaObjectId,
    alumnoId: esquemaObjectId,
    corte: z.enum(['parcial1', 'parcial2', 'global']),
    teoricoDecimal: z.number().min(0).max(10),
    practicas: z.array(z.number().min(0).max(10)).max(20).optional(),
    origen: z.enum(['manual', 'omr']).optional(),
    examenGeneradoId: esquemaObjectId.optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .strict();
