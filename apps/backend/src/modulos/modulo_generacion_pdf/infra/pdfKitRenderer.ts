import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import type { ExamenPdf } from '../domain/examenPdf';
import {
  ALTO_CARTA,
  ANCHO_CARTA,
  MM_A_PUNTOS,
  type BlockSpecOmr,
  type EngineHintsOmr,
  type MarkerSpecOmr,
  type PaginaOmr,
  type PerfilLayoutImpresion,
  type PerfilPlantillaOmr,
  type ResultadoGeneracionPdf
} from '../shared/tiposPdf';
import { TEMPLATE_VERSION_TV3 } from '../domain/tv3Compat';

type PerfilPlantillaRender = PerfilPlantillaOmr & {
  version: 3;
  qrRasterWidth: number;
  burbujaStroke: number;
  burbujaOffsetX: number;
  omrHeaderGap: number;
  omrTagWidth: number;
  omrTagHeight: number;
  omrTagFontSize: number;
  omrLabelFontSize: number;
  omrBoxBorderWidth: number;
  omrPanelPadding: number;
  fiducialMargin: number;
  fiducialQuietZone: number;
};

type LogoEmbed = {
  image: PDFImage;
  width: number;
  height: number;
};

type SegmentoTexto = { texto: string; font: PDFFont; size: number; esCodigo?: boolean };
type LineaSegmentos = { segmentos: SegmentoTexto[]; lineHeight: number };

const PERFIL_OMR_V3_RENDER: PerfilPlantillaRender = {
  version: 3,
  qrSize: 27 * MM_A_PUNTOS,
  qrPadding: 3.8 * MM_A_PUNTOS,
  qrMarginModulos: 8,
  qrRasterWidth: 780,
  marcasEsquina: 'cuadrados',
  marcaCuadradoSize: 14 * MM_A_PUNTOS,
  marcaCuadradoQuietZone: 2.6 * MM_A_PUNTOS,
  burbujaRadio: (6.6 * MM_A_PUNTOS) / 2,
  burbujaPasoY: 10.2 * MM_A_PUNTOS,
  burbujaStroke: 1.2,
  burbujaOffsetX: 14.2,
  omrHeaderGap: 16,
  omrTagWidth: 30,
  omrTagHeight: 12,
  omrTagFontSize: 7.6,
  omrLabelFontSize: 6.2,
  omrBoxBorderWidth: 1.45,
  omrPanelPadding: 4.5,
  cajaOmrAncho: 84,
  fiducialSize: 14 * MM_A_PUNTOS,
  fiducialMargin: 5.6,
  fiducialQuietZone: 3 * MM_A_PUNTOS,
  bubbleStrokePt: 1.2,
  labelToBubbleMm: 5.4,
  preguntasPorBloque: 10,
  opcionesPorPregunta: 5
};

function mmAPuntos(mm: number) {
  return mm * MM_A_PUNTOS;
}

function normalizarEspacios(valor: string) {
  return valor.replace(/\s+/g, ' ').trim();
}

function sanitizarTextoPdf(valor: string) {
  return String(valor ?? '')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2191/g, '^')
    .replace(/\u2193/g, 'v')
    .replace(/\u21d2/g, '=>')
    .replace(/\u21d0/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u00b7/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
}

function partirCodigoEnLineas(texto: string) {
  return String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linea) => linea.replace(/\t/g, '  '));
}

function partirBloquesCodigo(texto: string) {
  const src = String(texto ?? '');
  const bloques: Array<{ tipo: 'texto' | 'codigo'; contenido: string }> = [];
  let indice = 0;

  while (indice < src.length) {
    const inicio = src.indexOf('```', indice);
    if (inicio === -1) {
      bloques.push({ tipo: 'texto', contenido: src.slice(indice) });
      break;
    }

    if (inicio > indice) bloques.push({ tipo: 'texto', contenido: src.slice(indice, inicio) });

    const fin = src.indexOf('```', inicio + 3);
    if (fin === -1) {
      bloques.push({ tipo: 'texto', contenido: src.slice(inicio) });
      break;
    }

    const cuerpo = src.slice(inicio + 3, fin);
    const lineas = partirCodigoEnLineas(cuerpo);
    const primera = lineas[0] ?? '';
    const resto = lineas.slice(1);
    const pareceLenguaje = primera.trim().length > 0 && resto.length > 0;
    bloques.push({ tipo: 'codigo', contenido: (pareceLenguaje ? resto : lineas).join('\n') });
    indice = fin + 3;
  }

  return bloques;
}

function partirInlineCodigo(texto: string) {
  const src = String(texto ?? '');
  const salida: Array<{ tipo: 'texto' | 'codigo'; contenido: string }> = [];
  let actual = '';
  let enCodigo = false;

  for (let indice = 0; indice < src.length; indice += 1) {
    const caracter = src[indice];
    if (caracter === '`') {
      salida.push({ tipo: enCodigo ? 'codigo' : 'texto', contenido: actual });
      actual = '';
      enCodigo = !enCodigo;
      continue;
    }
    actual += caracter;
  }

  salida.push({ tipo: enCodigo ? 'codigo' : 'texto', contenido: actual });
  return salida;
}

function widthSeg(segmento: SegmentoTexto) {
  return segmento.font.widthOfTextAtSize(segmento.texto, segmento.size);
}

function envolverSegmentos({
  segmentos,
  maxWidth,
  preservarEspaciosIniciales
}: {
  segmentos: SegmentoTexto[];
  maxWidth: number;
  preservarEspaciosIniciales?: boolean;
}) {
  const lineas: SegmentoTexto[][] = [];
  let actual: SegmentoTexto[] = [];
  let anchoActual = 0;

  const pushLinea = () => {
    lineas.push(actual);
    actual = [];
    anchoActual = 0;
  };

  for (const segmento of segmentos) {
    const texto = String(segmento.texto ?? '');
    if (!texto) continue;

    const tokens = segmento.esCodigo ? [texto] : texto.split(/(\s+)/).filter((parte) => parte.length > 0);

    for (const token of tokens) {
      const esEspacio = /^\s+$/.test(token);
      if (!preservarEspaciosIniciales && actual.length === 0 && esEspacio) continue;

      const tokenSeg = { ...segmento, texto: token };
      const ancho = widthSeg(tokenSeg);
      if (anchoActual + ancho <= maxWidth) {
        actual.push(tokenSeg);
        anchoActual += ancho;
        continue;
      }

      if (actual.length > 0) {
        pushLinea();
        if (!preservarEspaciosIniciales && esEspacio) continue;
      }

      if (ancho > maxWidth) {
        let chunk = '';
        for (const caracter of token) {
          const siguiente = chunk + caracter;
          const anchoSiguiente = segmento.font.widthOfTextAtSize(siguiente, segmento.size);
          if (anchoSiguiente <= maxWidth) {
            chunk = siguiente;
            continue;
          }
          if (chunk) {
            actual.push({ ...segmento, texto: chunk });
            pushLinea();
          }
          chunk = caracter;
        }
        if (chunk) {
          actual.push({ ...segmento, texto: chunk });
          anchoActual = widthSeg({ ...segmento, texto: chunk });
        }
        continue;
      }

      actual.push(tokenSeg);
      anchoActual = ancho;
    }
  }

  if (actual.length > 0) lineas.push(actual);
  return lineas.length > 0 ? lineas : [[]];
}

