/**
 * Value objects de layout de examen.
 * 
 * Encapsula la configuracion visual y estructural del PDF de examen,
 * incluyendo dimensiones, margenes, perfiles OMR, etc.
 */
import type { PerfilPlantillaOmr, TemplateVersion } from '../shared/tiposPdf';

/**
 * Perfil OMR v1 (original): marcas de lineas, burbujas mas compactas.
 */
export const PERFIL_OMR_V1: PerfilPlantillaOmr = {
  qrSize: 68,
  qrPadding: 2,
  qrMarginModulos: 4,
  marcasEsquina: 'lineas',
  marcaCuadradoSize: 12,
  marcaCuadradoQuietZone: 4,
  burbujaRadio: 3.4,
  burbujaPasoY: 8.4,
  cajaOmrAncho: 42,
  fiducialSize: 5
};

/**
 * Perfil OMR v2 (mejorado): marcas cuadradas, burbujas mas espaciadas, fiduciales mas robustos.
 */
export const PERFIL_OMR_V2: PerfilPlantillaOmr = {
  qrSize: 88,
  qrPadding: 4,
  qrMarginModulos: 6,
  marcasEsquina: 'cuadrados',
  marcaCuadradoSize: 12,
  marcaCuadradoQuietZone: 4,
  burbujaRadio: 5,
  burbujaPasoY: 14,
  cajaOmrAncho: 60,
  fiducialSize: 7
};

/**
 * Resuelve el perfil OMR segun la version de template.
 */
export function obtenerPerfilPlantilla(templateVersion: TemplateVersion): PerfilPlantillaOmr {
  return templateVersion === 2 ? PERFIL_OMR_V2 : PERFIL_OMR_V1;
}
