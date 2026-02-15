/**
 * PdfKitRenderer - Adaptador de infraestructura para renderizado PDF.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { ExamenPdf } from '../domain/examenPdf';
import { ALTO_CARTA, ANCHO_CARTA, MM_A_PUNTOS, type ResultadoGeneracionPdf } from '../shared/tiposPdf';
import type { PerfilPlantillaOmr, PerfilLayoutImpresion, PaginaOmr } from '../shared/tiposPdf';

function calcularChunkPreguntas(totalPreguntas: number, totalPaginas: number): number {
  return Math.max(1, Math.ceil(totalPreguntas / Math.max(1, totalPaginas)));
}

function construirMapaPaginaOmr(
  numeroPagina: number,
  qrTexto: string,
  preguntasPagina: ExamenPdf['preguntas'],
  preguntaInicial: number,
  perfilOmr: PerfilPlantillaOmr,
  margenPt: number
): PaginaOmr {
  const baseX = ANCHO_CARTA - margenPt - perfilOmr.cajaOmrAncho;
  const inicioY = ALTO_CARTA - 170;

  return {
    numeroPagina,
    qr: {
      texto: qrTexto,
      x: ANCHO_CARTA - margenPt - perfilOmr.qrSize,
      y: margenPt,
      size: perfilOmr.qrSize,
      padding: perfilOmr.qrPadding
    },
    marcasPagina: {
      tipo: perfilOmr.marcasEsquina,
      size: perfilOmr.marcaCuadradoSize,
      quietZone: perfilOmr.marcaCuadradoQuietZone,
      tl: { x: margenPt, y: margenPt },
      tr: { x: ANCHO_CARTA - margenPt, y: margenPt },
      bl: { x: margenPt, y: ALTO_CARTA - margenPt },
      br: { x: ANCHO_CARTA - margenPt, y: ALTO_CARTA - margenPt }
    },
    preguntas: preguntasPagina.map((pregunta, indicePregunta) => {
      const numeroPregunta = preguntaInicial + indicePregunta;
      const y = inicioY - indicePregunta * Math.max(22, perfilOmr.burbujaPasoY * 2.5);
      const opciones = pregunta.opciones.map((_, indiceOpcion) => ({
        letra: String.fromCharCode(65 + indiceOpcion),
        x: baseX + indiceOpcion * (perfilOmr.burbujaRadio * 3.2),
        y
      }));

      return {
        numeroPregunta,
        idPregunta: pregunta.id,
        opciones,
        cajaOmr: {
          x: baseX - 4,
          y: y - perfilOmr.burbujaRadio - 2,
          width: perfilOmr.cajaOmrAncho,
          height: Math.max(12, perfilOmr.burbujaRadio * 3)
        },
        perfilOmr: {
          radio: perfilOmr.burbujaRadio,
          pasoY: perfilOmr.burbujaPasoY,
          cajaAncho: perfilOmr.cajaOmrAncho
        },
        fiduciales: {
          leftTop: { x: margenPt + 10, y: margenPt + 10 },
          leftBottom: { x: margenPt + 10, y: ALTO_CARTA - margenPt - 10 },
          rightTop: { x: ANCHO_CARTA - margenPt - 10, y: margenPt + 10 },
          rightBottom: { x: ANCHO_CARTA - margenPt - 10, y: ALTO_CARTA - margenPt - 10 }
        }
      };
    })
  };
}

export class PdfKitRenderer {
  constructor(
    private readonly perfilOmr: PerfilPlantillaOmr,
    private readonly perfilLayout: PerfilLayoutImpresion
  ) {}

  async generarPdf(examen: ExamenPdf): Promise<ResultadoGeneracionPdf> {
    const documento = await PDFDocument.create();
    const fuenteRegular = await documento.embedFont(StandardFonts.Helvetica);
    const fuenteNegrita = await documento.embedFont(StandardFonts.HelveticaBold);

    const margenPt = examen.layout.margenMm * MM_A_PUNTOS;
    const totalPaginas = Math.max(1, examen.layout.totalPaginas);
    const preguntasPorPagina = calcularChunkPreguntas(examen.totalPreguntas, totalPaginas);

    const paginas: ResultadoGeneracionPdf['paginas'] = [];
    const metricasPaginas: ResultadoGeneracionPdf['metricasPaginas'] = [];
    const mapaPaginas: PaginaOmr[] = [];

    let indicePregunta = 0;

    for (let numeroPagina = 1; numeroPagina <= totalPaginas; numeroPagina += 1) {
      const pagina = documento.addPage([ANCHO_CARTA, ALTO_CARTA]);

      pagina.drawText(examen.titulo || 'Examen', {
        x: margenPt,
        y: ALTO_CARTA - margenPt - 20,
        size: 14,
        font: fuenteNegrita
      });

      pagina.drawText(`Folio: ${examen.folioNormalizado}`, {
        x: margenPt,
        y: ALTO_CARTA - margenPt - 40,
        size: 10,
        font: fuenteRegular
      });

      pagina.drawText(`Página ${numeroPagina}/${totalPaginas}`, {
        x: ANCHO_CARTA - margenPt - 90,
        y: ALTO_CARTA - margenPt - 20,
        size: 9,
        font: fuenteRegular
      });

      const inicio = indicePregunta;
      const fin = Math.min(examen.totalPreguntas, indicePregunta + preguntasPorPagina);
      const preguntasPagina = examen.preguntas.slice(inicio, fin);

      let cursorY = ALTO_CARTA - margenPt - 80;
      for (const pregunta of preguntasPagina) {
        pagina.drawText(`${indicePregunta + 1}. ${pregunta.enunciado}`, {
          x: margenPt,
          y: cursorY,
          size: 10,
          font: fuenteRegular
        });
        cursorY -= 16;

        const opcionesCompactas = pregunta.opciones
          .map((opcion, indice) => `${String.fromCharCode(65 + indice)}) ${opcion.texto}`)
          .join('    ');

        pagina.drawText(opcionesCompactas, {
          x: margenPt + 10,
          y: cursorY,
          size: 8,
          font: fuenteRegular
        });
        cursorY -= 20;
        indicePregunta += 1;
      }

      const preguntasDel = preguntasPagina.length > 0 ? inicio + 1 : 0;
      const preguntasAl = preguntasPagina.length > 0 ? inicio + preguntasPagina.length : 0;
      const qrTexto = examen.generarTextoQrPagina(numeroPagina);

      paginas.push({ numero: numeroPagina, qrTexto, preguntasDel, preguntasAl });
      metricasPaginas.push({
        numero: numeroPagina,
        fraccionVacia: Number(Math.max(0, (cursorY - margenPt) / ALTO_CARTA).toFixed(3)),
        preguntas: preguntasPagina.length
      });

      mapaPaginas.push(
        construirMapaPaginaOmr(
          numeroPagina,
          qrTexto,
          preguntasPagina,
          preguntasDel || inicio + 1,
          this.perfilOmr,
          margenPt
        )
      );
    }

    const pdfBytes = Buffer.from(await documento.save());

    return {
      pdfBytes,
      paginas,
      metricasPaginas,
      mapaOmr: {
        margenMm: examen.layout.margenMm,
        templateVersion: examen.layout.templateVersion,
        perfilLayout: this.perfilLayout,
        perfil: this.perfilOmr,
        paginas: mapaPaginas
      },
      preguntasRestantes: Math.max(0, examen.totalPreguntas - indicePregunta)
    };
  }
}