function envolverTextoMixto({
  texto,
  maxWidth,
  fuente,
  fuenteMono,
  sizeTexto,
  sizeCodigoInline,
  sizeCodigoBloque,
  lineHeightTexto,
  lineHeightCodigo
}: {
  texto: string;
  maxWidth: number;
  fuente: PDFFont;
  fuenteMono: PDFFont;
  sizeTexto: number;
  sizeCodigoInline: number;
  sizeCodigoBloque: number;
  lineHeightTexto: number;
  lineHeightCodigo: number;
}) {
  const bloques = partirBloquesCodigo(sanitizarTextoPdf(texto));
  const lineas: LineaSegmentos[] = [];

  for (const bloque of bloques) {
    if (bloque.tipo === 'codigo') {
      const lineasCodigo = partirCodigoEnLineas(bloque.contenido);
      for (const linea of lineasCodigo) {
        const seg: SegmentoTexto = { texto: String(linea ?? ''), font: fuenteMono, size: sizeCodigoBloque, esCodigo: true };
        const env = envolverSegmentos({ segmentos: [seg], maxWidth, preservarEspaciosIniciales: true });
        for (const lineaEnvuelta of env) {
          lineas.push({
            segmentos: lineaEnvuelta.length > 0 ? lineaEnvuelta : [{ ...seg, texto: '' }],
            lineHeight: lineHeightCodigo
          });
        }
      }
      continue;
    }

    const inline = partirInlineCodigo(String(bloque.contenido ?? ''));
    const segmentos: SegmentoTexto[] = [];
    for (const segmento of inline) {
      if (!segmento.contenido) continue;
      if (segmento.tipo === 'codigo') {
        const textoCodigo = String(segmento.contenido).replace(/\s+/g, ' ').trim();
        if (!textoCodigo) continue;
        segmentos.push({ texto: textoCodigo, font: fuenteMono, size: sizeCodigoInline, esCodigo: true });
      } else {
        const textoPlano = normalizarEspacios(String(segmento.contenido));
        if (!textoPlano) continue;
        segmentos.push({ texto: textoPlano, font: fuente, size: sizeTexto, esCodigo: false });
      }
    }

    if (segmentos.length === 0) {
      lineas.push({ segmentos: [{ texto: '', font: fuente, size: sizeTexto }], lineHeight: lineHeightTexto });
      continue;
    }

    const segmentosConEspacios: SegmentoTexto[] = [];
    for (const segmento of segmentos) {
      if (segmentosConEspacios.length > 0) {
        const previo = segmentosConEspacios[segmentosConEspacios.length - 1];
        if (!/\s$/.test(previo.texto) && !/^\s/.test(segmento.texto)) {
          segmentosConEspacios.push({ texto: ' ', font: fuente, size: sizeTexto, esCodigo: false });
        }
      }
      segmentosConEspacios.push(segmento);
    }

    const env = envolverSegmentos({ segmentos: segmentosConEspacios, maxWidth });
    for (const linea of env) {
      lineas.push({
        segmentos: linea.length > 0 ? linea : [{ texto: '', font: fuente, size: sizeTexto }],
        lineHeight: lineHeightTexto
      });
    }
  }

  return lineas.length > 0
    ? lineas
    : [{ segmentos: [{ texto: '', font: fuente, size: sizeTexto }], lineHeight: lineHeightTexto }];
}

function dibujarLineasMixtas({
  page,
  lineas,
  x,
  y,
  colorTexto
}: {
  page: PDFPage;
  lineas: LineaSegmentos[];
  x: number;
  y: number;
  colorTexto?: ReturnType<typeof rgb>;
}) {
  let cursorY = y;
  for (const linea of lineas) {
    let cursorX = x;
    for (const segmento of linea.segmentos) {
      const texto = String(segmento.texto ?? '');
      if (!texto) continue;
      page.drawText(texto, { x: cursorX, y: cursorY, size: segmento.size, font: segmento.font, color: colorTexto });
      cursorX += segmento.font.widthOfTextAtSize(texto, segmento.size);
    }
    cursorY -= linea.lineHeight;
  }
  return cursorY;
}

function partirEnLineas({
  texto,
  maxWidth,
  font,
  size
}: {
  texto: string;
  maxWidth: number;
  font: PDFFont;
  size: number;
}) {
  const limpio = normalizarEspacios(sanitizarTextoPdf(String(texto ?? '')));
  if (!limpio) return [''];

  const palabras = limpio.split(' ');
  const lineas: string[] = [];
  let actual = '';

  const cabe = (valor: string) => font.widthOfTextAtSize(valor, size) <= maxWidth;

  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (cabe(candidato)) {
      actual = candidato;
      continue;
    }

    if (actual) lineas.push(actual);
    if (!cabe(palabra)) {
      let chunk = '';
      for (const caracter of palabra) {
        const siguiente = chunk + caracter;
        if (cabe(siguiente)) {
          chunk = siguiente;
        } else {
          if (chunk) lineas.push(chunk);
          chunk = caracter;
        }
      }
      actual = chunk;
    } else {
      actual = palabra;
    }
  }

  if (actual) lineas.push(actual);
  return lineas.length > 0 ? lineas : [''];
}

function resolverPerfilRender(templateVersion: 3, perfilBase: PerfilPlantillaOmr): PerfilPlantillaRender {
  if (templateVersion !== TEMPLATE_VERSION_TV3) {
    throw new Error(`Template version ${String(templateVersion)} no compatible para renderer TV3`);
  }
  const base = PERFIL_OMR_V3_RENDER;
  return {
    ...base,
    qrSize: perfilBase.qrSize,
    qrPadding: perfilBase.qrPadding,
    qrMarginModulos: perfilBase.qrMarginModulos,
    marcasEsquina: perfilBase.marcasEsquina,
    marcaCuadradoSize: perfilBase.marcaCuadradoSize,
    marcaCuadradoQuietZone: perfilBase.marcaCuadradoQuietZone,
    burbujaRadio: perfilBase.burbujaRadio,
    burbujaPasoY: perfilBase.burbujaPasoY,
    cajaOmrAncho: perfilBase.cajaOmrAncho,
    fiducialSize: perfilBase.fiducialSize,
    bubbleStrokePt: perfilBase.bubbleStrokePt ?? base.bubbleStrokePt,
    labelToBubbleMm: perfilBase.labelToBubbleMm ?? base.labelToBubbleMm,
    preguntasPorBloque: perfilBase.preguntasPorBloque ?? base.preguntasPorBloque,
    opcionesPorPregunta: perfilBase.opcionesPorPregunta ?? base.opcionesPorPregunta
  };
}

