/**
 * Manejador de errores robusto con contexto, auditoría y categorización
 * Ola 3 - Fase 2: Endpoints Robustos
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorCategoria, ErrorRobusto } from './tiposRobustez';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tiempoInicio?: number;
    }
  }
}

export class ErrorOperacional extends Error implements Omit<ErrorRobusto, 'name'> {
  categoria: ErrorCategoria;
  statusHttp: number;
  auditoria: string;
  reintentable: boolean;
  duracionMs: number;
  traceId?: string;

  constructor(
    message: string,
    categoria?: ErrorCategoria,
    statusHttp?: number,
    auditoria?: string,
    reintentable?: boolean,
    duracionMs?: number,
    traceId?: string
  ) {
    super(message);
    this.name = 'ErrorOperacional';
    this.categoria = categoria ?? ErrorCategoria.INTERNO;
    this.statusHttp = statusHttp ?? 500;
    this.auditoria = auditoria ?? '';
    this.reintentable = reintentable ?? false;
    this.duracionMs = duracionMs ?? 0;
    this.traceId = traceId;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Convierte errores Zod en ErrorOperacional con detalles de validación
 */
export function procesarErrorZod(error: ZodError, traceId?: string): ErrorOperacional {
  const problemas = error.issues.map((issue) => ({
    campo: issue.path.join('.'),
    tipo: issue.code,
    mensaje: issue.message
  }));

  return new ErrorOperacional(
    `Validación fallida: ${problemas.map((p) => `${p.campo} (${p.mensaje})`).join('; ')}`,
    ErrorCategoria.VALIDACION,
    400,
    JSON.stringify(problemas),
    false,
    0,
    traceId
  );
}

/**
 * Middleware global de manejo de errores robusto
 */
export function middlewareManejadorErroresRobusto(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  const traceId = req.headers['x-trace-id'] as string || `trace-${Date.now()}`;
  const tiempoInicio = req['tiempoInicio'] || Date.now();
  const duracionMs = Date.now() - tiempoInicio;

  let errorOperacional: ErrorRobusto | undefined;

  if (err instanceof ErrorOperacional) {
    errorOperacional = err;
  } else if (err instanceof ZodError) {
    errorOperacional = procesarErrorZod(err, traceId);
  } else if (err instanceof Error) {
    // Categorizar errores conocidos de Node.js
    if (err.name === 'TimeoutError') {
      errorOperacional = new ErrorOperacional(
        err.message || 'Timeout en operación',
        ErrorCategoria.TIMEOUT,
        504,
        err.stack || '',
        true,
        duracionMs,
        traceId
      );
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      errorOperacional = new ErrorOperacional(
        'Servicio no disponible',
        ErrorCategoria.INDISPONIBLE,
        503,
        err.message,
        true,
        duracionMs,
        traceId
      );
    } else {
      errorOperacional = new ErrorOperacional(
        err.message || 'Error interno del servidor',
        ErrorCategoria.INTERNO,
        500,
        err.stack || '',
        false,
        duracionMs,
        traceId
      );
    }
  } else {
    errorOperacional = new ErrorOperacional(
      'Error desconocido',
      ErrorCategoria.INTERNO,
      500,
      JSON.stringify(err),
      false,
      duracionMs,
      traceId
    );
  }

  errorOperacional.traceId = traceId;
  errorOperacional.duracionMs = duracionMs;

  // Registrar en logs con estructura
  console.error('[ERROR_ROBUSTO]', {
    traceId,
    categoria: errorOperacional.categoria,
    statusHttp: errorOperacional.statusHttp,
    mensaje: errorOperacional.message,
    reintentable: errorOperacional.reintentable,
    duracionMs: errorOperacional.duracionMs,
    ruta: req.path,
    metodo: req.method,
    usuario: (req as any).usuario?.id || 'anonimo',
    auditoria: errorOperacional.auditoria
  });

  // Respuesta estandarizada de error
  res.status(errorOperacional.statusHttp).json({
    exito: false,
    error: {
      categoria: errorOperacional.categoria,
      mensaje: errorOperacional.message,
      traceId: errorOperacional.traceId,
      reintentable: errorOperacional.reintentable,
      duracionMs: errorOperacional.duracionMs
    }
  });
}

/**
 * Middleware para capturar tiempo de inicio y trace ID
 */
export function middlewareContextoRobustez(req: Request, res: Response, next: NextFunction) {
  req['tiempoInicio'] = Date.now();
  if (!req.headers['x-trace-id']) {
    req.headers['x-trace-id'] = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  res.setHeader('x-trace-id', req.headers['x-trace-id']);
  next();
}
