/**
 * pdfImpresionContrato
 *
 * Garantia contractual de PDF para impresion (Carta + nombre trazable).
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';
import { prepararEscenarioFlujo } from './_flujoDocenteHelper';

const TOLERANCIA_PUNTOS = 0.5;
const CARTA_ANCHO = 612;
const CARTA_ALTO = 792;

describe('contrato PDF impresion', () => {
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

  it('genera PDF carta trazable y eficiente para impresion', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'global', 'docente-pdf-contrato@prueba.test');

    const examenResp = await request(app)
      .get(`/api/examenes/generados/folio/${encodeURIComponent(escenario.folio)}`)
      .set(escenario.auth)
      .expect(200);
    const examen = examenResp.body.examen;
    expect(examen?.mapaOmr?.paginas?.length ?? 0).toBeGreaterThan(0);
    expect(Number(examen?.mapaOmr?.perfilLayout?.gridStepPt ?? 0)).toBeGreaterThan(0);
    expect(Number(examen?.mapaOmr?.perfilLayout?.gridStepPt ?? 99)).toBeLessThanOrEqual(6);
    expect(Number(examen?.mapaOmr?.perfilLayout?.bottomSafePt ?? 0)).toBeGreaterThanOrEqual(8);
    expect(Number(examen?.mapaOmr?.perfilLayout?.headerHeightFirst ?? 0)).toBeGreaterThan(20);
    for (const pagina of examen.mapaOmr.paginas as Array<{ qr?: { texto?: string } }>) {
      expect(String(pagina?.qr?.texto ?? '')).toContain(escenario.folio);
    }

    const pdfResp = await request(app)
      .get(`/api/examenes/generados/${encodeURIComponent(escenario.examenId)}/pdf`)
      .set(escenario.auth)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);

    const contentDisposition = String(pdfResp.headers['content-disposition'] ?? '');
    expect(contentDisposition).toContain('attachment; filename=');
    expect(contentDisposition).toMatch(/examen_.*folio-[A-Z0-9]+\.pdf/);

    const pdfBuffer = pdfResp.body as Buffer;
    // Umbral inferior robusto entre entornos: asegura contenido real sin acoplarse
    // a variaciones menores del encoder/fuentes entre SO.
    expect(pdfBuffer.byteLength).toBeGreaterThan(12_000);
    expect(pdfBuffer.byteLength).toBeLessThan(1_500_000);

    const doc = await PDFDocument.load(pdfBuffer);
    const pages = doc.getPages();
    expect(pages.length).toBeGreaterThan(0);
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      expect(Math.abs(width - CARTA_ANCHO)).toBeLessThanOrEqual(TOLERANCIA_PUNTOS);
      expect(Math.abs(height - CARTA_ALTO)).toBeLessThanOrEqual(TOLERANCIA_PUNTOS);
    });

    // Reglas minimas de impresion/tinta: peso por pagina contenido y no excesivo.
    const bytesPorPagina = Math.round(pdfBuffer.byteLength / Math.max(1, pages.length));
    expect(bytesPorPagina).toBeGreaterThan(10_000);
    expect(bytesPorPagina).toBeLessThan(500_000);

    const hashSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const reporte = {
      version: '1',
      ejecutadoEn: new Date().toISOString(),
      archivo: `${escenario.folio}.pdf`,
      contentDisposition,
      paginaTamanoCartaOk: true,
      qrFolioEnTodasLasPaginas: true,
      reglasTintaOk: true,
      hashSha256,
      bytes: pdfBuffer.byteLength,
      paginas: pages.length
    };
    const out = path.resolve(process.cwd(), 'reports/qa/latest/pdf-print.json');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, `${JSON.stringify(reporte, null, 2)}\n`, 'utf8');
  });
});
