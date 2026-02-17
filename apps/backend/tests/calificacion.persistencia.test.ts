import type { Response } from 'express';
import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarMongoTest, cerrarMongoTest, limpiarMongoTest } from './utils/mongo';
import { calificarExamen, obtenerCalificacionPorExamen } from '../src/modulos/modulo_calificacion/controladorCalificacion';
import { BancoPregunta } from '../src/modulos/modulo_banco_preguntas/modeloBancoPregunta';
import { ExamenGenerado } from '../src/modulos/modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenPlantilla } from '../src/modulos/modulo_generacion_pdf/modeloExamenPlantilla';
import { Calificacion } from '../src/modulos/modulo_calificacion/modeloCalificacion';
import { EscaneoOmrArchivado } from '../src/modulos/modulo_escaneo_omr/modeloEscaneoOmrArchivado';
import type { SolicitudDocente } from '../src/modulos/modulo_autenticacion/middlewareAutenticacion';

function crearRespuesta() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  } as unknown as Response;
}

describe('calificaciones persistencia', () => {
  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('guarda calificación y luego la recupera por examen', async () => {
    const docenteId = new Types.ObjectId();
    const periodoId = new Types.ObjectId();
    const alumnoId = new Types.ObjectId();

    const pregunta = await BancoPregunta.create({
      docenteId,
      periodoId,
      tema: 'Álgebra',
      versionActual: 1,
      versiones: [
        {
          numeroVersion: 1,
          enunciado: '2 + 2 = ?',
          opciones: [
            { texto: '4', esCorrecta: true },
            { texto: '3', esCorrecta: false },
            { texto: '2', esCorrecta: false },
            { texto: '1', esCorrecta: false },
            { texto: '0', esCorrecta: false }
          ]
        }
      ]
    });

    const plantilla = await ExamenPlantilla.create({
      docenteId,
      periodoId,
      tipo: 'parcial',
      titulo: 'Parcial de prueba',
      numeroPaginas: 1,
      preguntasIds: [pregunta._id]
    });

    const examen = await ExamenGenerado.create({
      docenteId,
      periodoId,
      plantillaId: plantilla._id,
      alumnoId,
      folio: 'FOL-PERSIST-001',
      estado: 'entregado',
      preguntasIds: [pregunta._id],
      mapaVariante: {
        ordenPreguntas: [String(pregunta._id)],
        ordenOpcionesPorPregunta: {
          [String(pregunta._id)]: [0, 1, 2, 3, 4]
        }
      }
    });

    const reqGuardar = {
      docenteId: String(docenteId),
      body: {
        examenGeneradoId: String(examen._id),
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' }],
        bonoSolicitado: 0,
        retroalimentacion: 'Correcto'
      }
    } as unknown as SolicitudDocente;
    const resGuardar = crearRespuesta();

    await calificarExamen(reqGuardar, resGuardar);

    expect((resGuardar.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(201);
    const calificacionGuardada = await Calificacion.findOne({
      docenteId,
      examenGeneradoId: examen._id
    }).lean();
    expect(calificacionGuardada).toBeTruthy();
    expect(calificacionGuardada?.aciertos).toBe(1);
    expect(calificacionGuardada?.respuestasDetectadas).toEqual([{ numeroPregunta: 1, opcion: 'A' }]);

    const examenActualizado = await ExamenGenerado.findById(examen._id).lean();
    expect(examenActualizado?.estado).toBe('calificado');

    const reqRecuperar = {
      docenteId: String(docenteId),
      params: { examenGeneradoId: String(examen._id) }
    } as unknown as SolicitudDocente;
    const resRecuperar = crearRespuesta();

    await obtenerCalificacionPorExamen(reqRecuperar, resRecuperar);

    const payloadRecuperado = (resRecuperar.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      calificacion: { examenGeneradoId: string; respuestasDetectadas: Array<{ numeroPregunta: number; opcion: string }> };
    };
    expect(String(payloadRecuperado.calificacion.examenGeneradoId)).toBe(String(examen._id));
    expect(payloadRecuperado.calificacion.respuestasDetectadas).toEqual([{ numeroPregunta: 1, opcion: 'A' }]);
  });

  it('guarda imágenes OMR por página al calificar y las recupera en paginasOmr', async () => {
    const docenteId = new Types.ObjectId();
    const periodoId = new Types.ObjectId();
    const alumnoId = new Types.ObjectId();

    const pregunta = await BancoPregunta.create({
      docenteId,
      periodoId,
      tema: 'Álgebra',
      versionActual: 1,
      versiones: [
        {
          numeroVersion: 1,
          enunciado: '3 + 2 = ?',
          opciones: [
            { texto: '5', esCorrecta: true },
            { texto: '4', esCorrecta: false },
            { texto: '3', esCorrecta: false },
            { texto: '2', esCorrecta: false },
            { texto: '1', esCorrecta: false }
          ]
        }
      ]
    });

    const plantilla = await ExamenPlantilla.create({
      docenteId,
      periodoId,
      tipo: 'parcial',
      titulo: 'Parcial OMR 2 páginas',
      numeroPaginas: 2,
      preguntasIds: [pregunta._id]
    });

    const examen = await ExamenGenerado.create({
      docenteId,
      periodoId,
      plantillaId: plantilla._id,
      alumnoId,
      folio: 'FOL-PERSIST-OMR-002',
      estado: 'entregado',
      preguntasIds: [pregunta._id],
      mapaVariante: {
        ordenPreguntas: [String(pregunta._id)],
        ordenOpcionesPorPregunta: {
          [String(pregunta._id)]: [0, 1, 2, 3, 4]
        }
      }
    });

    const reqGuardar = {
      docenteId: String(docenteId),
      body: {
        examenGeneradoId: String(examen._id),
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A' }],
        paginasOmr: [
          {
            numeroPagina: 1,
            imagenBase64: 'data:image/png;base64,AQIDBA=='
          },
          {
            numeroPagina: 2,
            imagenBase64: 'data:image/jpeg;base64,BQYHCA=='
          }
        ]
      }
    } as unknown as SolicitudDocente;
    const resGuardar = crearRespuesta();

    await calificarExamen(reqGuardar, resGuardar);

    expect((resGuardar.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(201);

    const capturas = await EscaneoOmrArchivado.find({
      docenteId,
      examenGeneradoId: examen._id
    })
      .sort({ numeroPagina: 1 })
      .lean();
    expect(capturas).toHaveLength(2);
    expect(capturas[0]?.numeroPagina).toBe(1);
    expect(capturas[1]?.numeroPagina).toBe(2);
    expect(capturas[0]?.tamanoComprimidoBytes).toBeGreaterThan(0);
    expect(capturas[1]?.tamanoComprimidoBytes).toBeGreaterThan(0);

    const reqRecuperar = {
      docenteId: String(docenteId),
      params: { examenGeneradoId: String(examen._id) }
    } as unknown as SolicitudDocente;
    const resRecuperar = crearRespuesta();

    await obtenerCalificacionPorExamen(reqRecuperar, resRecuperar);

    const payloadRecuperado = (resRecuperar.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      calificacion: {
        paginasOmr: Array<{ numeroPagina: number; imagenBase64: string }>;
      };
    };
    expect(Array.isArray(payloadRecuperado.calificacion.paginasOmr)).toBe(true);
    expect(payloadRecuperado.calificacion.paginasOmr).toHaveLength(2);
    expect(payloadRecuperado.calificacion.paginasOmr[0]?.numeroPagina).toBe(1);
    expect(payloadRecuperado.calificacion.paginasOmr[1]?.numeroPagina).toBe(2);
    expect(payloadRecuperado.calificacion.paginasOmr[0]?.imagenBase64.startsWith('data:image/png;base64,')).toBe(true);
    expect(payloadRecuperado.calificacion.paginasOmr[1]?.imagenBase64.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});
