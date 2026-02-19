import type { ContextoPipelineOmr } from '../types';
import { analizarOmr as analizarOmrV2, type ResultadoOmr } from '../../servicioOmrV2';
import { debeIntentarMotorCv, describirErrorCv, preprocesarImagenOmrCv } from '../../infra/omrCvEngine';

export async function ejecutarEtapaScoring(contexto: ContextoPipelineOmr) {
  const mapaPagina = contexto.mapaPagina as Parameters<typeof analizarOmrV2>[1];
  const templateVersion =
    Number((mapaPagina as { templateVersion?: unknown })?.templateVersion ?? contexto.debugInfo?.templateVersionDetectada ?? 3);

  let resultado: ResultadoOmr;
  if (debeIntentarMotorCv(templateVersion)) {
    try {
      const imagenCv = await preprocesarImagenOmrCv(contexto.imagenBase64);
      resultado = await analizarOmrV2(
        imagenCv,
        mapaPagina,
        contexto.qrEsperado,
        contexto.margenMm,
        contexto.debugInfo
      );
      resultado.engineUsed = 'cv';
      resultado.engineVersion = 'omr-v3-cv';
    } catch (error) {
      resultado = await analizarOmrV2(
        contexto.imagenBase64,
        mapaPagina,
        contexto.qrEsperado,
        contexto.margenMm,
        contexto.debugInfo
      );
      resultado.engineUsed = 'legacy';
      resultado.engineVersion = 'omr-v3-cv';
      resultado.motivosRevision = Array.from(
        new Set([...(resultado.motivosRevision ?? []), `FALLBACK_LEGACY_CV:${describirErrorCv(error)}`])
      ).slice(0, 24);
    }
  } else {
    resultado = await analizarOmrV2(
      contexto.imagenBase64,
      mapaPagina,
      contexto.qrEsperado,
      contexto.margenMm,
      contexto.debugInfo
    );
    resultado.engineUsed = 'legacy';
    resultado.engineVersion = 'omr-v3-cv';
  }

  contexto.resultado = resultado as ResultadoOmr;
  return contexto;
}
