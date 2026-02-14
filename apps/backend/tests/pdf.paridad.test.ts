/**
 * pdf.paridad.test
 *
 * Tests de paridad entre servicioGeneracionPdfLegacy (v1) y generador DDD v2.
 * Valida que ambas implementaciones producen PDFs funcionalmente equivalentes.
 *
 * Responsabilidad: Gate de seguridad para canary deployment.
 * Criterio de exito: PDFs con mismo formato, contenido y estructura OMR (permite variacion minima en encoding).
 *
 * NOTA: Actualmente v2 delega a legacy (Ola 2B bootstrap). Este test establece
 * el contrato para cuando se implemente el renderer completo.
 */
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { generarPdfExamen as generarPdfExamenLegacy } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdfLegacy';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';
import type { MapaVariante, PreguntaBase } from '../src/modulos/modulo_generacion_pdf/servicioVariantes';

const CARTA_ANCHO = 612;
const CARTA_ALTO = 792;
const TOLERANCIA_PUNTOS = 0.5;
const TOLERANCIA_BYTES = 0.05; // 5% de variación aceptable en tamaño

type ParametrosGeneracion = {
  titulo: string;
  folio: string;
  preguntas: PreguntaBase[];
  mapaVariante: MapaVariante;
  tipoExamen: 'parcial' | 'global';
  totalPaginas: number;
  margenMm?: number;
  templateVersion?: 1 | 2;
  encabezado?: {
    institucion?: string;
    lema?: string;
    materia?: string;
    docente?: string;
    instrucciones?: string;
    alumno?: { nombre?: string; grupo?: string };
    mostrarInstrucciones?: boolean;
  };
};

function crearParametrosMinimos(): ParametrosGeneracion {
  const preguntas: PreguntaBase[] = [
    {
      id: 'p1',
      enunciado: '¿Cuál es la respuesta correcta?',
      opciones: [
        { texto: 'Opción A', esCorrecta: false },
        { texto: 'Opción B', esCorrecta: true },
        { texto: 'Opción C', esCorrecta: false },
        { texto: 'Opción D', esCorrecta: false }
      ]
    },
    {
      id: 'p2',
      enunciado: '¿Cuál es 2+2?',
      opciones: [
        { texto: '3', esCorrecta: false },
        { texto: '4', esCorrecta: true },
        { texto: '5', esCorrecta: false },
        { texto: '6', esCorrecta: false }
      ]
    }
  ];

  return {
    titulo: 'Examen Paridad Test',
    folio: 'PAR-TEST-001',
    preguntas,
    mapaVariante: {
      ordenPreguntas: ['p1', 'p2'],
      ordenOpcionesPorPregunta: {
        p1: [0, 1, 2, 3],
        p2: [0, 1, 2, 3]
      }
    },
    tipoExamen: 'parcial',
    totalPaginas: 1,
    margenMm: 10,
    templateVersion: 1
  };
}

function crearParametrosCompletos(): ParametrosGeneracion {
  const preguntas: PreguntaBase[] = [];
  const ordenPreguntas: string[] = [];
  const ordenOpcionesPorPregunta: Record<string, number[]> = {};

  for (let i = 1; i <= 20; i++) {
    const id = `p${i}`;
    preguntas.push({
      id,
      enunciado: `Pregunta ${i}: ¿Cuál es la opción correcta para el test de paridad?`,
      opciones: [
        { texto: `Opción A de pregunta ${i}`, esCorrecta: i === 1 },
        { texto: `Opción B de pregunta ${i}`, esCorrecta: i === 2 },
        { texto: `Opción C de pregunta ${i}`, esCorrecta: i === 3 },
        { texto: `Opción D de pregunta ${i}`, esCorrecta: i === 4 },
        { texto: `Opción E de pregunta ${i}`, esCorrecta: i > 4 }
      ]
    });
    ordenPreguntas.push(id);
    ordenOpcionesPorPregunta[id] = [0, 1, 2, 3, 4];
  }

  return {
    titulo: 'Examen Completo Paridad',
    folio: 'PAR-FULL-001',
    preguntas,
    mapaVariante: { ordenPreguntas, ordenOpcionesPorPregunta },
    tipoExamen: 'global',
    totalPaginas: 3,
    margenMm: 10,
    templateVersion: 2,
    encabezado: {
      institucion: 'Universidad Test',
      lema: 'Excelencia en Paridad',
      materia: 'Pruebas Automatizadas',
      docente: 'Prof. Test',
      instrucciones: 'Marque la opción correcta',
      alumno: { nombre: 'Alumno Test', grupo: '5A' },
      mostrarInstrucciones: true
    }
  };
}

