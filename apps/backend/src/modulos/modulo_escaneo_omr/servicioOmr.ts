import { ejecutarPipelineOmr } from './omr/pipeline/ejecutorPipelineOmr';
import { analizarOmr as analizarOmrV2, leerQrDesdeImagen as leerQrDesdeImagenV2, type ResultadoOmr } from './servicioOmrV2';

type ParametrosAnalizarOmr = Parameters<typeof analizarOmrV2>;
type MapaPaginaOmr = ParametrosAnalizarOmr[1];
type DebugInfoOmr = ParametrosAnalizarOmr[4];

export type { ResultadoOmr };

export async function leerQrDesdeImagen(imagenBase64: string): Promise<string | undefined> {
  return leerQrDesdeImagenV2(imagenBase64);
}

export async function analizarOmr(
  imagenBase64: string,
  mapaPagina: MapaPaginaOmr,
  qrEsperado?: string | string[],
  margenMm = 10,
  debugInfo?: DebugInfoOmr,
  requestId?: string
): Promise<ResultadoOmr> {
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
