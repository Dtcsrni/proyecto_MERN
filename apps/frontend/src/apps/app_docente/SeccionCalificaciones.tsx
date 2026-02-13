/**
 * SeccionCalificaciones
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
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
import { SeccionCalificar } from './SeccionCalificar';
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
  RevisionPaginaOmr,
  SolicitudRevisionAlumno
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


export function SeccionCalificaciones({
  alumnos,
  onAnalizar,
  onPrevisualizar,
  resultado,
  onActualizar,
  onActualizarPregunta,
  revisionOmrConfirmada,
  onConfirmarRevisionOmr,
  revisionesOmr,
  examenIdActivo,
  paginaActiva,
  onSeleccionarRevision,
  claveCorrectaPorNumero,
  ordenPreguntasClave,
  examenId,
  alumnoId,
  resultadoParaCalificar,
  respuestasParaCalificar,
  onCalificar,
  solicitudesRevision = [],
  onSincronizarSolicitudesRevision = async () => ({}),
  onResolverSolicitudRevision = async () => ({}),
  permisos,
  avisarSinPermiso
}: {
  alumnos: Alumno[];
  onAnalizar: (
    folio: string,
    numeroPagina: number,
    imagenBase64: string,
    contexto?: { nombreArchivo?: string }
  ) => Promise<ResultadoAnalisisOmr>;
  onPrevisualizar: (payload: {
    examenGeneradoId: string;
    alumnoId?: string | null;
    respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
  }) => Promise<{ preview: PreviewCalificacion }>;
  resultado: ResultadoOmr | null;
  onActualizar: (respuestas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>) => void;
  onActualizarPregunta: (numeroPregunta: number, opcion: string | null) => void;
  revisionOmrConfirmada: boolean;
  onConfirmarRevisionOmr: (confirmada: boolean) => void;
  revisionesOmr: RevisionExamenOmr[];
  examenIdActivo: string | null;
  paginaActiva: number | null;
  onSeleccionarRevision: (examenId: string, numeroPagina: number) => void;
  claveCorrectaPorNumero: Record<number, string>;
  ordenPreguntasClave: number[];
  examenId: string | null;
  alumnoId: string | null;
  resultadoParaCalificar: ResultadoOmr | null;
  respuestasParaCalificar: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  onCalificar: (payload: {
    examenGeneradoId: string;
    alumnoId?: string | null;
    aciertos?: number;
    totalReactivos?: number;
    bonoSolicitado?: number;
    evaluacionContinua?: number;
    proyecto?: number;
    retroalimentacion?: string;
    respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
    omrAnalisis?: {
      estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
      calidadPagina: number;
      confianzaPromedioPagina: number;
      ratioAmbiguas: number;
      templateVersionDetectada: 1 | 2;
      motivosRevision: string[];
      revisionConfirmada: boolean;
    };
  }) => Promise<unknown>;
  solicitudesRevision?: SolicitudRevisionAlumno[];
  onSincronizarSolicitudesRevision?: () => Promise<unknown>;
  onResolverSolicitudRevision?: (id: string, estado: 'atendida' | 'rechazada', respuestaDocente?: string) => Promise<unknown>;
  permisos: PermisosUI;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const puedeAnalizar = permisos.omr.analizar;
  const puedeCalificar = permisos.calificaciones.calificar;
  const revisionesSeguras = Array.isArray(revisionesOmr) ? revisionesOmr : [];
  const totalPaginas = revisionesSeguras.reduce((acumulado, examen) => acumulado + examen.paginas.length, 0);
  const paginasPendientes = revisionesSeguras.reduce(
    (acumulado, examen) => acumulado + examen.paginas.filter((pagina) => pagina.resultado.estadoAnalisis !== 'ok').length,
    0
  );
  const examenesListos = revisionesSeguras.filter((examen) => examen.revisionConfirmada).length;
  const solicitudesSeguras = Array.isArray(solicitudesRevision) ? solicitudesRevision : [];
  const [respuestaPorSolicitudId, setRespuestaPorSolicitudId] = useState<Record<string, string>>({});
  return (
    <>
      <div className="panel">
        <h2>
          <Icono nombre="calificar" /> Calificaciones
        </h2>
        <p className="nota">
          Escanea por página, revisa por examen y guarda solo cuando la revisión esté confirmada.
        </p>
        <div className="item-meta">
          <span>{revisionesSeguras.length} examen(es) en flujo</span>
          <span>{totalPaginas} página(s) procesadas</span>
          <span>{paginasPendientes} página(s) pendientes</span>
          <span>{examenesListos} examen(es) listos</span>
        </div>
      </div>
      <div className="calificaciones-layout">
        <div className="calificaciones-layout__main">
          <SeccionEscaneo
            alumnos={alumnos}
            onAnalizar={onAnalizar}
            onPrevisualizar={onPrevisualizar}
            resultado={resultado}
            onActualizar={onActualizar}
            onActualizarPregunta={onActualizarPregunta}
            respuestasCombinadas={respuestasParaCalificar}
            claveCorrectaPorNumero={claveCorrectaPorNumero}
            ordenPreguntasClave={ordenPreguntasClave}
            revisionOmrConfirmada={revisionOmrConfirmada}
            onConfirmarRevisionOmr={onConfirmarRevisionOmr}
            revisionesOmr={revisionesOmr}
            examenIdActivo={examenIdActivo}
            paginaActiva={paginaActiva}
            onSeleccionarRevision={onSeleccionarRevision}
            puedeAnalizar={puedeAnalizar}
            puedeCalificar={puedeCalificar}
            avisarSinPermiso={avisarSinPermiso}
          />
        </div>
        <aside className="calificaciones-layout__aside" aria-label="Panel de calificación">
          <SeccionCalificar
            examenId={examenId}
            alumnoId={alumnoId}
            resultadoOmr={resultadoParaCalificar}
            revisionOmrConfirmada={revisionOmrConfirmada}
            respuestasDetectadas={respuestasParaCalificar}
            claveCorrectaPorNumero={claveCorrectaPorNumero}
            ordenPreguntasClave={ordenPreguntasClave}
            onCalificar={onCalificar}
            puedeCalificar={puedeCalificar}
            avisarSinPermiso={avisarSinPermiso}
          />
          <section className="panel" style={{ marginTop: 12 }}>
            <h3>
              <Icono nombre="info" /> Solicitudes de revisión del alumno
            </h3>
            <div className="item-actions" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className="boton secundario"
                onClick={() => {
                  if (!puedeCalificar) {
                    avisarSinPermiso('No tienes permiso para revisar solicitudes.');
                    return;
                  }
                  void onSincronizarSolicitudesRevision();
                }}
              >
                <Icono nombre="recargar" /> Sincronizar solicitudes
              </button>
            </div>
            {solicitudesSeguras.length === 0 && <InlineMensaje tipo="info">Sin solicitudes pendientes de revisión.</InlineMensaje>}
            <ul className="lista lista-items">
              {solicitudesSeguras.map((solicitud) => (
                <li key={solicitud._id ?? solicitud.externoId}>
                  <div className="item-glass">
                    <div className="item-row">
                      <div>
                        <div className="item-title">
                          Folio {solicitud.folio} · Pregunta {solicitud.numeroPregunta}
                        </div>
                        <div className="item-meta">
                          <span className={`badge ${solicitud.estado === 'pendiente' ? 'warning' : solicitud.estado === 'atendida' ? 'ok' : 'error'}`}>
                            {solicitud.estado}
                          </span>
                          {solicitud.comentario && <span>Comentario: {solicitud.comentario}</span>}
                          {solicitud.conformidadAlumno && <span>Alumno en conformidad</span>}
                        </div>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      style={{ width: '100%', minHeight: 56, marginTop: 8 }}
                      placeholder="Respuesta para el alumno (opcional)"
                      value={respuestaPorSolicitudId[solicitud.externoId] ?? ''}
                      onChange={(event) =>
                        setRespuestaPorSolicitudId((prev) => ({ ...prev, [solicitud.externoId]: event.target.value }))
                      }
                    />
                    <div className="item-actions" style={{ marginTop: 8 }}>
                      <button
                        className="boton secundario"
                        type="button"
                        disabled={!solicitud._id}
                        onClick={() => {
                          if (!solicitud._id) return;
                          void onResolverSolicitudRevision(
                            solicitud._id,
                            'atendida',
                            respuestaPorSolicitudId[solicitud.externoId]
                          );
                        }}
                      >
                        <Icono nombre="ok" /> Marcar atendida
                      </button>
                      <button
                        className="boton secundario"
                        type="button"
                        disabled={!solicitud._id}
                        onClick={() => {
                          if (!solicitud._id) return;
                          void onResolverSolicitudRevision(
                            solicitud._id,
                            'rechazada',
                            respuestaPorSolicitudId[solicitud.externoId]
                          );
                        }}
                      >
                        <Icono nombre="salir" /> Rechazar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
