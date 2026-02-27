import type { Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import {
  Licencia,
  Suscripcion,
  consultarPagoMercadoPago,
  crearCobranzaWebhookIdempotente,
  mapearEstadoCobranzaDesdeMercadoPago,
  registrarEventoComercial,
  validarFirmaWebhookMercadoPago,
  verificarTokenLicencia
} from './servicioComercialCore';

export async function activarLicenciaPublica(req: Request, res: Response) {
  const { tenantId, codigoActivacion, huella, host, versionInstalada } = req.body as {
    tenantId?: string;
    codigoActivacion?: string;
    huella?: string;
    host?: string;
    versionInstalada?: string;
  };

  const licencia = await Licencia.findOne({
    tenantId: String(tenantId || '').trim().toLowerCase(),
    codigoActivacion: String(codigoActivacion || '').trim(),
    estado: { $in: ['generada', 'activa'] }
  });

  if (!licencia) throw new ErrorAplicacion('LICENCIA_INVALIDA', 'No se pudo activar la licencia', 404);
  if (licencia.estado === 'revocada') throw new ErrorAplicacion('LICENCIA_REVOCADA', 'Licencia revocada', 403);

  licencia.estado = 'activa';
  licencia.ultimoHeartbeatEn = new Date();
  licencia.metaDispositivo = {
    huella,
    host,
    versionInstalada
  };
  await licencia.save();

  await registrarEventoComercial(licencia.tenantId, 'licencia_activada', {
    licenciaId: String(licencia._id),
    host,
    versionInstalada
  });

  res.json({
    licencia: {
      tokenLicencia: licencia.tokenLicencia,
      expiraEn: licencia.expiraEn,
      graciaOfflineDias: licencia.graciaOfflineDias,
      canalRelease: licencia.ultimoCanalRelease
    }
  });
}

export async function heartbeatLicenciaPublica(req: Request, res: Response) {
  const { tokenLicencia, tenantId, huella, host, versionInstalada } = req.body as {
    tokenLicencia?: string;
    tenantId?: string;
    huella?: string;
    host?: string;
    versionInstalada?: string;
  };

  const token = String(tokenLicencia || '').trim();
  const payload = verificarTokenLicencia(token);
  if (payload.tenantId !== String(tenantId || '').trim().toLowerCase()) {
    throw new ErrorAplicacion('LICENCIA_TENANT_INVALIDO', 'Tenant no coincide con la licencia', 403);
  }

  const licencia = await Licencia.findById(payload.licenciaId);
  if (!licencia) throw new ErrorAplicacion('LICENCIA_NO_ENCONTRADA', 'Licencia no encontrada', 404);
  if (licencia.estado === 'revocada') throw new ErrorAplicacion('LICENCIA_REVOCADA', 'Licencia revocada', 403);

  const ahora = new Date();
  licencia.ultimoHeartbeatEn = ahora;
  licencia.metaDispositivo = { huella, host, versionInstalada };

  if (licencia.expiraEn.getTime() < ahora.getTime()) {
    licencia.estado = 'expirada';
  }

  await licencia.save();

  const horasSinHeartbeat = licencia.ultimoHeartbeatEn
    ? 0
    : configuracion.licenciaHeartbeatHoras + (licencia.graciaOfflineDias * 24);

  res.json({
    ok: licencia.estado !== 'revocada',
    estado: licencia.estado,
    expiraEn: licencia.expiraEn,
    horasSinHeartbeat,
    graciaOfflineDias: licencia.graciaOfflineDias,
    canalRelease: licencia.ultimoCanalRelease
  });
}

export async function webhookMercadoPago(req: Request, res: Response) {
  const firma = String(req.headers['x-signature'] || req.headers['x-mp-signature'] || '');
  if (!validarFirmaWebhookMercadoPago(firma || undefined)) {
    throw new ErrorAplicacion('WEBHOOK_FIRMA_INVALIDA', 'Firma de webhook invalida', 401);
  }

  const payload = req.body as {
    id?: string;
    eventId?: string;
    type?: string;
    data?: { id?: string; status?: string };
    metadata?: { tenantId?: string; suscripcionId?: string; monto?: number; moneda?: string; referencia?: string };
  };

  const webhookEventId = String(payload.eventId || payload.id || '').trim() || undefined;
  const paymentId = String(payload.data?.id || payload.id || '').trim();
  if (!paymentId) throw new ErrorAplicacion('WEBHOOK_PAYMENT_ID_REQUERIDO', 'Webhook sin payment id', 422);

  const pago = await consultarPagoMercadoPago(paymentId);
  const externalReference = String(pago.externalReference || payload.metadata?.referencia || '').trim();
  const [tenantIdFromRef, suscripcionIdFromRef] = externalReference.includes('|')
    ? externalReference.split('|')
    : ['', ''];

  const tenantId = String(
    payload.metadata?.tenantId ||
    pago.metadata?.tenantId ||
    tenantIdFromRef ||
    ''
  )
    .trim()
    .toLowerCase();
  const suscripcionId = String(
    payload.metadata?.suscripcionId ||
    pago.metadata?.suscripcionId ||
    suscripcionIdFromRef ||
    ''
  )
    .trim();

  if (!tenantId) throw new ErrorAplicacion('WEBHOOK_TENANT_REQUERIDO', 'Webhook sin tenant asociado', 422);

  const estado = mapearEstadoCobranzaDesdeMercadoPago(pago.status);

  const resultado = await crearCobranzaWebhookIdempotente({
    webhookEventId,
    tenantId,
    suscripcionId: suscripcionId || undefined,
    estado,
    monto: Number(pago.transactionAmount || payload.metadata?.monto || 0),
    moneda: pago.currencyId || payload.metadata?.moneda || 'MXN',
    referenciaExterna: externalReference || undefined,
    metadata: {
      webhook: payload,
      pago
    }
  });

  if (!resultado.duplicado && suscripcionId) {
    const suscripcion = await Suscripcion.findById(suscripcionId);
    if (suscripcion) {
      if (estado === 'aprobado') suscripcion.estado = 'activo';
      if (estado === 'rechazado') suscripcion.estado = 'past_due';
      if (estado === 'cancelado') suscripcion.estado = 'cancelado';
      await suscripcion.save();
    }
  }

  res.status(200).json({ ok: true, duplicado: resultado.duplicado });
}
