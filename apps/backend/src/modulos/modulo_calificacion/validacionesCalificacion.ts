/**
 * Validaciones de calificacion.
 */
import { z } from 'zod';
import { esquemaObjectId } from '../../compartido/validaciones/esquemas';

const esquemaRespuestaDetectada = z
  .object({
    numeroPregunta: z.number().int().positive(),
    opcion: z.string().trim().min(1).max(1).nullable(),
    confianza: z.number().min(0).max(1).optional()
  })
  .strict();

const esquemaAnalisisOmr = z
  .object({
    estadoAnalisis: z.enum(['ok', 'rechazado_calidad', 'requiere_revision']),
    calidadPagina: z.number().min(0).max(1),
    confianzaPromedioPagina: z.number().min(0).max(1).optional(),
    ratioAmbiguas: z.number().min(0).max(1).optional(),
    templateVersionDetectada: z.union([z.literal(1), z.literal(2)]).optional(),
    motivosRevision: z.array(z.string().min(1).max(200)).max(50).optional(),
    revisionConfirmada: z.boolean().optional()
  })
  .strict();

export const esquemaCalificarExamen = z.object({
  examenGeneradoId: esquemaObjectId,
  alumnoId: esquemaObjectId.optional(),
  aciertos: z.number().int().min(0).optional(),
  totalReactivos: z.number().int().positive().optional(),
  bonoSolicitado: z.number().min(0).optional(),
  evaluacionContinua: z.number().min(0).optional(),
  proyecto: z.number().min(0).optional(),
  retroalimentacion: z.string().optional(),
  respuestasDetectadas: z.array(esquemaRespuestaDetectada).max(500).optional(),
  omrAnalisis: esquemaAnalisisOmr.optional(),
  soloPreview: z.boolean().optional()
});

export const esquemaResolverSolicitudRevision = z
  .object({
    estado: z.enum(['atendida', 'rechazada']),
    respuestaDocente: z.string().trim().min(1).max(500).optional()
  })
  .strict();

export const esquemaSincronizarSolicitudesRevision = z
  .object({
    desde: z.string().trim().datetime().optional(),
    limite: z.number().int().min(1).max(200).optional()
  })
  .strict();
