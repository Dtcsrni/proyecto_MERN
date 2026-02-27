import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import {
  crearEvidenciaEvaluacion,
  crearPoliticaCalificacion,
  guardarConfiguracionPeriodo,
  listarEvidenciasEvaluacion,
  listarPoliticasCalificacion,
  obtenerConfiguracionPeriodo,
  obtenerResumenEvaluacionAlumno,
  upsertComponenteExamen
} from './controladorEvaluaciones';
import {
  esquemaComponenteExamen,
  esquemaConfigurarPeriodo,
  esquemaCrearEvidencia,
  esquemaCrearPolitica
} from './validacionesEvaluaciones';

const router = Router();

router.get('/politicas', requerirPermiso('evaluaciones:leer'), listarPoliticasCalificacion);
router.post(
  '/politicas',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaCrearPolitica, { strict: true }),
  crearPoliticaCalificacion
);
router.get('/configuracion-periodo', requerirPermiso('evaluaciones:leer'), obtenerConfiguracionPeriodo);
router.post(
  '/configuracion-periodo',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaConfigurarPeriodo, { strict: true }),
  guardarConfiguracionPeriodo
);
router.get('/evidencias', requerirPermiso('evaluaciones:leer'), listarEvidenciasEvaluacion);
router.post(
  '/evidencias',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaCrearEvidencia, { strict: true }),
  crearEvidenciaEvaluacion
);
router.post(
  '/examenes/componentes',
  requerirPermiso('evaluaciones:gestionar'),
  validarCuerpo(esquemaComponenteExamen, { strict: true }),
  upsertComponenteExamen
);
router.get('/alumnos/:alumnoId/resumen', requerirPermiso('evaluaciones:leer'), obtenerResumenEvaluacionAlumno);

export default router;
