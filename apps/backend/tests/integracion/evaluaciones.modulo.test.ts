import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';
import { Alumno } from '../../src/modulos/modulo_alumnos/modeloAlumno';
import { Periodo } from '../../src/modulos/modulo_alumnos/modeloPeriodo';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('módulo evaluaciones (LISC)', () => {
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

  it('calcula resumen por política LISC usando evidencias y componentes', async () => {
    const docente = await Docente.create({
      _id: '507f1f77bcf86cd799439500',
      nombreCompleto: 'Docente Evaluaciones',
      correo: 'evaluaciones@test.com',
      roles: ['docente'],
      activo: true
    });

    const periodo = await Periodo.create({
      _id: '507f1f77bcf86cd799439501',
      docenteId: docente._id,
      nombre: 'Lógica de Programación',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-03-31T00:00:00.000Z')
    });

    const alumno = await Alumno.create({
      _id: '507f1f77bcf86cd799439502',
      docenteId: docente._id,
      periodoId: periodo._id,
      matricula: 'CUH512410168',
      nombreCompleto: 'Alumno Lisc'
    });

    const token = crearTokenDocente({ docenteId: String(docente._id), roles: ['docente'] });
    const auth = { Authorization: `Bearer ${token}` };

    await request(app)
      .post('/api/evaluaciones/configuracion-periodo')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
        politicaVersion: 1,
        cortes: [
          { numero: 1, nombre: 'C1', fechaCorte: '2026-01-15T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.2 },
          { numero: 2, nombre: 'C2', fechaCorte: '2026-02-15T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.2 },
          { numero: 3, nombre: 'C3', fechaCorte: '2026-03-15T00:00:00.000Z', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.6 }
        ],
        pesosGlobales: { continua: 0.5, examenes: 0.5 },
        pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6 }
      })
      .expect(200);

    await request(app)
      .post('/api/evaluaciones/evidencias')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        titulo: 'E01',
        calificacionDecimal: 8,
        ponderacion: 1,
        fechaEvidencia: '2026-01-10T00:00:00.000Z'
      })
      .expect(201);
    await request(app)
      .post('/api/evaluaciones/evidencias')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        titulo: 'E02',
        calificacionDecimal: 9,
        ponderacion: 1,
        fechaEvidencia: '2026-02-10T00:00:00.000Z'
      })
      .expect(201);
    await request(app)
      .post('/api/evaluaciones/evidencias')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        titulo: 'E03',
        calificacionDecimal: 10,
        ponderacion: 1,
        fechaEvidencia: '2026-03-10T00:00:00.000Z'
      })
      .expect(201);

    await request(app)
      .post('/api/evaluaciones/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'parcial1',
        teoricoDecimal: 8,
        practicas: [8]
      })
      .expect(201);
    await request(app)
      .post('/api/evaluaciones/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'parcial2',
        teoricoDecimal: 9,
        practicas: [7, 9]
      })
      .expect(201);
    await request(app)
      .post('/api/evaluaciones/examenes/componentes')
      .set(auth)
      .send({
        periodoId: String(periodo._id),
        alumnoId: String(alumno._id),
        corte: 'global',
        teoricoDecimal: 10,
        practicas: [10]
      })
      .expect(201);

    const respuesta = await request(app)
      .get(`/api/evaluaciones/alumnos/${encodeURIComponent(String(alumno._id))}/resumen?periodoId=${encodeURIComponent(String(periodo._id))}`)
      .set(auth)
      .expect(200);

    const resumen = respuesta.body?.resumen;
    expect(resumen).toBeTruthy();
    expect(resumen.politicaCodigo).toBe('POLICY_LISC_ENCUADRE_2026');
    expect(Number(resumen.bloqueContinuaDecimal)).toBeCloseTo(8.7, 4);
    expect(Number(resumen.bloqueExamenesDecimal)).toBeCloseTo(9.3, 4);
    expect(Number(resumen.finalDecimal)).toBeCloseTo(9, 4);
    expect(Number(resumen.finalRedondeada)).toBe(9);
    expect(resumen.estado).toBe('completo');
  });
});
