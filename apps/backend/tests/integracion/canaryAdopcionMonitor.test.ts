/**
 * canaryAdopcionMonitor.test
 *
 * Responsabilidad: Validar que el sistema de canary rollout rastrea adopción correctamente
 * Limites: Solo validar contadores agregados, no datos sensibles
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { prepararEscenarioFlujo } from './_flujoDocenteHelper';

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+WmVQAAAAASUVORK5CYII=';

function leerMetricasAdopcion(metricas: string) {
  const resultado: Record<string, { v1: number; v2: number; v2Porcentaje: number }> = {};

  const lines = String(metricas).split('\n');

  for (const line of lines) {
    if (line.startsWith('evaluapro_adopcion_v2_porcentaje')) {
      const match = line.match(/modulo="([^"]+)"\}\s+([\d.]+)/);
      if (match) {
        const [, modulo, valor] = match;
        if (!resultado[modulo]) resultado[modulo] = { v1: 0, v2: 0, v2Porcentaje: 0 };
        resultado[modulo].v2Porcentaje = parseFloat(valor);
      }
    }

    if (line.startsWith('evaluapro_adopcion_v1_total')) {
      const match = line.match(/modulo="([^"]+)"\}\s+(\d+)/);
      if (match) {
        const [, modulo, valor] = match;
        if (!resultado[modulo]) resultado[modulo] = { v1: 0, v2: 0, v2Porcentaje: 0 };
        resultado[modulo].v1 = parseInt(valor, 10);
      }
    }

    if (line.startsWith('evaluapro_adopcion_v2_total')) {
      const match = line.match(/modulo="([^"]+)"\}\s+(\d+)/);
      if (match) {
        const [, modulo, valor] = match;
        if (!resultado[modulo]) resultado[modulo] = { v1: 0, v2: 0, v2Porcentaje: 0 };
        resultado[modulo].v2 = parseInt(valor, 10);
      }
    }
  }

  return resultado;
}

describe('Canary adopcion monitor (v1 vs v2)', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('rastrea adopción v1 para /examenes y v2 para /v2/omr', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'canario-test-v1@test.test');

    // Realizar solicitudes v1
    await request(app).get('/api/examenes/plantillas').set(escenario.auth).expect(200);

    await request(app)
      .post('/api/v2/omr/prevalidar-lote')
      .set(escenario.auth)
      .send({
        capturas: [{ nombreArchivo: 'test.png', imagenBase64: PNG_1X1_BASE64 }]
      })
      .expect(200);

    // Leer métricas
    const metricas = await request(app).get('/api/metrics').expect(200);
    const adopcion = leerMetricasAdopcion(String(metricas.text ?? ''));

    // Validar que se registró tráfico v1
    expect(adopcion.pdf).toBeDefined();
    expect(adopcion.pdf?.v1).toBeGreaterThan(0);

    expect(adopcion.omr).toBeDefined();
    expect(adopcion.omr?.v2).toBeGreaterThan(0);
  });

  it('rastrea adopción v2 para endpoints /v2/examenes y /v2/omr', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'canario-test-v2@test.test');

    // Realizar solicitudes v2
    await request(app).get('/api/v2/examenes/plantillas').set(escenario.auth).expect(200);

    await request(app)
      .post('/api/v2/omr/prevalidar-lote')
      .set(escenario.auth)
      .send({
        capturas: [{ nombreArchivo: 'test.png', imagenBase64: PNG_1X1_BASE64 }]
      })
      .expect(200);

    // Leer métricas
    const metricas = await request(app).get('/api/metrics').expect(200);
    const adopcion = leerMetricasAdopcion(String(metricas.text ?? ''));

    // Validar que se registró tráfico v2
    expect(adopcion.pdf).toBeDefined();
    expect(adopcion.pdf?.v2).toBeGreaterThan(0);

    expect(adopcion.omr).toBeDefined();
    expect(adopcion.omr?.v2).toBeGreaterThan(0);
  });

  it('calcula porcentaje de adopción v2 correctamente', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'canario-test-pct@test.test');

    // Leer métri cas ANTES
    const metricasAntes = await request(app).get('/api/metrics').expect(200);
    const adopcionAntes = leerMetricasAdopcion(String(metricasAntes.text ?? ''));

    // Realizar solicitudes mixtas: más v1 que v2
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/examenes/plantillas').set(escenario.auth).expect(200);
    }

    for (let i = 0; i < 1; i++) {
      await request(app).get('/api/v2/examenes/plantillas').set(escenario.auth).expect(200);
    }

    // Leer métricas DESPUÉS
    const metricasDespues = await request(app).get('/api/metrics').expect(200);
    const adopcionDespues = leerMetricasAdopcion(String(metricasDespues.text ?? ''));

    // Validar incrementos
    const v1Antes = adopcionAntes.pdf?.v1 ?? 0;
    const v2Antes = adopcionAntes.pdf?.v2 ?? 0;
    const v1Despues = adopcionDespues.pdf?.v1 ?? 0;
    const v2Despues = adopcionDespues.pdf?.v2 ?? 0;

    expect(v1Despues - v1Antes).toBe(3);
    expect(v2Despues - v2Antes).toBe(1);

    // Porcentaje: 1 / (3 + 1) * 100 = 25%
    const totalNuevo = (v1Despues - v1Antes) + (v2Despues - v2Antes);
    const porcentajEsperado = ((v2Despues - v2Antes) / totalNuevo) * 100;
    expect(Math.round(porcentajEsperado)).toBe(25);
  });

  it('expone métricas de adopción en formato Prometheus', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'canario-test-prom@test.test');

    // Generar tráfico
    await request(app).get('/api/examenes/plantillas').set(escenario.auth).expect(200);
    await request(app).get('/api/v2/examenes/plantillas').set(escenario.auth).expect(200);

    // Leer métricas raw
    const metricas = await request(app).get('/api/metrics').expect(200);
    const metricasText = String(metricas.text ?? '');

    // Validar formato Prometheus
    expect(metricasText).toContain('# HELP evaluapro_adopcion_v2_porcentaje');
    expect(metricasText).toContain('# TYPE evaluapro_adopcion_v2_porcentaje gauge');
    expect(metricasText).toContain('evaluapro_adopcion_v1_total');
    expect(metricasText).toContain('evaluapro_adopcion_v2_total');
  });

  it('distingue adopción por módulo (omr vs pdf)', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'canario-test-modulos@test.test');

    // Solicitud OMR v2
    await request(app)
      .post('/api/v2/omr/prevalidar-lote')
      .set(escenario.auth)
      .send({
        capturas: [{ nombreArchivo: 'test.png', imagenBase64: PNG_1X1_BASE64 }]
      })
      .expect(200);

    // Solicitud PDF v1
    await request(app).get('/api/examenes/plantillas').set(escenario.auth).expect(200);

    // Leer métricas
    const metricas = await request(app).get('/api/metrics').expect(200);
    const adopcion = leerMetricasAdopcion(String(metricas.text ?? ''));

    // Validar que cada módulo registra su propia adopción
    expect(adopcion.omr?.v2).toBeGreaterThan(0);
    expect(adopcion.pdf?.v1).toBeGreaterThan(0);
  });

  it('mantiene contadores consistentes durante múltiples solicitudes', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'canario-test-consistencia@test.test');

    // Leer métricas ANTES de hacer las solicitudes
    const metricasAntes = await request(app).get('/api/metrics').expect(200);
    const adopcionAntes = leerMetricasAdopcion(String(metricasAntes.text ?? ''));

    const solicitudesV1 = 5;
    const solicitudesV2 = 3;

    // Realizar solicitudes v1
    for (let i = 0; i < solicitudesV1; i++) {
      await request(app).get('/api/examenes/plantillas').set(escenario.auth).expect(200);
    }

    // Realizar solicitudes v2
    for (let i = 0; i < solicitudesV2; i++) {
      await request(app).get('/api/v2/examenes/plantillas').set(escenario.auth).expect(200);
    }

    // Leer métricas DESPUÉS
    const metricasDespues = await request(app).get('/api/metrics').expect(200);
    const adopcionDespues = leerMetricasAdopcion(String(metricasDespues.text ?? ''));

    // Validar incrementos (no valores absolutos)
    const v1Antes = adopcionAntes.pdf?.v1 ?? 0;
    const v2Antes = adopcionAntes.pdf?.v2 ?? 0;
    const v1Despues = adopcionDespues.pdf?.v1 ?? 0;
    const v2Despues = adopcionDespues.pdf?.v2 ?? 0;

    expect(v1Despues - v1Antes).toBe(solicitudesV1);
    expect(v2Despues - v2Antes).toBe(solicitudesV2);

    expect(adopcionDespues.pdf?.v2Porcentaje).toBeGreaterThan(0);
  });
});
