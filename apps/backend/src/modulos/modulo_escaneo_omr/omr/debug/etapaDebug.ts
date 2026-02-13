import type { ContextoPipelineOmr } from '../types';

export async function ejecutarEtapaDebug(contexto: ContextoPipelineOmr) {
  // El debug visual y export de parches se mantiene dentro del motor OMR legacy.
  return contexto;
}
