/**
 * Servicio de escaneo OMR basado en posiciones del PDF.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import jsQR from 'jsqr';
import {
  buscarMejorOffsetPregunta,
  calcularMetricasPregunta,
  evaluarConOffset,
  type CentroOpcion,
  type EstadoImagenOmr
} from './omrCore';

export type ResultadoOmr = {
  respuestasDetectadas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  advertencias: string[];
  qrTexto?: string;
  calidadPagina: number;
  estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  motivosRevision: string[];
  templateVersionDetectada: 1 | 2;
  confianzaPromedioPagina: number;
  ratioAmbiguas: number;
};

type Punto = { x: number; y: number };
type TemplateVersion = 1 | 2;

type MapaOmrPagina = {
  numeroPagina: number;
  templateVersion?: TemplateVersion;
  preguntas: Array<{
    numeroPregunta: number;
    idPregunta: string;
    opciones: Array<{ letra: string; x: number; y: number }>;
    fiduciales?:
      | { top: { x: number; y: number }; bottom: { x: number; y: number } }
      | {
          leftTop: { x: number; y: number };
          leftBottom: { x: number; y: number };
          rightTop: { x: number; y: number };
          rightBottom: { x: number; y: number };
        };
  }>;
};

const ANCHO_CARTA = 612;
const ALTO_CARTA = 792;
const MM_A_PUNTOS = 72 / 25.4;
const QR_SIZE_PTS_V1 = 68;
const QR_SIZE_PTS_V2 = 88;

const OMR_SCORE_MIN = Number.parseFloat(process.env.OMR_SCORE_MIN || '0.08');
const OMR_DELTA_MIN = Number.parseFloat(process.env.OMR_DELTA_MIN || '0.02');
const OMR_STRONG_SCORE = Number.parseFloat(process.env.OMR_STRONG_SCORE || '0.09');
const OMR_SECOND_RATIO = Number.parseFloat(process.env.OMR_SECOND_RATIO || '0.75');
const OMR_SCORE_STD = Number.parseFloat(process.env.OMR_SCORE_STD || '0.6');
const OMR_ALIGN_RANGE = Number.parseFloat(process.env.OMR_ALIGN_RANGE || '22');
const OMR_ALIGN_STEP = Number.parseFloat(process.env.OMR_ALIGN_STEP || '2');
const OMR_VERT_RANGE = Number.parseFloat(process.env.OMR_VERT_RANGE || '12');
const OMR_VERT_STEP = Number.parseFloat(process.env.OMR_VERT_STEP || '2');
const OMR_OFFSET_X = Number.parseFloat(process.env.OMR_OFFSET_X || '0');
const OMR_OFFSET_Y = Number.parseFloat(process.env.OMR_OFFSET_Y || '0');
const OMR_FID_RIGHT_OFFSET_PTS = Number.parseFloat(process.env.OMR_FID_RIGHT_OFFSET_PTS || '30');
const OMR_BUBBLE_RADIUS_PTS = Number.parseFloat(process.env.OMR_BUBBLE_RADIUS_PTS || '3.4');
const OMR_BOX_WIDTH_PTS = Number.parseFloat(process.env.OMR_BOX_WIDTH_PTS || '42');
const OMR_CENTER_TO_LEFT_PTS = Number.parseFloat(process.env.OMR_CENTER_TO_LEFT_PTS || '9.2');
const OMR_LOCAL_DRIFT_PENALTY = Number.parseFloat(process.env.OMR_LOCAL_DRIFT_PENALTY || '0.08');
const OMR_LOCAL_SEARCH_RATIO = Number.parseFloat(process.env.OMR_LOCAL_SEARCH_RATIO || '0.38');
const OMR_MAX_CENTER_DRIFT_RATIO = Number.parseFloat(process.env.OMR_MAX_CENTER_DRIFT_RATIO || '0.42');
const OMR_MIN_SAFE_RANGE = Number.parseFloat(process.env.OMR_MIN_SAFE_RANGE || '4');
const OMR_AMBIGUITY_RATIO = Number.parseFloat(process.env.OMR_AMBIGUITY_RATIO || '0.99');
const OMR_MIN_FILL_DELTA = Number.parseFloat(process.env.OMR_MIN_FILL_DELTA || '0.08');
const OMR_MIN_CENTER_GAP = Number.parseFloat(process.env.OMR_MIN_CENTER_GAP || '10');
const OMR_MIN_HYBRID_CONF = Number.parseFloat(process.env.OMR_MIN_HYBRID_CONF || '0.35');
const OMR_QUALITY_WARN_MIN = Number.parseFloat(process.env.OMR_QUALITY_WARN_MIN || '-1');
const OMR_QUALITY_REJECT_MIN = Number.parseFloat(process.env.OMR_QUALITY_REJECT_MIN || '0.65');
const OMR_QUALITY_REVIEW_MIN = Number.parseFloat(process.env.OMR_QUALITY_REVIEW_MIN || '0.8');
const OMR_AUTO_CONF_MIN = Number.parseFloat(process.env.OMR_AUTO_CONF_MIN || '0.75');
const OMR_AUTO_AMBIGUAS_MAX = Number.parseFloat(process.env.OMR_AUTO_AMBIGUAS_MAX || '0.1');
const OMR_EXPORT_PATCHES = String(process.env.OMR_EXPORT_PATCHES || '').toLowerCase() === 'true' || process.env.OMR_EXPORT_PATCHES === '1';
const OMR_PATCH_DIR = process.env.OMR_PATCH_DIR || path.resolve(process.cwd(), 'storage', 'omr_patches');
const OMR_PATCH_SIZE = Math.max(24, Number.parseInt(process.env.OMR_PATCH_SIZE || '56', 10));
const OMR_DEBUG = String(process.env.OMR_DEBUG || '').toLowerCase() === 'true' || process.env.OMR_DEBUG === '1';
const OMR_DEBUG_DIR = process.env.OMR_DEBUG_DIR || path.resolve(process.cwd(), 'storage', 'omr_debug');

type PerfilDeteccionOmr = {
  version: TemplateVersion;
  qrSizePts: number;
  bubbleRadiusPts: number;
  boxWidthPts: number;
  centerToLeftPts: number;
  alignRange: number;
  vertRange: number;
  localSearchRatio: number;
  localDriftPenalty: number;
  maxCenterDriftRatio: number;
  minSafeRange: number;
  scoreMin: number;
  scoreStd: number;
  strongScore: number;
  secondRatio: number;
  deltaMin: number;
  ambiguityRatio: number;
  minFillDelta: number;
  minCenterGap: number;
  minHybridConf: number;
  reprojectionMaxErrorPx: number;
};

function resolverPerfilDeteccion(templateVersion: TemplateVersion): PerfilDeteccionOmr {
  if (templateVersion === 2) {
    return {
      version: 2,
      qrSizePts: QR_SIZE_PTS_V2,
      bubbleRadiusPts: 5,
      boxWidthPts: 60,
      centerToLeftPts: 9.5,
      alignRange: Math.max(14, OMR_ALIGN_RANGE * 0.72),
      vertRange: Math.max(8, OMR_VERT_RANGE * 0.75),
      localSearchRatio: Math.max(0.2, OMR_LOCAL_SEARCH_RATIO * 0.85),
      localDriftPenalty: Math.max(0.1, OMR_LOCAL_DRIFT_PENALTY * 1.2),
      maxCenterDriftRatio: Math.max(0.24, OMR_MAX_CENTER_DRIFT_RATIO * 0.8),
      minSafeRange: Math.max(3, OMR_MIN_SAFE_RANGE),
      scoreMin: Math.max(0.1, OMR_SCORE_MIN),
      scoreStd: Math.max(0.6, OMR_SCORE_STD),
      strongScore: Math.max(0.11, OMR_STRONG_SCORE),
      secondRatio: Math.max(0.73, OMR_SECOND_RATIO),
      deltaMin: Math.max(0.03, OMR_DELTA_MIN),
      ambiguityRatio: Math.max(0.97, OMR_AMBIGUITY_RATIO),
      minFillDelta: Math.max(0.1, OMR_MIN_FILL_DELTA),
      minCenterGap: Math.max(12, OMR_MIN_CENTER_GAP),
      minHybridConf: Math.max(0.42, OMR_MIN_HYBRID_CONF),
      reprojectionMaxErrorPx: 2
    };
  }
  return {
    version: 1,
    qrSizePts: QR_SIZE_PTS_V1,
    bubbleRadiusPts: OMR_BUBBLE_RADIUS_PTS,
    boxWidthPts: OMR_BOX_WIDTH_PTS,
    centerToLeftPts: OMR_CENTER_TO_LEFT_PTS,
    alignRange: OMR_ALIGN_RANGE,
    vertRange: OMR_VERT_RANGE,
    localSearchRatio: OMR_LOCAL_SEARCH_RATIO,
    localDriftPenalty: OMR_LOCAL_DRIFT_PENALTY,
    maxCenterDriftRatio: OMR_MAX_CENTER_DRIFT_RATIO,
    minSafeRange: OMR_MIN_SAFE_RANGE,
    scoreMin: OMR_SCORE_MIN,
    scoreStd: OMR_SCORE_STD,
    strongScore: OMR_STRONG_SCORE,
    secondRatio: OMR_SECOND_RATIO,
    deltaMin: OMR_DELTA_MIN,
    ambiguityRatio: OMR_AMBIGUITY_RATIO,
    minFillDelta: OMR_MIN_FILL_DELTA,
    minCenterGap: OMR_MIN_CENTER_GAP,
    minHybridConf: OMR_MIN_HYBRID_CONF,
    reprojectionMaxErrorPx: Number.POSITIVE_INFINITY
  };
}

function limpiarBase64(entrada: string) {
  return entrada.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
}

type DebugInfo = {
  folio?: string;
  numeroPagina?: number;
  templateVersionDetectada?: TemplateVersion;
};

type DebugPregunta = {
  numeroPregunta: number;
  mejorOpcion: string | null;
  mejorScore: number;
  segundoScore: number;
  delta: number;
  dobleMarcada: boolean;
  suficiente: boolean;
  dx: number;
  dy: number;
  scoreMean: number;
  scoreStd: number;
  scoreThreshold: number;
  centros: Array<{ letra: string; x: number; y: number; score: number }>;
};

type DebugOmr = {
  folio?: string;
  numeroPagina?: number;
  width: number;
  height: number;
  transformacion: string;
  advertencias: string[];
  preguntas: DebugPregunta[];
};

type PatchRegistro = {
  numeroPregunta: number;
  letra: string;
  x: number;
  y: number;
  score: number;
  confianzaPregunta: number;
  seleccionada: boolean;
  opcionDetectada: string | null;
};

type ParametrosBurbuja = {
  radio: number;
  ringInner: number;
  ringOuter: number;
  outerOuter: number;
  paso: number;
};

function crearParametrosBurbuja(escalaX: number, bubbleRadiusPts: number): ParametrosBurbuja {
  const radio = Math.max(6, bubbleRadiusPts * escalaX);
  const ringInner = Math.max(radio + 2, radio * 1.4);
  const ringOuter = Math.max(ringInner + 4, radio * 2.2);
  const outerOuter = ringOuter + Math.max(3, radio * 0.5);
  const paso = Math.max(1, Math.round(radio / 4));
  return { radio, ringInner, ringOuter, outerOuter, paso };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function calcularCalidadPagina(args: {
  tipoTransformacion: 'qr' | 'homografia' | 'escala';
  qrDetectado: boolean;
  reprojectionErrorPromedio: number;
  blurVar: number;
  brilloMedio: number;
  confianzaMedia: number;
  ratioAmbiguas: number;
}) {
  const { tipoTransformacion, qrDetectado, reprojectionErrorPromedio, blurVar, brilloMedio, confianzaMedia, ratioAmbiguas } = args;
  const factorTransformacion = tipoTransformacion === 'escala' ? 0.62 : tipoTransformacion === 'homografia' ? 0.9 : 1;
  const factorQr = qrDetectado ? 1 : 0.78;
  const factorBlur = clamp01((blurVar - 70) / 320);
  const factorExposicion = clamp01(1 - Math.abs(brilloMedio - 145) / 120);
  const factorRepro = clamp01(1 - reprojectionErrorPromedio / 6);
  const factorNoAmbiguas = clamp01(1 - ratioAmbiguas);
  const calidad =
    factorTransformacion * 0.2 +
    factorQr * 0.12 +
    factorRepro * 0.24 +
    factorBlur * 0.16 +
    factorExposicion * 0.1 +
    clamp01(confianzaMedia) * 0.1 +
    factorNoAmbiguas * 0.08;
  return clamp01(calidad);
}

async function exportarPatchesOmr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  registros: PatchRegistro[],
  info: { folio?: string; numeroPagina?: number }
) {
  if (!OMR_EXPORT_PATCHES || registros.length === 0) return;
  const folioSafe = String(info.folio || 'sin-folio').replace(/[^a-zA-Z0-9_-]/g, '');
  const pagina = String(info.numeroPagina || '0');
  const baseDir = path.join(OMR_PATCH_DIR, folioSafe, `P${pagina}`);
  await fs.mkdir(baseDir, { recursive: true });

  const metadata: Array<Record<string, unknown>> = [];
  for (const reg of registros) {
    const left = Math.max(0, Math.round(reg.x - OMR_PATCH_SIZE / 2));
    const top = Math.max(0, Math.round(reg.y - OMR_PATCH_SIZE / 2));
    const crop = extraerSubimagenRgba(rgba, width, height, {
      left,
      top,
      width: OMR_PATCH_SIZE,
      height: OMR_PATCH_SIZE
    });
    const file = `q${String(reg.numeroPregunta).padStart(2, '0')}_${reg.letra}_${left}_${top}.png`;
    await sharp(Buffer.from(crop.data), { raw: { width: crop.width, height: crop.height, channels: 4 } })
      .png()
      .toFile(path.join(baseDir, file));
    metadata.push({
      file,
      numeroPregunta: reg.numeroPregunta,
      letra: reg.letra,
      x: reg.x,
      y: reg.y,
      score: reg.score,
      confianzaPregunta: reg.confianzaPregunta,
      seleccionada: reg.seleccionada,
      opcionDetectada: reg.opcionDetectada
    });
  }
  await fs.writeFile(path.join(baseDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
}

async function decodificarImagen(base64: string) {
  const buffer = Buffer.from(limpiarBase64(base64), 'base64');
  const imagen = sharp(buffer).rotate().normalize();
  const { width, height } = await imagen.metadata();
  if (!width || !height) {
    throw new Error('No se pudo leer la imagen');
  }
  const anchoObjetivo = Math.min(width, 1600);
  const imagenRedimensionada = imagen.resize({ width: anchoObjetivo });
  const { data, info } = await imagenRedimensionada.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width ?? width;
  const h = info.height ?? height;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  }

  const integral = calcularIntegral(gray, w, h);

  return {
    data: new Uint8ClampedArray(data),
    gray,
    integral,
    width: w,
    height: h,
    buffer
  };
}

type QrDetalle = {
  data: string;
  location: {
    topLeftCorner: Punto;
    topRightCorner: Punto;
    bottomRightCorner: Punto;
    bottomLeftCorner: Punto;
  };
};

function detectarQrDetalle(data: Uint8ClampedArray, width: number, height: number): QrDetalle | null {
  type QrLocationRaw = {
    topLeftCorner: Punto;
    topRightCorner: Punto;
    bottomRightCorner: Punto;
    bottomLeftCorner: Punto;
  };
  type QrRaw = { data?: string; location?: QrLocationRaw };
  const resultado = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' }) as QrRaw | null;
  if (!resultado?.data || !resultado.location) return null;
  return {
    data: resultado.data,
    location: {
      topLeftCorner: { x: resultado.location.topLeftCorner.x, y: resultado.location.topLeftCorner.y },
      topRightCorner: { x: resultado.location.topRightCorner.x, y: resultado.location.topRightCorner.y },
      bottomRightCorner: { x: resultado.location.bottomRightCorner.x, y: resultado.location.bottomRightCorner.y },
      bottomLeftCorner: { x: resultado.location.bottomLeftCorner.x, y: resultado.location.bottomLeftCorner.y }
    }
  };
}

function extraerSubimagenRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  crop: { left: number; top: number; width: number; height: number }
) {
  const w = Math.max(1, Math.min(width - crop.left, crop.width));
  const h = Math.max(1, Math.min(height - crop.top, crop.height));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const srcY = crop.top + y;
    for (let x = 0; x < w; x += 1) {
      const srcX = crop.left + x;
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * w + x) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return { data: out, width: w, height: h };
}

function extraerSubimagenGray(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  crop: { left: number; top: number; width: number; height: number }
) {
  const w = Math.max(1, Math.min(width - crop.left, crop.width));
  const h = Math.max(1, Math.min(height - crop.top, crop.height));
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y += 1) {
    const srcY = crop.top + y;
    for (let x = 0; x < w; x += 1) {
      const srcX = crop.left + x;
      out[y * w + x] = gray[srcY * width + srcX];
    }
  }
  return { gray: out, width: w, height: h };
}

function rgbaDesdeGray(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  umbral?: number,
  invertir = false
) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    let v = gray[i];
    if (typeof umbral === 'number') {
      v = v < umbral ? 0 : 255;
    }
    if (invertir) v = 255 - v;
    out[p] = v;
    out[p + 1] = v;
    out[p + 2] = v;
    out[p + 3] = 255;
  }
  return out;
}

function calcularIntegralBinaria(gray: Uint8ClampedArray, width: number, height: number, umbral: number) {
  const w1 = width + 1;
  const integral = new Uint32Array(w1 * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let fila = 0;
    for (let x = 1; x <= width; x += 1) {
      const val = gray[(y - 1) * width + (x - 1)] < umbral ? 1 : 0;
      fila += val;
      integral[y * w1 + x] = integral[(y - 1) * w1 + x] + fila;
    }
  }
  return integral;
}

function sumaVentana(integral: Uint32Array, width: number, x: number, y: number, w: number, h: number) {
  const w1 = width + 1;
  const x2 = x + w;
  const y2 = y + h;
  return integral[y2 * w1 + x2] - integral[y * w1 + x2] - integral[y2 * w1 + x] + integral[y * w1 + x];
}

function localizarQrRegion(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  region: { left: number; top: number; width: number; height: number },
  expectedSize: number
) {
  const sub = extraerSubimagenGray(gray, width, height, region);
  const integral = calcularIntegralBinaria(sub.gray, sub.width, sub.height, 140);
  const tamaños = [
    Math.round(expectedSize * 0.8),
    Math.round(expectedSize * 0.95),
    Math.round(expectedSize * 1.1),
    Math.round(expectedSize * 1.25)
  ].filter((s) => s > 10);
  let best = { score: 0, x: 0, y: 0, size: tamaños[1] ?? expectedSize };
  for (const size of tamaños) {
    const step = Math.max(4, Math.floor(size / 8));
    for (let y = 0; y + size < sub.height; y += step) {
      for (let x = 0; x + size < sub.width; x += step) {
        const negros = sumaVentana(integral, sub.width, x, y, size, size);
        const ratio = negros / (size * size);
        if (ratio > best.score) {
          best = { score: ratio, x, y, size };
        }
      }
    }
  }
  if (best.score < 0.12) return null;
  return {
    left: region.left + best.x,
    top: region.top + best.y,
    width: best.size,
    height: best.size
  };
}

function detectarQrMejorado(
  data: Uint8ClampedArray,
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  qrSizePtsHint = QR_SIZE_PTS_V1
): QrDetalle | null {
  const intentos: Array<{ data: Uint8ClampedArray; width: number; height: number; offsetX: number; offsetY: number }> = [];

  intentos.push({ data, width, height, offsetX: 0, offsetY: 0 });
  intentos.push({ data: rgbaDesdeGray(gray, width, height), width, height, offsetX: 0, offsetY: 0 });
  intentos.push({ data: rgbaDesdeGray(gray, width, height, 160), width, height, offsetX: 0, offsetY: 0 });
  intentos.push({ data: rgbaDesdeGray(gray, width, height, 160, true), width, height, offsetX: 0, offsetY: 0 });

  const cropBase = {
    left: Math.floor(width * 0.6),
    top: 0,
    width: Math.floor(width * 0.4),
    height: Math.floor(height * 0.35)
  };
  const cropRaw = extraerSubimagenRgba(data, width, height, cropBase);
  intentos.push({ data: cropRaw.data, width: cropRaw.width, height: cropRaw.height, offsetX: cropBase.left, offsetY: cropBase.top });
  const cropGray = extraerSubimagenGray(gray, width, height, cropBase);
  intentos.push({
    data: rgbaDesdeGray(cropGray.gray, cropGray.width, cropGray.height, 160),
    width: cropGray.width,
    height: cropGray.height,
    offsetX: cropBase.left,
    offsetY: cropBase.top
  });
  intentos.push({
    data: rgbaDesdeGray(cropGray.gray, cropGray.width, cropGray.height, 160, true),
    width: cropGray.width,
    height: cropGray.height,
    offsetX: cropBase.left,
    offsetY: cropBase.top
  });

  const tamañosQrPts = Array.from(new Set([qrSizePtsHint, QR_SIZE_PTS_V1, QR_SIZE_PTS_V2]));
  for (const qrPts of tamañosQrPts) {
    const expectedQr = Math.max(80, Math.round((qrPts / ANCHO_CARTA) * width));
    const region = localizarQrRegion(gray, width, height, cropBase, expectedQr);
    if (!region) continue;
    const regionRaw = extraerSubimagenRgba(data, width, height, region);
    intentos.push({
      data: regionRaw.data,
      width: regionRaw.width,
      height: regionRaw.height,
      offsetX: region.left,
      offsetY: region.top
    });
    const regionGray = extraerSubimagenGray(gray, width, height, region);
    intentos.push({
      data: rgbaDesdeGray(regionGray.gray, regionGray.width, regionGray.height, 160),
      width: regionGray.width,
      height: regionGray.height,
      offsetX: region.left,
      offsetY: region.top
    });
  }

  for (const intento of intentos) {
    const res = detectarQrDetalle(intento.data, intento.width, intento.height);
    if (!res) continue;
    const map = (p: Punto) => ({ x: p.x + intento.offsetX, y: p.y + intento.offsetY });
    return {
      data: res.data,
      location: {
        topLeftCorner: map(res.location.topLeftCorner),
        topRightCorner: map(res.location.topRightCorner),
        bottomRightCorner: map(res.location.bottomRightCorner),
        bottomLeftCorner: map(res.location.bottomLeftCorner)
      }
    };
  }
  return null;
}

function obtenerIntensidad(gray: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
  const idx = yi * width + xi;
  return gray[idx];
}

function calcularIntegral(gray: Uint8ClampedArray, width: number, height: number) {
  const w1 = width + 1;
  const integral = new Uint32Array(w1 * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let fila = 0;
    for (let x = 1; x <= width; x += 1) {
      fila += gray[(y - 1) * width + (x - 1)];
      integral[y * w1 + x] = integral[(y - 1) * w1 + x] + fila;
    }
  }
  return integral;
}

function mediaEnVentana(integral: Uint32Array, width: number, height: number, x0: number, y0: number, x1: number, y1: number) {
  const w1 = width + 1;
  const xa = Math.max(0, Math.min(width, Math.floor(x0)));
  const ya = Math.max(0, Math.min(height, Math.floor(y0)));
  const xb = Math.max(0, Math.min(width, Math.ceil(x1)));
  const yb = Math.max(0, Math.min(height, Math.ceil(y1)));
  const area = Math.max(1, (xb - xa) * (yb - ya));
  const sum =
    integral[yb * w1 + xb] -
    integral[ya * w1 + xb] -
    integral[yb * w1 + xa] +
    integral[ya * w1 + xa];
  return sum / area;
}

function detectarMarca(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  region: { x0: number; y0: number; x1: number; y1: number },
  esquina: 'tl' | 'tr' | 'bl' | 'br'
) {
  const paso = 2;
  let sumaX = 0;
  let sumaY = 0;
  let conteo = 0;
  let sum = 0;
  let sumSq = 0;
  const candidatos: Array<{ x: number; y: number; d: number }> = [];

  // Muestreo ligero para ubicar el centro de la marca negra sin procesar cada pixel.
  for (let y = region.y0; y < region.y1; y += paso) {
    for (let x = region.x0; x < region.x1; x += paso) {
      const intensidad = obtenerIntensidad(gray, width, height, x, y);
      sum += intensidad;
      sumSq += intensidad * intensidad;
    }
  }

  const total = Math.max(1, Math.floor(((region.y1 - region.y0) / paso) * ((region.x1 - region.x0) / paso)));
  const media = sum / total;
  const varianza = Math.max(0, sumSq / total - media * media);
  const desviacion = Math.sqrt(varianza);
  const umbral = Math.max(35, media - Math.max(15, desviacion * 1.1));

  for (let y = region.y0; y < region.y1; y += paso) {
    for (let x = region.x0; x < region.x1; x += paso) {
      const intensidad = obtenerIntensidad(gray, width, height, x, y);
      if (intensidad < umbral) {
        sumaX += x;
        sumaY += y;
        conteo += 1;
        const d =
          esquina === 'tl'
            ? x + y
            : esquina === 'tr'
              ? (width - x) + y
              : esquina === 'bl'
                ? x + (height - y)
                : (width - x) + (height - y);
        candidatos.push({ x, y, d });
      }
    }
  }

  if (!conteo || conteo < 12) return null;
  candidatos.sort((a, b) => a.d - b.d);
  const distanciaMin = candidatos[0]?.d ?? Infinity;
  const distanciaMaxima = Math.max(18, Math.min(width, height) * 0.12);
  if (distanciaMin > distanciaMaxima) {
    return null;
  }
  const limite = Math.max(8, Math.floor(candidatos.length * 0.15));
  let accX = 0;
  let accY = 0;
  for (let i = 0; i < Math.min(limite, candidatos.length); i += 1) {
    accX += candidatos[i].x;
    accY += candidatos[i].y;
  }
  const x = accX / Math.max(1, Math.min(limite, candidatos.length));
  const y = accY / Math.max(1, Math.min(limite, candidatos.length));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { x: sumaX / conteo, y: sumaY / conteo };
  }
  return { x, y };
}

function calcularHomografia(origen: Punto[], destino: Punto[]) {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i += 1) {
    const { x, y } = origen[i];
    const { x: u, y: v } = destino[i];

    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const h = resolverSistema(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function resolverSistema(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);

  for (let i = 0; i < n; i += 1) {
    let maxFila = i;
    for (let k = i + 1; k < n; k += 1) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxFila][i])) {
        maxFila = k;
      }
    }

    if (Math.abs(M[maxFila][i]) < 1e-8) return null;
    [M[i], M[maxFila]] = [M[maxFila], M[i]];

    const pivote = M[i][i];
    for (let j = i; j <= n; j += 1) {
      M[i][j] /= pivote;
    }

    for (let k = 0; k < n; k += 1) {
      if (k === i) continue;
      const factor = M[k][i];
      for (let j = i; j <= n; j += 1) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  return M.map((fila) => fila[n]);
}

function aplicarHomografia(h: number[], punto: Punto) {
  const [h11, h12, h13, h21, h22, h23, h31, h32] = h;
  const denom = h31 * punto.x + h32 * punto.y + 1;
  const x = (h11 * punto.x + h12 * punto.y + h13) / denom;
  const y = (h21 * punto.x + h22 * punto.y + h23) / denom;
  return { x, y };
}

function obtenerTransformacion(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  advertencias: string[],
  margenMm: number,
  qrSizePts: number,
  qr?: QrDetalle | null
) {
  const crearEscala = () => {
    const escalaX = width / ANCHO_CARTA;
    const escalaY = height / ALTO_CARTA;
    return (punto: Punto) => ({ x: punto.x * escalaX, y: height - punto.y * escalaY });
  };

  if (qr?.location) {
    const margen = margenMm * MM_A_PUNTOS;
    const x = ANCHO_CARTA - margen - qrSizePts;
    const y = margen;
    const origen = [
      { x, y },
      { x: x + qrSizePts, y },
      { x, y: y + qrSizePts },
      { x: x + qrSizePts, y: y + qrSizePts }
    ];
    const destino = [
      qr.location.topLeftCorner,
      qr.location.topRightCorner,
      qr.location.bottomLeftCorner,
      qr.location.bottomRightCorner
    ];
    const h = calcularHomografia(origen, destino);
    if (h) {
      return {
        transformar: (punto: Punto) => aplicarHomografia(h, { x: punto.x, y: ALTO_CARTA - punto.y }),
        tipo: 'qr' as const
      };
    }
  }
  const region = 0.15;
  const regiones = {
    tl: { x0: 0, y0: 0, x1: width * region, y1: height * region },
    tr: { x0: width * (1 - region), y0: 0, x1: width, y1: height * region },
    bl: { x0: 0, y0: height * (1 - region), x1: width * region, y1: height },
    br: { x0: width * (1 - region), y0: height * (1 - region), x1: width, y1: height }
  };

  const tl = detectarMarca(gray, width, height, regiones.tl, 'tl');
  const tr = detectarMarca(gray, width, height, regiones.tr, 'tr');
  const bl = detectarMarca(gray, width, height, regiones.bl, 'bl');
  const br = detectarMarca(gray, width, height, regiones.br, 'br');

  if (!tl || !tr || !bl || !br) {
    // Sin marcas completas, se aproxima con escala simple para no bloquear el flujo.
    advertencias.push('No se detectaron todas las marcas de registro; usando escala simple');
    return { transformar: crearEscala(), tipo: 'escala' as const };
  }
  const margenMax = 0.2;
  const dentro = (p: Punto, esquina: 'tl' | 'tr' | 'bl' | 'br') =>
    (esquina === 'tl' && p.x < width * margenMax && p.y < height * margenMax) ||
    (esquina === 'tr' && p.x > width * (1 - margenMax) && p.y < height * margenMax) ||
    (esquina === 'bl' && p.x < width * margenMax && p.y > height * (1 - margenMax)) ||
    (esquina === 'br' && p.x > width * (1 - margenMax) && p.y > height * (1 - margenMax));

  if (!dentro(tl, 'tl') || !dentro(tr, 'tr') || !dentro(bl, 'bl') || !dentro(br, 'br')) {
    advertencias.push('Marcas de registro fuera de esquina; usando escala simple');
    return { transformar: crearEscala(), tipo: 'escala' as const };
  }

  const margen = margenMm * MM_A_PUNTOS;
  const origen = [
    { x: margen, y: margen },
    { x: ANCHO_CARTA - margen, y: margen },
    { x: margen, y: ALTO_CARTA - margen },
    { x: ANCHO_CARTA - margen, y: ALTO_CARTA - margen }
  ];
  const destino = [tl, tr, bl, br];
  const h = calcularHomografia(origen, destino);

  if (!h) {
    advertencias.push('No se pudo calcular homografia; usando escala simple');
    return { transformar: crearEscala(), tipo: 'escala' as const };
  }

  return {
    transformar: (punto: Punto) => aplicarHomografia(h, { x: punto.x, y: ALTO_CARTA - punto.y }),
    tipo: 'homografia' as const
  };
}

function detectarOpcion(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centro: Punto,
  params: ParametrosBurbuja
) {
  const { radio, ringInner, ringOuter, outerOuter, paso } = params;
  const promLocal = mediaEnVentana(
    integral,
    width,
    height,
    centro.x - ringOuter,
    centro.y - ringOuter,
    centro.x + ringOuter,
    centro.y + ringOuter
  );
  const umbralBase = Math.max(40, Math.min(220, promLocal - 12));
  let pixeles = 0;
  let oscuros = 0;
  let pixelesRing = 0;
  let oscurosRing = 0;
  let suma = 0;
  let sumaRing = 0;
  let pixelesOuter = 0;
  let sumaOuter = 0;
  let sumaOuterSq = 0;
  let sumaSq = 0;
  let sumaRingSq = 0;

  // Cuenta pixeles oscuros dentro de un radio fijo para estimar marca.
  for (let y = -outerOuter; y <= outerOuter; y += paso) {
    for (let x = -outerOuter; x <= outerOuter; x += paso) {
      const dist = x * x + y * y;
      if (dist > outerOuter * outerOuter) continue;
      const intensidad = obtenerIntensidad(gray, width, height, centro.x + x, centro.y + y);
      if (dist <= radio * radio) {
        pixeles += 1;
        suma += intensidad;
        sumaSq += intensidad * intensidad;
      } else if (dist >= ringInner * ringInner) {
        if (dist <= ringOuter * ringOuter) {
          pixelesRing += 1;
          sumaRing += intensidad;
          sumaRingSq += intensidad * intensidad;
        } else {
          pixelesOuter += 1;
          sumaOuter += intensidad;
          sumaOuterSq += intensidad * intensidad;
        }
      }
    }
  }

  const promedio = suma / Math.max(1, pixeles);
  const promedioRing = sumaRing / Math.max(1, pixelesRing);
  const promedioOuter = sumaOuter / Math.max(1, pixelesOuter);
  const varOuter = Math.max(0, sumaOuterSq / Math.max(1, pixelesOuter) - promedioOuter * promedioOuter);
  const stdOuter = Math.sqrt(varOuter);
  const varCentro = Math.max(0, sumaSq / Math.max(1, pixeles) - promedio * promedio);
  const varRing = Math.max(0, sumaRingSq / Math.max(1, pixelesRing) - promedioRing * promedioRing);
  const stdCentro = Math.sqrt(varCentro);
  const stdRing = Math.sqrt(varRing);
  const umbral = Math.max(35, Math.min(220, Math.min(umbralBase, promedioOuter - Math.max(8, stdOuter * 0.6))));

  for (let y = -outerOuter; y <= outerOuter; y += paso) {
    for (let x = -outerOuter; x <= outerOuter; x += paso) {
      const dist = x * x + y * y;
      if (dist > outerOuter * outerOuter) continue;
      const intensidad = obtenerIntensidad(gray, width, height, centro.x + x, centro.y + y);
      if (dist <= radio * radio) {
        if (intensidad < umbral) oscuros += 1;
      } else if (dist >= ringInner * ringInner && dist <= ringOuter * ringOuter) {
        if (intensidad < umbral) oscurosRing += 1;
      }
    }
  }

  const ratio = oscuros / Math.max(1, pixeles);
  const ratioRing = oscurosRing / Math.max(1, pixelesRing);
  const fillDelta = Math.max(0, (promedioRing - promedio) / 255);
  const ringDelta = Math.max(0, (promedioOuter - promedioRing) / 255);
  const contraste = Math.max(0, (promedioOuter - promedio) / 255);

  // Puntaje fotometrico local: prioriza relleno central frente a borde/ruido.
  const score =
    fillDelta * 0.9 +
    contraste * 0.35 +
    ratio * 0.3 +
    ringDelta * 0.15 -
    ratioRing * 0.25;
  return {
    ratio,
    ratioRing,
    contraste,
    score,
    ringContrast: ringDelta,
    fillDelta,
    centerMean: promedio,
    ringMean: promedioRing,
    outerMean: promedioOuter
  };
}

function calcularMetricaAlineacion(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  dx: number,
  dy: number,
  params: ParametrosBurbuja
) {
  let mejorScore = 0;
  let segundoScore = 0;
  for (const opcion of centros) {
    const punto = { x: opcion.punto.x + dx, y: opcion.punto.y + dy };
    const { score } = detectarOpcion(gray, integral, width, height, punto, params);
    if (score > mejorScore) {
      segundoScore = mejorScore;
      mejorScore = score;
    } else if (score > segundoScore) {
      segundoScore = score;
    }
  }
  const delta = Math.max(0, mejorScore - segundoScore);
  // Priorizamos separacion clara entre opcion dominante y el resto.
  return delta * 1.4 + mejorScore * 0.3;
}

function evaluarAlineacionOffset(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  dx: number,
  dy: number,
  params: ParametrosBurbuja
) {
  return calcularMetricaAlineacion(gray, integral, width, height, centros, dx, dy, params);
}

function localizarMarcaLocal(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centro: Punto,
  radio = 18,
  fidSizePx = 10
) {
  const paso = 1;
  const half = Math.max(2, fidSizePx / 2);
  const x0 = Math.max(0, Math.floor(centro.x - radio));
  const x1 = Math.min(width - 1, Math.ceil(centro.x + radio));
  const y0 = Math.max(0, Math.floor(centro.y - radio));
  const y1 = Math.min(height - 1, Math.ceil(centro.y + radio));

  let mejorX = centro.x;
  let mejorY = centro.y;
  let mejorMean = Infinity;

  for (let y = y0; y <= y1; y += paso) {
    for (let x = x0; x <= x1; x += paso) {
      const mean = mediaEnVentana(integral, width, height, x - half, y - half, x + half, y + half);
      if (mean < mejorMean) {
        mejorMean = mean;
        mejorX = x;
        mejorY = y;
      }
    }
  }

  const fondo = mediaEnVentana(integral, width, height, centro.x - radio * 1.3, centro.y - radio * 1.3, centro.x + radio * 1.3, centro.y + radio * 1.3);
  if (mejorMean > fondo - 10) return null;
  if (!Number.isFinite(mejorX) || !Number.isFinite(mejorY)) return null;
  return { x: mejorX, y: mejorY };
}

function localizarBordeVertical(
  integral: Uint32Array,
  width: number,
  height: number,
  xEsperado: number,
  yTop: number,
  yBottom: number,
  rango = 18
) {
  const y0 = Math.max(0, Math.min(yTop, yBottom));
  const y1 = Math.min(height - 1, Math.max(yTop, yBottom));
  if (y1 - y0 < 8) return null;
  let mejorX = Math.round(xEsperado);
  let mejor = Infinity;
  for (let x = Math.floor(xEsperado - rango); x <= Math.ceil(xEsperado + rango); x += 1) {
    if (x < 2 || x >= width - 2) continue;
    const banda = mediaEnVentana(integral, width, height, x - 1, y0, x + 1, y1);
    if (banda < mejor) {
      mejor = banda;
      mejorX = x;
    }
  }
  const contexto = mediaEnVentana(integral, width, height, xEsperado - rango - 4, y0, xEsperado + rango + 4, y1);
  if (mejor > contexto - 6) return null;
  return mejorX;
}

type AjusteFiducialesResultado = {
  centros: Array<{ letra: string; punto: Punto }>;
  reprojectionErrorPx: number;
  puntosDetectados: number;
  puntosEsperados: number;
};

function distancia(a: Punto, b: Punto) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ajustarCentrosPorFiduciales(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  fidTop: Punto,
  fidBottom: Punto,
  fidSizePx: number,
  fidTopRight?: Punto,
  fidBottomRight?: Punto
): AjusteFiducialesResultado | null {
  const radio = Math.max(18, fidSizePx * 3.6);
  const detTop = localizarMarcaLocal(gray, integral, width, height, fidTop, radio, fidSizePx);
  const detBottom = localizarMarcaLocal(gray, integral, width, height, fidBottom, radio, fidSizePx);
  if (!detTop || !detBottom) return null;

  const dyEsperado = fidBottom.y - fidTop.y;
  const dyReal = detBottom.y - detTop.y;
  if (Math.abs(dyEsperado) < 1) return null;
  const scaleY = dyReal / dyEsperado;
  const offsetY = detTop.y - fidTop.y * scaleY;

  let scaleX = 1;
  let offsetX = (detTop.x - fidTop.x + detBottom.x - fidBottom.x) / 2;
  const yTopDet = Math.min(detTop.y, detBottom.y) - fidSizePx;
  const yBottomDet = Math.max(detTop.y, detBottom.y) + fidSizePx;
  let detTopR: Punto | null = null;
  let detBottomR: Punto | null = null;

  if (fidTopRight && fidBottomRight) {
    detTopR = localizarMarcaLocal(gray, integral, width, height, fidTopRight, radio, fidSizePx);
    detBottomR = localizarMarcaLocal(gray, integral, width, height, fidBottomRight, radio, fidSizePx);
    if (detTopR && detBottomR) {
      const dxEsperado = fidTopRight.x - fidTop.x;
      const dxReal = ((detTopR.x - detTop.x) + (detBottomR.x - detBottom.x)) / 2;
      if (Math.abs(dxEsperado) > 1) {
        scaleX = dxReal / dxEsperado;
      }
      const offsetLeft = detTop.x - fidTop.x * scaleX;
      const offsetRight = detTopR.x - fidTopRight.x * scaleX;
      offsetX = (offsetLeft + offsetRight) / 2;
    } else {
      const bordeIzq = localizarBordeVertical(integral, width, height, detTop.x, yTopDet, yBottomDet, Math.max(10, fidSizePx * 2));
      const bordeDer = localizarBordeVertical(
        integral,
        width,
        height,
        fidTopRight.x,
        yTopDet,
        yBottomDet,
        Math.max(14, fidSizePx * 3)
      );
      if (bordeIzq !== null && bordeDer !== null) {
        const dxEsperado = fidTopRight.x - fidTop.x;
        const dxReal = bordeDer - bordeIzq;
        if (Math.abs(dxEsperado) > 1) {
          scaleX = dxReal / dxEsperado;
        }
        const offsetLeft = bordeIzq - fidTop.x * scaleX;
        const offsetRight = bordeDer - fidTopRight.x * scaleX;
        offsetX = (offsetLeft + offsetRight) / 2;
      }
    }
  }

  if (!Number.isFinite(scaleX) || scaleX < 0.85 || scaleX > 1.15) {
    scaleX = 1;
    offsetX = (detTop.x - fidTop.x + detBottom.x - fidBottom.x) / 2;
  }

  const centrosAjustados = centros.map((opcion) => ({
    letra: opcion.letra,
    punto: {
      x: opcion.punto.x * scaleX + offsetX,
      y: opcion.punto.y * scaleY + offsetY
    }
  }));
  const errores: number[] = [distancia(detTop, fidTop), distancia(detBottom, fidBottom)];
  if (fidTopRight) {
    if (detTopR) errores.push(distancia(detTopR, fidTopRight));
    else errores.push(8);
  }
  if (fidBottomRight) {
    if (detBottomR) errores.push(distancia(detBottomR, fidBottomRight));
    else errores.push(8);
  }
  const reprojectionErrorPx = errores.reduce((acc, e) => acc + e, 0) / Math.max(1, errores.length);
  return {
    centros: centrosAjustados,
    reprojectionErrorPx,
    puntosDetectados: 2 + (detTopR ? 1 : 0) + (detBottomR ? 1 : 0),
    puntosEsperados: 2 + (fidTopRight ? 1 : 0) + (fidBottomRight ? 1 : 0)
  };
}

function ajustarCentrosVertical(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  params: ParametrosBurbuja,
  vertRange: number
) {
  if (centros.length < 2) return centros;
  const baseY = centros[0].punto.y;
  let mejorScore = -Infinity;
  let mejorScale = 1;
  let mejorOffset = 0;
  for (let scale = 0.96; scale <= 1.04 + 1e-6; scale += 0.01) {
    for (let offset = -vertRange; offset <= vertRange + 1e-6; offset += OMR_VERT_STEP) {
      const centrosAjustados = centros.map((opcion) => ({
        letra: opcion.letra,
        punto: { x: opcion.punto.x, y: baseY + (opcion.punto.y - baseY) * scale + offset }
      }));
      const score = calcularMetricaAlineacion(gray, integral, width, height, centrosAjustados, 0, 0, params);
      if (score > mejorScore) {
        mejorScore = score;
        mejorScale = scale;
        mejorOffset = offset;
      }
    }
  }
  return centros.map((opcion) => ({
    letra: opcion.letra,
    punto: {
      x: opcion.punto.x,
      y: baseY + (opcion.punto.y - baseY) * mejorScale + mejorOffset
    }
  }));
}

function ajustarCentrosPorCaja(
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  params: ParametrosBurbuja,
  escalaX: number,
  boxWidthPts: number,
  centerToLeftPts: number
) {
  if (centros.length === 0) return null;
  const xs = centros.map((c) => c.punto.x);
  const ys = centros.map((c) => c.punto.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const margenY = Math.max(8, params.ringOuter * 1.4);
  const yTop = Math.max(0, Math.min(height - 1, maxY + margenY));
  const yBottom = Math.max(0, Math.min(height - 1, minY - margenY));

  const offsetLeftPx = centerToLeftPts * escalaX;
  const boxWidthPx = boxWidthPts * escalaX;
  const expectedLeft = Math.min(...xs) - offsetLeftPx;
  const expectedRight = expectedLeft + boxWidthPx;

  const rango = Math.max(12, params.ringOuter * 1.1);
  const bordeIzq = localizarBordeVertical(integral, width, height, expectedLeft, yTop, yBottom, rango);
  const bordeDer = localizarBordeVertical(integral, width, height, expectedRight, yTop, yBottom, rango);
  if (bordeIzq === null || bordeDer === null) return null;

  const dxEsperado = expectedRight - expectedLeft;
  const dxReal = bordeDer - bordeIzq;
  if (Math.abs(dxEsperado) < 1) return null;

  const scaleX = dxReal / dxEsperado;
  const offsetX = bordeIzq - expectedLeft * scaleX;
  if (!Number.isFinite(scaleX) || scaleX < 0.88 || scaleX > 1.12) return null;

  return centros.map((opcion) => ({
    letra: opcion.letra,
    punto: {
      x: opcion.punto.x * scaleX + offsetX,
      y: opcion.punto.y
    }
  }));
}

function construirCentrosBasePregunta(
  pregunta: MapaOmrPagina['preguntas'][number],
  transformar: (punto: Punto) => Punto
) {
  return pregunta.opciones.map((opcion) => {
    const base = transformar({ x: opcion.x, y: opcion.y });
    return {
      letra: opcion.letra,
      punto: { x: base.x + OMR_OFFSET_X, y: base.y + OMR_OFFSET_Y }
    };
  });
}

type FiducialesNormalizados = {
  leftTop: Punto;
  leftBottom: Punto;
  rightTop: Punto;
  rightBottom: Punto;
};

type PreparacionPregunta = {
  centros: Array<{ letra: string; punto: Punto }>;
  reprojectionErrorPx: number | null;
  puntosFidDetectados: number;
  puntosFidEsperados: number;
  motivo?: string;
};

function normalizarFiducialesPregunta(
  fid: MapaOmrPagina['preguntas'][number]['fiduciales'],
  transformar: (punto: Punto) => Punto
): FiducialesNormalizados | null {
  if (!fid) return null;
  if ('leftTop' in fid) {
    return {
      leftTop: transformar(fid.leftTop),
      leftBottom: transformar(fid.leftBottom),
      rightTop: transformar(fid.rightTop),
      rightBottom: transformar(fid.rightBottom)
    };
  }
  return {
    leftTop: transformar(fid.top),
    leftBottom: transformar(fid.bottom),
    rightTop: transformar({ x: fid.top.x + OMR_FID_RIGHT_OFFSET_PTS, y: fid.top.y }),
    rightBottom: transformar({ x: fid.bottom.x + OMR_FID_RIGHT_OFFSET_PTS, y: fid.bottom.y })
  };
}

function prepararCentrosPregunta(
  estado: EstadoImagenOmr,
  pregunta: MapaOmrPagina['preguntas'][number],
  transformar: (punto: Punto) => Punto,
  perfil: PerfilDeteccionOmr
): PreparacionPregunta {
  const { gray, integral, width, height, escalaX, paramsBurbuja } = estado;
  const centrosBase = construirCentrosBasePregunta(pregunta, transformar);
  const fiduciales = normalizarFiducialesPregunta(pregunta.fiduciales, transformar);
  const fidSizePx = Math.max(6, (perfil.version === 2 ? 7 : 5) * escalaX);
  const ajusteFid = fiduciales
    ? ajustarCentrosPorFiduciales(
        gray,
        integral,
        width,
        height,
        centrosBase,
        fiduciales.leftTop,
        fiduciales.leftBottom,
        fidSizePx,
        fiduciales.rightTop,
        fiduciales.rightBottom
      )
    : null;
  const centrosCaja = !ajusteFid
    ? ajustarCentrosPorCaja(
        integral,
        width,
        height,
        centrosBase,
        paramsBurbuja,
        escalaX,
        perfil.boxWidthPts,
        perfil.centerToLeftPts
      )
    : null;
  const centros = ajustarCentrosVertical(
    gray,
    integral,
    width,
    height,
    centrosCaja ?? ajusteFid?.centros ?? centrosBase,
    paramsBurbuja,
    perfil.vertRange
  );
  if (!fiduciales) {
    return {
      centros,
      reprojectionErrorPx: null,
      puntosFidDetectados: 0,
      puntosFidEsperados: 0,
      motivo: 'Sin fiduciales por pregunta'
    };
  }
  if (!ajusteFid) {
    return {
      centros,
      reprojectionErrorPx: Number.POSITIVE_INFINITY,
      puntosFidDetectados: 0,
      puntosFidEsperados: 4,
      motivo: 'No se pudieron localizar fiduciales'
    };
  }
  return {
    centros,
    reprojectionErrorPx: ajusteFid.reprojectionErrorPx,
    puntosFidDetectados: ajusteFid.puntosDetectados,
    puntosFidEsperados: ajusteFid.puntosEsperados
  };
}

function extraerTemplateVersionDesdeQr(qrTexto?: string): TemplateVersion | undefined {
  if (!qrTexto) return undefined;
  const m = /:TV([12])\b/i.exec(qrTexto);
  if (!m) return undefined;
  return m[1] === '2' ? 2 : 1;
}

function calcularMetricasImagen(gray: Uint8ClampedArray, width: number, height: number) {
  const n = Math.max(1, width * height);
  let suma = 0;
  for (let i = 0; i < gray.length; i += 1) suma += gray[i];
  const brilloMedio = suma / n;

  if (width < 3 || height < 3) return { brilloMedio, blurVar: 0 };
  let lapSuma = 0;
  let lapSumaSq = 0;
  let conteo = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const c = gray[y * width + x];
      const lap =
        gray[y * width + (x - 1)] +
        gray[y * width + (x + 1)] +
        gray[(y - 1) * width + x] +
        gray[(y + 1) * width + x] -
        4 * c;
      lapSuma += lap;
      lapSumaSq += lap * lap;
      conteo += 1;
    }
  }
  const mediaLap = lapSuma / Math.max(1, conteo);
  const blurVar = Math.max(0, lapSumaSq / Math.max(1, conteo) - mediaLap * mediaLap);
  return { brilloMedio, blurVar };
}

export async function leerQrDesdeImagen(imagenBase64: string): Promise<string | undefined> {
  const { data, gray, width, height } = await decodificarImagen(imagenBase64);
  const qr = detectarQrMejorado(data, gray, width, height);
  return qr?.data;
}

export async function analizarOmr(
  imagenBase64: string,
  mapaPagina: MapaOmrPagina,
  qrEsperado?: string | string[],
  margenMm = 10,
  debugInfo?: DebugInfo
): Promise<ResultadoOmr> {
  const advertencias: string[] = [];
  const motivosRevision: string[] = [];
  const { data, gray, integral, width, height } = await decodificarImagen(imagenBase64);
  const templateInicial = debugInfo?.templateVersionDetectada ?? mapaPagina.templateVersion ?? 1;
  const perfilInicial = resolverPerfilDeteccion(templateInicial);
  let qrDetalle = detectarQrMejorado(data, gray, width, height, perfilInicial.qrSizePts);
  let qrTexto = qrDetalle?.data;
  const templateQr = extraerTemplateVersionDesdeQr(qrTexto);
  const templateVersionDetectada = templateQr ?? debugInfo?.templateVersionDetectada ?? mapaPagina.templateVersion ?? 1;
  const perfil = resolverPerfilDeteccion(templateVersionDetectada);
  if (!qrDetalle && perfil.qrSizePts !== perfilInicial.qrSizePts) {
    qrDetalle = detectarQrMejorado(data, gray, width, height, perfil.qrSizePts);
    qrTexto = qrDetalle?.data;
  }
  const escalaX = width / ANCHO_CARTA;
  const paramsBurbuja = crearParametrosBurbuja(escalaX, perfil.bubbleRadiusPts);

  if (!qrTexto) {
    advertencias.push('No se detecto QR en la imagen');
  }
  const qrEsperados = Array.isArray(qrEsperado) ? qrEsperado : qrEsperado ? [qrEsperado] : [];
  if (qrEsperados.length > 0 && qrTexto) {
    const normalizado = String(qrTexto).trim().toUpperCase();
    const coincide = qrEsperados.some((esperado) => {
      const exp = String(esperado).trim().toUpperCase();
      return normalizado === exp || normalizado.startsWith(`${exp}|`) || normalizado.includes(`FOLIO:${exp}`);
    });
    if (!coincide) {
      advertencias.push('El QR no coincide con el examen esperado');
    }
  }

  const transformacionBase = obtenerTransformacion(gray, width, height, advertencias, margenMm, perfil.qrSizePts, qrDetalle);
  const transformarEscala = (punto: Punto) => {
    const escalaX = width / ANCHO_CARTA;
    const escalaY = height / ALTO_CARTA;
    return { x: punto.x * escalaX, y: height - punto.y * escalaY };
  };
  let transformar = transformacionBase.transformar;

  const evaluarTransformacion = (transformador: (p: Punto) => Punto) => {
    const muestras = mapaPagina.preguntas.slice(0, Math.min(5, mapaPagina.preguntas.length));
    let totalScore = 0;
    let totalDelta = 0;
    for (const pregunta of muestras) {
      const centros = pregunta.opciones.map((opcion) => ({
        letra: opcion.letra,
        punto: transformador({ x: opcion.x, y: opcion.y })
      }));
      let mejorScore = 0;
      let segundoScore = 0;
      const rango = Math.max(8, Math.round(paramsBurbuja.ringOuter * 0.6));
      const paso = Math.max(1, Math.round(paramsBurbuja.radio / 4));
      for (let dy = -rango; dy <= rango; dy += paso) {
        for (let dx = -rango; dx <= rango; dx += paso) {
          const resultado = evaluarConOffset({
            gray,
            integral,
            width,
            height,
            centros,
            dx,
            dy,
            params: paramsBurbuja,
            localSearchRatio: perfil.localSearchRatio,
            localDriftPenalty: perfil.localDriftPenalty,
            detectarOpcion
          });
          if (resultado.mejorScore > mejorScore) {
            segundoScore = resultado.segundoScore;
            mejorScore = resultado.mejorScore;
          } else if (resultado.mejorScore > segundoScore) {
            segundoScore = resultado.mejorScore;
          }
        }
      }
      totalScore += mejorScore;
      totalDelta += Math.max(0, mejorScore - segundoScore);
    }
    const denom = Math.max(1, muestras.length);
    return { score: totalScore / denom, delta: totalDelta / denom };
  };

  if (transformacionBase.tipo === 'homografia' || transformacionBase.tipo === 'qr') {
    const calidadHom = evaluarTransformacion(transformacionBase.transformar);
    const calidadEscala = evaluarTransformacion(transformarEscala);
    const puntajeHom = calidadHom.score + calidadHom.delta * 0.6;
    const puntajeEscala = calidadEscala.score + calidadEscala.delta * 0.6;
    if (puntajeEscala > puntajeHom + 0.03) {
      advertencias.push('Se eligio transformacion por escala por mayor coherencia de marcas');
      motivosRevision.push('Alineacion global inestable (se uso escala simple)');
      transformar = transformarEscala;
    }
  }
  const estado: EstadoImagenOmr = { gray, integral, width, height, escalaX, paramsBurbuja };
  const respuestasDetectadas: ResultadoOmr['respuestasDetectadas'] = [];
  const patches: PatchRegistro[] = [];
  let sumaConfianza = 0;
  let preguntasAmbiguas = 0;
  let reprojectionErrorAcumulado = 0;
  let reprojectionErrorConteo = 0;
  const debug: DebugOmr | null = OMR_DEBUG
    ? {
        folio: debugInfo?.folio,
        numeroPagina: debugInfo?.numeroPagina,
        width,
        height,
        transformacion: transformacionBase.tipo,
        advertencias: [...advertencias],
        preguntas: []
      }
    : null;

  mapaPagina.preguntas.forEach((pregunta) => {
    const prep = prepararCentrosPregunta(estado, pregunta, transformar, perfil);
    const centros = prep.centros;
    if (prep.reprojectionErrorPx !== null && Number.isFinite(prep.reprojectionErrorPx)) {
      reprojectionErrorAcumulado += prep.reprojectionErrorPx;
      reprojectionErrorConteo += 1;
    }
    if (
      perfil.reprojectionMaxErrorPx < Number.POSITIVE_INFINITY &&
      (!Number.isFinite(prep.reprojectionErrorPx ?? Number.NaN) || (prep.reprojectionErrorPx ?? Infinity) > perfil.reprojectionMaxErrorPx)
    ) {
      respuestasDetectadas.push({
        numeroPregunta: pregunta.numeroPregunta,
        opcion: null,
        confianza: 0
      });
      preguntasAmbiguas += 1;
      motivosRevision.push(`P${pregunta.numeroPregunta}: error geometrico local (fiduciales)`);
      if (debug) {
        debug.preguntas.push({
          numeroPregunta: pregunta.numeroPregunta,
          mejorOpcion: null,
          mejorScore: 0,
          segundoScore: 0,
          delta: 0,
          dobleMarcada: true,
          suficiente: false,
          dx: 0,
          dy: 0,
          scoreMean: 0,
          scoreStd: 0,
          scoreThreshold: 0,
          centros: centros.map((c) => ({ letra: c.letra, x: c.punto.x, y: c.punto.y, score: 0 }))
        });
      }
      return;
    }
    const { mejorDx, mejorDy } = buscarMejorOffsetPregunta({
      estado,
      centros,
      alignRange: perfil.alignRange,
      maxCenterDriftRatio: perfil.maxCenterDriftRatio,
      minSafeRange: perfil.minSafeRange,
      evaluarAlineacionOffset
    });
    const resultado = evaluarConOffset({
      gray,
      integral,
      width,
      height,
      centros,
      dx: mejorDx,
      dy: mejorDy,
      params: paramsBurbuja,
      localSearchRatio: perfil.localSearchRatio,
      localDriftPenalty: perfil.localDriftPenalty,
      detectarOpcion
    });
    const metricas = calcularMetricasPregunta({
      estado,
      centros,
      resultado,
      mejorDx,
      mejorDy,
      umbrales: {
        scoreMin: perfil.scoreMin,
        scoreStd: perfil.scoreStd,
        strongScore: perfil.strongScore,
        secondRatio: perfil.secondRatio,
        deltaMin: perfil.deltaMin,
        ambiguityRatio: perfil.ambiguityRatio,
        minFillDelta: perfil.minFillDelta,
        minCenterGap: perfil.minCenterGap,
        minHybridConfidence: perfil.minHybridConf
      },
      detectarOpcion
    });
    respuestasDetectadas.push({
      numeroPregunta: pregunta.numeroPregunta,
      opcion: metricas.suficiente ? metricas.mejorOpcion : null,
      confianza: metricas.confianza
    });
    sumaConfianza += metricas.confianza;
    if (metricas.dobleMarcada || !metricas.suficiente) {
      preguntasAmbiguas += 1;
      if (metricas.dobleMarcada) {
        motivosRevision.push(`P${pregunta.numeroPregunta}: multiple marca / ambiguedad`);
      }
    }

    const opcionDetectada = metricas.suficiente ? metricas.mejorOpcion : null;
    for (const s of resultado.scores) {
      patches.push({
        numeroPregunta: pregunta.numeroPregunta,
        letra: s.letra,
        x: s.x,
        y: s.y,
        score: s.score,
        confianzaPregunta: metricas.confianza,
        seleccionada: s.letra === opcionDetectada,
        opcionDetectada
      });
    }

    if (debug) {
      const centrosConScore = centros.map((item) => {
        const scoreItem = resultado.scores.find((s) => s.letra === item.letra);
        return {
          letra: item.letra,
          x: scoreItem?.x ?? item.punto.x,
          y: scoreItem?.y ?? item.punto.y,
          score: scoreItem?.score ?? 0
        };
      });
      debug.preguntas.push({
        numeroPregunta: pregunta.numeroPregunta,
        mejorOpcion: metricas.mejorOpcion,
        mejorScore: metricas.mejorScore,
        segundoScore: metricas.segundoScore,
        delta: metricas.delta,
        dobleMarcada: metricas.dobleMarcada,
        suficiente: metricas.suficiente,
        dx: mejorDx,
        dy: mejorDy,
        scoreMean: metricas.scoreMean,
        scoreStd: metricas.scoreStd,
        scoreThreshold: metricas.scoreThreshold,
        centros: centrosConScore
      });
    }
  });

  if (debug) {
    try {
      const folioSafe = String(debugInfo?.folio || 'sin-folio').replace(/[^a-zA-Z0-9_-]/g, '');
      const paginaSafe = String(debugInfo?.numeroPagina || mapaPagina.numeroPagina || '0');
      const dir = path.join(OMR_DEBUG_DIR, folioSafe);
      await fs.mkdir(dir, { recursive: true });
      const baseName = `P${paginaSafe}_${Date.now()}`;
      const jsonPath = path.join(dir, `${baseName}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(debug, null, 2), 'utf8');

      const top2PorPregunta = new Map<number, { primero?: string; segundo?: string }>();
      for (const p of debug.preguntas) {
        const orden = [...p.centros].sort((a, b) => b.score - a.score);
        top2PorPregunta.set(p.numeroPregunta, { primero: orden[0]?.letra, segundo: orden[1]?.letra });
      }

      const svgPartes: string[] = [];
      svgPartes.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`);
      svgPartes.push(`<rect width="100%" height="100%" fill="none"/>`);
      for (const p of debug.preguntas) {
        const top2 = top2PorPregunta.get(p.numeroPregunta) || {};
        for (const c of p.centros) {
          const color =
            c.letra === top2.primero
              ? '#22c55e'
              : c.letra === top2.segundo
                ? '#f59e0b'
                : '#38bdf8';
          svgPartes.push(
            `<circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="6" stroke="${color}" stroke-width="2" fill="none" />`
          );
          svgPartes.push(
            `<text x="${(c.x + 7).toFixed(2)}" y="${(c.y - 6).toFixed(2)}" font-size="10" fill="${color}" font-family="Arial">${c.letra}</text>`
          );
        }
      }
      svgPartes.push(`</svg>`);
      const svg = Buffer.from(svgPartes.join(''));

      const buffer = Buffer.from(limpiarBase64(imagenBase64), 'base64');
      await sharp(buffer)
        .rotate()
        .normalize()
        .resize({ width })
        .composite([{ input: svg, top: 0, left: 0 }])
        .png()
        .toFile(path.join(dir, `${baseName}.png`));
    } catch {
      // No bloquea flujo si falla el debug.
    }
  }
  const confianzaMedia = respuestasDetectadas.length ? sumaConfianza / respuestasDetectadas.length : 0;
  const ratioAmbiguas = respuestasDetectadas.length > 0 ? preguntasAmbiguas / respuestasDetectadas.length : 1;
  const reprojectionErrorPromedio =
    reprojectionErrorConteo > 0 ? reprojectionErrorAcumulado / reprojectionErrorConteo : templateVersionDetectada === 2 ? 10 : 2.5;
  const metricasImagen = calcularMetricasImagen(gray, width, height);
  const calidadPagina = calcularCalidadPagina({
    tipoTransformacion: transformacionBase.tipo,
    qrDetectado: Boolean(qrTexto),
    reprojectionErrorPromedio,
    blurVar: metricasImagen.blurVar,
    brilloMedio: metricasImagen.brilloMedio,
    confianzaMedia,
    ratioAmbiguas
  });
  if (OMR_QUALITY_WARN_MIN >= 0 && calidadPagina < OMR_QUALITY_WARN_MIN) {
    advertencias.push(`Calidad de pagina baja (${calidadPagina.toFixed(2)})`);
  }
  let estadoAnalisis: ResultadoOmr['estadoAnalisis'] = 'ok';
  const puedeRechazarPorCalidad = respuestasDetectadas.length >= 3;
  if (calidadPagina < OMR_QUALITY_REJECT_MIN && puedeRechazarPorCalidad) {
    for (const r of respuestasDetectadas) {
      r.opcion = null;
      r.confianza = 0;
    }
    estadoAnalisis = 'rechazado_calidad';
    motivosRevision.push(`Calidad insuficiente (${calidadPagina.toFixed(2)} < ${OMR_QUALITY_REJECT_MIN.toFixed(2)})`);
    advertencias.push(`Pagina rechazada por baja calidad (${calidadPagina.toFixed(2)})`);
  } else if (calidadPagina < OMR_QUALITY_REJECT_MIN && !puedeRechazarPorCalidad) {
    estadoAnalisis = 'requiere_revision';
    motivosRevision.push(`Calidad baja en muestra reducida (${calidadPagina.toFixed(2)})`);
  } else if (
    calidadPagina < OMR_QUALITY_REVIEW_MIN ||
    confianzaMedia < OMR_AUTO_CONF_MIN ||
    ratioAmbiguas > OMR_AUTO_AMBIGUAS_MAX
  ) {
    estadoAnalisis = 'requiere_revision';
    if (calidadPagina < OMR_QUALITY_REVIEW_MIN) {
      motivosRevision.push(`Calidad media (${calidadPagina.toFixed(2)}), requiere revision`);
    }
    if (confianzaMedia < OMR_AUTO_CONF_MIN) {
      motivosRevision.push(`Confianza promedio baja (${confianzaMedia.toFixed(2)})`);
    }
    if (ratioAmbiguas > OMR_AUTO_AMBIGUAS_MAX) {
      motivosRevision.push(`Ambiguedad alta (${(ratioAmbiguas * 100).toFixed(1)}%)`);
    }
  }
  try {
    await exportarPatchesOmr(data, width, height, patches, {
      folio: debugInfo?.folio,
      numeroPagina: debugInfo?.numeroPagina ?? mapaPagina.numeroPagina
    });
  } catch {
    // No bloquea flujo si falla export de patches.
  }

  const motivosUnicos = Array.from(new Set(motivosRevision)).slice(0, 24);
  return {
    respuestasDetectadas,
    advertencias,
    qrTexto,
    calidadPagina,
    estadoAnalisis,
    motivosRevision: motivosUnicos,
    templateVersionDetectada,
    confianzaPromedioPagina: confianzaMedia,
    ratioAmbiguas
  };
}
