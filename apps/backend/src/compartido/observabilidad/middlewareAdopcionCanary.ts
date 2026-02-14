/**
 * middlewareAdopcionCanary
 *
 * Responsabilidad: Rastrear adopción de v2 en canary rollout
 * Limites: Registrar solo información agregada, no datos sensibles
 */
import type { RequestHandler } from 'express';
import { registrarAdopcion } from './metricsAdopcion';

/**
 * Middleware para rastrear adopción v1 de un módulo
 */
export function middlewareAdopcionV1(modulo: 'omr' | 'pdf' | 'sincronizacion' | string): RequestHandler {
  return (req, _res, next) => {
    // Extrae endpoint sin query params
    const endpoint = req.path.split('?')[0];
    registrarAdopcion(modulo, endpoint, 'v1');
    next();
  };
}

/**
 * Middleware para rastrear adopción v2 de un módulo
 */
export function middlewareAdopcionV2(modulo: 'omr' | 'pdf' | 'sincronizacion' | string): RequestHandler {
  return (req, _res, next) => {
    const endpoint = req.path.split('?')[0];
    registrarAdopcion(modulo, endpoint, 'v2');
    next();
  };
}
