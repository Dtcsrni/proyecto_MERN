import { Router } from 'express';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import {
  actualizarPlantilla,
  archivarPlantilla,
  crearPlantilla,
  eliminarPlantillaDev,
  generarExamen,
  generarExamenesLote,
  descargarPdfLote,
  listarPlantillas,
  previsualizarPlantilla,
  previsualizarPlantillaPdf
} from './controladorGeneracionPdf';
import {
  esquemaActualizarPlantilla,
  esquemaBodyVacioOpcional,
  esquemaCrearPlantilla,
  esquemaGenerarExamen,
  esquemaGenerarExamenesLote,
  esquemaRegenerarExamenGenerado
} from './validacionesExamenes';
import {
  archivarExamenGenerado,
  descargarPdf,
  listarExamenesGenerados,
  obtenerExamenPorFolio,
  regenerarPdfExamen
} from './controladorListadoGenerados';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import { middlewareRutaV2Write } from '../../compartido/observabilidad/middlewareVersionadoApi';

const router = Router();

router.get('/plantillas', requerirPermiso('plantillas:leer'), listarPlantillas);
router.post(
  '/plantillas',
  middlewareRutaV2Write(),
  requerirPermiso('plantillas:gestionar'),
  validarCuerpo(esquemaCrearPlantilla, { strict: true }),
  crearPlantilla
);
router.post(
  '/plantillas/:id',
  middlewareRutaV2Write(),
  requerirPermiso('plantillas:gestionar'),
  validarCuerpo(esquemaActualizarPlantilla, { strict: true }),
  actualizarPlantilla
);
router.post(
  '/plantillas/:id/archivar',
  middlewareRutaV2Write(),
  requerirPermiso('plantillas:archivar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  archivarPlantilla
);
router.post(
  '/plantillas/:id/eliminar',
  middlewareRutaV2Write(),
  requerirPermiso('plantillas:eliminar_dev'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  eliminarPlantillaDev
);
router.get('/plantillas/:id/previsualizar', requerirPermiso('plantillas:previsualizar'), previsualizarPlantilla);
router.get('/plantillas/:id/previsualizar/pdf', requerirPermiso('plantillas:previsualizar'), previsualizarPlantillaPdf);
router.get('/generados', requerirPermiso('examenes:leer'), listarExamenesGenerados);
router.get('/generados/folio/:folio', requerirPermiso('examenes:leer'), obtenerExamenPorFolio);
router.get('/generados/:id/pdf', requerirPermiso('examenes:descargar'), descargarPdf);
router.get('/generados/lote/:loteId/pdf', requerirPermiso('examenes:descargar'), descargarPdfLote);
router.post(
  '/generados/:id/regenerar',
  middlewareRutaV2Write(),
  requerirPermiso('examenes:regenerar'),
  validarCuerpo(esquemaRegenerarExamenGenerado, { strict: true }),
  regenerarPdfExamen
);
router.post(
  '/generados/:id/archivar',
  middlewareRutaV2Write(),
  requerirPermiso('examenes:archivar'),
  validarCuerpo(esquemaBodyVacioOpcional, { strict: true }),
  archivarExamenGenerado
);
router.post(
  '/generados',
  middlewareRutaV2Write(),
  requerirPermiso('examenes:generar'),
  validarCuerpo(esquemaGenerarExamen, { strict: true }),
  generarExamen
);
router.post(
  '/generados/lote',
  middlewareRutaV2Write(),
  requerirPermiso('examenes:generar'),
  validarCuerpo(esquemaGenerarExamenesLote, { strict: true }),
  generarExamenesLote
);

export default router;