function agregarMarcasRegistro(page: PDFPage, margen: number, perfil: PerfilPlantillaRender) {
  const quiet = perfil.marcaCuadradoQuietZone;
  const tam = perfil.marcaCuadradoSize;
  const mitad = tam / 2;
  const esquinas = [
    { x: margen, y: ALTO_CARTA - margen },
    { x: ANCHO_CARTA - margen, y: ALTO_CARTA - margen },
    { x: margen, y: margen },
    { x: ANCHO_CARTA - margen, y: margen }
  ];

  for (const esquina of esquinas) {
    page.drawRectangle({
      x: esquina.x - mitad - quiet,
      y: esquina.y - mitad - quiet,
      width: tam + quiet * 2,
      height: tam + quiet * 2,
      color: rgb(1, 1, 1)
    });
    page.drawRectangle({
      x: esquina.x - mitad,
      y: esquina.y - mitad,
      width: tam,
      height: tam,
      color: rgb(0, 0, 0)
    });
  }
}

function dibujarFiducialOmr(page: PDFPage, x: number, y: number, size: number, quietZone: number) {
  if (quietZone > 0) {
    page.drawRectangle({
      x: x - size / 2 - quietZone,
      y: y - size / 2 - quietZone,
      width: size + quietZone * 2,
      height: size + quietZone * 2,
      color: rgb(1, 1, 1)
    });
  }
  page.drawRectangle({
    x: x - size / 2,
    y: y - size / 2,
    width: size,
    height: size,
    color: rgb(0, 0, 0)
  });
}

async function agregarQr(pdfDoc: PDFDocument, page: PDFPage, qrTexto: string, margen: number, perfil: PerfilPlantillaRender) {
  const qrDataUrl = await QRCode.toDataURL(qrTexto, {
    margin: perfil.qrMarginModulos,
    width: perfil.qrRasterWidth,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' }
  });

  const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const qrBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
  const qrImage = await pdfDoc.embedPng(qrBytes);

  const qrSize = perfil.qrSize;
  const padding = perfil.qrPadding;
  const boxW = qrSize + padding * 2;
  const boxH = qrSize + padding * 2;

  const x = ANCHO_CARTA - margen - qrSize;
  const y = ALTO_CARTA - margen - qrSize;

  page.drawRectangle({
    x: x - padding,
    y: y - padding,
    width: boxW,
    height: boxH,
    color: rgb(1, 1, 1),
    borderWidth: 1,
    borderColor: rgb(0.75, 0.79, 0.84)
  });

  page.drawImage(qrImage, {
    x,
    y,
    width: qrSize,
    height: qrSize
  });

  return { qrSize, x, y, padding };
}

async function intentarEmbedImagen(pdfDoc: PDFDocument, src?: string): Promise<LogoEmbed | undefined> {
  const ruta = String(src ?? '').trim();
  if (!ruta) return undefined;

  try {
    if (ruta.startsWith('data:image/png;base64,')) {
      const base64 = ruta.replace(/^data:image\/png;base64,/, '');
      const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
      const image = await pdfDoc.embedPng(bytes);
      return { image, width: image.width, height: image.height };
    }

    if (ruta.startsWith('data:image/jpeg;base64,') || ruta.startsWith('data:image/jpg;base64,')) {
      const base64 = ruta.replace(/^data:image\/(jpeg|jpg);base64,/, '');
      const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
      const image = await pdfDoc.embedJpg(bytes);
      return { image, width: image.width, height: image.height };
    }

    const candidatos = (() => {
      if (path.isAbsolute(ruta)) return [ruta];
      const cwd = process.cwd();
      return [
        path.resolve(cwd, ruta),
        path.resolve(cwd, '..', ruta),
        path.resolve(cwd, '..', '..', ruta),
        path.resolve(cwd, '..', '..', '..', ruta)
      ];
    })();

    let encontrada: string | undefined;
    for (const candidato of candidatos) {
      try {
        await fs.access(candidato);
        encontrada = candidato;
        break;
      } catch {
        // continúa búsqueda
      }
    }

    const objetivo = encontrada ?? (path.isAbsolute(ruta) ? ruta : path.resolve(process.cwd(), ruta));
    const buffer = await fs.readFile(objetivo);
    const ext = path.extname(objetivo).toLowerCase();

    if (ext === '.jpg' || ext === '.jpeg') {
      const image = await pdfDoc.embedJpg(buffer);
      return { image, width: image.width, height: image.height };
    }

    const image = await pdfDoc.embedPng(buffer);
    return { image, width: image.width, height: image.height };
  } catch {
    return undefined;
  }
}

function mapearPreguntasOrdenadas(examen: ExamenPdf) {
  const mapa = new Map(examen.preguntas.map((pregunta) => [pregunta.id, pregunta]));
  return examen.mapaVariante.ordenPreguntas
    .map((idPregunta) => mapa.get(idPregunta))
    .filter((pregunta): pregunta is ExamenPdf['preguntas'][number] => Boolean(pregunta));
}

export class PdfKitRenderer {
  constructor(
    private readonly perfilOmr: PerfilPlantillaOmr,
    private readonly perfilLayout: PerfilLayoutImpresion
  ) {}

