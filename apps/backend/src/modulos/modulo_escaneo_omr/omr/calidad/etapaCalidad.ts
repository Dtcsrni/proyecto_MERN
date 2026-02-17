import type { ContextoPipelineOmr } from '../types';

export async function ejecutarEtapaCalidad(contexto: ContextoPipelineOmr) {
  // La calidad de pagina ya se calcula dentro del motor OMR actual.
  // Se conserva esta etapa para separar responsabilidades en v2.
  return contexto;
}
