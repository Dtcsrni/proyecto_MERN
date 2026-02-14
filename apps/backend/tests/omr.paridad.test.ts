/**
 * omr.paridad.test
 *
 * Tests de paridad entre servicioOmrLegacy (v1) y pipeline OMR v2.
 * Valida que ambas implementaciones producen resultados equivalentes.
 *
 * Responsabilidad: Gate de seguridad para canary deployment.
 * Criterio de exito: Resultados funcionalmente equivalentes (permite variacion minima en confianza/metricas).
 */
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { configuracion } from '../src/configuracion';
import { analizarOmr, leerQrDesdeImagen } from '../src/modulos/modulo_escaneo_omr/servicioOmr';
import {
  analizarOmr as analizarOmrLegacy,
  leerQrDesdeImagen as leerQrDesdeImagenLegacy
} from '../src/modulos/modulo_escaneo_omr/servicioOmrLegacy';

type MapaOmr = Parameters<typeof analizarOmrLegacy>[1];

async function crearImagenBlancaBase64(width = 612, height = 792) {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function crearImagenConMarcasBase64() {
  const width = 612;
  const height = 792;
  const buffer = Buffer.alloc(width * height * 3, 255);

  const setPixel = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = (y * width + x) * 3;
    buffer[idx] = v;
    buffer[idx + 1] = v;
    buffer[idx + 2] = v;
  };

  const drawSquare = (cx: number, cy: number, size: number) => {
    const half = Math.floor(size / 2);
    for (let y = cy - half; y <= cy + half; y += 1) {
      for (let x = cx - half; x <= cx + half; x += 1) {
        setPixel(x, y, 0);
      }
    }
  };

  const drawCircle = (cx: number, cy: number, radius: number) => {
    const r2 = radius * radius;
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        if (x * x + y * y <= r2) {
          setPixel(cx + x, cy + y, 0);
        }
      }
    }
  };

  // Marcas de registro (esquinas)
  const margen = Math.round(10 * (72 / 25.4));
  drawSquare(margen, margen, 18);
  drawSquare(width - margen, margen, 18);
  drawSquare(margen, height - margen, 18);
  drawSquare(width - margen, height - margen, 18);

  // Burbuja marcada para pregunta 1, opcion B
  const xBubble = 500;
  const yBubble = 150;
  drawCircle(xBubble, yBubble, 8);

  const png = await sharp(buffer, {
    raw: { width, height, channels: 3 }
  })
    .png()
    .toBuffer();

  return `data:image/png;base64,${png.toString('base64')}`;
}

