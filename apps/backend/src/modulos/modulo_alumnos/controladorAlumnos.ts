/**
 * Controlador de alumnos.
 *
 * Contrato:
 * - Todas las operaciones se asocian al docente autenticado via `docenteId`.
 * - La lectura se filtra por `docenteId` (y opcionalmente `periodoId`).
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { Alumno } from './modeloAlumno';

/**
 * Lista alumnos del docente (opcionalmente por periodo).
 */
export async function listarAlumnos(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtro: Record<string, string> = { docenteId };
  if (req.query.periodoId) filtro.periodoId = String(req.query.periodoId);

  const limite = Number(req.query.limite ?? 0);
  const consulta = Alumno.find(filtro);
  const alumnos = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ alumnos });
}

/**
 * Crea un alumno asociado al docente autenticado.
 */
export async function crearAlumno(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const alumno = await Alumno.create({ ...req.body, docenteId });
  res.status(201).json({ alumno });
}

/**
 * Actualiza un alumno del docente.
 * Nota: la UI envía el objeto completo (semántica tipo PUT) via POST.
 */
export async function actualizarAlumno(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const alumnoId = String(req.params.alumnoId ?? '').trim();

  const alumno = await Alumno.findOne({ _id: alumnoId, docenteId });
  if (!alumno) {
    throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'Alumno no encontrado', 404);
  }

  const { periodoId, matricula, nombres, apellidos, nombreCompleto, correo, grupo, activo } = req.body as Record<string, unknown>;

  alumno.periodoId = periodoId as never;
  alumno.matricula = matricula as never;
  alumno.nombres = nombres as never;
  alumno.apellidos = apellidos as never;
  alumno.nombreCompleto = nombreCompleto as never;
  alumno.correo = correo as never;
  alumno.grupo = grupo as never;
  if (typeof activo === 'boolean') alumno.activo = activo as never;

  await alumno.save();
  res.json({ alumno });
}
