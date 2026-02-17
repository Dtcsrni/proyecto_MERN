/**
 * metricsAdopcion
 *
 * Responsabilidad: Rastrear adopción de v2 respecto a v1 por endpoint y módulo
 * Limites: No exponer datos sensibles, solo contadores agregados
 */

const adopcionPorEndpoint = new Map<string, { v1: number; v2: number }>();
const adopcionPorModulo = new Map<string, { v1: number; v2: number }>();

/**
 * Registra una solicitud a un endpoint en una versión específica
 */
export function registrarAdopcion(
  modulo: 'omr' | 'pdf' | 'sincronizacion' | string,
  endpoint: string,
  version: 'v1' | 'v2'
) {
  // Contadores por endpoint
  const claveEndpoint = `${modulo}|${endpoint}`;
  const statsEndpoint = adopcionPorEndpoint.get(claveEndpoint) ?? { v1: 0, v2: 0 };
  if (version === 'v1') statsEndpoint.v1 += 1;
  else statsEndpoint.v2 += 1;
  adopcionPorEndpoint.set(claveEndpoint, statsEndpoint);

  // Contadores por módulo
  const statsModulo = adopcionPorModulo.get(modulo) ?? { v1: 0, v2: 0 };
  if (version === 'v1') statsModulo.v1 += 1;
  else statsModulo.v2 += 1;
  adopcionPorModulo.set(modulo, statsModulo);
}

/**
 * Calcula porcentaje de adopción v2 para un módulo
 */
export function calcularPorcentajeAdopcion(modulo: string): {
  v1Porcentaje: number;
  v2Porcentaje: number;
  totalSolicitudes: number;
  estado: 'iniciando' | 'canario' | 'madurando' | 'completado';
} {
  const stats = adopcionPorModulo.get(modulo) ?? { v1: 0, v2: 0 };
  const total = stats.v1 + stats.v2;

  if (total === 0) {
    return {
      v1Porcentaje: 0,
      v2Porcentaje: 0,
      totalSolicitudes: 0,
      estado: 'iniciando'
    };
  }

  const v2Porcentaje = Math.round((stats.v2 / total) * 10000) / 100; // Dos decimales

  let estado: 'iniciando' | 'canario' | 'madurando' | 'completado';
  if (v2Porcentaje === 0) estado = 'iniciando';
  else if (v2Porcentaje < 5) estado = 'canario';
  else if (v2Porcentaje < 90) estado = 'madurando';
  else estado = 'completado';

  return {
    v1Porcentaje: 100 - v2Porcentaje,
    v2Porcentaje,
    totalSolicitudes: total,
    estado
  };
}

/**
 * Obtiene detalles de adopción por endpoint en un módulo
 */
export function detallesAdopcionPorEndpoint(modulo: string): Array<{
  endpoint: string;
  v1: number;
  v2: number;
  v2Porcentaje: number;
}> {
  return Array.from(adopcionPorEndpoint.entries())
    .filter(([clave]) => clave.startsWith(`${modulo}|`))
    .map(([clave, stats]) => {
      const endpoint = clave.substring(modulo.length + 1);
      const total = stats.v1 + stats.v2;
      const v2Porcentaje = total === 0 ? 0 : Math.round((stats.v2 / total) * 10000) / 100;
      return {
        endpoint,
        v1: stats.v1,
        v2: stats.v2,
        v2Porcentaje
      };
    })
    .sort((a, b) => (b.v2Porcentaje - a.v2Porcentaje))
    .slice(0, 20); // Top 20 endpoints
}

/**
 * Exporta métricas de adopción en formato Prometheus
 */
export function exportarMetricasAdopcion(): string {
  const lineas: string[] = [];

  // Métricas por módulo
  lineas.push('# HELP evaluapro_adopcion_v2_porcentaje Porcentaje de adopción v2 por módulo');
  lineas.push('# TYPE evaluapro_adopcion_v2_porcentaje gauge');
  for (const modulo of adopcionPorModulo.keys()) {
    const stats = adopcionPorModulo.get(modulo) ?? { v1: 0, v2: 0 };
    const total = stats.v1 + stats.v2;
    const porcentaje = total === 0 ? 0 : Math.round((stats.v2 / total) * 10000) / 100;
    lineas.push(`evaluapro_adopcion_v2_porcentaje{modulo="${modulo}"} ${porcentaje}`);
  }

  lineas.push('');
  lineas.push('# HELP evaluapro_adopcion_v1_total Total de solicitudes a v1');
  lineas.push('# TYPE evaluapro_adopcion_v1_total counter');
  for (const [modulo, stats] of adopcionPorModulo.entries()) {
    lineas.push(`evaluapro_adopcion_v1_total{modulo="${modulo}"} ${stats.v1}`);
  }

  lineas.push('');
  lineas.push('# HELP evaluapro_adopcion_v2_total Total de solicitudes a v2');
  lineas.push('# TYPE evaluapro_adopcion_v2_total counter');
  for (const [modulo, stats] of adopcionPorModulo.entries()) {
    lineas.push(`evaluapro_adopcion_v2_total{modulo="${modulo}"} ${stats.v2}`);
  }

  return lineas.join('\n');
}

/**
 * Exporta estado resumido de canary por módulo
 */
export function exportarEstadoCanary(): Record<
  string,
  {
    modulo: string;
    v1Porcentaje: number;
    v2Porcentaje: number;
    totalSolicitudes: number;
    estado: string;
    topEndpoints: Array<{
      endpoint: string;
      v2Porcentaje: number;
    }>;
  }
> {
  const resultado: Record<
    string,
    {
      modulo: string;
      v1Porcentaje: number;
      v2Porcentaje: number;
      totalSolicitudes: number;
      estado: string;
      topEndpoints: Array<{
        endpoint: string;
        v2Porcentaje: number;
      }>;
    }
  > = {};

  for (const modulo of adopcionPorModulo.keys()) {
    const stats = calcularPorcentajeAdopcion(modulo);
    const detalles = detallesAdopcionPorEndpoint(modulo);

    resultado[modulo] = {
      modulo,
      ...stats,
      topEndpoints: detalles.slice(0, 5).map((d) => ({
        endpoint: d.endpoint,
        v2Porcentaje: d.v2Porcentaje
      }))
    };
  }

  return resultado;
}