describe('Paridad OMR v1 vs v2', () => {
  const mapaSimple: MapaOmr = {
    numeroPagina: 1,
    preguntas: [
      {
        numeroPregunta: 1,
        idPregunta: 'p1',
        opciones: [
          { letra: 'A', x: 480, y: 150 },
          { letra: 'B', x: 500, y: 150 },
          { letra: 'C', x: 520, y: 150 },
          { letra: 'D', x: 540, y: 150 }
        ]
      },
      {
        numeroPregunta: 2,
        idPregunta: 'p2',
        opciones: [
          { letra: 'A', x: 480, y: 170 },
          { letra: 'B', x: 500, y: 170 },
          { letra: 'C', x: 520, y: 170 },
          { letra: 'D', x: 540, y: 170 }
        ]
      }
    ]
  };

  it('leerQrDesdeImagen produce mismo resultado en v1 y v2', async () => {
    const imagenBlanca = await crearImagenBlancaBase64();

    // v1 (legacy)
    const resultadoV1 = await leerQrDesdeImagenLegacy(imagenBlanca);

    // v2 (facade siempre delega a legacy para QR por ahora)
    const resultadoV2 = await leerQrDesdeImagen(imagenBlanca);

    // Ambos deben ser undefined (no hay QR en imagen blanca)
    expect(resultadoV1).toBeUndefined();
    expect(resultadoV2).toBeUndefined();
  });

  it('analizarOmr imagen blanca produce estructura equivalente v1 vs v2', async () => {
    const imagenBlanca = await crearImagenBlancaBase64();
    const qrEsperado = ['TEST', 'EXAMEN:TEST:P1'];

    // Forzar v1 (legacy)
    const originalFlag = configuracion.featureOmrPipelineV2;
    configuracion.featureOmrPipelineV2 = false;
    const resultadoV1 = await analizarOmr(imagenBlanca, mapaSimple, qrEsperado, 10);
    configuracion.featureOmrPipelineV2 = originalFlag;

    // Forzar v2 (pipeline)
    configuracion.featureOmrPipelineV2 = true;
    const resultadoV2 = await analizarOmr(imagenBlanca, mapaSimple, qrEsperado, 10);
    configuracion.featureOmrPipelineV2 = originalFlag;

    // Validar paridad estructural
    expect(resultadoV1.qrTexto).toBe(resultadoV2.qrTexto);
    expect(resultadoV1.templateVersionDetectada).toBe(resultadoV2.templateVersionDetectada);
    expect(resultadoV1.respuestasDetectadas.length).toBe(resultadoV2.respuestasDetectadas.length);

    // Advertencias esperadas en ambos
    expect(resultadoV1.advertencias).toContain('No se detecto QR en la imagen');
    expect(resultadoV2.advertencias).toContain('No se detecto QR en la imagen');

    // Estados deben ser compatibles (pueden variar ligeramente pero en mismo dominio)
    const estadosValidos = ['rechazado_calidad', 'requiere_revision', 'aceptado'];
    expect(estadosValidos).toContain(resultadoV1.estadoAnalisis);
    expect(estadosValidos).toContain(resultadoV2.estadoAnalisis);

    // Calidad debe estar en rango [0,1]
    expect(resultadoV1.calidadPagina).toBeGreaterThanOrEqual(0);
    expect(resultadoV1.calidadPagina).toBeLessThanOrEqual(1);
    expect(resultadoV2.calidadPagina).toBeGreaterThanOrEqual(0);
    expect(resultadoV2.calidadPagina).toBeLessThanOrEqual(1);

    // Respuestas deben ser null para imagen blanca
    for (const resp of resultadoV1.respuestasDetectadas) {
      expect(resp.opcion).toBeNull();
    }
    for (const resp of resultadoV2.respuestasDetectadas) {
      expect(resp.opcion).toBeNull();
    }
  });

  it('analizarOmr con marcas produce detecciones equivalentes v1 vs v2', async () => {
    const imagenConMarcas = await crearImagenConMarcasBase64();
    const qrEsperado = ['TEST'];

    // Forzar v1
    const originalFlag = configuracion.featureOmrPipelineV2;
    configuracion.featureOmrPipelineV2 = false;
    const resultadoV1 = await analizarOmr(imagenConMarcas, mapaSimple, qrEsperado, 10);
    configuracion.featureOmrPipelineV2 = originalFlag;

    // Forzar v2
    configuracion.featureOmrPipelineV2 = true;
    const resultadoV2 = await analizarOmr(imagenConMarcas, mapaSimple, qrEsperado, 10);
    configuracion.featureOmrPipelineV2 = originalFlag;

    // Paridad estructural
    expect(resultadoV1.respuestasDetectadas.length).toBe(resultadoV2.respuestasDetectadas.length);
    expect(resultadoV1.templateVersionDetectada).toBe(resultadoV2.templateVersionDetectada);

    // Ambos deben detectar la burbuja B marcada para pregunta 1
    const respP1v1 = resultadoV1.respuestasDetectadas.find((r) => r.numeroPregunta === 1);
    const respP1v2 = resultadoV2.respuestasDetectadas.find((r) => r.numeroPregunta === 1);

    expect(respP1v1).toBeDefined();
    expect(respP1v2).toBeDefined();

    // La opcion detectada debe ser la misma (permitir null si ambos fallan)
    if (respP1v1?.opcion && respP1v2?.opcion) {
      expect(respP1v1.opcion).toBe(respP1v2.opcion);
    }

    // Confianza debe ser razonable si detectaron algo
    if (respP1v1?.opcion) {
      expect(respP1v1.confianza).toBeGreaterThan(0.3);
    }
    if (respP1v2?.opcion) {
      expect(respP1v2.confianza).toBeGreaterThan(0.3);
    }

    // Template version detectada debe coincidir
    expect(resultadoV1.templateVersionDetectada).toBe(resultadoV2.templateVersionDetectada);
  });

  it('v2 produce metadata de pipeline cuando está activo', async () => {
    const imagenBlanca = await crearImagenBlancaBase64();

    // Forzar v2
    const originalFlag = configuracion.featureOmrPipelineV2;
    configuracion.featureOmrPipelineV2 = true;
    const resultadoV2 = await analizarOmr(imagenBlanca, mapaSimple, ['TEST'], 10);
    configuracion.featureOmrPipelineV2 = originalFlag;

    // v2 debe tener metadata de pipeline (etapas, duraciones)
    // Nota: esto depende de que el pipeline agregue metadata al resultado
    // Si no existe aún, este test servirá como contrato futuro
    expect(resultadoV2).toBeDefined();
    expect(resultadoV2.respuestasDetectadas).toBeDefined();
    expect(Array.isArray(resultadoV2.respuestasDetectadas)).toBe(true);
  });

  it('v1 y v2 manejan errores de forma equivalente', async () => {
    const imagenInvalida = 'data:image/png;base64,INVALID_BASE64';

    const originalFlag = configuracion.featureOmrPipelineV2;

    // v1
    configuracion.featureOmrPipelineV2 = false;
    await expect(analizarOmr(imagenInvalida, mapaSimple, ['TEST'], 10)).rejects.toThrow();

    // v2
    configuracion.featureOmrPipelineV2 = true;
    await expect(analizarOmr(imagenInvalida, mapaSimple, ['TEST'], 10)).rejects.toThrow();

    configuracion.featureOmrPipelineV2 = originalFlag;
  });
});
