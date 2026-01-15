// Pruebas de validacion de payloads.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { tokenDocentePrueba } from '../utils/token';

describe('validaciones de payload', () => {
  const app = crearApp();

  it('rechaza registro sin campos requeridos', async () => {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ correo: 'faltan@campos.test' })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza banco de preguntas con opciones invalidas', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/banco-preguntas')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        enunciado: 'Pregunta invalida',
        opciones: [
          { texto: 'A', esCorrecta: true },
          { texto: 'B', esCorrecta: false }
        ]
      })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza calificacion sin examen', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/calificaciones/calificar')
      .set({ Authorization: `Bearer ${token}` })
      .send({ aciertos: 1 })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza vinculacion entrega sin alumnoId', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/entregas/vincular')
      .set({ Authorization: `Bearer ${token}` })
      .send({ examenGeneradoId: '507f1f77bcf86cd799439011' })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza vinculacion entrega por folio sin folio', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/entregas/vincular-folio')
      .set({ Authorization: `Bearer ${token}` })
      .send({ alumnoId: '507f1f77bcf86cd799439011' })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza crear bandera con tipo invalido', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/analiticas/banderas')
      .set({ Authorization: `Bearer ${token}` })
      .send({ examenGeneradoId: '507f1f77bcf86cd799439011', alumnoId: '507f1f77bcf86cd799439012', tipo: 'no-existe' })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza analizar OMR sin folio', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/omr/analizar')
      .set({ Authorization: `Bearer ${token}` })
      .send({ imagenBase64: 'x'.repeat(20) })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza crear plantilla sin campos requeridos', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/examenes/plantillas')
      .set({ Authorization: `Bearer ${token}` })
      .send({ tipo: 'parcial' })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza crear plantilla con preguntasIds invalidos', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/examenes/plantillas')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        tipo: 'parcial',
        titulo: 'Plantilla',
        totalReactivos: 5,
        preguntasIds: ['no-es-objectid']
      })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza generar examen con plantillaId invalido', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/examenes/generados')
      .set({ Authorization: `Bearer ${token}` })
      .send({ plantillaId: 'no-es-objectid' })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza generar codigo de acceso con periodoId invalido', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/sincronizaciones/codigo-acceso')
      .set({ Authorization: `Bearer ${token}` })
      .send({ periodoId: 'no-es-objectid' })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza exportar-csv con columnas vacias', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .post('/api/analiticas/exportar-csv')
      .set({ Authorization: `Bearer ${token}` })
      .send({ columnas: [''], filas: [{ a: 1 }] })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('requiere periodoId en calificaciones-csv', async () => {
    const token = tokenDocentePrueba();
    const respuesta = await request(app)
      .get('/api/analiticas/calificaciones-csv')
      .set({ Authorization: `Bearer ${token}` })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe('DATOS_INVALIDOS');
  });
});

