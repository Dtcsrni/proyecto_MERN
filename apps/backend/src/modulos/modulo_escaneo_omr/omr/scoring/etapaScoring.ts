import type { ContextoPipelineOmr } from '../types';
import { analizarOmr as analizarOmrCv, type ResultadoOmr } from '../../servicioOmrCv';
import { debeIntentarMotorCv, describirErrorCv, preprocesarImagenOmrCv } from '../../infra/omrCvEngine';

export async function ejecutarEtapaScoring(contexto: ContextoPipelineOmr) {
  const mapaPagina = contexto.mapaPagina as Parameters<typeof analizarOmrCv>[1];
  const templateVersion =
    Number((mapaPagina as { templateVersion?: unknown })?.templateVersion ?? contexto.debugInfo?.templateVersionDetectada ?? 3);

  let resultado: ResultadoOmr;
  if (debeIntentarMotorCv(templateVersion)) {
    try {
      const imagenCv = await preprocesarImagenOmrCv(contexto.imagenBase64);
      resultado = await analizarOmrCv(
        imagenCv,
        mapaPagina,
        contexto.qrEsperado,
        contexto.margenMm,
        contexto.debugInfo
      );
      resultado.engineVersion = 'omr-v3-cv';
    } catch (error) {
      resultado = await analizarOmrCv(
        contexto.imagenBase64,
        mapaPagina,
        contexto.qrEsperado,
        contexto.margenMm,
        contexto.debugInfo
      );
      resultado.engineVersion = 'omr-v3-cv';
      resultado.motivosRevision = Array.from(
        new Set([...(resultado.motivosRevision ?? []), `CV_PREPROCESO_REINTENTO:${describirErrorCv(error)}`])
      ).slice(0, 24);
    }
  } else {
    resultado = await analizarOmrCv(
      contexto.imagenBase64,
      mapaPagina,
      contexto.qrEsperado,
      contexto.margenMm,
      contexto.debugInfo
    );
    resultado.engineVersion = 'omr-v3-cv';
  }

  contexto.resultado = resultado as ResultadoOmr;
  return contexto;
}
