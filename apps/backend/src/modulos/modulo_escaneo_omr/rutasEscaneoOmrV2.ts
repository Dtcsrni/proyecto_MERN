import { Router } from 'express';
import { analizarImagen, prevalidarLoteCapturas } from './controladorEscaneoOmr';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { esquemaAnalizarOmr, esquemaPrevalidarLoteOmr } from './validacionesOmr';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import { middlewareRutaV2Write } from '../../compartido/observabilidad/middlewareVersionadoApi';

const router = Router();

router.post(
  '/analizar',
  middlewareRutaV2Write(),
  requerirPermiso('omr:analizar'),
  validarCuerpo(esquemaAnalizarOmr, { strict: true }),
  analizarImagen
);
router.post(
  '/prevalidar-lote',
  middlewareRutaV2Write(),
  requerirPermiso('omr:analizar'),
  validarCuerpo(esquemaPrevalidarLoteOmr, { strict: true }),
  prevalidarLoteCapturas
);

export default router;
