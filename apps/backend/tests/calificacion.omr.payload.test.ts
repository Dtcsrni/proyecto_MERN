import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from './utils/mongo';

async function crearEscenarioBase(app: ReturnType<typeof crearApp>) {
  const registro = await request(app)
    .post('/api/autenticacion/registrar')
    .send({
      nombreCompleto: 'Docente OMR Payload',
      correo: 'docente-omr-payload@cuh.mx',
      contrasena: 'Secreto123!'
    })
    .expect(201);
  const token = registro.body.token as string;
  const auth = { Authorization: `Bearer ${token}` };

  const periodo = await request(app)
    .post('/api/periodos')
    .set(auth)
    .send({
      nombre: 'Periodo Payload',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-06-01',
      grupos: ['A']
    })
    .expect(201);
  const periodoId = periodo.body.periodo._id as string;

  const alumno = await request(app)
    .post('/api/alumnos')
    .set(auth)
    .send({
      periodoId,
      matricula: 'CUH512410168',
      nombreCompleto: 'Alumno Payload',
      correo: 'alumno-omr-payload@cuh.mx',
      grupo: 'A'
    })
    .expect(201);

  const pregunta = await request(app)
    .post('/api/banco-preguntas')
    .set(auth)
    .send({
      periodoId,
      enunciado: 'Pregunta payload',
      opciones: [
        { texto: 'A', esCorrecta: true },
        { texto: 'B', esCorrecta: false },
        { texto: 'C', esCorrecta: false },
        { texto: 'D', esCorrecta: false },
        { texto: 'E', esCorrecta: false }
      ]
    })
    .expect(201);

  const plantilla = await request(app)
    .post('/api/examenes/plantillas')
    .set(auth)
    .send({
      periodoId,
      tipo: 'parcial',
      titulo: 'Plantilla payload',
      numeroPaginas: 1,
      preguntasIds: [pregunta.body.pregunta._id]
    })
    .expect(201);

  const examen = await request(app)
    .post('/api/examenes/generados')
    .set(auth)
    .send({ plantillaId: plantilla.body.plantilla._id })
    .expect(201);

  await request(app)
    .post('/api/entregas/vincular-folio')
    .set(auth)
    .send({
      folio: examen.body.examenGenerado.folio,
      alumnoId: alumno.body.alumno._id
    })
    .expect(201);

  return {
    auth,
    examenGeneradoId: examen.body.examenGenerado._id as string,
    folio: examen.body.examenGenerado.folio as string,
    alumnoId: alumno.body.alumno._id as string
  };
}

describe('calificación OMR payload estricto', () => {
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

  it('rechaza payload OMR con longitud de respuestas inconsistente', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [
          { numeroPregunta: 1, opcion: 'A', confianza: 0.9 },
          { numeroPregunta: 1, opcion: 'A', confianza: 0.88 }
        ],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.9,
          confianzaPromedioPagina: 0.89,
          ratioAmbiguas: 0,
          templateVersionDetectada: 3
        }
      })
      .expect(422);

    expect(respuesta.body.error.codigo).toBe('OMR_PAYLOAD_INCOMPLETO');
  });

  it('rechaza folio de payload que no coincide', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: 'FOLIO-INCORRECTO',
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
        omrAnalisis: {
          estadoAnalisis: 'ok',
          calidadPagina: 0.9,
          confianzaPromedioPagina: 0.9,
          ratioAmbiguas: 0,
          templateVersionDetectada: 3
        }
      })
      .expect(409);

    expect(respuesta.body.error.codigo).toBe('OMR_FOLIO_NO_COINCIDE');
  });

  it('exige metadata de revisión cuando revisionConfirmada=true y estado!=ok', async () => {
    const base = await crearEscenarioBase(app);

    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set(base.auth)
      .send({
        examenGeneradoId: base.examenGeneradoId,
        folio: base.folio,
        alumnoId: base.alumnoId,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.9 }],
        omrAnalisis: {
          estadoAnalisis: 'requiere_revision',
          calidadPagina: 0.7,
          confianzaPromedioPagina: 0.65,
          ratioAmbiguas: 0.15,
          templateVersionDetectada: 3,
          revisionConfirmada: true
        }
      })
      .expect(422);

    expect(respuesta.body.error.codigo).toBe('OMR_REVISION_METADATA_OBLIGATORIA');
  });
});
