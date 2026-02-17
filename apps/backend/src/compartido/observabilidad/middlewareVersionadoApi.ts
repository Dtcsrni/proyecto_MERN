import type { RequestHandler } from 'express';
import { registrarSchemaFallbackRead, registrarSchemaV2Write } from './metrics';

export function middlewareAdapterV1AV2(): RequestHandler {
  return (_req, _res, next) => {
    registrarSchemaFallbackRead();
    next();
  };
}

export function middlewareRutaV2Write(): RequestHandler {
  return (_req, _res, next) => {
    registrarSchemaV2Write();
    next();
  };
}
