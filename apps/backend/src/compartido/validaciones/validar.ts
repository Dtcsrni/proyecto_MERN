/**
 * Helpers de validacion con Zod para requests.
 *
 * Idea:
 * - Validar y normalizar entradas lo mas cerca posible del borde HTTP.
 * - Si el schema transforma/coerce (p. ej. strings -> numbers), aqui es donde
 *   queda aplicado y el resto del codigo puede asumir tipos correctos.
 */
import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ErrorAplicacion } from '../errores/errorAplicacion';

export function validarCuerpo(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const resultado = schema.safeParse(req.body);
    if (!resultado.success) {
      next(new ErrorAplicacion('VALIDACION', 'Payload invalido', 400, resultado.error.flatten()));
      return;
    }
    // Importante: mutamos `req.body` con el output del schema (ya validado).
    req.body = resultado.data;
    next();
  };
}
