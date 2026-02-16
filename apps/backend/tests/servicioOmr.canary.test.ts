/**
 * servicioOmr.canary.test
 *
 * Cobertura de canary/fallback para la fachada OMR.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEjecutarPipelineOmr,
  mockAnalizarOmrLegacy,
  mockDecidirVersionCanary,
  mockRegistrarAdopcion
} = vi.hoisted(() => ({
  mockEjecutarPipelineOmr: vi.fn(),
  mockAnalizarOmrLegacy: vi.fn(),
  mockDecidirVersionCanary: vi.fn(),
  mockRegistrarAdopcion: vi.fn()
}));

vi.mock('../src/modulos/modulo_escaneo_omr/omr/pipeline/ejecutorPipelineOmr', () => ({
  ejecutarPipelineOmr: mockEjecutarPipelineOmr
}));

vi.mock('../src/modulos/modulo_escaneo_omr/servicioOmrLegacy', () => ({
  analizarOmr: mockAnalizarOmrLegacy,
  leerQrDesdeImagen: vi.fn(),
  ResultadoOmr: undefined
}));

vi.mock('../src/compartido/observabilidad/rolloutCanary', () => ({
  decidirVersionCanary: mockDecidirVersionCanary
}));

vi.mock('../src/compartido/observabilidad/metricsAdopcion', () => ({
  registrarAdopcion: mockRegistrarAdopcion
}));

import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';

describe('servicioOmr (canary)', () => {
  const argsBase = {
    imagenBase64: 'data:image/png;base64,AAAA',
    mapaPagina: { numeroPagina: 1, preguntas: [] } as never,
    qrEsperado: ['EXAMEN:FOL-1:P1'],
    margenMm: 10,
    debugInfo: { origen: 'test' } as never,
    requestId: 'req-omr-1'
  };

  const legacyResult = {
    respuestasDetectadas: [],
    advertencias: [],
    calidadPagina: 0.7,
    estadoAnalisis: 'ok',
    motivosRevision: [],
    templateVersionDetectada: 1,
    confianzaPromedioPagina: 0.9,
    ratioAmbiguas: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa legacy cuando canary decide v1', async () => {
    mockDecidirVersionCanary.mockReturnValue('v1');
    mockAnalizarOmrLegacy.mockResolvedValue(legacyResult);

    const resultado = await analizarOmr(
      argsBase.imagenBase64,
      argsBase.mapaPagina,
      argsBase.qrEsperado,
      argsBase.margenMm,
      argsBase.debugInfo,
      argsBase.requestId
    );

    expect(mockDecidirVersionCanary).toHaveBeenCalledWith('omr', expect.any(String));
    expect(mockAnalizarOmrLegacy).toHaveBeenCalledTimes(1);
    expect(mockEjecutarPipelineOmr).not.toHaveBeenCalled();
    expect(mockRegistrarAdopcion).toHaveBeenCalledWith('omr', '/modulo_escaneo_omr/analizarOmr', 'v1');
    expect(resultado).toBe(legacyResult);
  });

  it('usa v2 cuando canary decide v2 y el pipeline responde', async () => {
    const pipelineResult = {
      requestId: 'req-omr-1',
      exito: true,
      resultado: { ...legacyResult, templateVersionDetectada: 2 },
      etapas: []
    };

    mockDecidirVersionCanary.mockReturnValue('v2');
    mockEjecutarPipelineOmr.mockResolvedValue(pipelineResult);

    const resultado = await analizarOmr(
      argsBase.imagenBase64,
      argsBase.mapaPagina,
      argsBase.qrEsperado,
      argsBase.margenMm,
      argsBase.debugInfo,
      argsBase.requestId
    );

    expect(mockEjecutarPipelineOmr).toHaveBeenCalledTimes(1);
    expect(mockAnalizarOmrLegacy).not.toHaveBeenCalled();
    expect(mockRegistrarAdopcion).toHaveBeenCalledWith('omr', '/modulo_escaneo_omr/analizarOmr', 'v2');
    expect(resultado).toEqual(pipelineResult.resultado);
  });

  it('hace fallback a legacy cuando v2 falla', async () => {
    mockDecidirVersionCanary.mockReturnValue('v2');
    mockEjecutarPipelineOmr.mockRejectedValue(new Error('pipeline failed'));
    mockAnalizarOmrLegacy.mockResolvedValue(legacyResult);

    const resultado = await analizarOmr(
      argsBase.imagenBase64,
      argsBase.mapaPagina,
      argsBase.qrEsperado,
      argsBase.margenMm,
      argsBase.debugInfo,
      argsBase.requestId
    );

    expect(mockEjecutarPipelineOmr).toHaveBeenCalledTimes(1);
    expect(mockAnalizarOmrLegacy).toHaveBeenCalledTimes(1);
    expect(mockRegistrarAdopcion).toHaveBeenCalledWith('omr', '/modulo_escaneo_omr/analizarOmr', 'v1');
    expect(resultado).toBe(legacyResult);
  });
});