  async generarPdf(examen: ExamenPdf): Promise<ResultadoGeneracionPdf> {
    const pdfDoc = await PDFDocument.create();
    const fuente = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fuenteBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fuenteItalica = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fuenteMono = await pdfDoc.embedFont(StandardFonts.Courier);

    void examen.tipoExamen;

    const templateVersion = examen.layout.templateVersion;
    const perfilOmr = resolverPerfilRender(templateVersion, this.perfilOmr);
    const margenMm = examen.layout.margenMm;
    const margen = mmAPuntos(margenMm);
    const paginasObjetivo = Number.isFinite(examen.layout.totalPaginas)
      ? Math.max(1, Math.floor(examen.layout.totalPaginas))
      : 1;

    const colorPrimario = rgb(0.08, 0.12, 0.2);
    const colorGris = rgb(0.28, 0.31, 0.36);
    const colorLinea = rgb(0.18, 0.24, 0.33);
    const colorAcento = rgb(0.05, 0.46, 0.7);
    const colorAcentoSuave = rgb(0.93, 0.97, 1);
    const colorSeccion = rgb(0.97, 0.98, 1);

    const sizeTitulo = 12.4;
    const sizeMeta = 7.6;
    const sizePregunta = 8.2;
    const sizeOpcion = 7.2;
    const sizeCodigoInline = 7.6;
    const sizeCodigoBloque = 7.2;

    const lineaPregunta = 8.7;
    const lineaOpcion = 7.8;
    const lineaCodigoBloque = 7.8;
    const separacionPregunta = 0;

    const omrTotalLetras = 5;
    const omrRadio = perfilOmr.burbujaRadio;
    const omrPasoY = perfilOmr.burbujaPasoY;
    const omrPadding = 5.6;
    const omrExtraTitulo = 14;

    const anchoColRespuesta = perfilOmr.cajaOmrAncho;
    const gutterRespuesta = 11;
    const xColRespuesta = ANCHO_CARTA - margen - anchoColRespuesta;
    const xDerechaTexto = xColRespuesta - gutterRespuesta;

    const xNumeroPregunta = margen;
    const xTextoPregunta = margen + 20;
    const anchoTextoPregunta = Math.max(60, xDerechaTexto - xTextoPregunta);

    const instruccionesDefault =
      'Por favor conteste las siguientes preguntas referentes al parcial. ' +
      'Rellene el círculo de la respuesta más adecuada, evitando salirse del mismo. ' +
      'Cada pregunta vale 10 puntos si está completa y es correcta.';

    const defaultInstitucion = 'Centro Universitario Hidalguense';
    const defaultLema = 'La sabiduria es nuestra fuerza';

    const institucion = String(examen.encabezado?.institucion ?? process.env.EXAMEN_INSTITUCION ?? defaultInstitucion).trim();
    const lema = String(examen.encabezado?.lema ?? process.env.EXAMEN_LEMA ?? defaultLema).trim();
    const materia = String(examen.encabezado?.materia ?? '').trim();
    const docente = String(examen.encabezado?.docente ?? '').trim();
    const mostrarInstrucciones = examen.encabezado?.mostrarInstrucciones !== false;
    const alumnoNombre = String(examen.encabezado?.alumno?.nombre ?? '').trim();
    const alumnoGrupo = String(examen.encabezado?.alumno?.grupo ?? '').trim();
    const instrucciones = String(examen.encabezado?.instrucciones ?? '').trim() || instruccionesDefault;

    const logoIzqSrc = examen.encabezado?.logos?.izquierdaPath ?? process.env.EXAMEN_LOGO_IZQ_PATH ?? '';
    const logoDerSrc = examen.encabezado?.logos?.derechaPath ?? process.env.EXAMEN_LOGO_DER_PATH ?? '';

    const logoIzquierda = await intentarEmbedImagen(pdfDoc, logoIzqSrc);
    const logoDerecha = await intentarEmbedImagen(pdfDoc, logoDerSrc);

    const preguntasOrdenadas = mapearPreguntasOrdenadas(examen);
    const totalPreguntas = preguntasOrdenadas.length;

    const imagenesPregunta = new Map<string, LogoEmbed>();
    for (const pregunta of preguntasOrdenadas) {
      const src = String(pregunta.imagenUrl ?? '').trim();
      if (!src) continue;
      const emb = await intentarEmbedImagen(pdfDoc, src);
      if (emb) imagenesPregunta.set(pregunta.id, emb);
    }

    const GRID_STEP = this.perfilLayout.gridStepPt;
    const snapToGrid = (y: number) => Math.floor(y / GRID_STEP) * GRID_STEP;

    const markerSpec: MarkerSpecOmr = {
      family: 'aruco_4x4_50',
      sizeMm: 18,
      quietZoneMm: 3,
      ids: { tl: 7, tr: 11, bl: 19, br: 23 }
    };
    const blockSpec: BlockSpecOmr = {
      preguntasPorBloque: perfilOmr.preguntasPorBloque ?? 10,
      opcionesPorPregunta: perfilOmr.opcionesPorPregunta ?? 5,
      bubbleDiameterMm: Number((omrRadio * 2 / MM_A_PUNTOS).toFixed(2)),
      bubblePitchYmm: Number((omrPasoY / MM_A_PUNTOS).toFixed(2)),
      labelToBubbleMm: Number((perfilOmr.labelToBubbleMm ?? 5).toFixed(2)),
      bubbleStrokePt: Number((perfilOmr.bubbleStrokePt ?? perfilOmr.burbujaStroke).toFixed(2))
    };
    const engineHints: EngineHintsOmr = {
      preferredEngine: 'cv',
      enableClahe: true,
      adaptiveThreshold: true,
      conservativeDecision: true
    };

    const paginasMeta: ResultadoGeneracionPdf['paginas'] = [];
    const metricasPaginas: ResultadoGeneracionPdf['metricasPaginas'] = [];
    const paginasOmr: PaginaOmr[] = [];

    const maxWidthIndicaciones = Math.max(120, xDerechaTexto - (margen + 10));
    const indicacionesPendientes = mostrarInstrucciones && instrucciones.length > 0;

    const headerHeightFirst = this.perfilLayout.headerHeightFirst;
    const headerHeightOther = this.perfilLayout.headerHeightOther;

    let indicePregunta = 0;
    let numeroPagina = 1;

    while (numeroPagina <= paginasObjetivo && (numeroPagina === 1 || indicePregunta < totalPreguntas)) {
      const page = pdfDoc.addPage([ANCHO_CARTA, ALTO_CARTA]);
      const folioQr = String(examen.folio ?? '').trim().toUpperCase();
      const qrTextoPagina = `EXAMEN:${folioQr}:P${numeroPagina}:TV${perfilOmr.version}`;

      let preguntasDel = 0;
      let preguntasAl = 0;
      const mapaPagina: PaginaOmr['preguntas'] = [];

      const yTop = ALTO_CARTA - margen;
      const esPrimera = numeroPagina === 1;
      const altoEncabezado = esPrimera ? headerHeightFirst : headerHeightOther;
      const xCaja = margen + 2;
      const wCaja = ANCHO_CARTA - 2 * margen - 4;
      const yCaja = yTop - altoEncabezado;

      if (esPrimera) {
        if (this.perfilLayout.usarRellenosDecorativos) {
          page.drawRectangle({ x: xCaja, y: yCaja, width: wCaja, height: altoEncabezado, color: colorSeccion });
          page.drawRectangle({
            x: xCaja,
            y: yTop - 8,
            width: wCaja,
            height: 8,
            color: colorAcento
          });
        }

        page.drawRectangle({
          x: xCaja,
          y: yCaja,
          width: wCaja,
          height: altoEncabezado,
          borderWidth: 0.8,
          borderColor: colorLinea,
          color: this.perfilLayout.usarRellenosDecorativos ? colorAcentoSuave : rgb(1, 1, 1)
        });

        page.drawLine({
          start: { x: xCaja, y: yTop - 6 },
          end: { x: xCaja + wCaja, y: yTop - 6 },
          color: colorLinea,
          thickness: 0.95
        });
      }

      agregarMarcasRegistro(page, margen, perfilOmr);
      const { x: xQr, y: yQr, padding: qrPadding, qrSize } = await agregarQr(pdfDoc, page, qrTextoPagina, margen, perfilOmr);

      const marcasPagina: PaginaOmr['marcasPagina'] = {
        tipo: perfilOmr.marcasEsquina,
        size: perfilOmr.marcaCuadradoSize,
        quietZone: perfilOmr.marcaCuadradoQuietZone,
        tl: { x: margen, y: ALTO_CARTA - margen },
        tr: { x: ANCHO_CARTA - margen, y: ALTO_CARTA - margen },
        bl: { x: margen, y: margen },
        br: { x: ANCHO_CARTA - margen, y: margen }
      };

      const yFolio = yQr - qrPadding - 10;
      const yPag = yFolio - 9;
      let folioEnEncabezado = false;
      if (yFolio > yCaja + 4) {
        page.drawText(folioQr, { x: xQr, y: yFolio, size: 9, font: fuenteBold, color: colorPrimario });
        page.drawText(`PAG ${numeroPagina}`, { x: xQr, y: yPag, size: 8.5, font: fuente, color: colorGris });
        folioEnEncabezado = true;
      }

      page.drawText(`Pagina ${numeroPagina}`, {
        x: ANCHO_CARTA - margen - 120,
        y: margen - 16,
        size: 8.5,
        font: fuente,
        color: colorGris
      });
      page.drawLine({
        start: { x: margen, y: margen - 6 },
        end: { x: ANCHO_CARTA - margen, y: margen - 6 },
        color: this.perfilLayout.usarRellenosDecorativos ? colorAcentoSuave : colorLinea,
        thickness: 0.75
      });

      if (!folioEnEncabezado) {
        page.drawText(folioQr, { x: margen, y: margen - 16, size: 8.5, font: fuenteBold, color: colorPrimario });
        page.drawText(`PAG ${numeroPagina}`, { x: margen, y: margen - 26, size: 8, font: fuente, color: colorGris });
      }

      if (esPrimera) {
        const logoMaxH = 40;
        if (logoIzquierda) {
          const escala = Math.min(1, logoMaxH / Math.max(1, logoIzquierda.height));
          const w = logoIzquierda.width * escala;
          const h = logoIzquierda.height * escala;
          page.drawImage(logoIzquierda.image, { x: margen + 10, y: yTop - h - 12, width: w, height: h });
        }

        if (logoDerecha) {
          const escala = Math.min(1, logoMaxH / Math.max(1, logoDerecha.height));
          const w = logoDerecha.width * escala;
          const h = logoDerecha.height * escala;
          const xMax = xQr - (qrPadding + 10);
          const x = Math.max(margen + 10, xMax - w);
          if (x + w <= xMax) {
            page.drawImage(logoDerecha.image, { x, y: yTop - h - 12, width: w, height: h });
          }
        }
      }

      const xTexto = margen + 70;
      if (esPrimera) {
        const xMaxEnc = xQr - (qrPadding + 8);
        const maxWidthEnc = Math.max(160, xMaxEnc - xTexto);

        const insti = (partirEnLineas({ texto: institucion, maxWidth: maxWidthEnc, font: fuenteBold, size: 12 })[0] ?? '').trim();
        const tit = (partirEnLineas({ texto: examen.titulo, maxWidth: maxWidthEnc, font: fuenteBold, size: sizeTitulo })[0] ?? '').trim();
        const lem = lema
          ? (partirEnLineas({ texto: lema, maxWidth: maxWidthEnc, font: fuenteItalica, size: 9 })[0] ?? '').trim()
          : '';

        const yInsti = yTop - 24;
        page.drawText(insti, { x: xTexto, y: yInsti, size: 12, font: fuenteBold, color: colorAcento });
        page.drawText(tit, { x: xTexto, y: yInsti - 20, size: sizeTitulo, font: fuenteBold, color: colorPrimario });
        if (lem) {
          page.drawText(lem, { x: xTexto, y: yInsti - 36, size: 9, font: fuenteItalica, color: colorGris });
        }

        const metaY = yTop - 68;
        const lineaMeta = 10.5;
        const meta = [materia ? `Materia: ${materia}` : '', docente ? `Docente: ${docente}` : ''].filter(Boolean).join('   |   ');
        const metaLineas = partirEnLineas({ texto: meta, maxWidth: maxWidthEnc, font: fuente, size: sizeMeta }).slice(0, 2);
        metaLineas.forEach((linea, indice) => {
          if (!linea) return;
          page.drawText(linea, { x: xTexto, y: metaY - indice * lineaMeta, size: sizeMeta, font: fuente, color: colorGris });
        });

        const yCampos = metaY - metaLineas.length * lineaMeta - 10;
        page.drawText('Alumno:', { x: xTexto, y: yCampos, size: 10, font: fuenteBold, color: colorPrimario });
        const alumnoLineaEnd = Math.min(xTexto + 260, xMaxEnc - 110);
        page.drawLine({ start: { x: xTexto + 52, y: yCampos + 3 }, end: { x: alumnoLineaEnd, y: yCampos + 3 }, color: colorLinea, thickness: 1 });
        if (alumnoNombre) {
          const maxAlumno = Math.max(40, alumnoLineaEnd - (xTexto + 56));
          const alumnoLinea = partirEnLineas({ texto: alumnoNombre, maxWidth: maxAlumno, font: fuente, size: 10 })[0] ?? '';
          page.drawText(alumnoLinea, { x: xTexto + 56, y: yCampos, size: 10, font: fuente, color: colorPrimario });
        }

        const xGrupo = alumnoLineaEnd + 10;
        page.drawText('Grupo:', { x: xGrupo, y: yCampos, size: 10, font: fuenteBold, color: colorPrimario });
        const grupoLineaEnd = Math.min(xGrupo + 65, xMaxEnc);
        page.drawLine({ start: { x: xGrupo + 45, y: yCampos + 3 }, end: { x: grupoLineaEnd, y: yCampos + 3 }, color: colorLinea, thickness: 1 });
        if (alumnoGrupo) {
          const maxGrupo = Math.max(40, grupoLineaEnd - (xGrupo + 50));
          const grupoLinea = partirEnLineas({ texto: alumnoGrupo, maxWidth: maxGrupo, font: fuente, size: 10 })[0] ?? '';
          page.drawText(grupoLinea, { x: xGrupo + 50, y: yCampos, size: 10, font: fuente, color: colorPrimario });
        }
      } else {
        const alumnoLinea = alumnoNombre || '-';
        const grupoLinea = alumnoGrupo || '-';
        page.drawText(`Alumno: ${alumnoLinea}`, {
          x: margen + 8,
          y: yTop - 12,
          size: 8.4,
          font: fuente,
          color: colorGris
        });
        page.drawText(`Grupo: ${grupoLinea}`, {
          x: margen + 260,
          y: yTop - 12,
          size: 8.4,
          font: fuente,
          color: colorGris
        });
      }

      const yZonaContenidoBase = esPrimera ? yCaja - 2 : yTop - 22;
      const yZonaContenidoSeguro = yQr - (qrPadding + 8);
      const yZonaContenido = esPrimera ? yZonaContenidoBase : Math.min(yZonaContenidoBase, yZonaContenidoSeguro);
      const cursorYInicio = snapToGrid(yZonaContenido);
      let cursorY = cursorYInicio;

      const alturaDisponibleMin = margen + this.perfilLayout.bottomSafePt;

      const calcularAlturaPregunta = (pregunta: ExamenPdf['preguntas'][number]) => {
        const lineasEnunciado = envolverTextoMixto({
          texto: pregunta.enunciado,
          maxWidth: anchoTextoPregunta,
          fuente,
          fuenteMono,
          sizeTexto: sizePregunta,
          sizeCodigoInline,
          sizeCodigoBloque,
          lineHeightTexto: lineaPregunta,
          lineHeightCodigo: lineaCodigoBloque
        });

        let alto = lineasEnunciado.reduce((acc, linea) => acc + linea.lineHeight, 0);

        const emb = imagenesPregunta.get(pregunta.id);
        if (emb) {
          const maxW = anchoTextoPregunta;
          const maxH = 40;
          const escala = Math.min(1, maxW / emb.width, maxH / emb.height);
          alto += emb.height * escala + 3;
        }

        const ordenOpciones = examen.mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? [0, 1, 2, 3, 4];
        const totalOpciones = ordenOpciones.length;
        const mitad = Math.ceil(totalOpciones / 2);

        const anchoOpcionesTotal = Math.max(80, xDerechaTexto - xTextoPregunta);
        const gutterCols = 8;
        const colWidth = totalOpciones > 1 ? (anchoOpcionesTotal - gutterCols) / 2 : anchoOpcionesTotal;
        const prefixWidth = fuenteBold.widthOfTextAtSize('E) ', sizeOpcion);
        const maxTextWidth = Math.max(30, colWidth - prefixWidth);

        const cols = [ordenOpciones.slice(0, mitad), ordenOpciones.slice(mitad)];
        const alturasCols = [0, 0];
        cols.forEach((col, idxCol) => {
          for (const indiceOpcion of col) {
            const opcion = pregunta.opciones[indiceOpcion];
            const lineasOpcion = envolverTextoMixto({
              texto: opcion?.texto ?? '',
              maxWidth: maxTextWidth,
              fuente,
              fuenteMono,
              sizeTexto: sizeOpcion,
              sizeCodigoInline: Math.min(sizeCodigoInline, sizeOpcion),
              sizeCodigoBloque,
              lineHeightTexto: lineaOpcion,
              lineHeightCodigo: lineaCodigoBloque
            });
            alturasCols[idxCol] += lineasOpcion.reduce((acc, l) => acc + l.lineHeight, 0) + 0.5;
          }
        });

        const altoOpciones = Math.max(alturasCols[0], alturasCols[1]);
        const altoOmrMin = (omrTotalLetras - 1) * omrPasoY + (omrExtraTitulo + omrPadding);
        alto += Math.max(altoOpciones, altoOmrMin);
        alto += separacionPregunta + 2;
        return alto;
      };

      if (esPrimera && indicacionesPendientes) {
        const xInd = margen + 10;
        const yTopInd = yZonaContenido - 6;
        const wIndMax = Math.max(140, xDerechaTexto - xInd - 6);
        const wInd = Math.min(wIndMax, maxWidthIndicaciones + 16);

        const hDisponible = yTopInd - (alturaDisponibleMin + 2);
        let hMin = 34;
        const hMax = Math.max(hMin, hDisponible);

        let sizeIndicaciones = 6.0;
        let lineaIndicaciones = 6.6;
        const hLabel = 9;
        const paddingY = 1;
        let lineasIndicaciones = partirEnLineas({
          texto: instrucciones,
          maxWidth: wInd - 16,
          font: fuente,
          size: sizeIndicaciones
        });

        for (let i = 0; i < 10; i += 1) {
          const hNecesaria = hLabel + paddingY + lineasIndicaciones.length * lineaIndicaciones;
          if (hNecesaria <= hMax) break;
          sizeIndicaciones = Math.max(6.0, sizeIndicaciones - 0.25);
          lineaIndicaciones = Math.max(6.6, lineaIndicaciones - 0.25);
          lineasIndicaciones = partirEnLineas({
            texto: instrucciones,
            maxWidth: wInd - 16,
            font: fuente,
            size: sizeIndicaciones
          });
        }

        const hNecesariaFinal = hLabel + paddingY + lineasIndicaciones.length * lineaIndicaciones;
        hMin = Math.max(hMin, hLabel + paddingY + lineaIndicaciones + 12);
        const hCaja = Math.max(hMin, hNecesariaFinal);

        if (alumnoNombre || alumnoGrupo) {
          const yAlumno = yTopInd + 6;
          const xAlumno = xInd;
          const maxAnchoAlumno = Math.max(120, xDerechaTexto - xAlumno - 140);
          const alumnoLinea = alumnoNombre
            ? (partirEnLineas({ texto: alumnoNombre, maxWidth: maxAnchoAlumno, font: fuente, size: 9 })[0] ?? '')
            : '';
          page.drawText(`Alumno: ${alumnoLinea || '-'}`, { x: xAlumno, y: yAlumno, size: 9, font: fuente, color: colorGris });

          if (alumnoGrupo) {
            const xGrupo = Math.max(xAlumno + 260, xDerechaTexto - 120);
            page.drawText(`Grupo: ${alumnoGrupo}`, { x: xGrupo, y: yAlumno, size: 9, font: fuente, color: colorGris });
          }
        }

        page.drawRectangle({
          x: xInd,
          y: yTopInd - hCaja,
          width: wInd,
          height: hCaja,
          borderWidth: 1,
          borderColor: colorLinea,
          color: this.perfilLayout.usarRellenosDecorativos ? colorSeccion : rgb(1, 1, 1)
        });

        page.drawLine({
          start: { x: xInd + 8, y: yTopInd - 18 },
          end: { x: xInd + Math.min(wInd - 8, 92), y: yTopInd - 18 },
          color: colorLinea,
          thickness: 0.8
        });

        page.drawText('Indicaciones', { x: xInd + 8, y: yTopInd - 16, size: 9, font: fuenteBold, color: colorAcento });

        let yLinea = yTopInd - 26;
        const yMinTexto = yTopInd - hCaja + 8;
        if (yLinea < yMinTexto) yLinea = yMinTexto;

        for (const linea of lineasIndicaciones) {
          if (yLinea < yMinTexto) break;
          page.drawText(linea, { x: xInd + 8, y: yLinea, size: sizeIndicaciones, font: fuente, color: rgb(0.1, 0.1, 0.1) });
          yLinea -= lineaIndicaciones;
        }

        cursorY = snapToGrid(yTopInd - hCaja - 6);
        if (hCaja > hDisponible || cursorY < alturaDisponibleMin + 40) {
          cursorY = alturaDisponibleMin - 1;
        }
      }

      while (indicePregunta < preguntasOrdenadas.length && cursorY > alturaDisponibleMin) {
        const pregunta = preguntasOrdenadas[indicePregunta];
        const numero = indicePregunta + 1;

        const alturaNecesaria = calcularAlturaPregunta(pregunta);
        if (cursorY - alturaNecesaria < alturaDisponibleMin) break;

        if (!preguntasDel) preguntasDel = numero;
        preguntasAl = numero;

        const textoNumero = String(numero);
        const wNum = 18;
        const hNum = 14;
        const xNum = xNumeroPregunta;
        const yNum = cursorY - 1;
        page.drawRectangle({
          x: xNum,
          y: yNum,
          width: wNum,
          height: hNum,
          borderWidth: 1,
          borderColor: colorLinea,
          color: this.perfilLayout.usarRellenosDecorativos ? colorAcentoSuave : rgb(1, 1, 1)
        });
        const sizeNum = textoNumero.length >= 3 ? 8 : 9;
        page.drawText(textoNumero, { x: xNum + 5, y: yNum + 3.2, size: sizeNum, font: fuenteBold, color: colorPrimario });

        const lineasEnunciado = envolverTextoMixto({
          texto: pregunta.enunciado,
          maxWidth: anchoTextoPregunta,
          fuente,
          fuenteMono,
          sizeTexto: sizePregunta,
          sizeCodigoInline,
          sizeCodigoBloque,
          lineHeightTexto: lineaPregunta,
          lineHeightCodigo: lineaCodigoBloque
        });
        cursorY = dibujarLineasMixtas({ page, lineas: lineasEnunciado, x: xTextoPregunta, y: cursorY });

        const emb = imagenesPregunta.get(pregunta.id);
        if (emb) {
          const maxW = anchoTextoPregunta;
          const maxH = 44;
          const escala = Math.min(1, maxW / emb.width, maxH / emb.height);
          const w = emb.width * escala;
          const h = emb.height * escala;
          page.drawImage(emb.image, { x: xTextoPregunta, y: cursorY - h, width: w, height: h });
          cursorY -= h + 3;
        }

        const ordenOpciones = examen.mapaVariante.ordenOpcionesPorPregunta[pregunta.id] ?? [0, 1, 2, 3, 4];
        const totalOpciones = ordenOpciones.length;
        const mitad = Math.ceil(totalOpciones / 2);

        const anchoOpcionesTotal = Math.max(80, xDerechaTexto - xTextoPregunta);
        const gutterCols = 8;
        const colWidth = totalOpciones > 1 ? (anchoOpcionesTotal - gutterCols) / 2 : anchoOpcionesTotal;
        const xCol1 = xTextoPregunta;
        const xCol2 = xTextoPregunta + colWidth + gutterCols;
        const prefixWidth = fuenteBold.widthOfTextAtSize('E) ', sizeOpcion);

        const yInicioOpciones = cursorY;
        let yCol1 = yInicioOpciones;
        let yCol2 = yInicioOpciones;

        const opcionesOmr: Array<{ letra: string; x: number; y: number }> = [];

        const itemsCol1 = ordenOpciones.slice(0, mitad).map((indiceOpcion, idx) => ({ indiceOpcion, letra: String.fromCharCode(65 + idx) }));
        const itemsCol2 = ordenOpciones.slice(mitad).map((indiceOpcion, idx) => ({ indiceOpcion, letra: String.fromCharCode(65 + (mitad + idx)) }));

        const dibujarItem = (xCol: number, yLocal: number, item: { indiceOpcion: number; letra: string }) => {
          page.drawText(`${item.letra})`, { x: xCol, y: yLocal, size: sizeOpcion, font: fuenteBold, color: rgb(0.12, 0.12, 0.12) });
          const opcion = pregunta.opciones[item.indiceOpcion];
          const textoOpcion = String(opcion?.texto ?? '');
          const textoLimpio = textoOpcion.includes('```') ? textoOpcion : normalizarEspacios(textoOpcion);
          const lineasOpcion = envolverTextoMixto({
            texto: textoLimpio,
            maxWidth: Math.max(30, colWidth - prefixWidth),
            fuente,
            fuenteMono,
            sizeTexto: sizeOpcion,
            sizeCodigoInline: Math.min(sizeCodigoInline, sizeOpcion),
            sizeCodigoBloque,
            lineHeightTexto: lineaOpcion,
            lineHeightCodigo: lineaCodigoBloque
          });
          const yFinal = dibujarLineasMixtas({ page, lineas: lineasOpcion, x: xCol + prefixWidth, y: yLocal, colorTexto: rgb(0.1, 0.1, 0.1) });
          return yFinal - 2;
        };

        for (const item of itemsCol1) yCol1 = dibujarItem(xCol1, yCol1, item);
        for (const item of itemsCol2) yCol2 = dibujarItem(xCol2, yCol2, item);

        const letras = Array.from({ length: omrTotalLetras }, (_valor, idx) => String.fromCharCode(65 + idx));
        const yPrimeraBurbuja = yInicioOpciones - perfilOmr.omrHeaderGap;
        const top = yPrimeraBurbuja + omrRadio + omrExtraTitulo + 8;
        const yUltimaBurbuja = yPrimeraBurbuja - (omrTotalLetras - 1) * omrPasoY;
        const omrExtraBottom = 6;
        const bottom = yUltimaBurbuja - omrRadio - 4 - omrExtraBottom;
        const hCaja = Math.max(40, top - bottom);
        const panelPad = perfilOmr.omrPanelPadding;

        if (panelPad > 0) {
          page.drawRectangle({
            x: xColRespuesta - panelPad,
            y: bottom - panelPad,
            width: anchoColRespuesta + panelPad * 2,
            height: hCaja + panelPad * 2,
            color: rgb(1, 1, 1)
          });
        }

        page.drawRectangle({
          x: xColRespuesta,
          y: bottom,
          width: anchoColRespuesta,
          height: hCaja,
          borderWidth: perfilOmr.omrBoxBorderWidth,
          borderColor: rgb(0, 0, 0),
          color: this.perfilLayout.usarRellenosDecorativos ? colorSeccion : rgb(1, 1, 1)
        });

        const hTag = perfilOmr.omrTagHeight;
        const wTag = perfilOmr.omrTagWidth;
        const yTag = top - hTag - 6;
        if (this.perfilLayout.usarEtiquetaOmrSolida) {
          page.drawRectangle({ x: xColRespuesta, y: yTag, width: wTag, height: hTag, color: colorPrimario });
          page.drawText(`#${numero}`, { x: xColRespuesta + 4, y: yTag + 2.2, size: perfilOmr.omrTagFontSize, font: fuenteBold, color: rgb(1, 1, 1) });
        } else {
          page.drawRectangle({
            x: xColRespuesta,
            y: yTag,
            width: wTag,
            height: hTag,
            borderWidth: 0.85,
            borderColor: colorLinea,
            color: rgb(1, 1, 1)
          });
          page.drawText(`#${numero}`, { x: xColRespuesta + 4, y: yTag + 2.2, size: perfilOmr.omrTagFontSize, font: fuenteBold, color: colorPrimario });
        }

        const label = 'RESP';
        const labelSize = perfilOmr.omrLabelFontSize;
        const labelWidth = fuenteBold.widthOfTextAtSize(label, labelSize);
        const maxLabelSpace = anchoColRespuesta - wTag - 8;
        if (labelWidth <= maxLabelSpace) {
          page.drawText(label, { x: xColRespuesta + wTag + 2, y: yTag + 2.1, size: labelSize, font: fuenteBold, color: colorPrimario });
        }

        const xBurbuja = xColRespuesta + omrPadding + perfilOmr.burbujaOffsetX;
        for (let idx = 0; idx < letras.length; idx += 1) {
          const letra = letras[idx];
          const yBurbuja = yPrimeraBurbuja - idx * omrPasoY;
          page.drawCircle({
            x: xBurbuja,
            y: yBurbuja,
            size: omrRadio,
            borderWidth: perfilOmr.bubbleStrokePt ?? perfilOmr.burbujaStroke,
            borderColor: rgb(0, 0, 0)
          });
          page.drawText(letra, {
            x: xBurbuja + omrRadio + mmAPuntos(perfilOmr.labelToBubbleMm ?? 5),
            y: yBurbuja - 3,
            size: 8.3,
            font: fuente,
            color: rgb(0.12, 0.12, 0.12)
          });
          opcionesOmr.push({ letra, x: xBurbuja, y: yBurbuja });
        }

        const fidSize = perfilOmr.fiducialSize;
        const fidMargin = perfilOmr.fiducialMargin;
        const xFid = xColRespuesta + fidMargin;
        const xFidRight = xColRespuesta + anchoColRespuesta - fidMargin;
        const yFidTop = top - fidMargin;
        const yFidBottom = bottom + fidMargin;
        dibujarFiducialOmr(page, xFid, yFidTop, fidSize, perfilOmr.fiducialQuietZone);
        dibujarFiducialOmr(page, xFid, yFidBottom, fidSize, perfilOmr.fiducialQuietZone);
        dibujarFiducialOmr(page, xFidRight, yFidTop, fidSize, perfilOmr.fiducialQuietZone);
        dibujarFiducialOmr(page, xFidRight, yFidBottom, fidSize, perfilOmr.fiducialQuietZone);

        cursorY = Math.min(yCol1, yCol2, bottom - 6);
        cursorY -= separacionPregunta;
        cursorY = snapToGrid(cursorY);

        indicePregunta += 1;

        mapaPagina.push({
          numeroPregunta: numero,
          idPregunta: pregunta.id,
          opciones: opcionesOmr,
          cajaOmr: { x: xColRespuesta, y: bottom, width: anchoColRespuesta, height: hCaja },
          perfilOmr: { radio: omrRadio, pasoY: omrPasoY, cajaAncho: anchoColRespuesta },
          fiduciales: {
            leftTop: { x: xFid, y: yFidTop },
            leftBottom: { x: xFid, y: yFidBottom },
            rightTop: { x: xFidRight, y: yFidTop },
            rightBottom: { x: xFidRight, y: yFidBottom }
          }
        });
      }

      const alturaUtil = Math.max(1, cursorYInicio - alturaDisponibleMin);
      const alturaRestante = Math.max(0, cursorY - alturaDisponibleMin);
      const fraccionVacia = Math.max(0, Math.min(1, alturaRestante / alturaUtil));
      metricasPaginas.push({ numero: numeroPagina, fraccionVacia, preguntas: mapaPagina.length });

      paginasMeta.push({ numero: numeroPagina, qrTexto: qrTextoPagina, preguntasDel, preguntasAl });
      paginasOmr.push({
        numeroPagina,
        qr: { texto: qrTextoPagina, x: xQr, y: yQr, size: qrSize, padding: qrPadding },
        marcasPagina,
        preguntas: mapaPagina
      });

      numeroPagina += 1;
    }

    const pdfBytes = Buffer.from(await pdfDoc.save());
    const preguntasRestantes = Math.max(0, totalPreguntas - indicePregunta);

    return {
      pdfBytes,
      paginas: paginasMeta,
      metricasPaginas,
      mapaOmr: {
        margenMm,
        templateVersion: perfilOmr.version,
        markerSpec,
        blockSpec,
        engineHints,
        perfilLayout: {
          gridStepPt: this.perfilLayout.gridStepPt,
          headerHeightFirst: this.perfilLayout.headerHeightFirst,
          headerHeightOther: this.perfilLayout.headerHeightOther,
          bottomSafePt: this.perfilLayout.bottomSafePt,
          usarRellenosDecorativos: this.perfilLayout.usarRellenosDecorativos,
          usarEtiquetaOmrSolida: this.perfilLayout.usarEtiquetaOmrSolida
        },
        perfil: {
          qrSize: perfilOmr.qrSize,
          qrPadding: perfilOmr.qrPadding,
          qrMarginModulos: perfilOmr.qrMarginModulos,
          marcasEsquina: perfilOmr.marcasEsquina,
          marcaCuadradoSize: perfilOmr.marcaCuadradoSize,
          marcaCuadradoQuietZone: perfilOmr.marcaCuadradoQuietZone,
          burbujaRadio: perfilOmr.burbujaRadio,
          burbujaPasoY: perfilOmr.burbujaPasoY,
          cajaOmrAncho: perfilOmr.cajaOmrAncho,
          fiducialSize: perfilOmr.fiducialSize,
          bubbleStrokePt: perfilOmr.bubbleStrokePt,
          labelToBubbleMm: perfilOmr.labelToBubbleMm,
          preguntasPorBloque: perfilOmr.preguntasPorBloque,
          opcionesPorPregunta: perfilOmr.opcionesPorPregunta
        },
        paginas: paginasOmr
      },
      preguntasRestantes
    };
  }
}
