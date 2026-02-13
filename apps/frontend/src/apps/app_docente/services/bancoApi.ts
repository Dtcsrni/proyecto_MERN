import { clienteApi } from '../clienteApiDocente';
import type { TemaBanco } from '../SeccionBanco.helpers';

export async function obtenerTemasBanco(periodoId: string): Promise<TemaBanco[]> {
  const payload = await clienteApi.obtener<{ temas: TemaBanco[] }>(`/banco-preguntas/temas?periodoId=${encodeURIComponent(periodoId)}`);
  return Array.isArray(payload.temas) ? payload.temas : [];
}
