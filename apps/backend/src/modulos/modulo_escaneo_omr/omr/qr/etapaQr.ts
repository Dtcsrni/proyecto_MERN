import type { ContextoPipelineOmr } from '../types';
import { leerQrDesdeImagen as leerQrDesdeImagenLegacy } from '../../servicioOmrLegacy';

export async function ejecutarEtapaQr(contexto: ContextoPipelineOmr) {
  contexto.qrTexto = await leerQrDesdeImagenLegacy(contexto.imagenBase64);
  return contexto;
}
