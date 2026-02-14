/**
 * metrics
 *
 * Responsabilidad: Punto comun de metricas/logs/correlacion para operacion.
 * Limites: Evitar romper nombres de metricas o formato de log en produccion.
 */
import { exportarMetricasAdopcion } from './metricsAdopcion';
import { exportarEstadosCircuitBreaker } from '../robustez/circuitBreaker';
import { exportarMetricasObjetivoCanary } from './rolloutCanary';

const inicioDelProceso = Date.now();

type ClaveSolicitud = `${string}|${string}|${number}`;

const solicitudesPorRuta = new Map<ClaveSolicitud, number>();
const solicitudesTotales = { total: 0, errores: 0 };
const exportacionesListaTotales = {
  csv: 0,
  docx: 0,
  firma: 0,
  errores: 0
};
const etapasOmrDuracionMs = new Map<string, number>();
const etapasOmrTotales = new Map<string, number>();
const pipelineOmrTotales = { total: 0, errores: 0, duracionAcumuladaMs: 0 };
const esquemaVersionadoTotales = {
  fallbackReads: 0,
  v2Writes: 0
};

const cubetasMs = [25, 50, 100, 250, 500, 1000, 2500, 5000];
const histogramaDuracion = new Map<number, number>();

for (const cubeta of cubetasMs) histogramaDuracion.set(cubeta, 0);
histogramaDuracion.set(Infinity, 0);

function incrementarCubeta(duracionMs: number) {
  for (const cubeta of cubetasMs) {
    if (duracionMs <= cubeta) {
      histogramaDuracion.set(cubeta, (histogramaDuracion.get(cubeta) ?? 0) + 1);
      return;
    }
  }
  histogramaDuracion.set(Infinity, (histogramaDuracion.get(Infinity) ?? 0) + 1);
}

export function registrarRequestHttp(method: string, route: string, status: number, durationMs: number) {
  const metodo = String(method || 'GET').toUpperCase();
  const ruta = String(route || '/');
  const estatus = Number.isFinite(status) ? status : 500;
  const clave = `${metodo}|${ruta}|${estatus}` as ClaveSolicitud;
  solicitudesPorRuta.set(clave, (solicitudesPorRuta.get(clave) ?? 0) + 1);

  solicitudesTotales.total += 1;
  if (estatus >= 500) solicitudesTotales.errores += 1;
  incrementarCubeta(Math.max(0, Math.round(durationMs)));
}

export function registrarExportacionLista(tipo: 'csv' | 'docx' | 'firma', exito: boolean) {
  if (!exito) {
    exportacionesListaTotales.errores += 1;
    return;
  }
  if (tipo === 'csv') exportacionesListaTotales.csv += 1;
  if (tipo === 'docx') exportacionesListaTotales.docx += 1;
  if (tipo === 'firma') exportacionesListaTotales.firma += 1;
}

export function registrarOmrEtapa(
  etapa: 'deteccion' | 'scoring' | 'calidad' | 'qr' | 'debug',
  duracionMs: number,
  exito: boolean,
  requestId?: string
) {
  const claveTotal = `${etapa}|${exito ? 'ok' : 'error'}`;
  etapasOmrTotales.set(claveTotal, (etapasOmrTotales.get(claveTotal) ?? 0) + 1);
  etapasOmrDuracionMs.set(etapa, (etapasOmrDuracionMs.get(etapa) ?? 0) + Math.max(0, duracionMs));
  if (!exito && requestId) {
    // requestId queda disponible para correlacion en logs del middleware;
    // aqui solo contabilizamos sin exponer datos sensibles.
    void requestId;
  }
}

export function registrarOmrPipeline(exito: boolean, duracionMs: number, requestId?: string) {
  pipelineOmrTotales.total += 1;
  pipelineOmrTotales.duracionAcumuladaMs += Math.max(0, duracionMs);
  if (!exito) pipelineOmrTotales.errores += 1;
  if (!exito && requestId) {
    void requestId;
  }
}

