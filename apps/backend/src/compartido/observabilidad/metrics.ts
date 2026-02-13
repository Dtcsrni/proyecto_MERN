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
  return lineas.join('\n');
}
