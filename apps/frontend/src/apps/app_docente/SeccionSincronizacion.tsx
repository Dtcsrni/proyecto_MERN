/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * App docente: panel basico para banco, examenes, entrega y calificacion.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guardarTokenDocente, limpiarTokenDocente, obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { accionToastSesionParaError, mensajeUsuarioDeErrorConSugerencia, onSesionInvalidada } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { TemaBoton } from '../../tema/TemaBoton';
import { AyudaFormulario } from './AyudaFormulario';
import { clienteApi } from './clienteApiDocente';
import { SeccionAutenticacion } from './SeccionAutenticacion';
import { SeccionAlumnos } from './SeccionAlumnos';
import { SeccionBanco } from './SeccionBanco';
import { SeccionCuenta } from './SeccionCuenta';
import { QrAccesoMovil, SeccionEscaneo } from './SeccionEscaneo';
import { SeccionPlantillas } from './SeccionPlantillas';
import { SeccionPeriodos, SeccionPeriodosArchivados } from './SeccionPeriodos';
import { SeccionPaqueteSincronizacion } from './SeccionPaqueteSincronizacion';
import { SeccionSincronizacionEquipos } from './SeccionSincronizacionEquipos';
import { SeccionPublicar } from './SeccionPublicar';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  Docente,
  EnviarConPermiso,
  ExamenGeneradoClave,
  Periodo,
  PermisosUI,
  Plantilla,
  Pregunta,
  PreviewCalificacion,
  PreviewPlantilla,
  RegistroSincronizacion,
  RespuestaSyncPull,
  RespuestaSyncPush,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RevisionExamenOmr,
  RevisionPaginaOmr
} from './tipos';
import {
  combinarRespuestasOmrPaginas,
  construirClaveCorrectaExamen,
  consolidarResultadoOmrExamen,
  esMensajeError,
  etiquetaMateria,
  mensajeDeError,
  normalizarResultadoOmr,
  obtenerSesionDocenteId,
  obtenerVistaInicial,
} from './utilidades';



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

  const ordenarSincronizaciones = useCallback((lista: RegistroSincronizacion[]) => {
    return [...lista].sort((a, b) => {
      const fechaA = new Date(a.ejecutadoEn || a.createdAt || 0).getTime();
      const fechaB = new Date(b.ejecutadoEn || b.createdAt || 0).getTime();
      return fechaB - fechaA;
    });
  }, []);

  const sincronizacionReciente = sincronizaciones[0];
  const fechaActualizacion = ultimaActualizacionDatos ? new Date(ultimaActualizacionDatos).toLocaleString() : '-';

  const refrescarEstado = useCallback(() => {
    setCargandoEstado(true);
    setErrorEstado('');
    clienteApi
      .obtener<{ sincronizaciones?: RegistroSincronizacion[] }>('/sincronizaciones?limite=6')
      .then((payload) => {
        if (!montadoRef.current) return;
        const lista = Array.isArray(payload.sincronizaciones) ? payload.sincronizaciones : [];
        setSincronizaciones(ordenarSincronizaciones(lista));
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
  }, [ordenarSincronizaciones]);

  useEffect(() => {
    montadoRef.current = true;
    const timer = window.setTimeout(() => {
      if (!montadoRef.current) return;
      refrescarEstado();
    }, 0);
    return () => {
      montadoRef.current = false;
      window.clearTimeout(timer);
    };
  }, [refrescarEstado]);

  return (
    <div className="panel">
      <div className="panel">
        <h2>
          <Icono nombre="publicar" /> Sincronización, backups y estado de datos
        </h2>
        <p className="nota">
          Esta pantalla concentra la sincronización con el portal y el flujo de backups/exportaciones entre equipos.
        </p>
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
                <div className="estado-datos-titulo">Ultima sincronización</div>
                <div className="nota">
                  {sincronizacionReciente ? formatearFecha(sincronizacionReciente.ejecutadoEn || sincronizacionReciente.createdAt) : 'Sin registros'}
                </div>
              </div>
              <span className={`estado-chip ${normalizarEstado(sincronizacionReciente?.estado).clase}`}>
                {normalizarEstado(sincronizacionReciente?.estado).texto}
              </span>
            </div>
            <div className="estado-datos-lista">
              {(sincronizaciones.length ? sincronizaciones : [{} as RegistroSincronizacion]).slice(0, 4).map((item, idx) => {
                if (!item || !item.estado) {
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
                      <div className="estado-datos-item__titulo">{String(item.tipo || 'publicacion').toUpperCase()}</div>
                      <div className="nota">{formatearFecha(item.ejecutadoEn || item.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {errorEstado && <InlineMensaje tipo="warning">{errorEstado}</InlineMensaje>}
            <div className="acciones">
              <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={cargandoEstado} onClick={() => refrescarEstado()}>
                {cargandoEstado ? 'Actualizando.' : 'Actualizar estado'}
              </Boton>
            </div>
          </div>
        </div>
      </div>
      <div className="sincronizacion-grid">
        <SeccionPublicar periodos={periodos} onPublicar={onPublicar} onCodigo={onCodigo} />
        <SeccionPaqueteSincronizacion
          periodos={periodos}
          docenteCorreo={docenteCorreo}
          onExportar={onExportarPaquete}
          onImportar={onImportarPaquete}
        />
        <SeccionSincronizacionEquipos onPushServidor={onPushServidor} onPullServidor={onPullServidor} />
      </div>
    </div>
  );
}
























