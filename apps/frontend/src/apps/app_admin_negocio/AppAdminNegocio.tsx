import { useEffect, useMemo, useState } from 'react';
import { clienteAdminNegocioApi } from './clienteAdminNegocioApi';

type Perfil = {
  docente?: {
    nombreCompleto?: string;
    correo?: string;
    permisos?: string[];
  };
};

type Vista =
  | 'dashboard'
  | 'tenants'
  | 'planes'
  | 'suscripciones'
  | 'licencias'
  | 'cupones'
  | 'campanas'
  | 'cobranza'
  | 'auditoria';

const VISTAS: Array<{ id: Vista; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'planes', label: 'Planes' },
  { id: 'suscripciones', label: 'Suscripciones' },
  { id: 'licencias', label: 'Licencias' },
  { id: 'cupones', label: 'Cupones' },
  { id: 'campanas', label: 'Campanas' },
  { id: 'cobranza', label: 'Cobranza' },
  { id: 'auditoria', label: 'Auditoria' }
];

export function AppAdminNegocio() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [vista, setVista] = useState<Vista>('dashboard');
  const [data, setData] = useState<unknown>(null);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  const [nuevoTenant, setNuevoTenant] = useState({
    tenantId: '',
    nombre: '',
    modalidad: 'saas',
    ownerDocenteId: ''
  });
  const [nuevoPlan, setNuevoPlan] = useState({
    planId: '',
    nombre: '',
    lineaPersona: 'docente',
    nivel: 1,
    precioMensual: 1000,
    precioAnual: 10000,
    costoMensualEstimado: 300
  });
  const [nuevaSuscripcion, setNuevaSuscripcion] = useState({
    tenantId: '',
    planId: '',
    ciclo: 'mensual',
    estado: 'trial',
    activarTrial35Dias: true
  });
  const [nuevoCupon, setNuevoCupon] = useState({
    codigo: '',
    tipoDescuento: 'porcentaje',
    valorDescuento: 10
  });
  const [nuevaCampana, setNuevaCampana] = useState({
    nombre: '',
    canal: 'email'
  });
  const [nuevaLicencia, setNuevaLicencia] = useState({
    tenantId: '',
    tipo: 'onprem',
    canalRelease: 'stable'
  });
  const [nuevoCobroMp, setNuevoCobroMp] = useState({
    suscripcionId: '',
    titulo: 'Suscripcion EvaluaPro',
    monto: 1000
  });
  const [ultimoInitPoint, setUltimoInitPoint] = useState('');

  const permisos = useMemo(() => new Set(perfil?.docente?.permisos ?? []), [perfil]);
  const puedeVer = permisos.has('comercial:metricas:leer') || permisos.has('comercial:tenants:leer');

  async function cargarPerfil() {
    try {
      const payload = await clienteAdminNegocioApi.obtener<Perfil>('/autenticacion/perfil');
      setPerfil(payload);
      setMensaje('');
    } catch {
      setMensaje('No hay sesion activa. Ingresa con tu cuenta Google y rol comercial.');
    }
  }

  async function cargarVistaActual(v: Vista) {
    const rutas: Record<Vista, string> = {
      dashboard: '/admin-negocio/dashboard/resumen',
      tenants: '/admin-negocio/tenants',
      planes: '/admin-negocio/planes',
      suscripciones: '/admin-negocio/suscripciones',
      licencias: '/admin-negocio/licencias',
      cupones: '/admin-negocio/cupones',
      campanas: '/admin-negocio/campanas',
      cobranza: '/admin-negocio/cobranza',
      auditoria: '/admin-negocio/auditoria'
    };

    setCargando(true);
    try {
      const payload = await clienteAdminNegocioApi.obtener<unknown>(rutas[v]);
      setData(payload);
      setMensaje('');
    } catch (error) {
      setMensaje(clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo cargar la vista'));
    } finally {
      setCargando(false);
    }
  }

  async function crearTenant() {
    try {
      await clienteAdminNegocioApi.enviar('/admin-negocio/tenants', {
        ...nuevoTenant,
        tipoTenant: 'smb',
        pais: 'MX',
        moneda: 'MXN',
        configAislamiento: { estrategia: 'shared' }
      });
      setMensaje('Tenant creado');
      await cargarVistaActual('tenants');
    } catch (error) {
      setMensaje(clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear tenant'));
    }
  }

  async function crearPlan() {
    try {
      await clienteAdminNegocioApi.enviar('/admin-negocio/planes', {
        ...nuevoPlan,
        moneda: 'MXN',
        margenObjetivoMinimo: 0.6,
        activo: true
      });
      setMensaje('Plan creado');
      await cargarVistaActual('planes');
    } catch (error) {
      setMensaje(clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear plan'));
    }
  }

  async function crearSuscripcion() {
    try {
      await clienteAdminNegocioApi.enviar('/admin-negocio/suscripciones', {
        ...nuevaSuscripcion,
        pasarela: 'mercadopago'
      });
      setMensaje('Suscripcion creada');
      await cargarVistaActual('suscripciones');
    } catch (error) {
      setMensaje(clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear suscripcion'));
    }
  }

  async function crearCupon() {
    try {
      const ahora = new Date();
      const fin = new Date(ahora.getTime() + 1000 * 60 * 60 * 24 * 30);
      await clienteAdminNegocioApi.enviar('/admin-negocio/cupones', {
        ...nuevoCupon,
        moneda: 'MXN',
        vigenciaInicio: ahora.toISOString(),
        vigenciaFin: fin.toISOString(),
        usoMaximo: 100,
        activo: true
      });
      setMensaje('Cupon creado');
      await cargarVistaActual('cupones');
    } catch (error) {
      setMensaje(clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear cupon'));
    }
  }

  async function crearCampana() {
    try {
      const ahora = new Date();
      const fin = new Date(ahora.getTime() + 1000 * 60 * 60 * 24 * 20);
      await clienteAdminNegocioApi.enviar('/admin-negocio/campanas', {
        ...nuevaCampana,
        fechaInicio: ahora.toISOString(),
        fechaFin: fin.toISOString(),
        presupuestoMxn: 15000,
        estado: 'borrador'
      });
      setMensaje('Campana creada');
      await cargarVistaActual('campanas');
    } catch (error) {
      setMensaje(clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear campana'));
    }
  }

  async function generarLicencia() {
    try {
      const fin = new Date();
      fin.setFullYear(fin.getFullYear() + 1);
      await clienteAdminNegocioApi.enviar('/admin-negocio/licencias/generar', {
        ...nuevaLicencia,
        expiraEn: fin.toISOString()
      });
      setMensaje('Licencia generada');
      await cargarVistaActual('licencias');
    } catch (error) {
      setMensaje(clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo generar licencia'));
    }
  }

  async function crearPreferenciaMercadoPago() {
    try {
      const payload = await clienteAdminNegocioApi.enviar<{
        preferencia?: { initPoint?: string; sandboxInitPoint?: string; id?: string };
      }>('/admin-negocio/cobranza/mercadopago/preferencia', {
        suscripcionId: nuevoCobroMp.suscripcionId,
        titulo: nuevoCobroMp.titulo,
        monto: nuevoCobroMp.monto,
        moneda: 'MXN'
      });
      const url = String(payload?.preferencia?.initPoint || payload?.preferencia?.sandboxInitPoint || '').trim();
      setUltimoInitPoint(url);
      setMensaje(url ? 'Preferencia creada. Abre el enlace para cobrar.' : 'Preferencia creada.');
      await cargarVistaActual('cobranza');
    } catch (error) {
      setMensaje(clienteAdminNegocioApi.mensajeUsuarioDeError(error, 'No se pudo crear preferencia Mercado Pago'));
    }
  }

  useEffect(() => {
    void cargarPerfil();
  }, []);

  useEffect(() => {
    if (!puedeVer) return;
    void cargarVistaActual(vista);
  }, [vista, puedeVer]);

  return (
    <div className="panel cuenta-panel">
      <h2>Panel de Negocio EvaluaPro</h2>
      <p className="nota">
        Usuario: <b>{perfil?.docente?.nombreCompleto || 'Sin sesion'}</b> ({perfil?.docente?.correo || '-'})
      </p>

      {!puedeVer ? (
        <div className="subpanel">
          <p className="nota">
            Este panel requiere permisos comerciales. Ingresa con tu cuenta Google superadmin o asigna permisos comerciales a tu usuario.
          </p>
        </div>
      ) : (
        <>
          <div className="acciones acciones--mt">
            {VISTAS.map((item) => (
              <button key={item.id} type="button" className="chip" disabled={cargando} onClick={() => setVista(item.id)}>
                {item.label}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => void cargarVistaActual(vista)}>
              Recargar
            </button>
          </div>

          {vista === 'tenants' && (
            <div className="subpanel">
              <h3>Nuevo tenant</h3>
              <label className="campo">Tenant ID<input value={nuevoTenant.tenantId} onChange={(e) => setNuevoTenant({ ...nuevoTenant, tenantId: e.target.value })} /></label>
              <label className="campo">Nombre<input value={nuevoTenant.nombre} onChange={(e) => setNuevoTenant({ ...nuevoTenant, nombre: e.target.value })} /></label>
              <label className="campo">Owner Docente ID<input value={nuevoTenant.ownerDocenteId} onChange={(e) => setNuevoTenant({ ...nuevoTenant, ownerDocenteId: e.target.value })} /></label>
              <div className="acciones"><button type="button" className="chip" onClick={() => void crearTenant()}>Crear tenant</button></div>
            </div>
          )}

          {vista === 'planes' && (
            <div className="subpanel">
              <h3>Nuevo plan</h3>
              <label className="campo">Plan ID<input value={nuevoPlan.planId} onChange={(e) => setNuevoPlan({ ...nuevoPlan, planId: e.target.value })} /></label>
              <label className="campo">Nombre<input value={nuevoPlan.nombre} onChange={(e) => setNuevoPlan({ ...nuevoPlan, nombre: e.target.value })} /></label>
              <div className="acciones"><button type="button" className="chip" onClick={() => void crearPlan()}>Crear plan</button></div>
            </div>
          )}

          {vista === 'suscripciones' && (
            <div className="subpanel">
              <h3>Nueva suscripcion</h3>
              <label className="campo">Tenant ID<input value={nuevaSuscripcion.tenantId} onChange={(e) => setNuevaSuscripcion({ ...nuevaSuscripcion, tenantId: e.target.value })} /></label>
              <label className="campo">Plan ID<input value={nuevaSuscripcion.planId} onChange={(e) => setNuevaSuscripcion({ ...nuevaSuscripcion, planId: e.target.value })} /></label>
              <label className="campo">Ciclo
                <select value={nuevaSuscripcion.ciclo} onChange={(e) => setNuevaSuscripcion({ ...nuevaSuscripcion, ciclo: e.target.value })}>
                  <option value="mensual">mensual</option>
                  <option value="anual">anual</option>
                </select>
              </label>
              <label className="campo">Estado
                <select value={nuevaSuscripcion.estado} onChange={(e) => setNuevaSuscripcion({ ...nuevaSuscripcion, estado: e.target.value })}>
                  <option value="trial">trial</option>
                  <option value="activo">activo</option>
                  <option value="past_due">past_due</option>
                  <option value="suspendido">suspendido</option>
                  <option value="cancelado">cancelado</option>
                </select>
              </label>
              <label className="campo">
                <input
                  type="checkbox"
                  checked={nuevaSuscripcion.activarTrial35Dias}
                  onChange={(e) => setNuevaSuscripcion({ ...nuevaSuscripcion, activarTrial35Dias: e.target.checked })}
                />
                Activar trial 35 dias
              </label>
              <div className="acciones"><button type="button" className="chip" onClick={() => void crearSuscripcion()}>Crear suscripcion</button></div>
            </div>
          )}

          {vista === 'cupones' && (
            <div className="subpanel">
              <h3>Nuevo cupon</h3>
              <label className="campo">Codigo<input value={nuevoCupon.codigo} onChange={(e) => setNuevoCupon({ ...nuevoCupon, codigo: e.target.value })} /></label>
              <label className="campo">Valor descuento<input type="number" value={nuevoCupon.valorDescuento} onChange={(e) => setNuevoCupon({ ...nuevoCupon, valorDescuento: Number(e.target.value || 0) })} /></label>
              <div className="acciones"><button type="button" className="chip" onClick={() => void crearCupon()}>Crear cupon</button></div>
            </div>
          )}

          {vista === 'campanas' && (
            <div className="subpanel">
              <h3>Nueva campana</h3>
              <label className="campo">Nombre<input value={nuevaCampana.nombre} onChange={(e) => setNuevaCampana({ ...nuevaCampana, nombre: e.target.value })} /></label>
              <div className="acciones"><button type="button" className="chip" onClick={() => void crearCampana()}>Crear campana</button></div>
            </div>
          )}

          {vista === 'licencias' && (
            <div className="subpanel">
              <h3>Generar licencia</h3>
              <label className="campo">Tenant ID<input value={nuevaLicencia.tenantId} onChange={(e) => setNuevaLicencia({ ...nuevaLicencia, tenantId: e.target.value })} /></label>
              <div className="acciones"><button type="button" className="chip" onClick={() => void generarLicencia()}>Generar licencia</button></div>
            </div>
          )}

          {vista === 'cobranza' && (
            <div className="subpanel">
              <h3>Crear preferencia Mercado Pago</h3>
              <label className="campo">
                Suscripcion ID
                <input value={nuevoCobroMp.suscripcionId} onChange={(e) => setNuevoCobroMp({ ...nuevoCobroMp, suscripcionId: e.target.value })} />
              </label>
              <label className="campo">
                Titulo
                <input value={nuevoCobroMp.titulo} onChange={(e) => setNuevoCobroMp({ ...nuevoCobroMp, titulo: e.target.value })} />
              </label>
              <label className="campo">
                Monto MXN
                <input type="number" value={nuevoCobroMp.monto} onChange={(e) => setNuevoCobroMp({ ...nuevoCobroMp, monto: Number(e.target.value || 0) })} />
              </label>
              <div className="acciones">
                <button type="button" className="chip" onClick={() => void crearPreferenciaMercadoPago()}>
                  Crear preferencia
                </button>
                {ultimoInitPoint ? (
                  <a className="chip" href={ultimoInitPoint} target="_blank" rel="noreferrer">
                    Abrir checkout
                  </a>
                ) : null}
              </div>
            </div>
          )}

          <div className="subpanel">
            <h3>Datos</h3>
            {cargando ? <p className="nota">Cargando...</p> : <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 520, overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>}
          </div>
        </>
      )}

      {mensaje ? <p className="nota">{mensaje}</p> : null}
    </div>
  );
}