export function registrarSchemaFallbackRead() {
  esquemaVersionadoTotales.fallbackReads += 1;
}

export function registrarSchemaV2Write() {
  esquemaVersionadoTotales.v2Writes += 1;
}

export function exportarMetricasPrometheus(): string {
  const lineas: string[] = [];
  lineas.push('# HELP evaluapro_http_requests_total Total de requests HTTP procesados');
  lineas.push('# TYPE evaluapro_http_requests_total counter');
  for (const [clave, valor] of solicitudesPorRuta.entries()) {
    const [metodo, ruta, estatus] = clave.split('|');
    lineas.push(
      `evaluapro_http_requests_total{method="${metodo}",route="${ruta}",status="${estatus}"} ${valor}`
    );
  }
  lineas.push('');

  lineas.push('# HELP evaluapro_http_request_duration_ms_bucket Histograma simple de latencia por buckets');
  lineas.push('# TYPE evaluapro_http_request_duration_ms_bucket counter');
  for (const [cubeta, valor] of histogramaDuracion.entries()) {
    const le = cubeta === Infinity ? '+Inf' : String(cubeta);
    lineas.push(`evaluapro_http_request_duration_ms_bucket{le="${le}"} ${valor}`);
  }
  lineas.push('');

  lineas.push('# HELP evaluapro_process_uptime_seconds Uptime del proceso');
  lineas.push('# TYPE evaluapro_process_uptime_seconds gauge');
  lineas.push(`evaluapro_process_uptime_seconds ${Math.floor((Date.now() - inicioDelProceso) / 1000)}`);
  lineas.push('');

  lineas.push('# HELP evaluapro_http_errors_total Total de respuestas con error 5xx');
  lineas.push('# TYPE evaluapro_http_errors_total counter');
  lineas.push(`evaluapro_http_errors_total ${solicitudesTotales.errores}`);
  lineas.push('');

  lineas.push('# HELP evaluapro_lista_export_csv_total Total de exportaciones de lista academica en CSV');
  lineas.push('# TYPE evaluapro_lista_export_csv_total counter');
  lineas.push(`evaluapro_lista_export_csv_total ${exportacionesListaTotales.csv}`);
  lineas.push('');

  lineas.push('# HELP evaluapro_lista_export_docx_total Total de exportaciones de lista academica en DOCX');
  lineas.push('# TYPE evaluapro_lista_export_docx_total counter');
  lineas.push(`evaluapro_lista_export_docx_total ${exportacionesListaTotales.docx}`);
  lineas.push('');

  lineas.push('# HELP evaluapro_lista_export_firma_total Total de exportaciones de manifiesto de integridad');
  lineas.push('# TYPE evaluapro_lista_export_firma_total counter');
  lineas.push(`evaluapro_lista_export_firma_total ${exportacionesListaTotales.firma}`);
  lineas.push('');

  lineas.push('# HELP evaluapro_lista_export_error_total Total de fallos de exportacion de lista academica');
  lineas.push('# TYPE evaluapro_lista_export_error_total counter');
  lineas.push(`evaluapro_lista_export_error_total ${exportacionesListaTotales.errores}`);

  lineas.push('');
  lineas.push('# HELP evaluapro_omr_stage_duration_ms Duracion acumulada de etapas OMR en milisegundos');
  lineas.push('# TYPE evaluapro_omr_stage_duration_ms counter');
  for (const [etapa, valor] of etapasOmrDuracionMs.entries()) {
    lineas.push(`evaluapro_omr_stage_duration_ms{stage="${etapa}"} ${valor}`);
  }

  lineas.push('');
  lineas.push('# HELP evaluapro_omr_stage_errors_total Total de ejecuciones por etapa OMR y estado');
  lineas.push('# TYPE evaluapro_omr_stage_errors_total counter');
  for (const [clave, valor] of etapasOmrTotales.entries()) {
    const [etapa, estado] = clave.split('|');
    lineas.push(`evaluapro_omr_stage_errors_total{stage="${etapa}",status="${estado}"} ${valor}`);
  }

  lineas.push('');
  lineas.push('# HELP evaluapro_omr_pipeline_total Total de ejecuciones del pipeline OMR');
  lineas.push('# TYPE evaluapro_omr_pipeline_total counter');
  lineas.push(`evaluapro_omr_pipeline_total ${pipelineOmrTotales.total}`);

  lineas.push('');
  lineas.push('# HELP evaluapro_omr_pipeline_error_total Total de errores del pipeline OMR');
  lineas.push('# TYPE evaluapro_omr_pipeline_error_total counter');
  lineas.push(`evaluapro_omr_pipeline_error_total ${pipelineOmrTotales.errores}`);

  lineas.push('');
  lineas.push('# HELP evaluapro_omr_pipeline_duration_ms Promedio de duracion del pipeline OMR en milisegundos');
  lineas.push('# TYPE evaluapro_omr_pipeline_duration_ms gauge');
  const promedioPipeline =
    pipelineOmrTotales.total > 0 ? pipelineOmrTotales.duracionAcumuladaMs / pipelineOmrTotales.total : 0;
  lineas.push(`evaluapro_omr_pipeline_duration_ms ${Number(promedioPipeline.toFixed(2))}`);

  lineas.push('');
  lineas.push('# HELP evaluapro_schema_fallback_reads_total Total de lecturas por adaptador v1 durante migracion dual');
  lineas.push('# TYPE evaluapro_schema_fallback_reads_total counter');
  lineas.push(`evaluapro_schema_fallback_reads_total ${esquemaVersionadoTotales.fallbackReads}`);

  lineas.push('');
  lineas.push('# HELP evaluapro_schema_v2_writes_total Total de escrituras procesadas en handlers v2');
  lineas.push('# TYPE evaluapro_schema_v2_writes_total counter');
  lineas.push(`evaluapro_schema_v2_writes_total ${esquemaVersionadoTotales.v2Writes}`);

  // Agregar métrica de adopción canary
  lineas.push('');
  lineas.push(exportarMetricasAdopcion());

  // Agregar objetivos actuales de rollout canary
  lineas.push('');
  lineas.push(exportarMetricasObjetivoCanary());

  // Agregar estados de circuit breaker
  lineas.push('');
  lineas.push('# HELP evaluapro_circuit_breaker_status Estado actual de circuit breakers (0=cerrado, 1=abierto, 2=semiluza)');
  lineas.push('# TYPE evaluapro_circuit_breaker_status gauge');
  const estadosCb = exportarEstadosCircuitBreaker();
  for (const [nombre, estado] of Object.entries(estadosCb)) {
    const estadoNumerico = estado.estado === 'cerrado' ? 0 : estado.estado === 'abierto' ? 1 : 2;
    lineas.push(`evaluapro_circuit_breaker_status{nombre="${nombre}"} ${estadoNumerico}`);
  }

  lineas.push('');
  lineas.push('# HELP evaluapro_circuit_breaker_metrics Métricas de circuit breaker (intentos, éxitos, fallos)');
  lineas.push('# TYPE evaluapro_circuit_breaker_metrics counter');
  for (const [nombre, estado] of Object.entries(estadosCb)) {
    const { metricas } = estado;
    lineas.push(
      `evaluapro_circuit_breaker_metrics{nombre="${nombre}",tipo="intentos_totales"} ${metricas.intentosTotales}`
    );
    lineas.push(
      `evaluapro_circuit_breaker_metrics{nombre="${nombre}",tipo="intentos_exitosos"} ${metricas.intentosExitosos}`
    );
    lineas.push(
      `evaluapro_circuit_breaker_metrics{nombre="${nombre}",tipo="intentos_fallidos"} ${metricas.intentosFallidos}`
    );
    lineas.push(
      `evaluapro_circuit_breaker_metrics{nombre="${nombre}",tipo="rechazos_cb"} ${metricas.erroresCircuitBreaker}`
    );
  }

  return lineas.join('\n');
}
