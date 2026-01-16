/**
 * Rutas de alumnos.
 */
import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { actualizarAlumno, crearAlumno, listarAlumnos } from './controladorAlumnos';
import { esquemaActualizarAlumno, esquemaCrearAlumno } from './validacionesAlumnos';

const router = Router();

router.get('/', listarAlumnos);
router.post('/', validarCuerpo(esquemaCrearAlumno, { strict: true }), crearAlumno);
router.post('/:alumnoId/actualizar', validarCuerpo(esquemaActualizarAlumno, { strict: true }), actualizarAlumno);

export default router;
