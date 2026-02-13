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


export function SeccionCalificar({
  examenId,
  alumnoId,
  resultadoOmr,
  revisionOmrConfirmada,
  respuestasDetectadas,
  claveCorrectaPorNumero,
  ordenPreguntasClave,
  onCalificar,
  puedeCalificar,
  avisarSinPermiso
}: {
  examenId: string | null;
  alumnoId: string | null;
  resultadoOmr: ResultadoOmr | null;
  revisionOmrConfirmada: boolean;
  respuestasDetectadas: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
  claveCorrectaPorNumero: Record<number, string>;
  ordenPreguntasClave: number[];
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
  puedeCalificar: boolean;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const [bono, setBono] = useState(0);
  const [evaluacionContinua, setEvaluacionContinua] = useState(0);
  const [proyecto, setProyecto] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const respuestasSeguras = useMemo(
    () => (Array.isArray(respuestasDetectadas) ? respuestasDetectadas : []),
    [respuestasDetectadas]
  );
  const respuestasPorNumero = useMemo(
    () =>
      new Map(
        respuestasSeguras
          .filter((item) => Number.isFinite(Number(item?.numeroPregunta)))
          .map((item) => [Number(item.numeroPregunta), item])
      ),
    [respuestasSeguras]
  );
  const ordenPreguntas = useMemo(() => {
    if (Array.isArray(ordenPreguntasClave) && ordenPreguntasClave.length > 0) return ordenPreguntasClave;
    const desdeRespuestas = respuestasSeguras
      .map((item) => Number(item?.numeroPregunta))
      .filter((numero) => Number.isFinite(numero));
    const desdeClave = Object.keys(claveCorrectaPorNumero)
      .map((numero) => Number(numero))
      .filter((numero) => Number.isFinite(numero));
    return Array.from(new Set([...desdeClave, ...desdeRespuestas])).sort((a, b) => a - b);
  }, [claveCorrectaPorNumero, ordenPreguntasClave, respuestasSeguras]);
  const resumenDinamico = useMemo(() => {
    if (ordenPreguntas.length === 0) {
      return { total: 0, aciertos: 0, contestadas: 0, notaSobre5: 0 };
    }
    let aciertos = 0;
    let contestadas = 0;
    for (const numero of ordenPreguntas) {
      const correcta = claveCorrectaPorNumero[numero] ?? null;
      const opcion = respuestasPorNumero.get(numero)?.opcion ?? null;
      if (opcion) contestadas += 1;
      if (correcta && opcion && correcta === opcion) aciertos += 1;
    }
    const total = ordenPreguntas.length;
    const notaSobre5 = Number(((aciertos / Math.max(1, total)) * 5).toFixed(2));
    return { total, aciertos, contestadas, notaSobre5 };
  }, [claveCorrectaPorNumero, ordenPreguntas, respuestasPorNumero]);

  const requiereRevisionConfirmacion = Boolean(
    resultadoOmr && resultadoOmr.estadoAnalisis !== 'ok' && !revisionOmrConfirmada
  );
  const bloqueoPorCalidad = resultadoOmr?.estadoAnalisis === 'rechazado_calidad';
  const puedeCalificarLocal = Boolean(examenId && alumnoId) && !requiereRevisionConfirmacion && !bloqueoPorCalidad;
  const bloqueoCalificar = !puedeCalificar;

  async function calificar() {
    if (!examenId || !alumnoId) {
      setMensaje('Falta examen o alumno');
      return;
    }
    try {
      const inicio = Date.now();
      if (!puedeCalificar) {
        avisarSinPermiso('No tienes permiso para calificar.');
        return;
      }
      setGuardando(true);
      setMensaje('');
      await onCalificar({
        examenGeneradoId: examenId,
        alumnoId,
        bonoSolicitado: bono,
        evaluacionContinua,
        proyecto,
        respuestasDetectadas,
        omrAnalisis: resultadoOmr
          ? {
              estadoAnalisis: resultadoOmr.estadoAnalisis,
              calidadPagina: resultadoOmr.calidadPagina,
              confianzaPromedioPagina: resultadoOmr.confianzaPromedioPagina,
              ratioAmbiguas: resultadoOmr.ratioAmbiguas,
              templateVersionDetectada: resultadoOmr.templateVersionDetectada,
              motivosRevision: Array.isArray(resultadoOmr.motivosRevision) ? resultadoOmr.motivosRevision : [],
              revisionConfirmada: revisionOmrConfirmada
            }
          : undefined
      });
      setMensaje('Calificacion guardada');
      emitToast({ level: 'ok', title: 'Calificacion', message: 'Calificacion guardada', durationMs: 2200 });
      registrarAccionDocente('calificar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo calificar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo calificar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('calificar', false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="panel calif-grade-card">
      <h2>
        <Icono nombre="calificar" /> Calificar examen
      </h2>
      <div className="item-sub">Examen: {examenId ?? 'Sin examen'}</div>
      <div className="item-sub">Alumno: {alumnoId ?? 'Sin alumno'}</div>
      <div className="item-meta">
        <span>Respuestas listas: {respuestasSeguras.length}</span>
        <span>
          Aciertos dinámicos: {resumenDinamico.aciertos}/{resumenDinamico.total}
        </span>
        <span>Nota estimada: {resumenDinamico.notaSobre5.toFixed(2)} / 5.00</span>
      </div>
      {resultadoOmr && (
        <div className="item-meta">
          <span className={`badge ${resultadoOmr.estadoAnalisis === 'ok' ? 'ok' : resultadoOmr.estadoAnalisis === 'rechazado_calidad' ? 'error' : 'warning'}`}>
            OMR: {resultadoOmr.estadoAnalisis}
          </span>
          <span>Calidad {Math.round(resultadoOmr.calidadPagina * 100)}%</span>
          <span>Confianza {Math.round(resultadoOmr.confianzaPromedioPagina * 100)}%</span>
          <span>Ambiguas {(resultadoOmr.ratioAmbiguas * 100).toFixed(1)}%</span>
        </div>
      )}
      {requiereRevisionConfirmacion && (
        <InlineMensaje tipo="warning">Debes confirmar la revisión OMR antes de guardar la calificación.</InlineMensaje>
      )}
      {bloqueoPorCalidad && (
        <InlineMensaje tipo="error">Calificación bloqueada: el análisis OMR fue rechazado por calidad.</InlineMensaje>
      )}
      <div className="calif-grade-grid">
        <label className="campo">
          Bono (max 0.5)
          <input
            type="number"
            step="0.1"
            min={0}
            max={0.5}
            value={bono}
            onChange={(event) => setBono(Math.max(0, Math.min(0.5, Number(event.target.value))))}
            disabled={bloqueoCalificar}
          />
        </label>
        <label className="campo">
          Evaluacion continua (parcial)
          <input
            type="number"
            value={evaluacionContinua}
            onChange={(event) => setEvaluacionContinua(Math.max(0, Number(event.target.value)))}
            disabled={bloqueoCalificar}
          />
        </label>
        <label className="campo">
          Proyecto (global)
          <input
            type="number"
            value={proyecto}
            onChange={(event) => setProyecto(Math.max(0, Number(event.target.value)))}
            disabled={bloqueoCalificar}
          />
        </label>
      </div>
      <Boton
        type="button"
        icono={<Icono nombre="calificar" />}
        cargando={guardando}
        disabled={!puedeCalificarLocal || bloqueoCalificar}
        onClick={calificar}
      >
        {guardando ? 'Guardando…' : 'Guardar calificación'}
      </Boton>
      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
      <details className="colapsable">
        <summary>Ayuda para calificar</summary>
        <ul className="lista nota">
          <li>La nota estimada se recalcula automáticamente sobre 5.00.</li>
          <li>
            Si el estado es <code>requiere_revision</code>, confirma la revisión manual antes de guardar.
          </li>
          <li>
            Si el estado es <code>rechazado_calidad</code>, recaptura y vuelve a analizar.
          </li>
        </ul>
      </details>
    </div>
  );
}
