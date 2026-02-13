/**
 * portal.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas de integracion del portal alumno.
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gzipSync } from 'zlib';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('portal alumno', () => {
  const app = crearApp();
  const apiKey = process.env.PORTAL_API_KEY ?? 'TEST_PORTAL_KEY';

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('sincroniza y permite consultar resultados', async () => {
    const periodoId = '507f1f77bcf86cd799439011';
    const alumnoId = '507f1f77bcf86cd799439012';
    const docenteId = '507f1f77bcf86cd799439013';
    const examenId = '507f1f77bcf86cd799439014';
    const folio = 'FOLIO01';
    const pdfComprimidoBase64 = gzipSync(Buffer.from('%PDF-1.4 prueba')).toString('base64');

    await request(app)
      .post('/api/portal/sincronizar')
      .set({ 'x-api-key': apiKey })
      .send({
        periodo: { _id: periodoId },
        alumnos: [{ _id: alumnoId, matricula: 'CUH512410168', nombreCompleto: 'Alumno Uno', grupo: 'A' }],
        calificaciones: [
          {
            docenteId,
            alumnoId,
            examenGeneradoId: examenId,
            tipoExamen: 'parcial',
            totalReactivos: 3,
            aciertos: 2,
            calificacionExamenFinalTexto: '4',
            calificacionParcialTexto: '9',
            respuestasDetectadas: [
              { numeroPregunta: 1, opcion: 'A', confianza: 0.95 },
              { numeroPregunta: 2, opcion: 'C', confianza: 0.88 },
              { numeroPregunta: 3, opcion: 'D', confianza: 0.9 }
            ],
            comparativaRespuestas: [
              { numeroPregunta: 1, correcta: 'A', detectada: 'A', coincide: true, confianza: 0.95 },
              { numeroPregunta: 2, correcta: 'B', detectada: 'C', coincide: false, confianza: 0.88 },
              { numeroPregunta: 3, correcta: 'D', detectada: 'D', coincide: true, confianza: 0.9 }
            ],
            omrAuditoria: { estadoAnalisis: 'requiere_revision', revisionConfirmada: true, calidadPagina: 0.84 }
          }
        ],
        examenes: [{ examenGeneradoId: examenId, folio, pdfComprimidoBase64 }],
        banderas: [{ examenGeneradoId: examenId, tipo: 'similitud' }],
        codigoAcceso: { codigo: 'ABC123', expiraEn: new Date(Date.now() + 60 * 60 * 1000).toISOString() }
      })
      .expect(200);

    const ingreso = await request(app)
      .post('/api/portal/ingresar')
      .send({ codigo: 'ABC123', matricula: 'CUH512410168' })
      .expect(200);

    const token = ingreso.body.token as string;
    expect(token).toBeTruthy();

    const resultados = await request(app)
      .get('/api/portal/resultados')
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);

    expect(resultados.body.resultados).toHaveLength(1);
    expect(resultados.body.resultados[0].folio).toBe(folio);
    expect(resultados.body.resultados[0].aciertos).toBe(2);
    expect(resultados.body.resultados[0].comparativaRespuestas).toHaveLength(3);
    expect(resultados.body.resultados[0].omrAuditoria?.revisionConfirmada).toBe(true);

    const pdf = await request(app)
      .get(`/api/portal/examen/${folio}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(pdf.header['content-type']).toContain('application/pdf');
  });

  it('requiere api key para sincronizar', async () => {
    const respuesta = await request(app)
      .post('/api/portal/sincronizar')
      .send({ periodo: {}, alumnos: [], calificaciones: [] })
      .expect(401);

    expect(respuesta.body.error.codigo).toBe('NO_AUTORIZADO');
  });
});
