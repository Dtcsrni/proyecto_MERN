/**
 * App alumno: consulta de resultados en la nube.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  crearClientePortal,
  guardarTokenAlumno,
  limpiarTokenAlumno,
  obtenerTokenAlumno
} from '../../servicios_api/clientePortal';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, IlustracionSinResultados, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { CampoTexto } from '../../ui/ux/componentes/CampoTexto';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { obtenerSessionId } from '../../ui/ux/sesion';
import { TemaBoton } from '../../tema/TemaBoton';
import {
  accionCerrarSesion,
  accionToastSesionParaError,
  mensajeUsuarioDeErrorConSugerencia,
  onSesionInvalidada
} from '../../servicios_api/clienteComun';

const clientePortal = crearClientePortal();
const basePortal = import.meta.env.VITE_PORTAL_BASE_URL || 'http://localhost:8080/api/portal';

type Resultado = {
  folio: string;
  tipoExamen: string;
  totalReactivos?: number;
  aciertos?: number;
  calificacionExamenFinalTexto: string;
  calificacionParcialTexto?: string;
  calificacionGlobalTexto?: string;
  respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
  comparativaRespuestas?: Array<{
    numeroPregunta: number;
    correcta: string | null;
    detectada: string | null;
    coincide: boolean;
    confianza?: number;
  }>;
  omrAuditoria?: {
    estadoAnalisis?: 'ok' | 'rechazado_calidad' | 'requiere_revision';
    revisionConfirmada?: boolean;
    calidadPagina?: number;
    confianzaPromedioPagina?: number;
    ratioAmbiguas?: number;
    motivosRevision?: string[];
  };
};

export function AppAlumno() {
  const [codigo, setCodigo] = useState('');
  const [matricula, setMatricula] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [detalleAbiertoFolio, setDetalleAbiertoFolio] = useState<string | null>(null);
  const [detallesPorFolio, setDetallesPorFolio] = useState<Record<string, Resultado>>({});
  const [cargandoDetallePorFolio, setCargandoDetallePorFolio] = useState<Record<string, boolean>>({});
  const [errorDetallePorFolio, setErrorDetallePorFolio] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const intentosFallidosRef = useRef(0);
  const [cooldownHasta, setCooldownHasta] = useState(0);

  const obtenerSesionId = useCallback(() => obtenerSessionId('sesionAlumnoId'), []);

  const cerrarSesion = useCallback(() => {
    limpiarTokenAlumno();
    setResultados([]);
    setMensaje('');
    emitToast({ level: 'info', title: 'Sesion', message: 'Sesion cerrada', durationMs: 2200 });
    void clientePortal.registrarEventosUso({
      eventos: [{ sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'logout', exito: true }]
    });
  }, [obtenerSesionId]);

  useEffect(() => {
    return onSesionInvalidada((tipo) => {
      if (tipo !== 'alumno') return;
      cerrarSesion();
    });
  }, [cerrarSesion]);

  function mensajeDeError(error: unknown, fallback: string) {
    return mensajeUsuarioDeErrorConSugerencia(error, fallback);
  }

  async function ingresar() {
    if (Date.now() < cooldownHasta) {
      const s = Math.max(1, Math.ceil((cooldownHasta - Date.now()) / 1000));
      const msg = `Espera ${s}s antes de intentar de nuevo.`;
      setMensaje(msg);
      emitToast({ level: 'warn', title: 'Espera un momento', message: msg, durationMs: Math.min(5200, 800 + s * 250) });
      return;
    }
    try {
      const inicio = Date.now();
      setCargando(true);
      setMensaje('');
      const respuesta = await clientePortal.enviar<{ token: string }>('/ingresar', { codigo, matricula });
      guardarTokenAlumno(respuesta.token);
      intentosFallidosRef.current = 0;
      setCooldownHasta(0);
      emitToast({ level: 'ok', title: 'Bienvenido', message: 'Sesion iniciada', durationMs: 2200 });
      void clientePortal.registrarEventosUso({
        eventos: [
          {
            sessionId: obtenerSesionId(),
            pantalla: 'alumno',
            accion: 'login',
            exito: true,
            duracionMs: Date.now() - inicio
          }
        ]
      });
      await cargarResultados();
    } catch (error) {
      const nuevo = intentosFallidosRef.current + 1;
      intentosFallidosRef.current = nuevo;
      if (nuevo >= 3) {
        const base = 15_000;
        const extra = Math.min(120_000, base * Math.pow(2, Math.min(4, nuevo - 3)));
        setCooldownHasta(Date.now() + extra);
      }
      const msg = mensajeDeError(error, 'No se pudo ingresar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo ingresar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'alumno')
      });
      void clientePortal.registrarEventosUso({
        eventos: [{ sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'login', exito: false }]
      });
    } finally {
      setCargando(false);
    }
  }

  async function cargarResultados() {
    try {
      const inicio = Date.now();
      setCargando(true);
      const respuesta = await clientePortal.obtener<{ resultados: Resultado[] }>('/resultados');
      setResultados(respuesta.resultados);
      const detallesIniciales = (respuesta.resultados || []).reduce(
        (acumulado, resultado) => {
          const tieneDetalle = Array.isArray(resultado.comparativaRespuestas) || Boolean(resultado.omrAuditoria);
          if (tieneDetalle && resultado.folio) acumulado[resultado.folio] = resultado;
          return acumulado;
        },
        {} as Record<string, Resultado>
      );
      if (Object.keys(detallesIniciales).length > 0) {
        setDetallesPorFolio((prev) => ({ ...prev, ...detallesIniciales }));
      }
      void clientePortal.registrarEventosUso({
        eventos: [
          {
            sessionId: obtenerSesionId(),
            pantalla: 'alumno',
            accion: 'cargar_resultados',
            exito: true,
            duracionMs: Date.now() - inicio
          }
        ]
      });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron cargar resultados');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudieron cargar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'alumno')
      });
      void clientePortal.registrarEventosUso({
        eventos: [{ sessionId: obtenerSesionId(), pantalla: 'alumno', accion: 'cargar_resultados', exito: false }]
      });
    } finally {
      setCargando(false);
    }
  }

  function estadoRevision(resultado: Resultado | undefined) {
    const estado = resultado?.omrAuditoria?.estadoAnalisis;
    const revisionConfirmada = Boolean(resultado?.omrAuditoria?.revisionConfirmada);
    if (!estado) return { clase: '', texto: 'Sin auditoria OMR' };
    if (estado === 'rechazado_calidad') return { clase: 'error', texto: 'OMR rechazado por calidad' };
    if (revisionConfirmada) return { clase: 'ok', texto: 'Revision manual confirmada' };
    if (estado === 'requiere_revision') return { clase: 'warning', texto: 'Pendiente de revision manual' };
    return { clase: 'ok', texto: 'OMR validado automaticamente' };
  }

  async function onToggleDetalle(folio: string) {
    if (!folio) return;
    if (detalleAbiertoFolio === folio) {
      setDetalleAbiertoFolio(null);
      return;
    }
    setDetalleAbiertoFolio(folio);
    if (detallesPorFolio[folio]) return;

    try {
      setCargandoDetallePorFolio((prev) => ({ ...prev, [folio]: true }));
      setErrorDetallePorFolio((prev) => ({ ...prev, [folio]: '' }));
      const respuesta = await clientePortal.obtener<{ resultado: Resultado }>(`/resultados/${folio}`);
      if (respuesta?.resultado) {
        setDetallesPorFolio((prev) => ({ ...prev, [folio]: respuesta.resultado }));
      }
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo cargar el detalle del examen');
      setErrorDetallePorFolio((prev) => ({ ...prev, [folio]: msg }));
      emitToast({
        level: 'error',
        title: 'Detalle no disponible',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'alumno')
      });
    } finally {
      setCargandoDetallePorFolio((prev) => ({ ...prev, [folio]: false }));
    }
  }

  const token = obtenerTokenAlumno();
  const puedeIngresar = Boolean(codigo.trim() && matricula.trim());
  // Valida sin bloquear el flujo (hay códigos reales con '-' / '_' y longitudes variables).
  const codigoValido = !codigo.trim() || /^[a-zA-Z0-9_-]{3,24}$/.test(codigo.trim());
  const matriculaValida = !matricula.trim() || /^[A-Za-z0-9._-]{3,32}$/.test(matricula.trim());
  const cooldownActivo = Date.now() < cooldownHasta;

  return (
    <section className="card anim-entrada">
      <div className="cabecera">
        <p className="eyebrow">
          <Icono nombre="alumno" /> Portal Alumno
        </p>
        <div className="cabecera__acciones">
          <TemaBoton />
          {token && (
            <button className="boton secundario" type="button" onClick={cerrarSesion}>
              <Icono nombre="salir" /> Salir
            </button>
          )}
        </div>
      </div>
      {!token && (
        <div className="auth-grid">
          <div>
            <p className="eyebrow">Acceso</p>
            <h2>
              <Icono nombre="alumno" /> Consulta de resultados
            </h2>
            {cooldownActivo && (
              <InlineMensaje tipo="info">Por seguridad, espera unos segundos antes de reintentar.</InlineMensaje>
            )}
            <p className="auth-subtitulo">Ingresa con el codigo de acceso que te compartio tu docente y tu matricula.</p>
            <ul className="auth-beneficios" aria-label="Beneficios">
              <li>
                <Icono nombre="ok" /> Consulta rapida y segura.
              </li>
              <li>
                <Icono nombre="pdf" /> Descarga tu PDF cuando este disponible.
              </li>
              <li>
                <Icono nombre="info" /> Si no aparece, intenta recargar.
              </li>
            </ul>
            <div className="auth-ilustracion" aria-hidden="true">
              <div className="auth-blob" />
              <div className="auth-blob auth-blob--2" />
            </div>
          </div>

          <div className="auth-form">
            {mensaje && <InlineMensaje tipo="error">{mensaje}</InlineMensaje>}
            {cargando && (
              <p className="mensaje" role="status">
                <Spinner /> Cargando…
              </p>
            )}

            <CampoTexto
              etiqueta="Codigo de acceso"
              value={codigo}
              onChange={(event) => {
                const limpio = event.target.value.replace(/\s+/g, '').toUpperCase();
                setCodigo(limpio);
              }}
              placeholder="ABC123"
              autoComplete="one-time-code"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              error={!codigoValido && codigo.trim() ? 'Usa 3-24 caracteres (letras/numeros/guion/guion_bajo).' : undefined}
            />
            <CampoTexto
              etiqueta="Matricula"
              value={matricula}
              onChange={(event) => {
                const limpio = event.target.value.replace(/\s+/g, '');
                setMatricula(limpio);
              }}
              placeholder="2024-001"
              autoComplete="username"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              error={!matriculaValida && matricula.trim() ? 'Usa 3-32 caracteres (letras/numeros/punto/guion/guion_bajo).' : undefined}
            />
            <p className="nota">
              Si no ves resultados tras ingresar, intenta &quot;Recargar&quot;. Si el codigo expiro, solicita uno nuevo al docente.
            </p>
            <Boton
              type="button"
              icono={<Icono nombre="entrar" />}
              cargando={cargando}
              disabled={!puedeIngresar || cargando || cooldownActivo}
              onClick={ingresar}
            >
              Consultar
            </Boton>
          </div>
        </div>
      )}

      {token && mensaje && <InlineMensaje tipo="error">{mensaje}</InlineMensaje>}

      {token && cargando && (
        <p className="mensaje" role="status">
          <Spinner /> Cargando…
        </p>
      )}

      {token && resultados.length === 0 && !cargando && (
        <div className="resultado">
          <h3>
            <Icono nombre="info" /> Sin resultados
          </h3>
          <IlustracionSinResultados />
          <p>Si acabas de ingresar, intenta recargar.</p>
          <button className="boton secundario" type="button" onClick={cargarResultados}>
            <Icono nombre="recargar" /> Recargar
          </button>
        </div>
      )}

      {token && resultados.length > 0 && (
        <div className="resultado">
          <h3>Resultados disponibles</h3>
          <ul className="lista lista-items">
            {resultados.map((resultado) => (
              <li key={resultado.folio}>
                <div className="item-glass">
                  <div className="item-row">
                    <div>
                      <div className="item-title">Folio {resultado.folio}</div>
                      <div className="item-meta">
                        <span>Tipo: {resultado.tipoExamen}</span>
                        <span>Examen: {resultado.calificacionExamenFinalTexto}</span>
                        {resultado.calificacionParcialTexto && <span>Parcial: {resultado.calificacionParcialTexto}</span>}
                        {resultado.calificacionGlobalTexto && <span>Global: {resultado.calificacionGlobalTexto}</span>}
                      </div>
                    </div>
                    <div className="item-actions">
                      <button className="boton secundario" type="button" onClick={() => void onToggleDetalle(resultado.folio)}>
                        <Icono nombre={detalleAbiertoFolio === resultado.folio ? 'chevron' : 'info'} />{' '}
                        {detalleAbiertoFolio === resultado.folio ? 'Ocultar detalle' : 'Ver detalle'}
                      </button>
                      <button
                        className="boton secundario"
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          const inicio = Date.now();
                          try {
                            const respuesta = await fetch(`${basePortal}/examen/${resultado.folio}`, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (!respuesta.ok) {
                              emitToast({
                                level: 'error',
                                title: 'PDF no disponible',
                                message: `HTTP ${respuesta.status}`,
                                durationMs: 5200,
                                action: respuesta.status === 401 ? accionCerrarSesion('alumno') : undefined
                              });
                              void clientePortal.registrarEventosUso({
                                eventos: [
                                  {
                                    sessionId: obtenerSesionId(),
                                    pantalla: 'alumno',
                                    accion: 'ver_pdf',
                                    exito: false,
                                    meta: { folio: resultado.folio, status: respuesta.status }
                                  }
                                ]
                              });
                              return;
                            }
                            const blob = await respuesta.blob();
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank', 'noopener,noreferrer');
                            void clientePortal.registrarEventosUso({
                              eventos: [
                                {
                                  sessionId: obtenerSesionId(),
                                  pantalla: 'alumno',
                                  accion: 'ver_pdf',
                                  exito: true,
                                  duracionMs: Date.now() - inicio,
                                  meta: { folio: resultado.folio }
                                }
                              ]
                            });
                          } catch (error) {
                            emitToast({
                              level: 'error',
                              title: 'Error al abrir PDF',
                              message: mensajeDeError(error, 'Error al abrir PDF'),
                              durationMs: 5200,
                              action: accionToastSesionParaError(error, 'alumno')
                            });
                            void clientePortal.registrarEventosUso({
                              eventos: [
                                {
                                  sessionId: obtenerSesionId(),
                                  pantalla: 'alumno',
                                  accion: 'ver_pdf',
                                  exito: false,
                                  meta: { folio: resultado.folio }
                                }
                              ]
                            });
                          }
                        }}
                      >
                        <Icono nombre="pdf" /> Ver PDF
                      </button>
                    </div>
                  </div>
                  {detalleAbiertoFolio === resultado.folio && (
                    <div className="alumno-detalle">
                      {cargandoDetallePorFolio[resultado.folio] && (
                        <p className="mensaje" role="status">
                          <Spinner /> Cargando detalle del examen...
                        </p>
                      )}
                      {errorDetallePorFolio[resultado.folio] && (
                        <InlineMensaje tipo="error">{errorDetallePorFolio[resultado.folio]}</InlineMensaje>
                      )}
                      {!cargandoDetallePorFolio[resultado.folio] && !errorDetallePorFolio[resultado.folio] && (
                        <>
                          {(() => {
                            const detalle = detallesPorFolio[resultado.folio] ?? resultado;
                            const estado = estadoRevision(detalle);
                            const comparativa = Array.isArray(detalle.comparativaRespuestas) ? detalle.comparativaRespuestas : [];
                            const aciertos = comparativa.filter((item) => item.coincide).length;
                            const total = comparativa.length;
                            return (
                              <>
                                <div className="item-meta">
                                  <span>Reactivos: {detalle.totalReactivos ?? total ?? '-'}</span>
                                  <span>Aciertos detectados: {typeof detalle.aciertos === 'number' ? detalle.aciertos : aciertos}</span>
                                  <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                                </div>
                                {detalle.omrAuditoria?.motivosRevision && detalle.omrAuditoria.motivosRevision.length > 0 && (
                                  <InlineMensaje tipo="info">
                                    Motivos de revision: {detalle.omrAuditoria.motivosRevision.join(' | ')}
                                  </InlineMensaje>
                                )}
                                <div className="alumno-detalle-tabla-wrap">
                                  {comparativa.length === 0 ? (
                                    <InlineMensaje tipo="info">
                                      Aun no hay comparativa de respuestas para este examen.
                                    </InlineMensaje>
                                  ) : (
                                    <table className="alumno-detalle-tabla">
                                      <thead>
                                        <tr>
                                          <th>Pregunta</th>
                                          <th>Clave correcta</th>
                                          <th>Tu respuesta</th>
                                          <th>Estado</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {comparativa.map((item) => (
                                          <tr key={`${resultado.folio}-q-${item.numeroPregunta}`}>
                                            <td>{item.numeroPregunta}</td>
                                            <td>{item.correcta ?? '-'}</td>
                                            <td>{item.detectada ?? '-'}</td>
                                            <td>
                                              <span className={`badge ${item.coincide ? 'ok' : 'error'}`}>
                                                {item.coincide ? 'Correcta' : 'Incorrecta'}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
