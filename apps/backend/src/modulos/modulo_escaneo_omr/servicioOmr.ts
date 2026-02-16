import { ejecutarPipelineOmr } from './omr/pipeline/ejecutorPipelineOmr';
import { analizarOmr as analizarOmrLegacy, leerQrDesdeImagen as leerQrDesdeImagenLegacy, type ResultadoOmr } from './servicioOmrLegacy';
import { decidirVersionCanary } from '../../compartido/observabilidad/rolloutCanary';
import { registrarAdopcion } from '../../compartido/observabilidad/metricsAdopcion';

type ParametrosAnalizarOmr = Parameters<typeof analizarOmrLegacy>;
type MapaPaginaOmr = ParametrosAnalizarOmr[1];
type DebugInfoOmr = ParametrosAnalizarOmr[4];
const ENDPOINT_ADOPCION = '/modulo_escaneo_omr/analizarOmr';

function construirSemillaCanary(params: {
  imagenBase64: string;
  mapaPagina: MapaPaginaOmr;
  qrEsperado?: string | string[];
  margenMm: number;
  requestId?: string;
}) {
  const qr = Array.isArray(params.qrEsperado)
    ? params.qrEsperado.map((x) => String(x ?? '').trim()).filter(Boolean).join('|')
    : String(params.qrEsperado ?? '').trim();
  const numeroPagina = Number((params.mapaPagina as { numeroPagina?: unknown })?.numeroPagina ?? 0);
  return [
    params.requestId ? String(params.requestId) : '',
    qr,
    Number.isFinite(numeroPagina) ? String(numeroPagina) : '',
    String(params.imagenBase64?.length ?? 0),
    String(params.margenMm ?? 10)
  ].join(':');
}

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
  const version = decidirVersionCanary(
    'omr',
    construirSemillaCanary({
      imagenBase64,
      mapaPagina,
      qrEsperado,
      margenMm,
      requestId
    })
  );

  if (version === 'v1') {
    registrarAdopcion('omr', ENDPOINT_ADOPCION, 'v1');
    return analizarOmrLegacy(imagenBase64, mapaPagina, qrEsperado, margenMm, debugInfo);
  }

  try {
    const pipeline = await ejecutarPipelineOmr({
      imagenBase64,
      mapaPagina,
      qrEsperado,
      margenMm,
      debugInfo,
      requestId
    });
    registrarAdopcion('omr', ENDPOINT_ADOPCION, 'v2');
    return pipeline.resultado;
  } catch {
    registrarAdopcion('omr', ENDPOINT_ADOPCION, 'v1');
    return analizarOmrLegacy(imagenBase64, mapaPagina, qrEsperado, margenMm, debugInfo);
  }
}
