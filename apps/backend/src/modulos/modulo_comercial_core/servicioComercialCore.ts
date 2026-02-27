import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { AuditoriaComercial } from './modeloAuditoriaComercial';
import { Campana } from './modeloCampana';
import { Cobranza } from './modeloCobranza';
import { ConsentimientoComercial } from './modeloConsentimientoComercial';
import { Cupon } from './modeloCupon';
import { EventoComercial } from './modeloEventoComercial';
import { Licencia } from './modeloLicencia';
import { PlanComercial } from './modeloPlanComercial';
import { Suscripcion } from './modeloSuscripcion';
import { Tenant } from './modeloTenant';

const MARGEN_MINIMO = 0.6;

export function calcularMargen(precio: number, costo: number): number {
  const p = Number(precio || 0);
  const c = Number(costo || 0);
  if (p <= 0) return 0;
  return (p - c) / p;
}

export function validarMargenMinimo(precio: number, costo: number, margenMinimo = MARGEN_MINIMO) {
  const margen = calcularMargen(precio, costo);
  if (margen < margenMinimo) {
    throw new ErrorAplicacion('MARGEN_INVALIDO', `El margen bruto (${(margen * 100).toFixed(2)}%) es menor al minimo requerido`, 422);
  }
  return margen;
}

export async function registrarAuditoriaComercial(params: {
  actorDocenteId?: string;
  tenantId?: string;
  accion: string;
  recurso: string;
  recursoId?: string;
  origen?: string;
  ip?: string;
  diff?: unknown;
}) {
  await AuditoriaComercial.create({
    actorDocenteId: params.actorDocenteId,
    tenantId: params.tenantId,
    accion: params.accion,
    recurso: params.recurso,
    recursoId: params.recursoId,
    origen: params.origen || 'panel_admin_negocio',
    ip: params.ip,
    diff: params.diff
  });
}

export async function validarConsentimientoTrial(tenantId: string) {
  const ultimo = await ConsentimientoComercial.findOne({ tenantId }).sort({ createdAt: -1 }).lean();
  if (!ultimo || !ultimo.finalidades?.producto || !ultimo.finalidades?.ventas) {
    throw new ErrorAplicacion('CONSENTIMIENTO_REQUERIDO', 'Se requiere consentimiento granular (producto y ventas) para activar trial', 422);
  }
}

export async function validarYAplicarCupon(params: {
  codigo: string;
  planId: string;
  lineaPersona: string;
  precioBase: number;
  costoMensualEstimado: number;
}): Promise<{ precioFinal: number; descuento: number; cuponId: string }> {
  const cupon = await Cupon.findOne({ codigo: String(params.codigo || '').trim().toUpperCase(), activo: true });
  if (!cupon) {
    throw new ErrorAplicacion('CUPON_NO_ENCONTRADO', 'Cupon no valido', 404);
  }

  const ahora = new Date();
  if (cupon.vigenciaInicio > ahora || cupon.vigenciaFin < ahora) {
    throw new ErrorAplicacion('CUPON_VENCIDO', 'Cupon fuera de vigencia', 422);
  }
  if ((cupon.usosActuales ?? 0) >= (cupon.usoMaximo ?? 0)) {
    throw new ErrorAplicacion('CUPON_AGOTADO', 'Cupon sin usos disponibles', 422);
  }

  const planesPermitidos = cupon.restricciones?.planesPermitidos ?? [];
  if (planesPermitidos.length > 0 && !planesPermitidos.includes(params.planId)) {
    throw new ErrorAplicacion('CUPON_RESTRINGIDO_PLAN', 'Cupon no aplica para este plan', 422);
  }

  const personasPermitidas = cupon.restricciones?.personasPermitidas ?? [];
  if (personasPermitidas.length > 0 && !personasPermitidas.includes(params.lineaPersona)) {
    throw new ErrorAplicacion('CUPON_RESTRINGIDO_PERSONA', 'Cupon no aplica para este perfil', 422);
  }

  const base = Number(params.precioBase || 0);
  const descuentoBruto = cupon.tipoDescuento === 'porcentaje'
    ? base * (Number(cupon.valorDescuento || 0) / 100)
    : Number(cupon.valorDescuento || 0);
  const precioFinal = Math.max(0, Number((base - descuentoBruto).toFixed(2)));
  const descuento = base > 0 ? Number(((base - precioFinal) / base).toFixed(6)) : 0;

  validarMargenMinimo(precioFinal, params.costoMensualEstimado);

  cupon.usosActuales = Number(cupon.usosActuales || 0) + 1;
  await cupon.save();

  return { precioFinal, descuento, cuponId: String(cupon._id) };
}

