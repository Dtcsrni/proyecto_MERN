import type { ContextoPipelineOmr } from '../types';
import { analizarOmr as analizarOmrLegacy, type ResultadoOmr } from '../../servicioOmrLegacy';

export async function ejecutarEtapaScoring(contexto: ContextoPipelineOmr) {
  const resultado = await analizarOmrLegacy(
    contexto.imagenBase64,
    contexto.mapaPagina as Parameters<typeof analizarOmrLegacy>[1],
    contexto.qrEsperado,
    contexto.margenMm,
    contexto.debugInfo
  );
  contexto.resultado = resultado as ResultadoOmr;
  return contexto;
}
