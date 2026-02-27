import { describe, expect, it } from 'vitest';
import { ANCHO_CARTA, ALTO_CARTA } from '../src/modulos/modulo_generacion_pdf/shared/tiposPdf';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';
import type { MapaVariante, PreguntaBase } from '../src/modulos/modulo_generacion_pdf/servicioVariantes';

type Rect = { x: number; y: number; width: number; height: number };

function interseca(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function crearParametros(cantidadPreguntas = 24) {
  const preguntas: PreguntaBase[] = [];
  const ordenPreguntas: string[] = [];
  const ordenOpcionesPorPregunta: Record<string, number[]> = {};

  for (let i = 1; i <= cantidadPreguntas; i += 1) {
    const id = `p${i}`;
    preguntas.push({
      id,
      enunciado: `Pregunta corta ${i}: selecciona la opcion correcta.`,
      opciones: [
        { texto: 'Opcion A', esCorrecta: i % 5 === 1 },
        { texto: 'Opcion B', esCorrecta: i % 5 === 2 },
        { texto: 'Opcion C', esCorrecta: i % 5 === 3 },
        { texto: 'Opcion D', esCorrecta: i % 5 === 4 },
        { texto: 'Opcion E', esCorrecta: i % 5 === 0 }
      ]
    });
    ordenPreguntas.push(id);
    ordenOpcionesPorPregunta[id] = [0, 1, 2, 3, 4];
  }

  const mapaVariante: MapaVariante = { ordenPreguntas, ordenOpcionesPorPregunta };
  return {
    titulo: 'Primer Parcial',
    folio: 'LAYOUT-GUARD-001',
    preguntas,
    mapaVariante,
    tipoExamen: 'parcial' as const,
    totalPaginas: 3,
    margenMm: 10,
    templateVersion: 3 as const
  };
}

describe('pdf layout visual guard', () => {
  it('valida no solapes, cajas dentro de pagina y densidad 8-9 preguntas por pagina', async () => {
    const resultado = await generarPdfExamen(crearParametros(24));

    const conteoPorPagina = resultado.paginas.map((pagina) => {
      const del = Number(pagina.preguntasDel ?? 0);
      const al = Number(pagina.preguntasAl ?? 0);
      return del > 0 && al >= del ? al - del + 1 : 0;
    });

    for (const conteo of conteoPorPagina.filter((v) => v > 0)) {
      expect(conteo).toBeGreaterThanOrEqual(8);
      expect(conteo).toBeLessThanOrEqual(9);
    }

    for (const pagina of resultado.mapaOmr.paginas) {
      const dbg = pagina.layoutDebug;
      expect(dbg).toBeTruthy();
      const header = dbg?.header as Rect;
      const qr = dbg?.qr as Rect;

      expect(header.x).toBeGreaterThanOrEqual(0);
      expect(header.y).toBeGreaterThanOrEqual(0);
      expect(header.x + header.width).toBeLessThanOrEqual(ANCHO_CARTA);
      expect(header.y + header.height).toBeLessThanOrEqual(ALTO_CARTA);
      expect(qr.x).toBeGreaterThanOrEqual(0);
      expect(qr.y).toBeGreaterThanOrEqual(0);
      expect(qr.x + qr.width).toBeLessThanOrEqual(ANCHO_CARTA);
      expect(qr.y + qr.height).toBeLessThanOrEqual(ALTO_CARTA);

      if (pagina.numeroPagina === 1) {
        expect(interseca(header, qr)).toBe(true);
      }

      const bloquesHeader = Array.isArray(dbg?.headerTextBlocks) ? dbg!.headerTextBlocks : [];
      for (let i = 0; i < bloquesHeader.length; i += 1) {
        const a = bloquesHeader[i] as Rect;
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.x + a.width).toBeLessThanOrEqual(ANCHO_CARTA);
        expect(a.y + a.height).toBeLessThanOrEqual(ALTO_CARTA);
        for (let j = i + 1; j < bloquesHeader.length; j += 1) {
          const b = bloquesHeader[j] as Rect;
          expect(interseca(a, b)).toBe(false);
        }
      }

      const preguntas = Array.isArray(pagina.preguntas) ? pagina.preguntas : [];
      for (let i = 0; i < preguntas.length; i += 1) {
        const actual = preguntas[i];
        if (!actual.bboxPregunta) continue;
        const a = actual.bboxPregunta;
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.x + a.width).toBeLessThanOrEqual(ANCHO_CARTA);
        expect(a.y + a.height).toBeLessThanOrEqual(ALTO_CARTA);

        const omr = actual.cajaOmr;
        if (omr) {
          expect(interseca(a, omr)).toBe(true);
        }

        if (i > 0 && preguntas[i - 1]?.bboxPregunta) {
          const prev = preguntas[i - 1]!.bboxPregunta as Rect;
          expect(interseca(prev, a)).toBe(false);
        }
      }
    }
  });
});

