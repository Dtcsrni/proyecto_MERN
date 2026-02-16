/**
 * servicioGeneracionPdf.canary.test
 *
 * Cobertura de canary/fallback para la fachada PDF.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerarExamenIndividual,
  mockGenerarPdfExamenLegacy,
  mockDecidirVersionCanary,
  mockRegistrarAdopcion
} = vi.hoisted(() => ({
  mockGenerarExamenIndividual: vi.fn(),
  mockGenerarPdfExamenLegacy: vi.fn(),
  mockDecidirVersionCanary: vi.fn(),
  mockRegistrarAdopcion: vi.fn()
}));

vi.mock('../src/modulos/modulo_generacion_pdf/application/usecases/generarExamenIndividual', () => ({
  generarExamenIndividual: mockGenerarExamenIndividual
}));

vi.mock('../src/modulos/modulo_generacion_pdf/servicioGeneracionPdfLegacy', () => ({
  generarPdfExamen: mockGenerarPdfExamenLegacy
}));

vi.mock('../src/compartido/observabilidad/rolloutCanary', () => ({
  decidirVersionCanary: mockDecidirVersionCanary
}));

vi.mock('../src/compartido/observabilidad/metricsAdopcion', () => ({
  registrarAdopcion: mockRegistrarAdopcion
}));

import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';

describe('servicioGeneracionPdf (canary)', () => {
  const paramsBase = {
    titulo: 'Examen canary',
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
    templateVersion: 1 as const
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa legacy cuando canary decide v1', async () => {
    const legacyResult = {
      pdfBytes: Buffer.from('legacy'),
      paginas: [],
      metricasPaginas: [],
      mapaOmr: { paginas: [] },
      preguntasRestantes: 0
    };

    mockDecidirVersionCanary.mockReturnValue('v1');
    mockGenerarPdfExamenLegacy.mockResolvedValue(legacyResult);

    const resultado = await generarPdfExamen(paramsBase);

    expect(mockDecidirVersionCanary).toHaveBeenCalledWith('pdf', expect.any(String));
    expect(mockGenerarPdfExamenLegacy).toHaveBeenCalledTimes(1);
    expect(mockGenerarExamenIndividual).not.toHaveBeenCalled();
    expect(mockRegistrarAdopcion).toHaveBeenCalledWith('pdf', '/modulo_generacion_pdf/generarPdfExamen', 'v1');
    expect(resultado).toBe(legacyResult);
  });

  it('usa v2 cuando canary decide v2 y el use case responde', async () => {
    const v2Result = {
      pdfBytes: Buffer.from('v2'),
      paginas: [],
      metricasPaginas: [],
      mapaOmr: { paginas: [] },
      preguntasRestantes: 0
    };

    mockDecidirVersionCanary.mockReturnValue('v2');
    mockGenerarExamenIndividual.mockResolvedValue(v2Result);

    const resultado = await generarPdfExamen(paramsBase);

    expect(mockGenerarExamenIndividual).toHaveBeenCalledTimes(1);
    expect(mockGenerarPdfExamenLegacy).not.toHaveBeenCalled();
    expect(mockRegistrarAdopcion).toHaveBeenCalledWith('pdf', '/modulo_generacion_pdf/generarPdfExamen', 'v2');
    expect(resultado).toBe(v2Result);
  });

  it('hace fallback a legacy cuando v2 falla', async () => {
    const legacyResult = {
      pdfBytes: Buffer.from('legacy-after-error'),
      paginas: [],
      metricasPaginas: [],
      mapaOmr: { paginas: [] },
      preguntasRestantes: 0
    };

    mockDecidirVersionCanary.mockReturnValue('v2');
    mockGenerarExamenIndividual.mockRejectedValue(new Error('v2 failed'));
    mockGenerarPdfExamenLegacy.mockResolvedValue(legacyResult);

    const resultado = await generarPdfExamen(paramsBase);

    expect(mockGenerarExamenIndividual).toHaveBeenCalledTimes(1);
    expect(mockGenerarPdfExamenLegacy).toHaveBeenCalledTimes(1);
    expect(mockRegistrarAdopcion).toHaveBeenCalledWith('pdf', '/modulo_generacion_pdf/generarPdfExamen', 'v1');
    expect(resultado).toBe(legacyResult);
  });
});
