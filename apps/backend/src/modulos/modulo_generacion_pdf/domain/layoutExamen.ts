/**
 * Value objects de layout de examen.
 * 
 * Encapsula la configuracion visual y estructural del PDF de examen,
 * incluyendo dimensiones, margenes, perfiles OMR, etc.
 */
import type { PerfilPlantillaOmr, TemplateVersion } from '../shared/tiposPdf';
import { TEMPLATE_VERSION_TV3 } from './tv3Compat';

const MM_A_PUNTOS = 72 / 25.4;

/**
 * Perfil OMR v3 (radical): hoja de respuestas robusta para fotografía móvil.
 */
export const PERFIL_OMR_V3: PerfilPlantillaOmr = {
  qrSize: 30 * MM_A_PUNTOS,
  qrPadding: 4 * MM_A_PUNTOS,
  qrMarginModulos: 8,
  marcasEsquina: 'cuadrados',
  marcaCuadradoSize: 18 * MM_A_PUNTOS,
  marcaCuadradoQuietZone: 3 * MM_A_PUNTOS,
  burbujaRadio: (6.2 * MM_A_PUNTOS) / 2,
  burbujaPasoY: 10.5 * MM_A_PUNTOS,
  cajaOmrAncho: 84,
  fiducialSize: 18 * MM_A_PUNTOS,
  bubbleStrokePt: 0.9,
  labelToBubbleMm: 5.0,
  preguntasPorBloque: 10,
  opcionesPorPregunta: 5
};

/**
 * Resuelve el perfil OMR segun la version de template.
 */
export function obtenerPerfilPlantilla(templateVersion: TemplateVersion): PerfilPlantillaOmr {
  if (templateVersion !== TEMPLATE_VERSION_TV3) {
    throw new Error(`Template version ${String(templateVersion)} no compatible para OMR TV3`);
  }
  return PERFIL_OMR_V3;
}
