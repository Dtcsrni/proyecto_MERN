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


export function SeccionPaqueteSincronizacion({
  periodos,
  docenteCorreo,
  onExportar,
  onImportar
}: {
  periodos: Periodo[];
  docenteCorreo?: string;
  onExportar: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<{
    paqueteBase64: string;
    checksumSha256: string;
    checksumGzipSha256?: string;
    exportadoEn: string;
    conteos: Record<string, number>;
  }>;
  onImportar: (payload: { paqueteBase64: string; checksumSha256?: string; dryRun?: boolean; docenteCorreo?: string }) => Promise<
    | { mensaje?: string; resultados?: unknown[]; pdfsGuardados?: number }
    | { mensaje?: string; checksumSha256?: string; conteos?: Record<string, number> }
  >;
}) {
  const [periodoId, setPeriodoId] = useState('');
  const [desde, setDesde] = useState('');
  const [incluirPdfs, setIncluirPdfs] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [ultimoResumen, setUltimoResumen] = useState<Record<string, number> | null>(null);
  const [ultimoExportEn, setUltimoExportEn] = useState<string | null>(null);
  const [ultimoArchivoExportado, setUltimoArchivoExportado] = useState<string | null>(null);
  const [ultimoArchivoImportado, setUltimoArchivoImportado] = useState<string | null>(null);
  const [ultimoChecksum, setUltimoChecksum] = useState<string | null>(null);

  function descargarJson(nombreArchivo: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportar() {
    try {
      const inicio = Date.now();
      setExportando(true);
      setMensaje('');
      setUltimoResumen(null);

      const payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean } = {
        incluirPdfs
      };
      if (periodoId) payload.periodoId = periodoId;
      if (desde) payload.desde = new Date(desde).toISOString();

      const resp = await onExportar(payload);
      setUltimoResumen(resp.conteos);
      setUltimoExportEn(resp.exportadoEn);
      setUltimoChecksum(resp.checksumSha256 || null);

      const nombre = `sincronizacion_${(resp.exportadoEn || new Date().toISOString()).replace(/[:.]/g, '-')}.ep-sync.json`;
      descargarJson(nombre, {
        version: 1,
        exportadoEn: resp.exportadoEn,
        checksumSha256: resp.checksumSha256,
        conteos: resp.conteos,
        paqueteBase64: resp.paqueteBase64,
        ...(docenteCorreo ? { docenteCorreo } : {})
      });
      setUltimoArchivoExportado(nombre);

      setMensaje('Paquete exportado (descarga iniciada)');
      emitToast({ level: 'ok', title: 'Sincronizacion', message: 'Paquete exportado', durationMs: 2400 });
      registrarAccionDocente('sync_paquete_exportar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo exportar el paquete');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo exportar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('sync_paquete_exportar', false);
    } finally {
      setExportando(false);
    }
  }

  async function importar(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;

    try {
      const inicio = Date.now();
      setImportando(true);
      setMensaje('');
      setUltimoArchivoImportado(archivo.name);

      const texto = await archivo.text();
      const json = JSON.parse(texto) as {
        paqueteBase64?: string;
        checksumSha256?: string;
        conteos?: Record<string, number>;
        docenteCorreo?: string;
      };
      const paqueteBase64 = String(json?.paqueteBase64 || '').trim();
      const checksumSha256 = String(json?.checksumSha256 || '').trim();
      const correoArchivo = typeof json?.docenteCorreo === 'string' ? json.docenteCorreo.trim() : '';
      const correoFinal = correoArchivo || docenteCorreo || '';
      if (!paqueteBase64) {
        throw new Error('Archivo invalido: no contiene paqueteBase64');
      }

      // 1) Validar en servidor (dry-run) para detectar corrupcion antes de escribir.
      const validacion = await onImportar({
        paqueteBase64,
        checksumSha256: checksumSha256 || undefined,
        dryRun: true,
        ...(correoFinal ? { docenteCorreo: correoFinal } : {})
      });
      const conteos = (validacion as { conteos?: Record<string, number> })?.conteos;
      const resumen = conteos
        ? `\n\nContenido: ${Object.entries(conteos)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}`
        : '';

      const ok = window.confirm(
        `Paquete valido.${resumen}\n\n¿Deseas importar y aplicar los cambios en esta computadora?\n\nRecomendacion: haz un export antes de importar.`
      );
      if (!ok) {
        setMensaje('Importacion cancelada');
        registrarAccionDocente('sync_paquete_importar_cancelado', true, Date.now() - inicio);
        return;
      }

      // 2) Importar realmente.
      const resp = await onImportar({
        paqueteBase64,
        checksumSha256: checksumSha256 || undefined,
        ...(correoFinal ? { docenteCorreo: correoFinal } : {})
      });
      setMensaje((resp as { mensaje?: string })?.mensaje || 'Paquete importado');
      emitToast({ level: 'ok', title: 'Sincronizacion', message: 'Paquete importado', durationMs: 2600 });
      registrarAccionDocente('sync_paquete_importar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo importar el paquete');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo importar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('sync_paquete_importar', false);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="panel">
      <h2>
        <Icono nombre="recargar" /> Backups y exportaciones
      </h2>
      <AyudaFormulario titulo="Como funciona">
        <p>
          <b>Objetivo:</b> crear respaldos locales y mover tus materias/alumnos/banco/plantillas/examenes entre instalaciones (por archivo).
        </p>
        <ul className="lista">
          <li>
            <b>Exportar:</b> genera un archivo <code>.ep-sync.json</code> (compatible con <code>.seu-sync.json</code>).
          </li>
          <li>
            <b>Guardar backup:</b> mueve el archivo exportado a una carpeta de respaldo (sugerido: <code>backups/</code> del proyecto).
          </li>
          <li>
            <b>Importar:</b> selecciona ese archivo en la otra computadora (misma cuenta docente).
          </li>
          <li>
            <b>Integridad:</b> el sistema valida checksum antes de aplicar (si no coincide, se bloquea).
          </li>
          <li>
            <b>Conflictos:</b> se conserva el registro mas nuevo (por fecha de actualizacion).
          </li>
        </ul>
        <p className="nota">
          Sugerencia: conserva al menos 2 backups recientes. Esta funcion es compatible con el flujo de recuperacion y la papeleria (dev).
        </p>
      </AyudaFormulario>

      {(ultimoExportEn || ultimoArchivoExportado || ultimoArchivoImportado) && (
        <div className="subpanel">
          <h3>Resumen de backup</h3>
          <div className="item-glass">
            <div className="item-row">
              <div>
                <div className="item-title">Ultima actividad</div>
                <div className="item-meta">
                  <span>Exportado: {ultimoExportEn ? new Date(ultimoExportEn).toLocaleString() : '-'}</span>
                  <span>Archivo exportado: {ultimoArchivoExportado || '-'}</span>
                  <span>Archivo importado: {ultimoArchivoImportado || '-'}</span>
                </div>
                <div className="item-sub">
                  {ultimoChecksum ? `Checksum: ${ultimoChecksum.slice(0, 12)}…` : 'Checksum: -'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <label className="campo">
        Materia (opcional)
        <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
          <option value="">Todas</option>
          {periodos.map((periodo) => (
            <option key={periodo._id} value={periodo._id} title={periodo._id}>
              {etiquetaMateria(periodo)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid">
        <label className="campo">
          Desde (opcional)
          <input
            type="datetime-local"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
            placeholder="YYYY-MM-DDThh:mm"
          />
        </label>
        <label className="campo campo--checkbox">
          <input type="checkbox" checked={incluirPdfs} onChange={(e) => setIncluirPdfs(e.target.checked)} />
          Incluir PDFs (puede ser pesado)
        </label>
      </div>

      <div className="acciones">
        <Boton type="button" icono={<Icono nombre="publicar" />} cargando={exportando} onClick={exportar}>
          {exportando ? 'Exportando…' : 'Exportar backup'}
        </Boton>
        <label className={importando ? 'boton boton--secundario boton--disabled' : 'boton boton--secundario'}>
          <Icono nombre="entrar" /> {importando ? 'Importando…' : 'Importar backup'}
          <input
            type="file"
            accept="application/json,.json,.ep-sync.json,.seu-sync.json"
            onChange={importar}
            disabled={importando}
            className="input-file-oculto"
          />
        </label>
      </div>

      {ultimoResumen && (
        <InlineMensaje tipo="info">
          Ultimo export{ultimoExportEn ? ` (${new Date(ultimoExportEn).toLocaleString()})` : ''}: {Object.entries(ultimoResumen)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')}
        </InlineMensaje>
      )}

      {(ultimoArchivoExportado || ultimoArchivoImportado) && (
        <div className="nota">
          {ultimoArchivoExportado ? `Exportado: ${ultimoArchivoExportado}` : ''}
          {ultimoArchivoExportado && ultimoArchivoImportado ? ' · ' : ''}
          {ultimoArchivoImportado ? `Importado: ${ultimoArchivoImportado}` : ''}
        </div>
      )}

      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
    </div>
  );
}
