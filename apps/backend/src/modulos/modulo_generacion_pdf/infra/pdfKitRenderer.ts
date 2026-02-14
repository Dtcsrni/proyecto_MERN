/**
 * Stub para el renderer PDFKit (infraestructura).
 * 
 * TODO Ola 2B: Implementar renderer completo que encapsule toda la logica
 * de PDFKit actualmente en servicioGeneracionPdfLegacy.ts:
 * 
 * - Embedding de fuentes (Helvetica, HelveticaBold, Courier)
 * - Rendering de QR codes
 * - Dibujo de marcas de registro y fiduciales
 * - Layout de encabezados institucionales
 * - Rendering de preguntas con texto mixto (normal + codigo markdown)
 * - Rendering de burbujas OMR con posiciones exactas
 * - Generacion de mapa OMR para escaneo posterior
 * 
 * Este stub existe para estructurar el modulo durante Ola 2B.
 */
import type { ExamenPdf } from '../domain/examenPdf';
import type { PerfilPlantillaOmr, PerfilLayoutImpresion, ResultadoGeneracionPdf } from '../shared/tiposPdf';

export class PdfKitRenderer {
  constructor(
    private readonly perfilOmr: PerfilPlantillaOmr,
    private readonly perfilLayout: PerfilLayoutImpresion
  ) {}

  async generarPdf(examen: ExamenPdf): Promise<ResultadoGeneracionPdf> {
    // TODO: Implementar rendering completo
    void examen;
    void this.perfilOmr;
    void this.perfilLayout;
    throw new Error('PdfKitRenderer no implementado aun (Ola 2B pendiente)');
  }
}
