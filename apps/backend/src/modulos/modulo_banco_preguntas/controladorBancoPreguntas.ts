/**
 * Controlador de banco de preguntas.
 *
 * Contrato:
 * - El banco de preguntas es multi-tenant por `docenteId`.
 * - Al crear una pregunta se inicializa con `versionActual = 1` y una sola version.
 */
import type { Response } from 'express';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { BancoPregunta } from './modeloBancoPregunta';

/**
 * Lista preguntas del docente (opcionalmente por periodo).
 */
export async function listarBancoPreguntas(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const queryActivo = String(req.query.activo ?? '').trim().toLowerCase();
  const activo = queryActivo === '' ? true : !(queryActivo === '0' || queryActivo === 'false');

  const filtro: Record<string, unknown> = { docenteId, activo };
  if (req.query.periodoId) filtro.periodoId = String(req.query.periodoId);

  const limite = Number(req.query.limite ?? 0);
  const consulta = BancoPregunta.find(filtro).sort({ createdAt: -1 });
  const preguntas = await (limite > 0 ? consulta.limit(limite) : consulta).lean();
  res.json({ preguntas });
}

/**
 * Crea una pregunta en el banco del docente.
 */
export async function crearPregunta(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { periodoId, tema, enunciado, imagenUrl, opciones } = req.body;

  const pregunta = await BancoPregunta.create({
    docenteId,
    periodoId,
    tema,
    versionActual: 1,
    versiones: [
      {
        numeroVersion: 1,
        enunciado,
        imagenUrl,
        opciones
      }
    ]
  });

  res.status(201).json({ pregunta });
}
