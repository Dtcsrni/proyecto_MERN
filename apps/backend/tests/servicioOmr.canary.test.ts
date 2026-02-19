/**
 * servicioOmr.v2.test
 *
 * Cobertura de fachada OMR v2-only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEjecutarPipelineOmr,
  mockRegistrarAdopcion
} = vi.hoisted(() => ({
  mockEjecutarPipelineOmr: vi.fn(),
  mockRegistrarAdopcion: vi.fn()
}));

vi.mock('../src/modulos/modulo_escaneo_omr/omr/pipeline/ejecutorPipelineOmr', () => ({
  ejecutarPipelineOmr: mockEjecutarPipelineOmr
}));

vi.mock('../src/compartido/observabilidad/metricsAdopcion', () => ({
  registrarAdopcion: mockRegistrarAdopcion
}));

import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';

describe('servicioOmr (v2-only)', () => {
  const argsBase = {
    imagenBase64: 'data:image/png;base64,AAAA',
    mapaPagina: { numeroPagina: 1, preguntas: [] } as never,
    qrEsperado: ['EXAMEN:FOL-1:P1'],
    margenMm: 10,
    debugInfo: { origen: 'test' } as never,
    requestId: 'req-omr-1'
  };

  const resultadoOmr = {
    respuestasDetectadas: [],
    advertencias: [],
    calidadPagina: 0.7,
    estadoAnalisis: 'ok',
    motivosRevision: [],
    templateVersionDetectada: 3,
    confianzaPromedioPagina: 0.9,
    ratioAmbiguas: 0,
    engineVersion: 'omr-v3-cv',
    engineUsed: 'legacy',
    geomQuality: 0.8,
    photoQuality: 0.8,
    decisionPolicy: 'conservadora_v1'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('usa pipeline v2 y retorna resultado', async () => {
    const pipelineResult = {
      requestId: 'req-omr-1',
      exito: true,
      resultado: { ...resultadoOmr, templateVersionDetectada: 3 },
      etapas: []
    };

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
    expect(mockRegistrarAdopcion).toHaveBeenCalledWith('omr', '/modulo_escaneo_omr/analizarOmr', 'v2');
    expect(resultado).toEqual(pipelineResult.resultado);
  });

  it('propaga error cuando pipeline v2 falla', async () => {
    mockEjecutarPipelineOmr.mockRejectedValue(new Error('pipeline failed'));

    await expect(analizarOmr(
      argsBase.imagenBase64,
      argsBase.mapaPagina,
      argsBase.qrEsperado,
      argsBase.margenMm,
      argsBase.debugInfo,
      argsBase.requestId
    )).rejects.toThrow('pipeline failed');

    expect(mockEjecutarPipelineOmr).toHaveBeenCalledTimes(1);
    expect(mockRegistrarAdopcion).not.toHaveBeenCalledWith('omr', '/modulo_escaneo_omr/analizarOmr', 'v1');
  });
});
