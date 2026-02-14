/**
 * versionadoApiV2Contratos.test
 *
 * Valida la transicion controlada de v1 -> v2 para OMR/PDF:
 * - Paridad funcional minima de lectura/analisis.
 * - Contadores de observabilidad para fallback reads y writes v2.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { prepararEscenarioFlujo } from './_flujoDocenteHelper';

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+WmVQAAAAASUVORK5CYII=';

function leerMetricaCounter(metricas: string, nombre: string) {
  const coincidencia = metricas.match(new RegExp(`^${nombre}\\s+(\\d+)`, 'm'));
  if (!coincidencia) {
    return 0;
  }
  return Number.parseInt(coincidencia[1], 10);
}

describe('API v2 OMR/PDF + observabilidad de transicion', () => {
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

  it('mantiene paridad minima y registra fallback reads + writes v2', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'docente-versionado-v2@prueba.test');

    const metricasAntes = await request(app).get('/api/metrics').expect(200);
    const fallbackAntes = leerMetricaCounter(String(metricasAntes.text ?? ''), 'evaluapro_schema_fallback_reads_total');
    const writesV2Antes = leerMetricaCounter(String(metricasAntes.text ?? ''), 'evaluapro_schema_v2_writes_total');

    const plantillasV1 = await request(app).get('/api/examenes/plantillas').set(escenario.auth).expect(200);
    const plantillasV2 = await request(app).get('/api/v2/examenes/plantillas').set(escenario.auth).expect(200);

    expect(Array.isArray(plantillasV1.body.plantillas)).toBe(true);
    expect(Array.isArray(plantillasV2.body.plantillas)).toBe(true);
    expect(plantillasV2.body.plantillas).toHaveLength(plantillasV1.body.plantillas.length);

    const prevalidacionV1 = await request(app)
      .post('/api/omr/prevalidar-lote')
      .set(escenario.auth)
      .send({
        capturas: [{ nombreArchivo: 'captura-v1.png', imagenBase64: PNG_1X1_BASE64 }]
      })
      .expect(200);

    const prevalidacionV2 = await request(app)
      .post('/api/v2/omr/prevalidar-lote')
      .set(escenario.auth)
      .send({
        capturas: [{ nombreArchivo: 'captura-v2.png', imagenBase64: PNG_1X1_BASE64 }]
      })
      .expect(200);

    expect(prevalidacionV1.body.total).toBe(1);
    expect(prevalidacionV2.body.total).toBe(1);

    const metricasDespues = await request(app).get('/api/metrics').expect(200);
    const fallbackDespues = leerMetricaCounter(String(metricasDespues.text ?? ''), 'evaluapro_schema_fallback_reads_total');
    const writesV2Despues = leerMetricaCounter(String(metricasDespues.text ?? ''), 'evaluapro_schema_v2_writes_total');

    // v1 /examenes/* y /omr/* deben registrar uso de adapter.
    expect(fallbackDespues).toBeGreaterThan(fallbackAntes);
    // v2 POST debe registrar write en handlers v2.
    expect(writesV2Despues).toBeGreaterThan(writesV2Antes);
  });
});
