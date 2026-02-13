/**
 * SeccionSincronizacion
 *
 * Panel consolidado de estado, sincronizacion con portal y backups entre equipos.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import { SeccionPaqueteSincronizacion } from './SeccionPaqueteSincronizacion';
import { SeccionSincronizacionEquipos } from './SeccionSincronizacionEquipos';
import { SeccionPublicar } from './SeccionPublicar';
import type { Periodo, Plantilla, Pregunta, Alumno, RegistroSincronizacion, RespuestaSyncPull, RespuestaSyncPush } from './tipos';
import { mensajeDeError } from './utilidades';

function formatearFecha(valor?: string) {
  if (!valor) return '-';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function normalizarEstado(estado?: string) {
  const lower = String(estado || '').toLowerCase();
  if (lower.includes('exitos')) return { clase: 'ok', texto: 'Exitosa' };
  if (lower.includes('fall')) return { clase: 'error', texto: 'Fallida' };
  if (lower.includes('pend')) return { clase: 'warn', texto: 'Pendiente' };
  return { clase: 'info', texto: 'Sin dato' };
}

export function SeccionSincronizacion({
  periodos,
  periodosArchivados,
  alumnos,
  plantillas,
  preguntas,
  ultimaActualizacionDatos,
  docenteCorreo,
  onPublicar,
  onCodigo,
  onExportarPaquete,
  onImportarPaquete,
  onPushServidor,
  onPullServidor
}: {
  periodos: Periodo[];
  periodosArchivados: Periodo[];
  alumnos: Alumno[];
  plantillas: Plantilla[];
  preguntas: Pregunta[];
  ultimaActualizacionDatos: number | null;
  docenteCorreo?: string;
  onPublicar: (periodoId: string) => Promise<unknown>;
  onCodigo: (periodoId: string) => Promise<{ codigo?: string; expiraEn?: string }>;
  onExportarPaquete: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<{
    paqueteBase64: string;
    checksumSha256: string;
    checksumGzipSha256?: string;
    exportadoEn: string;
    conteos: Record<string, number>;
  }>;
  onImportarPaquete: (payload: { paqueteBase64: string; checksumSha256?: string; dryRun?: boolean; docenteCorreo?: string }) => Promise<
    | { mensaje?: string; resultados?: unknown[]; pdfsGuardados?: number }
    | { mensaje?: string; checksumSha256?: string; conteos?: Record<string, number> }
  >;
  onPushServidor: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<RespuestaSyncPush>;
  onPullServidor: (payload: { desde?: string; limite?: number }) => Promise<RespuestaSyncPull>;
}) {
  const [sincronizaciones, setSincronizaciones] = useState<RegistroSincronizacion[]>([]);
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const montadoRef = useRef(true);

  const resumenDatos = useMemo(
    () => ({
      materiasActivas: periodos.length,
      materiasArchivadas: periodosArchivados.length,
      alumnos: alumnos.length,
      plantillas: plantillas.length,
      banco: preguntas.length
    }),
    [periodos.length, periodosArchivados.length, alumnos.length, plantillas.length, preguntas.length]
  );

  const ordenadas = useMemo(() => {
    return [...sincronizaciones].sort((a, b) => {
      const fechaA = new Date(a.ejecutadoEn || a.createdAt || 0).getTime();
      const fechaB = new Date(b.ejecutadoEn || b.createdAt || 0).getTime();
      return fechaB - fechaA;
    });
  }, [sincronizaciones]);

  const sincronizacionReciente = ordenadas[0];
  const totalesEstado = useMemo(() => {
    let exitosas = 0;
    let fallidas = 0;
    let pendientes = 0;
    for (const item of ordenadas) {
      const estado = normalizarEstado(item.estado).clase;
      if (estado === 'ok') exitosas += 1;
      else if (estado === 'error') fallidas += 1;
      else if (estado === 'warn') pendientes += 1;
    }
    return { exitosas, fallidas, pendientes };
  }, [ordenadas]);

  const fechaActualizacion = ultimaActualizacionDatos ? new Date(ultimaActualizacionDatos).toLocaleString() : '-';

  const refrescarEstado = useCallback(() => {
    setCargandoEstado(true);
    setErrorEstado('');
    clienteApi
      .obtener<{ sincronizaciones?: RegistroSincronizacion[] }>('/sincronizaciones?limite=12')
      .then((payload) => {
        if (!montadoRef.current) return;
        const lista = Array.isArray(payload.sincronizaciones) ? payload.sincronizaciones : [];
        setSincronizaciones(lista);
      })
      .catch((error) => {
        if (!montadoRef.current) return;
        setSincronizaciones([]);
        setErrorEstado(mensajeDeError(error, 'No se pudo obtener el estado de sincronización'));
      })
      .finally(() => {
        if (!montadoRef.current) return;
        setCargandoEstado(false);
      });
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    // React lint: evita setState sincronico directo dentro del efecto.
    const id = window.setTimeout(() => {
      void refrescarEstado();
    }, 0);
    return () => {
      window.clearTimeout(id);
      montadoRef.current = false;
    };
  }, [refrescarEstado]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      if (!montadoRef.current) return;
      refrescarEstado();
    }, 45_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, refrescarEstado]);

  return (
    <div className="panel">
      <div className="panel">
        <h2>
          <Icono nombre="publicar" /> Sincronización, backups y estado de datos
        </h2>
        <p className="nota">Consolida sincronización con portal, paquetes entre computadoras y trazabilidad del estado operativo.</p>
        <div className="estado-datos-grid">
          <div className="item-glass estado-datos-card">
            <div className="estado-datos-header">
              <div>
                <div className="estado-datos-titulo">Estado de datos locales</div>
                <div className="nota">Actualizado: {fechaActualizacion}</div>
              </div>
              <span className="estado-chip info">Local</span>
            </div>
            <div className="estado-datos-cifras">
              <div>
                <div className="estado-datos-numero">{resumenDatos.materiasActivas}</div>
                <div className="nota">Materias activas</div>
              </div>
              <div>
                <div className="estado-datos-numero">{resumenDatos.materiasArchivadas}</div>
                <div className="nota">Materias archivadas</div>
              </div>
              <div>
                <div className="estado-datos-numero">{resumenDatos.alumnos}</div>
                <div className="nota">Alumnos</div>
              </div>
              <div>
                <div className="estado-datos-numero">{resumenDatos.plantillas}</div>
                <div className="nota">Plantillas</div>
              </div>
              <div>
                <div className="estado-datos-numero">{resumenDatos.banco}</div>
                <div className="nota">Banco de preguntas</div>
              </div>
            </div>
          </div>

          <div className="item-glass estado-datos-card">
            <div className="estado-datos-header">
              <div>
                <div className="estado-datos-titulo">Estado de sincronización</div>
                <div className="nota">
                  Último evento:{' '}
                  {sincronizacionReciente ? formatearFecha(sincronizacionReciente.ejecutadoEn || sincronizacionReciente.createdAt) : 'Sin registros'}
                </div>
              </div>
              <span className={`estado-chip ${normalizarEstado(sincronizacionReciente?.estado).clase}`}>
                {normalizarEstado(sincronizacionReciente?.estado).texto}
              </span>
            </div>

            <div className="estado-datos-cifras">
              <div>
                <div className="estado-datos-numero">{totalesEstado.exitosas}</div>
                <div className="nota">Exitosas</div>
              </div>
              <div>
                <div className="estado-datos-numero">{totalesEstado.fallidas}</div>
                <div className="nota">Fallidas</div>
              </div>
              <div>
                <div className="estado-datos-numero">{totalesEstado.pendientes}</div>
                <div className="nota">Pendientes</div>
              </div>
            </div>

            <div className="estado-datos-lista">
              {(ordenadas.length ? ordenadas : [{} as RegistroSincronizacion]).slice(0, 5).map((item, idx) => {
                if (!item?.estado) {
                  return (
                    <div key={`vacio-${idx}`} className="estado-datos-item">
                      <div className="nota">No hay historial disponible.</div>
                    </div>
                  );
                }
                const estado = normalizarEstado(item.estado);
                return (
                  <div key={item._id || `sync-${idx}`} className="estado-datos-item">
                    <span className={`estado-chip ${estado.clase}`}>{estado.texto}</span>
                    <div>
                      <div className="estado-datos-item__titulo">{String(item.tipo || 'sincronizacion').toUpperCase()}</div>
                      <div className="nota">{formatearFecha(item.ejecutadoEn || item.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {errorEstado && <InlineMensaje tipo="warning">{errorEstado}</InlineMensaje>}
            <div className="acciones">
              <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={cargandoEstado} onClick={refrescarEstado}>
                {cargandoEstado ? 'Actualizando...' : 'Actualizar estado'}
              </Boton>
              <label className="campo campo--checkbox" style={{ marginBottom: 0 }}>
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                Auto-refresh 45s
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="sincronizacion-grid">
        <SeccionPublicar periodos={periodos} onPublicar={onPublicar} onCodigo={onCodigo} />
        <SeccionPaqueteSincronizacion periodos={periodos} docenteCorreo={docenteCorreo} onExportar={onExportarPaquete} onImportar={onImportarPaquete} />
        <SeccionSincronizacionEquipos onPushServidor={onPushServidor} onPullServidor={onPullServidor} />
      </div>
    </div>
  );
}
