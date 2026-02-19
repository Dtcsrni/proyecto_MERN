import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerarExamenIndividual,
  mockRegistrarAdopcion
} = vi.hoisted(() => ({
  mockGenerarExamenIndividual: vi.fn(),
  mockRegistrarAdopcion: vi.fn()
}));

vi.mock('../src/modulos/modulo_generacion_pdf/application/usecases/generarExamenIndividual', () => ({
  generarExamenIndividual: mockGenerarExamenIndividual
}));

vi.mock('../src/compartido/observabilidad/metricsAdopcion', () => ({
  registrarAdopcion: mockRegistrarAdopcion
}));

import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';

describe('servicioGeneracionPdf (tv3 only)', () => {
  const paramsBase = {
    titulo: 'Examen TV3',
    folio: 'FOL-001',
    preguntas: [
      {
        id: 'p1',
        enunciado: 'Pregunta 1',
        opciones: [
          { texto: 'A', esCorrecta: true },
          { texto: 'B', esCorrecta: false }
        ]
      }
    ],
    mapaVariante: {
      ordenPreguntas: ['p1'],
      ordenOpcionesPorPregunta: { p1: [0, 1] }
    },
    tipoExamen: 'parcial' as const,
    totalPaginas: 1,
    margenMm: 10,
    templateVersion: 3 as const
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa el caso de uso TV3 y registra adopción', async () => {
    const resultadoEsperado = {
      pdfBytes: Buffer.from('tv3'),
      paginas: [],
      metricasPaginas: [],
      mapaOmr: { templateVersion: 3, paginas: [] },
      preguntasRestantes: 0
    };

    mockGenerarExamenIndividual.mockResolvedValue(resultadoEsperado);
    const resultado = await generarPdfExamen(paramsBase);

    expect(mockGenerarExamenIndividual).toHaveBeenCalledTimes(1);
    expect(mockGenerarExamenIndividual).toHaveBeenCalledWith(expect.objectContaining({ templateVersion: 3 }));
    expect(mockRegistrarAdopcion).toHaveBeenCalledWith('pdf', '/modulo_generacion_pdf/generarPdfExamen', 'v2');
    expect(resultado).toBe(resultadoEsperado);
  });

  it('propaga error si falla generación TV3', async () => {
    mockGenerarExamenIndividual.mockRejectedValue(new Error('tv3 failed'));

    await expect(generarPdfExamen(paramsBase)).rejects.toThrow('tv3 failed');
    expect(mockRegistrarAdopcion).not.toHaveBeenCalled();
  });
});
