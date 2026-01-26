/**
 * Rutas de alumnos.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { actualizarAlumno, crearAlumno, eliminarAlumnoDev, listarAlumnos } from './controladorAlumnos';
import { esquemaActualizarAlumno, esquemaCrearAlumno } from './validacionesAlumnos';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';

const router = Router();

router.get('/', requerirPermiso('alumnos:leer'), listarAlumnos);
router.post('/', requerirPermiso('alumnos:gestionar'), validarCuerpo(esquemaCrearAlumno, { strict: true }), crearAlumno);
router.post(
  '/:alumnoId/actualizar',
  requerirPermiso('alumnos:gestionar'),
  validarCuerpo(esquemaActualizarAlumno, { strict: true }),
  actualizarAlumno
);
router.post(
  '/:alumnoId/eliminar',
  requerirPermiso('alumnos:eliminar_dev'),
  eliminarAlumnoDev
);

export default router;