export function emitirTokenLicencia(payload: { licenciaId: string; tenantId: string; tipo: 'saas' | 'onprem'; canalRelease: 'stable' | 'beta' }) {
  return jwt.sign(payload, configuracion.licenciaJwtSecreto, {
    algorithm: 'HS256',
    expiresIn: '90d'
  });
}

export function verificarTokenLicencia(token: string): { licenciaId: string; tenantId: string; tipo: 'saas' | 'onprem'; canalRelease: 'stable' | 'beta' } {
  return jwt.verify(token, configuracion.licenciaJwtSecreto) as {
    licenciaId: string;
    tenantId: string;
    tipo: 'saas' | 'onprem';
    canalRelease: 'stable' | 'beta';
  };
}

export function generarCodigoActivacion(): string {
  return `EVAL-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

export async function registrarEventoComercial(tenantId: string, evento: string, meta?: unknown) {
  await EventoComercial.create({ tenantId, evento, origen: 'sistema', meta });
}

export async function construirResumenDashboard() {
  const [
    totalTenants,
    suscripcionesActivas,
    suscripcionesPastDue,
    mrr,
    cobranzaPendiente,
    conversionTrial,
    churnMensual
  ] = await Promise.all([
    Tenant.countDocuments({}),
    Suscripcion.countDocuments({ estado: 'activo' }),
    Suscripcion.countDocuments({ estado: 'past_due' }),
    Suscripcion.aggregate([
      { $match: { estado: 'activo', ciclo: 'mensual' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$precioAplicado', 0] } } } }
    ]),
    Cobranza.aggregate([
      { $match: { estado: 'pendiente' } },
      { $group: { _id: null, total: { $sum: '$monto' } } }
    ]),
    (async () => {
      const trials = await Suscripcion.countDocuments({ estado: 'trial' });
      const activos = await Suscripcion.countDocuments({ estado: 'activo' });
      const base = trials + activos;
      return base > 0 ? activos / base : 0;
    })(),
    (async () => {
      const canceladas = await Suscripcion.countDocuments({ estado: 'cancelado' });
      const activas = await Suscripcion.countDocuments({ estado: 'activo' });
      return activas > 0 ? canceladas / activas : 0;
    })()
  ]);

  return {
    margenBrutoMinimo: MARGEN_MINIMO,
    totalTenants,
    suscripcionesActivas,
    suscripcionesPastDue,
    mrrMxn: Number(mrr[0]?.total || 0),
    cobranzaPendienteMxn: Number(cobranzaPendiente[0]?.total || 0),
    conversionTrial,
    churnMensual
  };
}

export async function crearCobranzaWebhookIdempotente(params: {
  webhookEventId?: string;
  tenantId: string;
  suscripcionId?: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado';
  monto: number;
  moneda?: string;
  referenciaExterna?: string;
  metadata?: unknown;
}) {
  if (params.webhookEventId) {
    const existente = await Cobranza.findOne({ webhookEventId: params.webhookEventId }).lean();
    if (existente) return { registro: existente, duplicado: true };
  }

  const registro = await Cobranza.create({
    tenantId: params.tenantId,
    suscripcionId: params.suscripcionId,
    pasarela: 'mercadopago',
    estado: params.estado,
    monto: params.monto,
    moneda: (params.moneda || 'MXN').toUpperCase(),
    referenciaExterna: params.referenciaExterna,
    webhookEventId: params.webhookEventId,
    metadata: params.metadata
  });

  return { registro, duplicado: false };
}

export async function crearPreferenciaMercadoPago(params: {
  tenantId: string;
  suscripcionId: string;
  titulo: string;
  monto: number;
  moneda: string;
  correoComprador?: string;
  referenciaExterna?: string;
}): Promise<{
  id: string;
  initPoint?: string;
  sandboxInitPoint?: string;
  raw: unknown;
}> {
  if (!configuracion.mercadoPagoAccessToken) {
    throw new ErrorAplicacion('MP_NO_CONFIG', 'Mercado Pago no esta configurado (access token)', 503);
  }

  const referencia = params.referenciaExterna || `${params.tenantId}|${params.suscripcionId}`;
  const body = {
    items: [
      {
        title: params.titulo,
        quantity: 1,
        currency_id: String(params.moneda || 'MXN').toUpperCase(),
        unit_price: Number(params.monto || 0)
      }
    ],
    payer: params.correoComprador ? { email: params.correoComprador } : undefined,
    metadata: {
      tenantId: params.tenantId,
      suscripcionId: params.suscripcionId
    },
    external_reference: referencia
  };

  const respuesta = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${configuracion.mercadoPagoAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new ErrorAplicacion('MP_PREFERENCIA_ERROR', `No se pudo crear preferencia Mercado Pago (${respuesta.status})`, 502, detalle);
  }

  const payload = (await respuesta.json()) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  };

  if (!payload?.id) {
    throw new ErrorAplicacion('MP_PREFERENCIA_INVALIDA', 'Respuesta invalida al crear preferencia', 502, payload);
  }

  return {
    id: payload.id,
    initPoint: payload.init_point,
    sandboxInitPoint: payload.sandbox_init_point,
    raw: payload
  };
}

export async function consultarPagoMercadoPago(paymentId: string): Promise<{
  id: string;
  status: string;
  transactionAmount: number;
  currencyId: string;
  externalReference?: string;
  metadata?: Record<string, unknown>;
}> {
  if (!configuracion.mercadoPagoAccessToken) {
    throw new ErrorAplicacion('MP_NO_CONFIG', 'Mercado Pago no esta configurado (access token)', 503);
  }
  const id = String(paymentId || '').trim();
  if (!id) throw new ErrorAplicacion('MP_PAGO_ID_INVALIDO', 'paymentId requerido', 400);

  const respuesta = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${configuracion.mercadoPagoAccessToken}`
    }
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new ErrorAplicacion('MP_PAGO_CONSULTA_ERROR', `No se pudo consultar pago Mercado Pago (${respuesta.status})`, 502, detalle);
  }

  const payload = (await respuesta.json()) as {
    id?: number | string;
    status?: string;
    transaction_amount?: number;
    currency_id?: string;
    external_reference?: string;
    metadata?: Record<string, unknown>;
  };

  return {
    id: String(payload.id || id),
    status: String(payload.status || 'unknown').toLowerCase(),
    transactionAmount: Number(payload.transaction_amount || 0),
    currencyId: String(payload.currency_id || 'MXN').toUpperCase(),
    externalReference: payload.external_reference ? String(payload.external_reference) : undefined,
    metadata: payload.metadata
  };
}

export function mapearEstadoCobranzaDesdeMercadoPago(status: string): 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado' {
  const valor = String(status || '').toLowerCase();
  if (valor === 'approved') return 'aprobado';
  if (valor === 'rejected' || valor === 'charged_back') return 'rechazado';
  if (valor === 'cancelled' || valor === 'cancelled_by_user') return 'cancelado';
  return 'pendiente';
}

export function validarFirmaWebhookMercadoPago(signature: string | undefined): boolean {
  if (!configuracion.mercadoPagoWebhookSecret) return true;
  if (!signature) return false;
  const esperado = crypto
    .createHmac('sha256', configuracion.mercadoPagoWebhookSecret)
    .update('mercadopago')
    .digest('hex');
  return signature === esperado;
}

export { Tenant, PlanComercial, Suscripcion, Licencia, Cupon, Campana, EventoComercial, ConsentimientoComercial, Cobranza, AuditoriaComercial };
