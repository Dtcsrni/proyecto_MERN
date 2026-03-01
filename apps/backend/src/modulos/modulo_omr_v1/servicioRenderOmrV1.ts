import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import type { PaginaOmr, PreguntaBase } from '../modulo_generacion_pdf/shared/tiposPdf';
import { guardarPdfExamen } from '../../infraestructura/archivos/almacenLocal';
import type { OmrSheetFamilyDescriptor } from './contratosOmrV1';
import { OMR_RUNTIME_VERSION_V1 } from './contratosOmrV1';

type PlantillaOmrV1 = {
  titulo?: string;
  numeroPaginas?: number;
  bookletConfig?: {
    targetPages?: number;
  };
};

type SheetInstanceV1 = {
  sheetSerial: string;
  familyCode: string;
  familyRevision: number;
  pageIndex: number;
  versionCode: string;
  studentBinding?: { alumnoId?: string | null; studentId?: string | null };
  qrPayload: string;
  expectedQuestionCount: number;
  expectedChoiceCount: number;
  expectedIdDigits: number;
  artifactPath?: string;
};

type RenderBundleV1 = {
  bookletPdfBytes: Buffer;
  omrSheetPdfBytes: Buffer;
  sheetInstances: SheetInstanceV1[];
  mapaOmrV1: {
    omrRuntimeVersion: 1;
    sheetFamilyCode: string;
    sheetFamilyRevision: number;
    paginas: PaginaOmr[];
  };
  bookletDiagnostics: {
    pagesEstimated: number;
    questionsPerPage: number[];
    imageHeavyQuestions: Array<{ id: string; numero: number }>;
    layoutWarnings: string[];
  };
  omrDiagnostics: {
    anchorFootprintRatio: number;
    qrFootprintRatio: number;
    bubbleSpacingScore: number;
  };
};

const LETTER_W = 612;
const LETTER_H = 792;
const MM_A_PT = 72 / 25.4;

function mm(mmValue: number) {
  return mmValue * MM_A_PT;
}

function slug(value: string) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function acotarTexto(value: string, max = 140) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function qrPayload(sheetSerial: string, familyCode: string, revision: number, pageIndex: number, versionPolicy: string) {
  return `OMR1:${sheetSerial}:${familyCode}:${revision}:${pageIndex}:${versionPolicy}`;
}

async function generarBookletPdf(args: {
  plantilla: PlantillaOmrV1;
  preguntas: PreguntaBase[];
  targetPages: number;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const usableWidth = LETTER_W - mm(20) * 2;
  const imageHeavyQuestions: Array<{ id: string; numero: number }> = [];
  const questionsPerPage: number[] = [];
  const layoutWarnings: string[] = [];
  const approxPerPage = Math.max(6, Math.ceil(args.preguntas.length / Math.max(1, args.targetPages)));
  const bloques = chunk(args.preguntas, approxPerPage);

  for (let pageIdx = 0; pageIdx < bloques.length; pageIdx += 1) {
    const page = pdf.addPage([LETTER_W, LETTER_H]);
    let y = LETTER_H - mm(18);
    page.drawText(String(args.plantilla.titulo ?? 'Evaluacion'), {
      x: mm(20),
      y,
      size: 20,
      font: bold,
      color: rgb(0.09, 0.16, 0.28)
    });
    y -= 20;
    page.drawText(`Cuadernillo V1 · Pagina ${pageIdx + 1}`, {
      x: mm(20),
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.41, 0.5)
    });
    y -= 26;
    const preguntasPagina = bloques[pageIdx] ?? [];
    questionsPerPage.push(preguntasPagina.length);
    for (let idx = 0; idx < preguntasPagina.length; idx += 1) {
      const pregunta = preguntasPagina[idx]!;
      const numero = pageIdx * approxPerPage + idx + 1;
      const enunciado = acotarTexto(pregunta.enunciado, 220);
      page.drawText(`${numero}. ${enunciado}`, {
        x: mm(20),
        y,
        size: 11.2,
        font: bold,
        color: rgb(0.08, 0.1, 0.16),
        maxWidth: usableWidth
      });
      y -= 16;
      if (pregunta.imagenUrl) {
        imageHeavyQuestions.push({ id: pregunta.id, numero });
        page.drawText('[Imagen asociada al reactivo; se mantiene fuera de la hoja OMR]', {
          x: mm(24),
          y,
          size: 9.3,
          font: mono,
          color: rgb(0.36, 0.2, 0.07),
          maxWidth: usableWidth - mm(4)
        });
        y -= 14;
      }
      for (let op = 0; op < pregunta.opciones.length; op += 1) {
        const opcion = pregunta.opciones[op]!;
        const letra = String.fromCharCode(65 + op);
        page.drawText(`${letra}) ${acotarTexto(opcion.texto, 110)}`, {
          x: mm(26),
          y,
          size: 10.1,
          font,
          color: rgb(0.18, 0.22, 0.29),
          maxWidth: usableWidth - mm(6)
        });
        y -= 12;
      }
      y -= 8;
      if (y < mm(30)) {
        layoutWarnings.push(`El cuadernillo quedó denso en la pagina ${pageIdx + 1}.`);
        break;
      }
    }
  }

  return {
    pdfBytes: Buffer.from(await pdf.save()),
    diagnostics: {
      pagesEstimated: bloques.length,
      questionsPerPage,
      imageHeavyQuestions,
      layoutWarnings
    }
  };
}

