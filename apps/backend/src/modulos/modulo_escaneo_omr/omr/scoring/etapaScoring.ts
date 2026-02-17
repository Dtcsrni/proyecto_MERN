import type { ContextoPipelineOmr } from '../types';
import { analizarOmr as analizarOmrV2, type ResultadoOmr } from '../../servicioOmrV2';

export async function ejecutarEtapaScoring(contexto: ContextoPipelineOmr) {
  const resultado = await analizarOmrV2(
    contexto.imagenBase64,
    contexto.mapaPagina as Parameters<typeof analizarOmrV2>[1],
    contexto.qrEsperado,
    contexto.margenMm,
    contexto.debugInfo
  );
  contexto.resultado = resultado as ResultadoOmr;
  return contexto;
}
