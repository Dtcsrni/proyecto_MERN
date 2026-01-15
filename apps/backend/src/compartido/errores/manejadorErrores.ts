/**
 * Middleware de manejo de errores para el API.
 */
import type { NextFunction, Request, Response } from 'express';
import { ErrorAplicacion } from './errorAplicacion';
import { logError } from '../../infraestructura/logging/logger';

export function manejadorErrores(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  void _next;

  if (error instanceof ErrorAplicacion) {
    res.status(error.estadoHttp).json({
      error: {
        codigo: error.codigo,
        mensaje: error.message,
        detalles: error.detalles
      }
    });
    return;
  }

  // Errores no esperados: se registran para diagnostico y se responde con un
  // mensaje generico al cliente para evitar leakage de detalles internos.
  const entorno = process.env.NODE_ENV;
  if (entorno !== 'test') {
    logError('Error no controlado en request', error);
  }

  const mensaje = error instanceof Error ? error.message : 'Error interno';
  res.status(500).json({
    error: {
      codigo: 'ERROR_INTERNO',
      mensaje
    }
  });
}