async function generarHojaOmrPdf(args: {
  family: OmrSheetFamilyDescriptor;
  folio: string;
  questionCount: number;
  versionCount: number;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const paginas: PaginaOmr[] = [];
  const instances: SheetInstanceV1[] = [];
  const perPage = args.family.geometryDefaults.questionsPerPage;
  const totalPages = Math.max(1, Math.ceil(args.questionCount / perPage));

  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    const page = pdf.addPage([LETTER_W, LETTER_H]);
    const serial = `${slug(args.folio)}-${pageIndex}`.toUpperCase();
    const qr = qrPayload(serial, args.family.familyCode, 1, pageIndex, args.versionCount > 1 ? 'multi' : 'single');
    instances.push({
      sheetSerial: serial,
      familyCode: args.family.familyCode,
      familyRevision: 1,
      pageIndex,
      versionCode: args.versionCount > 1 ? 'A' : 'SINGLE',
      qrPayload: qr,
      expectedQuestionCount: Math.min(perPage, args.questionCount - (pageIndex - 1) * perPage),
      expectedChoiceCount: args.family.choiceCountMax,
      expectedIdDigits: args.family.studentIdDigits
    });

    const g = args.family.geometryDefaults;
    const margin = g.outerMarginPt;
    const anchorSize = g.anchorSizePt;
    const qrX = LETTER_W - margin - g.qrSizePt;
    const qrY = LETTER_H - margin - g.qrSizePt;
    const squares = [
      { x: margin, y: LETTER_H - margin - anchorSize },
      { x: LETTER_W - margin - anchorSize, y: LETTER_H - margin - anchorSize },
      { x: margin, y: margin },
      { x: LETTER_W - margin - anchorSize, y: margin }
    ];
    for (const sq of squares) {
      page.drawRectangle({ x: sq.x, y: sq.y, width: anchorSize, height: anchorSize, color: rgb(0, 0, 0) });
    }
    page.drawRectangle({
      x: qrX - g.qrPaddingPt,
      y: qrY - g.qrPaddingPt,
      width: g.qrSizePt + g.qrPaddingPt * 2,
      height: g.qrSizePt + g.qrPaddingPt * 2,
      borderColor: rgb(0.75, 0.78, 0.84),
      borderWidth: 1,
      color: rgb(1, 1, 1)
    });
    const qrImage = await pdf.embedPng(
      await QRCode.toBuffer(qr, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: Math.max(220, Math.round(g.qrSizePt * 4))
      })
    );
    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: g.qrSizePt,
      height: g.qrSizePt
    });
    page.drawText('Hoja OMR V1', { x: margin + 16, y: LETTER_H - margin - 12, size: 16, font: bold, color: rgb(0.08, 0.12, 0.18) });
    page.drawText(`${args.family.displayName} · Pagina ${pageIndex}/${totalPages}`, {
      x: margin + 16,
      y: LETTER_H - margin - 28,
      size: 10,
      font,
      color: rgb(0.34, 0.4, 0.49)
    });
    page.drawText(`QR: ${qr}`, { x: margin + 16, y: LETTER_H - margin - 42, size: 7.5, font, color: rgb(0.4, 0.46, 0.55) });
    let metaY = LETTER_H - margin - 62;
    if (args.family.studentIdDigits > 0) {
      page.drawText('ID estudiante', { x: margin + 16, y: metaY + 12, size: 9, font: bold, color: rgb(0.14, 0.18, 0.24) });
      for (let digit = 0; digit < args.family.studentIdDigits; digit += 1) {
        const columnX = margin + 22 + digit * 24;
        page.drawText(String(digit + 1), { x: columnX + 1, y: metaY, size: 7, font, color: rgb(0.35, 0.39, 0.46) });
        for (let value = 0; value <= 9; value += 1) {
          const cy = metaY - value * 9;
          page.drawCircle({
            x: columnX,
            y: cy,
            size: 3.2,
            borderWidth: 0.8,
            borderColor: rgb(0.15, 0.18, 0.23)
          });
          page.drawText(String(value), { x: columnX + 6, y: cy - 2.5, size: 6.4, font, color: rgb(0.2, 0.23, 0.29) });
        }
      }
      metaY -= 102;
    }
    if (args.versionCount > 1) {
      page.drawText('Version', { x: margin + 16, y: metaY + 12, size: 9, font: bold, color: rgb(0.14, 0.18, 0.24) });
      for (let versionIndex = 0; versionIndex < Math.min(args.family.versionBubbleCount, args.versionCount); versionIndex += 1) {
        const cx = margin + 26 + versionIndex * 22;
        const cy = metaY;
        page.drawCircle({
          x: cx,
          y: cy,
          size: 3.4,
          borderWidth: 0.9,
          borderColor: rgb(0.15, 0.18, 0.23)
        });
        page.drawText(String.fromCharCode(65 + versionIndex), {
          x: cx + 6,
          y: cy - 2.5,
          size: 7.4,
          font,
          color: rgb(0.2, 0.23, 0.29)
        });
      }
    }

    let y = LETTER_H - g.answersTop;
    const pageQuestions: PaginaOmr['preguntas'] = [];
    const startQuestion = (pageIndex - 1) * perPage + 1;
    const endQuestion = Math.min(args.questionCount, pageIndex * perPage);
    for (let numeroPregunta = startQuestion; numeroPregunta <= endQuestion; numeroPregunta += 1) {
      page.drawText(String(numeroPregunta).padStart(2, '0'), {
        x: margin + 12,
        y: y + 2,
        size: 10,
        font: bold,
        color: rgb(0.08, 0.1, 0.16)
      });
      const options: Array<{ letra: string; x: number; y: number }> = [];
      for (let op = 0; op < args.family.choiceCountMax; op += 1) {
        const cx = margin + 54 + op * g.bubblePitchXpt;
        const cy = y + g.bubbleRadiusPt;
        page.drawCircle({
          x: cx,
          y: cy,
          size: g.bubbleRadiusPt,
          borderWidth: 1.2,
          borderColor: rgb(0.1, 0.12, 0.18)
        });
        page.drawText(String.fromCharCode(65 + op), {
          x: cx + g.bubbleRadiusPt + 4,
          y: cy - 3,
          size: 9,
          font,
          color: rgb(0.16, 0.18, 0.22)
        });
        options.push({ letra: String.fromCharCode(65 + op), x: cx, y: cy });
      }
      pageQuestions.push({
        numeroPregunta,
        idPregunta: `Q-${numeroPregunta}`,
        opciones: options,
        cajaOmr: { x: margin + 46, y: y - 2, width: g.bubblePitchXpt * args.family.choiceCountMax + 34, height: g.bubbleDiameterPt + 6 },
        perfilOmr: { radio: g.bubbleRadiusPt, pasoY: g.bubblePitchYpt, cajaAncho: g.bubblePitchXpt * args.family.choiceCountMax + 34 },
        fiduciales: {
          leftTop: { x: margin + 46, y: y + g.bubbleDiameterPt + 1 },
          leftBottom: { x: margin + 46, y: y - 2 },
          rightTop: { x: margin + 46 + g.bubblePitchXpt * args.family.choiceCountMax + 34, y: y + g.bubbleDiameterPt + 1 },
          rightBottom: { x: margin + 46 + g.bubblePitchXpt * args.family.choiceCountMax + 34, y: y - 2 }
        }
      });
      y -= g.bubblePitchYpt;
    }
    const lastSlot = Math.min(args.family.questionCapacity, pageIndex * perPage);
    for (let numeroPregunta = endQuestion + 1; numeroPregunta <= lastSlot; numeroPregunta += 1) {
      page.drawText(String(numeroPregunta).padStart(2, '0'), {
        x: margin + 12,
        y: y + 2,
        size: 10,
        font: bold,
        color: rgb(0.55, 0.58, 0.63)
      });
      page.drawText('IGNORADA', {
        x: margin + 54,
        y: y + 2,
        size: 8,
        font,
        color: rgb(0.55, 0.58, 0.63)
      });
      y -= g.bubblePitchYpt;
    }

    paginas.push({
      numeroPagina: pageIndex,
      qr: { texto: qr, x: qrX, y: qrY, size: g.qrSizePt, padding: g.qrPaddingPt },
      marcasPagina: {
        tipo: 'cuadrados',
        size: anchorSize,
        quietZone: g.anchorQuietZonePt,
        tl: { x: margin, y: LETTER_H - margin - anchorSize },
        tr: { x: LETTER_W - margin - anchorSize, y: LETTER_H - margin - anchorSize },
        bl: { x: margin, y: margin },
        br: { x: LETTER_W - margin - anchorSize, y: margin }
      },
      preguntas: pageQuestions
    });
  }

  const anchorArea = 4 * args.family.geometryDefaults.anchorSizePt * args.family.geometryDefaults.anchorSizePt;
  const qrArea = args.family.geometryDefaults.qrSizePt * args.family.geometryDefaults.qrSizePt;
  const pageArea = LETTER_W * LETTER_H;

  return {
    pdfBytes: Buffer.from(await pdf.save()),
    pages: paginas,
    instances,
    diagnostics: {
      anchorFootprintRatio: Number((anchorArea / pageArea).toFixed(4)),
      qrFootprintRatio: Number((qrArea / pageArea).toFixed(4)),
      bubbleSpacingScore: Number(
        Math.min(1, (args.family.geometryDefaults.bubblePitchXpt + args.family.geometryDefaults.bubblePitchYpt) / mm(16.5)).toFixed(4)
      )
    }
  };
}

