import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { Tenant } from '../../src/modulos/modulo_comercial_core/modeloTenant';
import { Suscripcion } from '../../src/modulos/modulo_comercial_core/modeloSuscripcion';
import { Cobranza } from '../../src/modulos/modulo_comercial_core/modeloCobranza';

function construirFirmaMpOficial(params: {
  secret: string;
  ts: number;
  dataIdUrl: string;
  requestId: string;
}) {
  const manifest = `id:${params.dataIdUrl};request-id:${params.requestId};ts:${params.ts};`;
  const v1 = crypto.createHmac('sha256', params.secret).update(manifest).digest('hex');
  return `ts=${params.ts},v1=${v1}`;
}

describe('integracion webhook Mercado Pago - firma estricta', () => {
  let app: ReturnType<(typeof import('../../src/app'))['crearApp']>;

  beforeAll(async () => {
    await conectarMongoTest();
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'mp-secret-integration';
    process.env.MERCADOPAGO_WEBHOOK_FIRMA_ESTRICTA = 'true';
    process.env.MERCADOPAGO_WEBHOOK_MAX_EDAD_SEGUNDOS = '600';
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'test-token';
    vi.resetModules();
    const modApp = await import('../../src/app');
    app = modApp.crearApp();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await cerrarMongoTest();
  });

  it('acepta firma oficial y procesa payment aprobado', async () => {
    const tenantId = 'tenant_mp_demo';
    const suscripcionId = new mongoose.Types.ObjectId();
    await Tenant.create({
      tenantId,
      nombre: 'Tenant MP Demo',
      tipoTenant: 'smb',
      modalidad: 'saas',
      estado: 'past_due',
      pais: 'MX',
      moneda: 'MXN',
      ownerDocenteId: new mongoose.Types.ObjectId().toString(),
      configAislamiento: { estrategia: 'shared' }
    });
    await Suscripcion.create({
      _id: suscripcionId,
      tenantId,
      planId: 'plan_demo',
      ciclo: 'mensual',
      estado: 'past_due',
      pasarela: 'mercadopago',
      precioAplicado: 1000
    });

    const paymentId = '123456789';
    const requestId = 'req-webhook-001';
    const ts = Math.floor(Date.now() / 1000);
    const signature = construirFirmaMpOficial({
      secret: 'mp-secret-integration',
      ts,
      dataIdUrl: paymentId,
      requestId
    });

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes(`/v1/payments/${paymentId}`)) {
        return new Response(JSON.stringify({
          id: paymentId,
          status: 'approved',
          transaction_amount: 1000,
          currency_id: 'MXN',
          external_reference: `${tenantId}|${String(suscripcionId)}`,
          metadata: { tenantId, suscripcionId: String(suscripcionId) }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not-found', { status: 404 });
    }) as typeof fetch);

    await request(app)
      .post(`/api/comercial-publico/mercadopago/webhook?type=payment&data.id=${paymentId}`)
      .set('x-request-id', requestId)
      .set('x-signature', signature)
      .send({
        type: 'payment',
        data: { id: paymentId },
        metadata: { tenantId, suscripcionId: String(suscripcionId) }
      })
      .expect(200);

    const suscripcion = await Suscripcion.findById(suscripcionId).lean();
    const cobro = await Cobranza.findOne({ suscripcionId }).lean();
    expect(suscripcion?.estado).toBe('activo');
    expect(cobro?.estado).toBe('aprobado');
    expect(cobro?.moneda).toBe('MXN');
    expect(Number(cobro?.monto || 0)).toBe(1000);
  });

  it('rechaza webhook sin x-request-id en modo estricto', async () => {
    const paymentId = '987654321';
    const ts = Math.floor(Date.now() / 1000);
    const signature = construirFirmaMpOficial({
      secret: 'mp-secret-integration',
      ts,
      dataIdUrl: paymentId,
      requestId: 'req-x'
    });

    await request(app)
      .post(`/api/comercial-publico/mercadopago/webhook?type=payment&data.id=${paymentId}`)
      .set('x-signature', signature)
      .send({ type: 'payment', data: { id: paymentId } })
      .expect(401);
  });
});