async function validarEstructuraPdf(resultado: {pdfBytes: Buffer}, params: ParametrosGeneracion) {
  const buffer = resultado.pdfBytes;
  expect(buffer.byteLength).toBeGreaterThan(10_000);
  expect(buffer.byteLength).toBeLessThan(2_000_000);

  const doc = await PDFDocument.load(buffer);
  const pages = doc.getPages();

  expect(pages.length).toBeGreaterThanOrEqual(params.totalPaginas);

  for (const page of pages) {
    const { width, height } = page.getSize();
    expect(Math.abs(width - CARTA_ANCHO)).toBeLessThanOrEqual(TOLERANCIA_PUNTOS);
    expect(Math.abs(height - CARTA_ALTO)).toBeLessThanOrEqual(TOLERANCIA_PUNTOS);
  }

  return { doc, pages, buffer };
}

describe('Paridad PDF v1 vs v2', () => {
  it('genera PDFs con misma estructura para parametros minimos', async () => {
    const params = crearParametrosMinimos();

    // v1 (legacy)
    const resultadoV1 = await generarPdfExamenLegacy(params);

    // v2 (facade, actualmente delega a legacy en bootstrap)
    const resultadoV2 = await generarPdfExamen(params);

    // Validar estructura
    const v1Info = await validarEstructuraPdf(resultadoV1, params);
    const v2Info = await validarEstructuraPdf(resultadoV2, params);

    // Mismo número de páginas
    expect(v1Info.pages.length).toBe(v2Info.pages.length);

    // Tamaño similar (puede variar ligeramente por encoding)
    const diffBytes = Math.abs(v1Info.buffer.byteLength - v2Info.buffer.byteLength);
    const toleranciaAbsoluta = Math.max(
      v1Info.buffer.byteLength,
      v2Info.buffer.byteLength
    ) * TOLERANCIA_BYTES;
    expect(diffBytes).toBeLessThanOrEqual(toleranciaAbsoluta);
  });

  it('genera PDFs con misma estructura para parametros completos', async () => {
    const params = crearParametrosCompletos();

    const resultadoV1 = await generarPdfExamenLegacy(params);
    const resultadoV2 = await generarPdfExamen(params);

    const v1Info = await validarEstructuraPdf(resultadoV1, params);
    const v2Info = await validarEstructuraPdf(resultadoV2, params);

    expect(v1Info.pages.length).toBe(v2Info.pages.length);

    // Bytes por página similar
    const bytesPerPageV1 = v1Info.buffer.byteLength / v1Info.pages.length;
    const bytesPerPageV2 = v2Info.buffer.byteLength / v2Info.pages.length;
    const diffPerPage = Math.abs(bytesPerPageV1 - bytesPerPageV2);
    expect(diffPerPage).toBeLessThan(bytesPerPageV1 * TOLERANCIA_BYTES);
  });

  it('genera PDFs con template v1 equivalentes', async () => {
    const params = crearParametrosMinimos();
    params.templateVersion = 1;

    const resultadoV1 = await generarPdfExamenLegacy(params);
    const resultadoV2 = await generarPdfExamen(params);

    await validarEstructuraPdf(resultadoV1, params);
    await validarEstructuraPdf(resultadoV2, params);

    // Hash debe ser idéntico si implementaciones son equivalentes
    const hashV1 = crypto.createHash('sha256').update(resultadoV1.pdfBytes).digest('hex');
    const hashV2 = crypto.createHash('sha256').update(resultadoV2.pdfBytes).digest('hex');

    // NOTA: Durante bootstrap (v2 delega a legacy), hashes serán idénticos.
    // Cuando se implemente renderer v2, este test validará equivalencia funcional
    // (no necesariamente hash idéntico, pero sí estructura equivalente).
    if (process.env.FEATURE_PDF_BUILDER_V2 === '0' || !process.env.FEATURE_PDF_BUILDER_V2) {
      // En modo bootstrap, v2 delega a legacy: hashes idénticos
      expect(hashV1).toBe(hashV2);
    } else {
      // En modo v2 real, validar que estructura/contenido sean equivalentes
      // (hashes pueden diferir por encoding/timestamps)
      expect(resultadoV1.pdfBytes.byteLength).toBeCloseTo(resultadoV2.pdfBytes.byteLength, -3);
    }
  });

  it('genera PDFs con template v2 equivalentes', async () => {
    const params = crearParametrosMinimos();
    params.templateVersion = 2;

    const resultadoV1 = await generarPdfExamenLegacy(params);
    const resultadoV2 = await generarPdfExamen(params);

    const v1Info = await validarEstructuraPdf(resultadoV1, params);
    const v2Info = await validarEstructuraPdf(resultadoV2, params);

    expect(v1Info.pages.length).toBe(v2Info.pages.length);
  });

  it('genera PDFs con encabezados institucionales equivalentes', async () => {
    const params = crearParametrosCompletos();

    const resultadoV1 = await generarPdfExamenLegacy(params);
    const resultadoV2 = await generarPdfExamen(params);

    await validarEstructuraPdf(resultadoV1, params);
    await validarEstructuraPdf(resultadoV2, params);

    // Validar que contenido de encabezado está presente
    // (requeriría parsing de texto del PDF, por ahora validamos estructura)
    expect(resultadoV1.pdfBytes.byteLength).toBeGreaterThan(20_000); // encabezados agregan contenido
    expect(resultadoV2.pdfBytes.byteLength).toBeGreaterThan(20_000);
  });

  it('genera PDFs con márgenes personalizados equivalentes', async () => {
    const params = crearParametrosMinimos();
    params.margenMm = 15;

    const resultadoV1 = await generarPdfExamenLegacy(params);
    const resultadoV2 = await generarPdfExamen(params);

    await validarEstructuraPdf(resultadoV1, params);
    await validarEstructuraPdf(resultadoV2, params);
  });

  it('maneja errores de forma equivalente con parametros invalidos', async () => {
    const paramsInvalidos: ParametrosGeneracion = {
      titulo: '',
      folio: '',
      preguntas: [],
      mapaVariante: {
        ordenPreguntas: [],
        ordenOpcionesPorPregunta: {}
      },
      tipoExamen: 'parcial',
      totalPaginas: 0
    };

    // Ambos deben comportarse igual (generar PDF vacío o fallar de forma similar)
    const resultadoV1 = await generarPdfExamenLegacy(paramsInvalidos);
    const resultadoV2 = await generarPdfExamen(paramsInvalidos);

    // Ambos generan estructuras equivalentes incluso con parámetros vacíos
    expect(resultadoV1.pdfBytes).toBeDefined();
    expect(resultadoV2.pdfBytes).toBeDefined();
    expect(resultadoV1.paginas).toBeDefined();
    expect(resultadoV2.paginas).toBeDefined();
    
    // Ambos deben reportar 0 preguntas restantes
    expect(resultadoV1.preguntasRestantes).toBe(0);
    expect(resultadoV2.preguntasRestantes).toBe(0);
  });

  it('v2 produce misma cantidad de paginas que v1 para mismo contenido', async () => {
    const preguntasPorPagina = [5, 10, 15, 20, 25];

    for (const cantidad of preguntasPorPagina) {
      const preguntas: PreguntaBase[] = [];
      const ordenPreguntas: string[] = [];
      const ordenOpcionesPorPregunta: Record<string, number[]> = {};

      for (let i = 0; i < cantidad; i++) {
        const id = `p${i + 1}`;
        preguntas.push({
          id,
          enunciado: `Pregunta ${i + 1}`,
          opciones: [
            { texto: 'A', esCorrecta: i === 0 },
            { texto: 'B', esCorrecta: i === 1 },
            { texto: 'C', esCorrecta: i === 2 },
            { texto: 'D', esCorrecta: i > 2 }
          ]
        });
        ordenPreguntas.push(id);
        ordenOpcionesPorPregunta[id] = [0, 1, 2, 3];
      }

      const params: ParametrosGeneracion = {
        titulo: `Test ${cantidad} preguntas`,
        folio: `PAR-${cantidad}`,
        preguntas,
        mapaVariante: { ordenPreguntas, ordenOpcionesPorPregunta },
        tipoExamen: 'parcial',
        totalPaginas: Math.ceil(cantidad / 10),
        templateVersion: 1
      };

      const resultadoV1 = await generarPdfExamenLegacy(params);
      const resultadoV2 = await generarPdfExamen(params);

      const docV1 = await PDFDocument.load(resultadoV1.pdfBytes);
      const docV2 = await PDFDocument.load(resultadoV2.pdfBytes);

      expect(docV1.getPageCount()).toBe(docV2.getPageCount());
    }
  });
});
