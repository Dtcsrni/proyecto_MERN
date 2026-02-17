import { Router } from 'express';
import { z } from 'zod';
import { validarCuerpo } from '../validaciones/validar';
import { requerirPermiso } from '../../modulos/modulo_autenticacion/middlewarePermisos';
import {
  definirObjetivoCanary,
  evaluarDecisionConservadora,
  evaluarYAplicarCanaryConservador,
  obtenerEstadoRolloutCanary
} from './rolloutCanary';

const router = Router();

const esquemaDefinirObjetivo = z
  .object({
    modulo: z.enum(['omr', 'pdf']),
    objetivoV2: z.number().min(0).max(1),
    motivo: z.string().trim().min(3).max(200).optional()
  })
  .strict();

const esquemaEvaluar = z
  .object({
    modulo: z.enum(['omr', 'pdf']),
    objetivoActual: z.number().min(0).max(1),
    adopcionV2: z.number().min(0).max(100),
    errorRate: z.number().min(0).max(1),
    totalSolicitudes: z.number().int().min(0),
    aplicar: z.boolean().default(false)
  })
  .strict();

router.get('/estado', requerirPermiso('docentes:administrar'), (_req, res) => {
  res.json({
    ok: true,
    data: obtenerEstadoRolloutCanary()
  });
});

router.post(
  '/objetivo',
  requerirPermiso('docentes:administrar'),
  validarCuerpo(esquemaDefinirObjetivo, { strict: true }),
  (req, res) => {
    const payload = req.body as z.infer<typeof esquemaDefinirObjetivo>;
    const actualizado = definirObjetivoCanary(
      payload.modulo,
      payload.objetivoV2,
      'manual',
      payload.motivo ?? 'Ajuste manual de operador'
    );

    res.json({
      ok: true,
      data: actualizado
    });
  }
);

router.post(
  '/evaluar',
  requerirPermiso('docentes:administrar'),
  validarCuerpo(esquemaEvaluar, { strict: true }),
  (req, res) => {
    const payload = req.body as z.infer<typeof esquemaEvaluar>;

    if (payload.aplicar) {
      const aplicado = evaluarYAplicarCanaryConservador(payload);
      res.json({ ok: true, data: aplicado });
      return;
    }

    const decision = evaluarDecisionConservadora(payload);
    res.json({
      ok: true,
      data: {
        modulo: payload.modulo,
        aplicado: false,
        decision
      }
    });
  }
);

export default router;