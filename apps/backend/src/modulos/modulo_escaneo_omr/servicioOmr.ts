import { configuracion } from '../../configuracion';
import { ejecutarPipelineOmr } from './omr/pipeline/ejecutorPipelineOmr';
import { analizarOmr as analizarOmrLegacy, leerQrDesdeImagen as leerQrDesdeImagenLegacy, type ResultadoOmr } from './servicioOmrLegacy';

type ParametrosAnalizarOmr = Parameters<typeof analizarOmrLegacy>;
type MapaPaginaOmr = ParametrosAnalizarOmr[1];
type DebugInfoOmr = ParametrosAnalizarOmr[4];

export type { ResultadoOmr };

export async function leerQrDesdeImagen(imagenBase64: string): Promise<string | undefined> {
  return leerQrDesdeImagenLegacy(imagenBase64);
}

export async function analizarOmr(
  imagenBase64: string,
  mapaPagina: MapaPaginaOmr,
  qrEsperado?: string | string[],
  margenMm = 10,
  debugInfo?: DebugInfoOmr,
  requestId?: string
): Promise<ResultadoOmr> {
  if (!configuracion.featureOmrPipelineV2) {
    return analizarOmrLegacy(imagenBase64, mapaPagina, qrEsperado, margenMm, debugInfo);
  }

  const pipeline = await ejecutarPipelineOmr({
    imagenBase64,
    mapaPagina,
    qrEsperado,
    margenMm,
    debugInfo,
    requestId
  });

  return pipeline.resultado;
}