export async function generarBundleAssessmentOmrV1(args: {
  plantilla: PlantillaOmrV1;
  preguntas: PreguntaBase[];
  family: OmrSheetFamilyDescriptor;
  folio: string;
  versionCount: number;
}) : Promise<RenderBundleV1> {
  const targetPages = Math.max(1, Number(args.plantilla.bookletConfig?.targetPages ?? args.plantilla.numeroPaginas ?? 1));
  const booklet = await generarBookletPdf({ plantilla: args.plantilla, preguntas: args.preguntas, targetPages });
  const omr = await generarHojaOmrPdf({
    family: args.family,
    folio: args.folio,
    questionCount: args.preguntas.length,
    versionCount: args.versionCount
  });

  return {
    bookletPdfBytes: booklet.pdfBytes,
    omrSheetPdfBytes: omr.pdfBytes,
    sheetInstances: omr.instances,
    mapaOmrV1: {
      omrRuntimeVersion: OMR_RUNTIME_VERSION_V1,
      sheetFamilyCode: args.family.familyCode,
      sheetFamilyRevision: 1,
      paginas: omr.pages
    },
    bookletDiagnostics: booklet.diagnostics,
    omrDiagnostics: omr.diagnostics
  };
}

export async function persistirArtifactsAssessmentOmrV1(args: {
  folio: string;
  bookletPdfBytes: Buffer;
  omrSheetPdfBytes: Buffer;
}) {
  const base = slug(args.folio || 'assessment-v1') || 'assessment-v1';
  const bookletPath = await guardarPdfExamen(`${base}_booklet_v1.pdf`, args.bookletPdfBytes);
  const omrSheetPath = await guardarPdfExamen(`${base}_omr_sheet_v1.pdf`, args.omrSheetPdfBytes);
  return { bookletPath, omrSheetPath };
}
