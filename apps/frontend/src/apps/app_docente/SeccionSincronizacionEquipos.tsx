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


export function SeccionSincronizacionEquipos({
  onPushServidor,
  onPullServidor
}: {
  onPushServidor: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<RespuestaSyncPush>;
  onPullServidor: (payload: { desde?: string; limite?: number }) => Promise<RespuestaSyncPull>;
}) {
  const [incluyePdfs, setIncluyePdfs] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'info' | 'ok' | 'warning' | 'error'>('info');
  const [ultimoCursor, setUltimoCursor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [trayendo, setTrayendo] = useState(false);

  async function enviarCambios() {
    try {
      const inicio = Date.now();
      setEnviando(true);
      setMensaje('');
      const respuesta = await onPushServidor({ incluirPdfs: incluyePdfs });
      const msg = respuesta.mensaje || 'Paquete enviado';
      setMensaje(msg);
      setTipoMensaje(msg.toLowerCase().includes('sin cambios') ? 'info' : 'ok');
      setUltimoCursor(respuesta.cursor || respuesta.exportadoEn || null);
      emitToast({ level: 'ok', title: 'Sincronizacion', message: msg, durationMs: 2400 });
      registrarAccionDocente('sync_push_servidor', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo enviar');
      setMensaje(msg);
      setTipoMensaje('error');
      emitToast({
        level: 'error',
        title: 'No se pudo enviar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('sync_push_servidor', false);
    } finally {
      setEnviando(false);
    }
  }

  async function traerCambios() {
    try {
      const inicio = Date.now();
      setTrayendo(true);
      setMensaje('');
      const respuesta = await onPullServidor({});
      const msg = respuesta.mensaje || 'Paquetes aplicados';
      setMensaje(msg);
      setTipoMensaje(msg.toLowerCase().includes('sin cambios') ? 'info' : 'ok');
      if (respuesta.ultimoCursor) {
        setUltimoCursor(respuesta.ultimoCursor);
      }
      emitToast({ level: 'ok', title: 'Sincronizacion', message: msg, durationMs: 2400 });
      registrarAccionDocente('sync_pull_servidor', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron traer cambios');
      setMensaje(msg);
      setTipoMensaje('error');
      emitToast({
        level: 'error',
        title: 'No se pudo traer cambios',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('sync_pull_servidor', false);
    } finally {
      setTrayendo(false);
    }
  }

  return (
    <div className="shell">
      <div className="panel shell-main">
        <h2>
          <Icono nombre="recargar" /> Sincronizacion entre equipos
        </h2>
        <p className="nota">
          Usa un servidor intermedio para mantener una sola fuente de verdad por docente, sin requerir que los equipos esten en linea al mismo tiempo.
        </p>
        <InlineMensaje tipo="info">
          Esta funcion no reemplaza los backups locales: exporta un respaldo antes de cambios grandes.
        </InlineMensaje>
        <label className="campo campo--checkbox">
          <input type="checkbox" checked={incluyePdfs} onChange={(e) => setIncluyePdfs(e.target.checked)} />
          Incluir PDFs en el envio (mas pesado)
        </label>
        <div className="acciones">
          <Boton type="button" icono={<Icono nombre="publicar" />} cargando={enviando} onClick={enviarCambios}>
            {enviando ? 'Enviando.' : 'Enviar cambios'}
          </Boton>
          <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={trayendo} onClick={traerCambios}>
            {trayendo ? 'Trayendo.' : 'Traer cambios'}
          </Boton>
        </div>
        {ultimoCursor && <div className="nota">Ultima marca recibida: {new Date(ultimoCursor).toLocaleString()}</div>}
        {mensaje && <InlineMensaje tipo={tipoMensaje}>{mensaje}</InlineMensaje>}
      </div>

      <aside className="shell-aside" aria-label="Ayuda de sincronizacion">
        <div className="shell-asideCard">
          <AyudaFormulario titulo="Para que sirve y como usarlo">
            <p>
              <b>Proposito:</b> sincronizar cambios entre equipos del mismo docente usando un servidor intermedio.
            </p>
            <ul className="lista">
              <li>
                <b>Enviar cambios:</b> sube tus cambios al servidor para que otros equipos los puedan traer despues.
              </li>
              <li>
                <b>Traer cambios:</b> aplica los cambios pendientes del servidor en esta computadora.
              </li>
              <li>
                <b>Cuenta:</b> usa el mismo docente en todos los equipos para conservar la fuente de verdad.
              </li>
            </ul>
          </AyudaFormulario>
        </div>
      </aside>
    </div>
  );
}
