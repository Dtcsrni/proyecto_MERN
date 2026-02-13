/**
 * SeccionCuenta
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
import { useCallback, useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from './AyudaFormulario';
import { clienteApi } from './clienteApiDocente';
import { tipoMensajeInline } from './mensajeInline';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Docente } from './tipos';
import { idCortoMateria, mensajeDeError } from './utilidades';
export function SeccionCuenta({
  docente,
  onDocenteActualizado,
  esAdmin,
  esDev
}: {
  docente: Docente;
  onDocenteActualizado: (d: Docente) => void;
  esAdmin: boolean;
  esDev: boolean;
}) {
  const [contrasenaNueva, setContrasenaNueva] = useState('');
  const [contrasenaNueva2, setContrasenaNueva2] = useState('');
  const [contrasenaActual, setContrasenaActual] = useState('');
  const [credentialReauth, setCredentialReauth] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [institucionPdf, setInstitucionPdf] = useState(docente.preferenciasPdf?.institucion ?? '');
  const [lemaPdf, setLemaPdf] = useState(docente.preferenciasPdf?.lema ?? '');
  const [logoIzqPdf, setLogoIzqPdf] = useState(docente.preferenciasPdf?.logos?.izquierdaPath ?? '');
  const [logoDerPdf, setLogoDerPdf] = useState(docente.preferenciasPdf?.logos?.derechaPath ?? '');
  const [papelera, setPapelera] = useState<Array<Record<string, unknown>>>([]);
  const [cargandoPapelera, setCargandoPapelera] = useState(false);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);

  const coincide = contrasenaNueva && contrasenaNueva === contrasenaNueva2;
  const requiereContrasenaActual = Boolean(docente.tieneContrasena);
  const requiereGoogle = Boolean(docente.tieneGoogle && !docente.tieneContrasena);

  const reautenticacionValida = requiereContrasenaActual ? Boolean(contrasenaActual.trim()) : requiereGoogle ? Boolean(credentialReauth) : Boolean(contrasenaActual.trim() || credentialReauth);
  const puedeGuardar = Boolean(contrasenaNueva.trim().length >= 8 && coincide && reautenticacionValida);

  function hayGoogleConfigurado() {
    return Boolean(String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());
  }

  async function guardar() {
    try {
      const inicio = Date.now();
      setGuardando(true);
      setMensaje('');

      const cuerpo: Record<string, unknown> = { contrasenaNueva };
      if (contrasenaActual.trim()) cuerpo.contrasenaActual = contrasenaActual;
      if (credentialReauth) cuerpo.credential = credentialReauth;

      await clienteApi.enviar('/autenticacion/definir-contrasena', cuerpo);
      setMensaje('Contrasena actualizada');
      emitToast({ level: 'ok', title: 'Cuenta', message: 'Contrasena actualizada', durationMs: 2400 });
      registrarAccionDocente('definir_contrasena', true, Date.now() - inicio);
      setContrasenaNueva('');
      setContrasenaNueva2('');
      setContrasenaActual('');
      setCredentialReauth(null);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar la contrasena');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'Cuenta',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('definir_contrasena', false);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarPreferenciasPdf() {
    try {
      const inicio = Date.now();
      setGuardando(true);
      setMensaje('');

      const cuerpo: Record<string, unknown> = {};
      if (institucionPdf.trim()) cuerpo.institucion = institucionPdf.trim();
      if (lemaPdf.trim()) cuerpo.lema = lemaPdf.trim();
      if (logoIzqPdf.trim() || logoDerPdf.trim()) {
        cuerpo.logos = {
          ...(logoIzqPdf.trim() ? { izquierdaPath: logoIzqPdf.trim() } : {}),
          ...(logoDerPdf.trim() ? { derechaPath: logoDerPdf.trim() } : {})
        };
      }

      const respuesta = await clienteApi.enviar<{ preferenciasPdf: Docente['preferenciasPdf'] }>('/autenticacion/preferencias/pdf', cuerpo);
      onDocenteActualizado({
        ...docente,
        preferenciasPdf: respuesta.preferenciasPdf
      });

      setMensaje('Preferencias de PDF guardadas');
      emitToast({ level: 'ok', title: 'PDF', message: 'Preferencias guardadas', durationMs: 2400 });
      registrarAccionDocente('preferencias_pdf', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron guardar las preferencias de PDF');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'PDF',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('preferencias_pdf', false);
    } finally {
      setGuardando(false);
    }
  }

  const cargarPapelera = useCallback(async () => {
    if (!esAdmin || !esDev) return;
    setCargandoPapelera(true);
    try {
      const respuesta = await clienteApi.obtener<{ items: Array<Record<string, unknown>> }>('/papelera?limite=60');
      setPapelera(respuesta.items ?? []);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo cargar la papelera');
      setMensaje(msg);
    } finally {
      setCargandoPapelera(false);
    }
  }, [esAdmin, esDev]);

  async function restaurarPapelera(idElemento: string) {
    setRestaurandoId(idElemento);
    try {
      await clienteApi.enviar(`/papelera/${encodeURIComponent(idElemento)}/restaurar`, {});
      emitToast({ level: 'ok', title: 'Papelera', message: 'Elemento restaurado', durationMs: 2200 });
      await cargarPapelera();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo restaurar');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'Papelera', message: msg, durationMs: 4200 });
    } finally {
      setRestaurandoId(null);
    }
  }

  useEffect(() => {
    void cargarPapelera();
  }, [cargarPapelera]);

  function formatearFechaPapelera(valor?: unknown) {
    if (!valor) return '-';
    const d = new Date(String(valor));
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
  }

  function tituloPapelera(elemento: Record<string, unknown>) {
    const cuerpo = (elemento.payload as Record<string, unknown>) ?? {};
    const tipo = String(elemento.tipo ?? '');
    if (tipo === 'plantilla') return String((cuerpo.plantilla as Record<string, unknown>)?.titulo ?? '').trim();
    if (tipo === 'periodo') return String((cuerpo.periodo as Record<string, unknown>)?.nombre ?? '').trim();
    if (tipo === 'alumno') return String((cuerpo.alumno as Record<string, unknown>)?.nombreCompleto ?? '').trim();
    return '';
  }

  return (
    <div className="panel">
      <h2>
        <Icono nombre="info" /> Cuenta
      </h2>
      <AyudaFormulario titulo="Para que sirve y como llenarlo">
        <p>
          <b>Proposito:</b> definir o cambiar tu contrasena para acceder con correo/contrasena.
        </p>
        <ul className="lista">
          <li>
            <b>Contrasena actual:</b> requerida si tu cuenta ya tenia contrasena.
          </li>
          <li>
            <b>Nueva contrasena:</b> minimo 8 caracteres.
          </li>
          <li>
            <b>Confirmar contrasena:</b> debe coincidir exactamente.
          </li>
          <li>
            <b>Reautenticacion:</b> si aparece Google, es la opcion recomendada para confirmar identidad.
          </li>
        </ul>
        <p>
          Ejemplo: nueva contrasena <code>MiClaveSegura2026</code> (no uses contrasenas obvias).
        </p>
      </AyudaFormulario>

      <div className="meta" aria-label="Estado de la cuenta">
        <span className={docente.tieneGoogle ? 'badge ok' : 'badge'}>
          <span className="dot" aria-hidden="true" /> Google {docente.tieneGoogle ? 'vinculado' : 'no vinculado'}
        </span>
        <span className={docente.tieneContrasena ? 'badge ok' : 'badge'}>
          <span className="dot" aria-hidden="true" /> Contrasena {docente.tieneContrasena ? 'definida' : 'no definida'}
        </span>
      </div>

      <div className="subpanel">
        <h3>
          <Icono nombre="pdf" /> PDF institucional
        </h3>
        <AyudaFormulario titulo="Como se usa">
          <p>
            Estas preferencias se usan para el <b>encabezado institucional</b> del PDF (solo pagina 1). Si no configuras nada,
            se usan los defaults del sistema.
          </p>
          <ul className="lista">
            <li>
              <b>Institucion:</b> ej. Centro Universitario Hidalguense
            </li>
            <li>
              <b>Lema:</b> ej. La sabiduria es nuestra fuerza
            </li>
            <li>
              <b>Logos:</b> ruta relativa (ej. <code>logos/logo_cuh.png</code>) o absoluta.
            </li>
          </ul>
        </AyudaFormulario>

        <label className="campo">
          Institucion
          <input value={institucionPdf} onChange={(e) => setInstitucionPdf(e.target.value)} placeholder="Centro Universitario Hidalguense" />
        </label>
        <label className="campo">
          Lema
          <input value={lemaPdf} onChange={(e) => setLemaPdf(e.target.value)} placeholder="La sabiduria es nuestra fuerza" />
        </label>
        <div className="grid grid--2">
          <label className="campo">
            Logo izquierda (path)
            <input value={logoIzqPdf} onChange={(e) => setLogoIzqPdf(e.target.value)} placeholder="logos/logo_cuh.png" />
          </label>
          <label className="campo">
            Logo derecha (path)
            <input value={logoDerPdf} onChange={(e) => setLogoDerPdf(e.target.value)} placeholder="logos/logo_sys.png" />
          </label>
        </div>

        <div className="acciones acciones--mt">
          <Boton onClick={guardarPreferenciasPdf} disabled={guardando}>
            Guardar PDF
          </Boton>
        </div>

      {mensaje && <InlineMensaje tipo={tipoMensajeInline(mensaje)}>{mensaje}</InlineMensaje>}
      </div>

      {esAdmin && esDev && (
        <div className="subpanel">
          <h3>
            <Icono nombre="info" /> Papelera (dev)
          </h3>
          <p className="nota">Elementos eliminados se conservan 45 dias y luego se eliminan automaticamente.</p>
          <div className="acciones acciones--mt">
            <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={cargandoPapelera} onClick={cargarPapelera}>
              {cargandoPapelera ? 'Cargando...' : 'Actualizar papelera'}
            </Boton>
          </div>
          {!cargandoPapelera && papelera.length === 0 && <InlineMensaje tipo="info">No hay elementos en papelera.</InlineMensaje>}
          {papelera.length > 0 && (
            <div className="lista lista--compacta">
              {papelera.map((item) => {
                const id = String(item._id ?? '');
                const tipo = String(item.tipo ?? 'desconocido');
                const entidadId = String(item.entidadId ?? '');
                const titulo = tituloPapelera(item) || `${tipo} ${idCortoMateria(entidadId || id)}`;
                const eliminadoEn = formatearFechaPapelera(item.eliminadoEn);
                const expiraEn = formatearFechaPapelera(item.expiraEn);
                return (
                  <div key={id} className="item-glass">
                    <div>
                      <div className="texto-base">{titulo}</div>
                      <div className="nota">Tipo: {tipo} · Eliminado: {eliminadoEn} · Expira: {expiraEn}</div>
                    </div>
                    <div className="acciones">
                      <Boton
                        type="button"
                        variante="secundario"
                        icono={<Icono nombre="ok" />}
                        disabled={!id || restaurandoId === id}
                        cargando={restaurandoId === id}
                        onClick={() => restaurarPapelera(id)}
                      >
                        {restaurandoId === id ? 'Restaurando...' : 'Restaurar'}
                      </Boton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {Boolean(docente.tieneGoogle && hayGoogleConfigurado()) && (
        <div className="auth-google auth-google--mb">
          <p className="nota">Reautenticacion con Google (recomendado).</p>
          <GoogleLogin
            onSuccess={(cred) => {
              const credencialGoogle = cred.credential;
              if (!credencialGoogle) {
                setMensaje('No se recibio credencial de Google.');
                return;
              }
              setCredentialReauth(credencialGoogle);
              setMensaje('Reautenticacion con Google lista.');
            }}
            onError={() => setMensaje('No se pudo reautenticar con Google.')}
          />
          <div className="acciones acciones--mt">
            <button type="button" className="chip" disabled={!credentialReauth} onClick={() => setCredentialReauth(null)}>
              Limpiar reauth
            </button>
          </div>
        </div>
      )}

      {docente.tieneContrasena && (
        <label className="campo">
          Contrasena actual
          <input
            type="password"
            value={contrasenaActual}
            onChange={(event) => setContrasenaActual(event.target.value)}
            autoComplete="current-password"
          />
        </label>
      )}

      <label className="campo">
        Nueva contrasena
        <input
          type="password"
          value={contrasenaNueva}
          onChange={(event) => setContrasenaNueva(event.target.value)}
          autoComplete="new-password"
        />
        <span className="ayuda">Minimo 8 caracteres.</span>
      </label>

      <label className="campo">
        Confirmar contrasena
        {contrasenaNueva2 && !coincide ? (
          <input
            type="password"
            value={contrasenaNueva2}
            onChange={(event) => setContrasenaNueva2(event.target.value)}
            autoComplete="new-password"
            aria-invalid="true"
          />
        ) : (
          <input
            type="password"
            value={contrasenaNueva2}
            onChange={(event) => setContrasenaNueva2(event.target.value)}
            autoComplete="new-password"
          />
        )}
        {contrasenaNueva2 && !coincide && <span className="ayuda error">Las contrasenas no coinciden.</span>}
      </label>

      <div className="acciones">
        <Boton type="button" icono={<Icono nombre="ok" />} cargando={guardando} disabled={!puedeGuardar} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar contrasena'}
        </Boton>
      </div>

      {mensaje && <InlineMensaje tipo={tipoMensajeInline(mensaje)}>{mensaje}</InlineMensaje>}
    </div>
  );
}

