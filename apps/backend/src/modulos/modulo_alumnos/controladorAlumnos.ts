/**
 * Controlador de alumnos.
 *
 * Contrato:
 * - Todas las operaciones se asocian al docente autenticado via `docenteId`.
 * - La lectura se filtra por `docenteId` (y opcionalmente `periodoId`).
 */
import type { Response } from 'express';
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
