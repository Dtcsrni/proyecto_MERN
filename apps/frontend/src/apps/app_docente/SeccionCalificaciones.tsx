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
  type ExamenEntregado = {
    _id: string;
    folio: string;
    alumnoId?: string | null;
    plantillaId?: string;
    tipoExamen?: string;
    plantillaTitulo?: string;
    estado?: string;
    periodoId?: string;
    generadoEn?: string;
    entregadoEn?: string;
  };

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
  const [alumnoManualId, setAlumnoManualId] = useState('');
  const [examenesManual, setExamenesManual] = useState<ExamenEntregado[]>([]);
  const [plantillasPorId, setPlantillasPorId] = useState<Map<string, Plantilla>>(new Map());
  const [filtroFolioManual, setFiltroFolioManual] = useState('');
  const [examenManualId, setExamenManualId] = useState('');
  const [cargandoExamenesManual, setCargandoExamenesManual] = useState(false);
  const [activandoManual, setActivandoManual] = useState(false);
  const [manualMensaje, setManualMensaje] = useState('');
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  const [resolviendoSolicitudId, setResolviendoSolicitudId] = useState('');
  const [mensajeRevision, setMensajeRevision] = useState('');
  const bancoPorPeriodoRef = useRef<Map<string, Pregunta[]>>(new Map());
  const [manualContexto, setManualContexto] = useState<{
    examenId: string;
    alumnoId: string;
    folio: string;
    tipoExamenEtiqueta?: string;
    plantillaTitulo?: string;
    claveCorrectaPorNumero: Record<number, string>;
    ordenPreguntas: number[];
    respuestasDetectadas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  } | null>(null);

  function seleccionarAlumnoManual(valor: string) {
    if (valor === alumnoManualId) return;
    setAlumnoManualId(valor);
    setCargandoExamenesManual(Boolean(valor));
    setExamenesManual([]);
    setFiltroFolioManual('');
    setExamenManualId('');
    setManualMensaje('');
    setManualContexto(null);
  }

  function etiquetarTipoExamen(tipo?: string | null) {
    const valor = String(tipo ?? '').trim().toLowerCase();
    if (valor === 'parcial') return 'Parcial 1';
    if (valor === 'global') return 'Global final';
    return '';
  }

  const examenManualSeleccionado = useMemo(
    () => examenesManual.find((item) => item._id === examenManualId) ?? null,
    [examenesManual, examenManualId]
  );

  const resumenExamenManual = useMemo(() => {
    if (!examenManualSeleccionado) {
      return { tipo: '-', plantilla: '-', estado: '-' };
    }
    const plantilla = plantillasPorId.get(String(examenManualSeleccionado.plantillaId ?? '').trim());
    const tipo =
      etiquetarTipoExamen(String(examenManualSeleccionado.tipoExamen ?? '').trim()) ||
      etiquetarTipoExamen(String(plantilla?.tipo ?? '').trim()) ||
      '-';
    const plantillaTitulo =
      String(examenManualSeleccionado.plantillaTitulo ?? '').trim() ||
      String(plantilla?.titulo ?? '').trim() ||
      '-';
    const estado = String(examenManualSeleccionado.estado ?? 'entregado').trim() || 'entregado';
    return { tipo, plantilla: plantillaTitulo, estado };
  }, [examenManualSeleccionado, plantillasPorId]);

  useEffect(() => {
    let cancelado = false;
    void clienteApi
      .obtener<{ plantillas?: Plantilla[] }>('/examenes/plantillas')
      .then((payload) => {
        if (cancelado) return;
        const lista = Array.isArray(payload?.plantillas) ? payload.plantillas : [];
        const mapa = new Map<string, Plantilla>();
        for (const plantilla of lista) {
          const id = String(plantilla?._id ?? '').trim();
          if (!id) continue;
          mapa.set(id, plantilla);
        }
        setPlantillasPorId(mapa);
      })
      .catch(() => {
        if (!cancelado) setPlantillasPorId(new Map());
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const examenesManualFiltrados = useMemo(() => {
    const filtro = String(filtroFolioManual ?? '').trim().toUpperCase();
    if (!filtro) return examenesManual;
    return examenesManual.filter((examen) => String(examen?.folio ?? '').toUpperCase().includes(filtro));
  }, [examenesManual, filtroFolioManual]);

  useEffect(() => {
    if (!examenManualId) return;
    if (examenesManualFiltrados.some((item) => item._id === examenManualId)) return;
    setExamenManualId('');
  }, [examenManualId, examenesManualFiltrados]);

  useEffect(() => {
    if (!alumnoManualId) {
      setCargandoExamenesManual(false);
      return;
    }
    let cancelado = false;
    void clienteApi
      .obtener<{ examenes?: ExamenEntregado[] }>(
        `/examenes/generados?alumnoId=${encodeURIComponent(alumnoManualId)}&limite=200`
      )
      .then((payload) => {
        if (cancelado) return;
        const lista = Array.isArray(payload?.examenes) ? payload.examenes : [];
        const entregados = lista.filter((item) => {
          const estado = String(item?.estado ?? '').toLowerCase();
          return estado === 'entregado' || estado === 'calificado';
        });
        entregados.sort((a, b) => {
          const aTime = a.entregadoEn ? new Date(a.entregadoEn).getTime() : 0;
          const bTime = b.entregadoEn ? new Date(b.entregadoEn).getTime() : 0;
          return bTime - aTime;
        });
        setExamenesManual(entregados);
        setExamenManualId((prev) => (entregados.some((item) => item._id === prev) ? prev : ''));
        setManualMensaje(entregados.length === 0 ? 'No hay exámenes entregados para el alumno seleccionado.' : '');
      })
      .catch((error) => {
        if (cancelado) return;
        setExamenesManual([]);
        setExamenManualId('');
        setManualMensaje(mensajeDeError(error, 'No se pudo cargar la lista de exámenes entregados'));
      })
      .finally(() => {
        if (!cancelado) setCargandoExamenesManual(false);
      });
    return () => {
      cancelado = true;
    };
  }, [alumnoManualId]);

  async function obtenerBancoPreguntas(periodoId: string) {
    const llave = String(periodoId ?? '').trim();
    if (llave && bancoPorPeriodoRef.current.has(llave)) {
      return bancoPorPeriodoRef.current.get(llave) ?? [];
    }

    const banco = await clienteApi.obtener<{ preguntas: Pregunta[] }>(
      `/banco-preguntas${llave ? `?periodoId=${encodeURIComponent(llave)}` : ''}`
    );
    const preguntas = Array.isArray(banco?.preguntas) ? banco.preguntas : [];
    if (llave) {
      bancoPorPeriodoRef.current.set(llave, preguntas);
    }
    return preguntas;
  }

  async function activarManualDesdeEntregado() {
    if (activandoManual) return;
    if (!examenManualId) {
      setManualMensaje('Selecciona un examen entregado.');
      return;
    }
    const examenSeleccionado = examenesManual.find((item) => item._id === examenManualId);
    if (!examenSeleccionado) {
      setManualMensaje('No se encontró el examen seleccionado.');
      return;
    }
    try {
      setActivandoManual(true);
      setManualMensaje('');
      const detalle = await clienteApi.obtener<{ examen?: ExamenGeneradoClave & { _id?: string; alumnoId?: string | null; folio?: string; periodoId?: string } }>(
        `/examenes/generados/folio/${encodeURIComponent(examenSeleccionado.folio)}`
      );
      const examenDetalle = detalle?.examen;
      if (!examenDetalle) {
        setManualMensaje('No se pudo cargar el detalle del examen.');
        return;
      }

      const periodoId = String((examenDetalle as { periodoId?: unknown })?.periodoId ?? '').trim();
      const preguntasBanco = await obtenerBancoPreguntas(periodoId);
      const clave = construirClaveCorrectaExamen(examenDetalle, preguntasBanco);
      if (clave.ordenPreguntas.length === 0) {
        setManualMensaje('No se pudo construir la clave del examen para calificación manual.');
        return;
      }

      setManualContexto({
        examenId: String(examenDetalle._id ?? examenSeleccionado._id),
        alumnoId: String(examenDetalle.alumnoId ?? examenSeleccionado.alumnoId ?? alumnoManualId),
        folio: String(examenDetalle.folio ?? examenSeleccionado.folio),
        tipoExamenEtiqueta:
          etiquetarTipoExamen(String(examenSeleccionado.tipoExamen ?? '').trim()) ||
          etiquetarTipoExamen(String(plantillasPorId.get(String(examenSeleccionado.plantillaId ?? '').trim())?.tipo ?? '').trim()) ||
          undefined,
        plantillaTitulo:
          String(examenSeleccionado.plantillaTitulo ?? '').trim() ||
          String(plantillasPorId.get(String(examenSeleccionado.plantillaId ?? '').trim())?.titulo ?? '').trim() ||
          undefined,
        claveCorrectaPorNumero: clave.claveCorrectaPorNumero,
        ordenPreguntas: clave.ordenPreguntas,
        respuestasDetectadas: clave.ordenPreguntas.map((numeroPregunta) => ({ numeroPregunta, opcion: null, confianza: 0 }))
      });
      setManualMensaje('Modo manual activado para el examen seleccionado.');
    } catch (error) {
      setManualMensaje(mensajeDeError(error, 'No se pudo activar la calificación manual'));
    } finally {
      setActivandoManual(false);
    }
  }

  async function sincronizarSolicitudesRevision() {
    if (cargandoSolicitudes) return;
    try {
      setCargandoSolicitudes(true);
      setMensajeRevision('');
      await onSincronizarSolicitudesRevision();
      setMensajeRevision('Solicitudes sincronizadas correctamente.');
    } catch (error) {
      setMensajeRevision(mensajeDeError(error, 'No se pudieron sincronizar las solicitudes'));
    } finally {
      setCargandoSolicitudes(false);
    }
  }

  async function resolverSolicitud(solicitud: SolicitudRevisionAlumno, estado: 'atendida' | 'rechazada') {
    if (!solicitud._id || resolviendoSolicitudId) return;
    const respuesta = String(respuestaPorSolicitudId[solicitud.externoId] ?? '').trim();
    if (respuesta.length < 8) return;
    try {
      setResolviendoSolicitudId(solicitud._id);
      setMensajeRevision('');
      await onResolverSolicitudRevision(solicitud._id, estado, respuesta);
      setRespuestaPorSolicitudId((prev) => ({ ...prev, [solicitud.externoId]: '' }));
      setMensajeRevision(`Solicitud ${estado === 'atendida' ? 'atendida' : 'rechazada'} correctamente.`);
      await onSincronizarSolicitudesRevision();
    } catch (error) {
      setMensajeRevision(mensajeDeError(error, 'No se pudo resolver la solicitud'));
    } finally {
      setResolviendoSolicitudId('');
    }
  }

  return (
    <>
      <div className="panel calificaciones-hero">
        <h2>
          <Icono nombre="calificar" /> Calificaciones
        </h2>
        <p className="nota">
          Escanea por página, revisa por examen y guarda solo cuando la revisión esté confirmada.
        </p>
        <div className="item-meta calificaciones-hero__meta">
          <span>{revisionesSeguras.length} examen(es) en flujo</span>
          <span>{totalPaginas} página(s) procesadas</span>
          <span>{paginasPendientes} página(s) pendientes</span>
          <span>{examenesListos} examen(es) listos</span>
        </div>
      </div>
      <div className="calificaciones-layout" data-calificaciones-layout="true">
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
          <section className="panel calificaciones-manual-panel">
            <h3>
              <Icono nombre="alumno" /> Selección manual por entregado
            </h3>
            <p className="nota">Selecciona alumno y examen entregado para calificar manualmente cada pregunta.</p>
            <label className="campo">
              Alumno
              <select value={alumnoManualId} onChange={(event) => seleccionarAlumnoManual(event.target.value)}>
                <option value="">Selecciona</option>
                {alumnos.map((alumno) => (
                  <option key={alumno._id} value={alumno._id}>
                    {alumno.matricula} - {alumno.nombreCompleto}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Buscar folio
              <input
                value={filtroFolioManual}
                onChange={(event) => setFiltroFolioManual(event.target.value)}
                placeholder="Ej. FOLIO-000123"
                disabled={!alumnoManualId || cargandoExamenesManual || examenesManual.length === 0}
              />
            </label>
            <label className="campo">
              Examen entregado
              <select
                value={examenManualId}
                onChange={(event) => setExamenManualId(event.target.value)}
                disabled={!alumnoManualId || cargandoExamenesManual}
              >
                <option value="">Selecciona</option>
                {examenesManualFiltrados.map((examen) => (
                  <option key={examen._id} value={examen._id}>
                    {[
                      examen.folio,
                      etiquetarTipoExamen(examen.tipoExamen) || etiquetarTipoExamen(plantillasPorId.get(String(examen.plantillaId ?? '').trim())?.tipo),
                      String(examen.plantillaTitulo ?? '').trim() || String(plantillasPorId.get(String(examen.plantillaId ?? '').trim())?.titulo ?? '').trim(),
                      String(examen.estado ?? 'entregado')
                    ]
                      .filter((valor) => String(valor ?? '').trim().length > 0)
                      .join(' · ')}
                  </option>
                ))}
              </select>
            </label>
            {examenManualSeleccionado && (
              <div className="item-meta">
                <span>Tipo: {resumenExamenManual.tipo}</span>
                <span>Plantilla: {resumenExamenManual.plantilla}</span>
                <span>Estado: {resumenExamenManual.estado}</span>
              </div>
            )}
            {filtroFolioManual && examenesManualFiltrados.length === 0 && (
              <InlineMensaje tipo="info">No hay exámenes que coincidan con el folio buscado.</InlineMensaje>
            )}
            <div className="item-actions calificaciones-manual-panel__actions">
              <Boton
                type="button"
                variante="secundario"
                disabled={!alumnoManualId || !examenManualId || cargandoExamenesManual || activandoManual || !puedeCalificar}
                onClick={() => {
                  if (!puedeCalificar) {
                    avisarSinPermiso('No tienes permiso para calificar manualmente.');
                    return;
                  }
                  void activarManualDesdeEntregado();
                }}
              >
                {activandoManual ? 'Activando modo manual…' : cargandoExamenesManual ? 'Cargando…' : 'Usar examen para calificación manual'}
              </Boton>
              {manualContexto && (
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={() => {
                    setManualContexto(null);
                    setManualMensaje('Modo manual desactivado.');
                  }}
                >
                  Limpiar selección manual
                </Boton>
              )}
            </div>
            {manualMensaje && (
              <InlineMensaje tipo={esMensajeError(manualMensaje) ? 'error' : 'info'}>{manualMensaje}</InlineMensaje>
            )}
          </section>
          <SeccionCalificar
            examenId={manualContexto?.examenId ?? examenId}
            alumnoId={manualContexto?.alumnoId ?? alumnoId}
            resultadoOmr={manualContexto ? null : resultadoParaCalificar}
            revisionOmrConfirmada={manualContexto ? true : revisionOmrConfirmada}
            respuestasDetectadas={manualContexto?.respuestasDetectadas ?? respuestasParaCalificar}
            claveCorrectaPorNumero={manualContexto?.claveCorrectaPorNumero ?? claveCorrectaPorNumero}
            ordenPreguntasClave={manualContexto?.ordenPreguntas ?? ordenPreguntasClave}
            etiquetaTipoExamen={manualContexto?.tipoExamenEtiqueta ?? null}
            contextoManual={manualContexto
              ? [
                  'Modo manual activo',
                  `Folio ${manualContexto.folio}`,
                  manualContexto.tipoExamenEtiqueta ? `Tipo ${manualContexto.tipoExamenEtiqueta}` : '',
                  manualContexto.plantillaTitulo ? `Plantilla ${manualContexto.plantillaTitulo}` : ''
                ]
                  .filter((parte) => String(parte ?? '').trim().length > 0)
                  .join(' · ')
              : null}
            onCalificar={onCalificar}
            puedeCalificar={puedeCalificar}
            avisarSinPermiso={avisarSinPermiso}
          />
          <section className="panel calificaciones-revision-panel">
            <h3>
              <Icono nombre="info" /> Solicitudes de revisión del alumno
            </h3>
            <div className="item-actions calificaciones-revision-panel__toolbar">
              <button
                type="button"
                className="boton secundario"
                disabled={cargandoSolicitudes || resolviendoSolicitudId.length > 0}
                onClick={() => {
                  if (!puedeCalificar) {
                    avisarSinPermiso('No tienes permiso para revisar solicitudes.');
                    return;
                  }
                  void sincronizarSolicitudesRevision();
                }}
              >
                <Icono nombre="recargar" /> {cargandoSolicitudes ? 'Sincronizando…' : 'Sincronizar solicitudes'}
              </button>
            </div>
            {mensajeRevision && (
              <InlineMensaje tipo={esMensajeError(mensajeRevision) ? 'error' : 'info'}>{mensajeRevision}</InlineMensaje>
            )}
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
                          {solicitud.firmaDocente && <span>Firma: {solicitud.firmaDocente}</span>}
                        </div>
                      </div>
                    </div>
                    <textarea
                      className="calificaciones-revision-panel__respuesta"
                      rows={2}
                      placeholder="Respuesta obligatoria para el alumno (mínimo 8 caracteres)"
                      value={respuestaPorSolicitudId[solicitud.externoId] ?? ''}
                      onChange={(event) =>
                        setRespuestaPorSolicitudId((prev) => ({ ...prev, [solicitud.externoId]: event.target.value }))
                      }
                    />
                    <div className="item-actions calificaciones-revision-panel__actions">
                      <button
                        className="boton secundario"
                        type="button"
                        disabled={
                          !solicitud._id ||
                          String(respuestaPorSolicitudId[solicitud.externoId] ?? '').trim().length < 8 ||
                          resolviendoSolicitudId.length > 0
                        }
                        onClick={() => {
                          void resolverSolicitud(solicitud, 'atendida');
                        }}
                      >
                        <Icono nombre="ok" /> {resolviendoSolicitudId === solicitud._id ? 'Procesando…' : 'Marcar atendida'}
                      </button>
                      <button
                        className="boton secundario"
                        type="button"
                        disabled={
                          !solicitud._id ||
                          String(respuestaPorSolicitudId[solicitud.externoId] ?? '').trim().length < 8 ||
                          resolviendoSolicitudId.length > 0
                        }
                        onClick={() => {
                          void resolverSolicitud(solicitud, 'rechazada');
                        }}
                      >
                        <Icono nombre="salir" /> {resolviendoSolicitudId === solicitud._id ? 'Procesando…' : 'Rechazar'}
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
