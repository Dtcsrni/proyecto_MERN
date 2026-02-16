import type { ContextoPipelineOmr } from '../types';
import { leerQrDesdeImagen as leerQrDesdeImagenV2 } from '../../servicioOmrV2';

export async function ejecutarEtapaQr(contexto: ContextoPipelineOmr) {
  contexto.qrTexto = await leerQrDesdeImagenV2(contexto.imagenBase64);
  return contexto;
}
