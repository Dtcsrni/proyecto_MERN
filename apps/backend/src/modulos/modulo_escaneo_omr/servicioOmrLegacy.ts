/**
 * Servicio de escaneo OMR basado en posiciones del PDF.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  buscarMejorOffsetPregunta,
  calcularMetricasPregunta,
  evaluarConOffset,
  type EstadoImagenOmr
} from './omrCore';
import {
  calcularIntegral,
  detectarOpcion,
  detectarQrMejorado,
  extraerSubimagenRgba,
  mediaEnVentana,
  obtenerTransformacion
} from './infra/imagenProcesamientoLegacy';

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
type PerfilGeometriaOmr = 'actual' | 'geo_tight_search';

type MapaOmrPagina = {
  numeroPagina: number;
  templateVersion?: TemplateVersion;
  perfilLayout?: {
    gridStepPt?: number;
    headerHeightFirst?: number;
    headerHeightOther?: number;
    bottomSafePt?: number;
  };
  preguntas: Array<{
    numeroPregunta: number;
    idPregunta: string;
    opciones: Array<{ letra: string; x: number; y: number }>;
    cajaOmr?: { x: number; y: number; width: number; height: number };
    perfilOmr?: { radio?: number; pasoY?: number; cajaAncho?: number };
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

// Geometria base de hoja carta en puntos PDF.
const ANCHO_CARTA = 612; const ALTO_CARTA = 792;
const MM_A_PUNTOS = 72 / 25.4; const QR_SIZE_PTS_V1 = 68; const QR_SIZE_PTS_V2 = 88;

const PERFILES_GEOMETRIA_OMR: Record<PerfilGeometriaOmr, {
  alignRange: number;
  vertRange: number;
  localSearchRatio: number;
  offsetX: number;
  offsetY: number;
}> = {
  actual: {
    alignRange: 22,
    vertRange: 12,
    localSearchRatio: 0.38,
    offsetX: 0,
    offsetY: 0
  },
  geo_tight_search: {
    alignRange: 16,
    vertRange: 8,
    localSearchRatio: 0.3,
    offsetX: 0,
    offsetY: 0
  }
};

function resolverPerfilGeometriaOmr(): PerfilGeometriaOmr {
  const raw = String(process.env.OMR_GEOMETRY_PROFILE || 'actual').trim().toLowerCase();
  const seleccionado: PerfilGeometriaOmr = raw === 'geo_tight_search' ? 'geo_tight_search' : 'actual';
  const entorno = String(process.env.NODE_ENV || 'development').toLowerCase();
  const forceProd = String(process.env.OMR_GEOMETRY_PROFILE_FORCE_PROD || '').trim().toLowerCase();
  const puedeEnProd = forceProd === '1' || forceProd === 'true';
  if (entorno === 'production' && seleccionado !== 'actual' && !puedeEnProd) {
    return 'actual';
  }
  return seleccionado;
}

const PERFIL_GEOMETRIA_OMR_ACTIVO = resolverPerfilGeometriaOmr();
const GEOMETRIA_OMR_DEFAULT = PERFILES_GEOMETRIA_OMR[PERFIL_GEOMETRIA_OMR_ACTIVO];
// Parametros de deteccion ajustables por entorno (centralizados para calibracion/auditoria).
const OMR_SCORE_MIN = Number.parseFloat(process.env.OMR_SCORE_MIN || '0.08');
const OMR_DELTA_MIN = Number.parseFloat(process.env.OMR_DELTA_MIN || '0.02');
const OMR_STRONG_SCORE = Number.parseFloat(process.env.OMR_STRONG_SCORE || '0.09');
const OMR_SECOND_RATIO = Number.parseFloat(process.env.OMR_SECOND_RATIO || '0.75');
const OMR_SCORE_STD = Number.parseFloat(process.env.OMR_SCORE_STD || '0.6');
const OMR_ALIGN_RANGE = Number.parseFloat(process.env.OMR_ALIGN_RANGE || String(GEOMETRIA_OMR_DEFAULT.alignRange));
const OMR_VERT_RANGE = Number.parseFloat(process.env.OMR_VERT_RANGE || String(GEOMETRIA_OMR_DEFAULT.vertRange));
const OMR_VERT_STEP = Number.parseFloat(process.env.OMR_VERT_STEP || '2');
const OMR_OFFSET_X = Number.parseFloat(process.env.OMR_OFFSET_X || String(GEOMETRIA_OMR_DEFAULT.offsetX));
const OMR_OFFSET_Y = Number.parseFloat(process.env.OMR_OFFSET_Y || String(GEOMETRIA_OMR_DEFAULT.offsetY));
const OMR_FID_RIGHT_OFFSET_PTS = Number.parseFloat(process.env.OMR_FID_RIGHT_OFFSET_PTS || '30');
const OMR_BUBBLE_RADIUS_PTS = Number.parseFloat(process.env.OMR_BUBBLE_RADIUS_PTS || '3.4');
const OMR_BOX_WIDTH_PTS = Number.parseFloat(process.env.OMR_BOX_WIDTH_PTS || '42');
const OMR_CENTER_TO_LEFT_PTS = Number.parseFloat(process.env.OMR_CENTER_TO_LEFT_PTS || '9.2');
const OMR_LOCAL_DRIFT_PENALTY = Number.parseFloat(process.env.OMR_LOCAL_DRIFT_PENALTY || '0.08');
const OMR_LOCAL_SEARCH_RATIO = Number.parseFloat(process.env.OMR_LOCAL_SEARCH_RATIO || String(GEOMETRIA_OMR_DEFAULT.localSearchRatio));
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
const OMR_AUTO_RESCUE_QUALITY_MIN = Number.parseFloat(process.env.OMR_AUTO_RESCUE_QUALITY_MIN || '0.58');
const OMR_AUTO_RESCUE_CONF_MIN = Number.parseFloat(process.env.OMR_AUTO_RESCUE_CONF_MIN || '0.84');
const OMR_AUTO_RESCUE_AMBIG_MAX = Number.parseFloat(process.env.OMR_AUTO_RESCUE_AMBIG_MAX || '0.04');
const OMR_EXPORT_PATCHES = String(process.env.OMR_EXPORT_PATCHES || '').toLowerCase() === 'true' || process.env.OMR_EXPORT_PATCHES === '1';
const OMR_PATCH_DIR = process.env.OMR_PATCH_DIR || path.resolve(process.cwd(), 'storage', 'omr_patches');
const OMR_PATCH_SIZE = Math.max(24, Number.parseInt(process.env.OMR_PATCH_SIZE || '56', 10));
const OMR_DEBUG = String(process.env.OMR_DEBUG || '').toLowerCase() === 'true' || process.env.OMR_DEBUG === '1';
const OMR_DEBUG_DIR = process.env.OMR_DEBUG_DIR || path.resolve(process.cwd(), 'storage', 'omr_debug');
const OMR_COLORIMETRY_ENABLED =
  String(process.env.OMR_COLORIMETRY_ENABLED || '1').toLowerCase() !== 'false' && process.env.OMR_COLORIMETRY_ENABLED !== '0';
const OMR_COLORIMETRY_WHITE_PERCENTILE = Math.max(
  0.85,
  Math.min(0.99, Number.parseFloat(process.env.OMR_COLORIMETRY_WHITE_PERCENTILE || '0.96'))
);

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
  minTopZScore: number;
  ambiguityRatio: number;
  minFillDelta: number;
  minCenterGap: number;
  minHybridConf: number;
  reprojectionMaxErrorPx: number;
};

function resolverPerfilDeteccion(templateVersion: TemplateVersion): PerfilDeteccionOmr {
  // Perfil V2: parametros mas tolerantes a variaciones de captura.
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
      minTopZScore: 1.35,
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
    scoreMin: Math.max(0.11, OMR_SCORE_MIN),
    scoreStd: OMR_SCORE_STD,
    strongScore: OMR_STRONG_SCORE,
    secondRatio: OMR_SECOND_RATIO,
    deltaMin: Math.max(0.035, OMR_DELTA_MIN),
    minTopZScore: 1.25,
    ambiguityRatio: Math.min(0.95, OMR_AMBIGUITY_RATIO),
    minFillDelta: Math.max(0.11, OMR_MIN_FILL_DELTA),
    minCenterGap: OMR_MIN_CENTER_GAP,
    minHybridConf: Math.max(0.5, OMR_MIN_HYBRID_CONF),
    reprojectionMaxErrorPx: Number.POSITIVE_INFINITY
  };
}

function mediana(valores: number[]) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[medio - 1] + ordenados[medio]) / 2 : ordenados[medio];
}

function ajustarPerfilConMapa(perfilBase: PerfilDeteccionOmr, mapaPagina: MapaOmrPagina): PerfilDeteccionOmr {
  const radios: number[] = [];
  const anchosCaja: number[] = [];
  const offsetsCentroIzq: number[] = [];

  for (const pregunta of mapaPagina.preguntas ?? []) {
    if (Number.isFinite(pregunta.perfilOmr?.radio)) radios.push(Number(pregunta.perfilOmr?.radio));
    if (Number.isFinite(pregunta.cajaOmr?.width)) anchosCaja.push(Number(pregunta.cajaOmr?.width));
    const opcionA = pregunta.opciones?.find((op) => op.letra === 'A');
    if (opcionA && Number.isFinite(pregunta.cajaOmr?.x)) {
      offsetsCentroIzq.push(Number(opcionA.x) - Number(pregunta.cajaOmr?.x));
    }
  }

  const radio = mediana(radios);
  const anchoCaja = mediana(anchosCaja);
  const offset = mediana(offsetsCentroIzq);

  return {
    ...perfilBase,
    bubbleRadiusPts:
      radio !== null ? Math.max(2.6, Math.min(7.2, radio)) : perfilBase.bubbleRadiusPts,
    boxWidthPts:
      anchoCaja !== null ? Math.max(32, Math.min(84, anchoCaja)) : perfilBase.boxWidthPts,
    centerToLeftPts:
      offset !== null ? Math.max(4.5, Math.min(22, offset)) : perfilBase.centerToLeftPts
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
  colorCast: number;
  saturationMean: number;
  confianzaMedia: number;
  ratioAmbiguas: number;
}) {
  const {
    tipoTransformacion,
    qrDetectado,
    reprojectionErrorPromedio,
    blurVar,
    brilloMedio,
    colorCast,
    saturationMean,
    confianzaMedia,
    ratioAmbiguas
  } = args;
  const factorTransformacion = tipoTransformacion === 'escala' ? 0.74 : tipoTransformacion === 'homografia' ? 0.9 : 1;
  const factorQr = qrDetectado ? 1 : 0.78;
  const factorBlur = Math.max(0.35, clamp01((blurVar - 70) / 320));
  const factorExposicion = clamp01(1 - Math.abs(brilloMedio - 145) / 120);
  const factorRepro = clamp01(1 - reprojectionErrorPromedio / 6);
  const factorColorBalance = clamp01(1 - colorCast / 0.24);
  const excesoSaturacion = Math.max(0, saturationMean - 0.28);
  const factorSaturacion = clamp01(1 - excesoSaturacion / 0.45);
  const factorNoAmbiguas = clamp01(1 - ratioAmbiguas);
  const calidad =
    factorTransformacion * 0.22 +
    factorQr * 0.14 +
    factorRepro * 0.25 +
    factorBlur * 0.17 +
    factorExposicion * 0.12 +
    factorColorBalance * 0.06 +
    factorSaturacion * 0.02 +
    clamp01(confianzaMedia) * 0.01 +
    factorNoAmbiguas * 0.01;
  return clamp01(calidad);
}

function resolverEstadoAnalisis(args: {
  calidadPagina: number;
  confianzaMedia: number;
  ratioAmbiguas: number;
  totalRespuestas: number;
}) {
  const { calidadPagina, confianzaMedia, ratioAmbiguas, totalRespuestas } = args;
  const motivos: string[] = [];
  const advertencias: string[] = [];
  const puedeRechazarPorCalidad = totalRespuestas >= 3;
  const rescateAltaPrecision =
    calidadPagina >= OMR_AUTO_RESCUE_QUALITY_MIN &&
    confianzaMedia >= OMR_AUTO_RESCUE_CONF_MIN &&
    ratioAmbiguas <= OMR_AUTO_RESCUE_AMBIG_MAX;
  let estado: ResultadoOmr['estadoAnalisis'] = 'ok';
  let anularRespuestas = false;

  if (calidadPagina < OMR_QUALITY_REJECT_MIN && puedeRechazarPorCalidad) {
    const senalMuyDebil = confianzaMedia < 0.2 || ratioAmbiguas > 0.85;
    if (senalMuyDebil) {
      estado = 'rechazado_calidad';
      anularRespuestas = true;
      motivos.push(`Calidad insuficiente (${calidadPagina.toFixed(2)} < ${OMR_QUALITY_REJECT_MIN.toFixed(2)})`);
      advertencias.push(`Pagina rechazada por baja calidad (${calidadPagina.toFixed(2)})`);
    } else {
      estado = 'requiere_revision';
      motivos.push(`Calidad baja (${calidadPagina.toFixed(2)}), revisar manualmente`);
    }
  } else if (calidadPagina < OMR_QUALITY_REJECT_MIN && !puedeRechazarPorCalidad) {
    estado = 'requiere_revision';
    motivos.push(`Calidad baja en muestra reducida (${calidadPagina.toFixed(2)})`);
  } else if (
    calidadPagina < OMR_QUALITY_REVIEW_MIN ||
    confianzaMedia < OMR_AUTO_CONF_MIN ||
    ratioAmbiguas > OMR_AUTO_AMBIGUAS_MAX
  ) {
    if (rescateAltaPrecision) {
      estado = 'ok';
      advertencias.push(
        `Calidad baja compensada por senal OMR fuerte (confianza ${confianzaMedia.toFixed(2)}, ambiguas ${(ratioAmbiguas * 100).toFixed(1)}%)`
      );
    } else {
      estado = 'requiere_revision';
      if (calidadPagina < OMR_QUALITY_REVIEW_MIN) {
        motivos.push(`Calidad media (${calidadPagina.toFixed(2)}), requiere revision`);
      }
      if (confianzaMedia < OMR_AUTO_CONF_MIN) {
        motivos.push(`Confianza promedio baja (${confianzaMedia.toFixed(2)})`);
      }
      if (ratioAmbiguas > OMR_AUTO_AMBIGUAS_MAX) {
        motivos.push(`Ambiguedad alta (${(ratioAmbiguas * 100).toFixed(1)}%)`);
      }
    }
  }

  return { estado, motivos, advertencias, anularRespuestas };
}

type MetricasColorimetria = {
  colorCast: number;
  saturationMean: number;
  whiteRefR: number;
  whiteRefG: number;
  whiteRefB: number;
};

function percentilDesdeHistograma(hist: Uint32Array, q: number) {
  const total = hist.reduce((acc, v) => acc + v, 0);
  if (total <= 0) return 255;
  const objetivo = Math.max(1, Math.round(total * q));
  let acumulado = 0;
  for (let i = 0; i < hist.length; i += 1) {
    acumulado += hist[i];
    if (acumulado >= objetivo) return i;
  }
  return 255;
}

function construirGrayColorimetrico(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { gray: Uint8ClampedArray; metricasColor: MetricasColorimetria } {
  const histR = new Uint32Array(256);
  const histG = new Uint32Array(256);
  const histB = new Uint32Array(256);
  const totalPix = Math.max(1, width * height);
  const targetMuestras = 220_000;
  const pasoMuestra = Math.max(1, Math.round(Math.sqrt(totalPix / targetMuestras)));
  let sumaR = 0;
  let sumaG = 0;
  let sumaB = 0;
  let sumaSat = 0;
  let conteo = 0;

  for (let y = 0; y < height; y += pasoMuestra) {
    for (let x = 0; x < width; x += pasoMuestra) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      histR[r] += 1;
      histG[g] += 1;
      histB[b] += 1;
      sumaR += r;
      sumaG += g;
      sumaB += b;
      const maxRgb = Math.max(r, g, b);
      const minRgb = Math.min(r, g, b);
      sumaSat += maxRgb > 0 ? (maxRgb - minRgb) / maxRgb : 0;
      conteo += 1;
    }
  }

  const refR = Math.max(170, percentilDesdeHistograma(histR, OMR_COLORIMETRY_WHITE_PERCENTILE));
  const refG = Math.max(170, percentilDesdeHistograma(histG, OMR_COLORIMETRY_WHITE_PERCENTILE));
  const refB = Math.max(170, percentilDesdeHistograma(histB, OMR_COLORIMETRY_WHITE_PERCENTILE));
  const scaleR = 255 / Math.max(1, refR);
  const scaleG = 255 / Math.max(1, refG);
  const scaleB = 255 / Math.max(1, refB);
  const meanR = (sumaR / Math.max(1, conteo)) * scaleR;
  const meanG = (sumaG / Math.max(1, conteo)) * scaleG;
  const meanB = (sumaB / Math.max(1, conteo)) * scaleB;
  const colorCast = clamp01((Math.abs(meanR - meanG) + Math.abs(meanG - meanB) + Math.abs(meanR - meanB)) / (3 * 255));
  const saturationMean = clamp01(sumaSat / Math.max(1, conteo));

  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    const r = Math.min(255, data[p] * scaleR);
    const g = Math.min(255, data[p + 1] * scaleG);
    const b = Math.min(255, data[p + 2] * scaleB);
    const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const tinta = Math.min(r, g, b);
    gray[i] = Math.round(luma * 0.68 + tinta * 0.32);
  }

  return {
    gray,
    metricasColor: {
      colorCast,
      saturationMean,
      whiteRefR: refR,
      whiteRefG: refG,
      whiteRefB: refB
    }
  };
}

function percentilGray(gray: Uint8ClampedArray, q: number) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i += 1) hist[gray[i]] += 1;
  const total = gray.length;
  const objetivo = Math.max(1, Math.round(total * q));
  let acumulado = 0;
  for (let i = 0; i < 256; i += 1) {
    acumulado += hist[i];
    if (acumulado >= objetivo) return i;
  }
  return 255;
}

function realzarGrayParaFotoDificil(gray: Uint8ClampedArray, width: number, height: number) {
  if (gray.length === 0) return gray;
  const pLow = percentilGray(gray, 0.03);
  const pHigh = percentilGray(gray, 0.97);
  const rango = Math.max(24, pHigh - pLow);
  const estirada = new Uint8ClampedArray(gray.length);

  for (let i = 0; i < gray.length; i += 1) {
    const norm = (gray[i] - pLow) / rango;
    const clamped = Math.max(0, Math.min(1, norm));
    const gamma = Math.pow(clamped, 0.92);
    estirada[i] = Math.max(0, Math.min(255, Math.round(gamma * 255)));
  }

  if (width < 3 || height < 3) return estirada;

  const salida = new Uint8ClampedArray(estirada.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        salida[idx] = estirada[idx];
        continue;
      }

      const c = estirada[idx];
      const avg4 =
        (estirada[idx - 1] + estirada[idx + 1] + estirada[idx - width] + estirada[idx + width]) / 4;
      const unsharp = c + (c - avg4) * 0.75;
      salida[idx] = Math.max(0, Math.min(255, Math.round(unsharp)));
    }
  }

  return salida;
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
  const rgba = new Uint8ClampedArray(data);
  const grayDefault = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < grayDefault.length; i += 1, p += 4) {
    grayDefault[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
  }
  let gray = grayDefault;
  let metricasColor: MetricasColorimetria = {
    colorCast: 0,
    saturationMean: 0,
    whiteRefR: 255,
    whiteRefG: 255,
    whiteRefB: 255
  };
  if (OMR_COLORIMETRY_ENABLED) {
    const colorimetrico = construirGrayColorimetrico(rgba, w, h);
    metricasColor = colorimetrico.metricasColor;
    const fuerzaColor =
      clamp01((metricasColor.colorCast - 0.03) / 0.25) * 0.7 +
      clamp01((metricasColor.saturationMean - 0.2) / 0.45) * 0.3;
    const mezclaColor = 0.2 + fuerzaColor * 0.45;
    gray = new Uint8ClampedArray(grayDefault.length);
    for (let i = 0; i < gray.length; i += 1) {
      gray[i] = Math.round(grayDefault[i] * (1 - mezclaColor) + colorimetrico.gray[i] * mezclaColor);
    }
  }

  const metricasPrevias = calcularMetricasImagen(gray, w, h);
  const contrasteGlobal = Math.abs(percentilGray(gray, 0.9) - percentilGray(gray, 0.1));
  const requiereRescate = metricasPrevias.blurVar < 110 || contrasteGlobal < 52;
  if (requiereRescate) {
    const realzada = realzarGrayParaFotoDificil(gray, w, h);
    const mezcla = Math.max(0.35, Math.min(0.8, contrasteGlobal < 42 ? 0.72 : 0.5));
    const combinada = new Uint8ClampedArray(gray.length);
    for (let i = 0; i < gray.length; i += 1) {
      combinada[i] = Math.round(gray[i] * (1 - mezcla) + realzada[i] * mezcla);
    }
    gray = combinada;
  }

  const integral = calcularIntegral(gray, w, h);

  return {
    data: rgba,
    gray,
    integral,
    width: w,
    height: h,
    metricasColor,
    buffer
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
  const qr = detectarQrMejorado(data, gray, width, height, {
    qrSizePtsV1: QR_SIZE_PTS_V1,
    qrSizePtsV2: QR_SIZE_PTS_V2,
    anchoCarta: ANCHO_CARTA
  });
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
  const { data, gray, integral, width, height, metricasColor } = await decodificarImagen(imagenBase64);
  const templateInicial = debugInfo?.templateVersionDetectada ?? mapaPagina.templateVersion ?? 1;
  const perfilInicial = ajustarPerfilConMapa(resolverPerfilDeteccion(templateInicial), mapaPagina);
  let qrDetalle = detectarQrMejorado(data, gray, width, height, {
    qrSizePtsHint: perfilInicial.qrSizePts,
    qrSizePtsV1: QR_SIZE_PTS_V1,
    qrSizePtsV2: QR_SIZE_PTS_V2,
    anchoCarta: ANCHO_CARTA
  });
  let qrTexto = qrDetalle?.data;
  const templateQr = extraerTemplateVersionDesdeQr(qrTexto);
  const templateVersionDetectada = templateQr ?? debugInfo?.templateVersionDetectada ?? mapaPagina.templateVersion ?? 1;
  const perfil = ajustarPerfilConMapa(resolverPerfilDeteccion(templateVersionDetectada), mapaPagina);
  if (!qrDetalle && perfil.qrSizePts !== perfilInicial.qrSizePts) {
    qrDetalle = detectarQrMejorado(data, gray, width, height, {
      qrSizePtsHint: perfil.qrSizePts,
      qrSizePtsV1: QR_SIZE_PTS_V1,
      qrSizePtsV2: QR_SIZE_PTS_V2,
      anchoCarta: ANCHO_CARTA
    });
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

  const transformacionBase = obtenerTransformacion(gray, width, height, advertencias, qrDetalle, {
    margenMm,
    qrSizePts: perfil.qrSizePts,
    anchoCarta: ANCHO_CARTA,
    altoCarta: ALTO_CARTA,
    mmAPuntos: MM_A_PUNTOS
  });
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
        minTopZScore: perfil.minTopZScore,
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
    colorCast: metricasColor.colorCast,
    saturationMean: metricasColor.saturationMean,
    confianzaMedia,
    ratioAmbiguas
  });
  if (OMR_QUALITY_WARN_MIN >= 0 && calidadPagina < OMR_QUALITY_WARN_MIN) {
    advertencias.push(`Calidad de pagina baja (${calidadPagina.toFixed(2)})`);
  }
  const decisionEstado = resolverEstadoAnalisis({
    calidadPagina,
    confianzaMedia,
    ratioAmbiguas,
    totalRespuestas: respuestasDetectadas.length
  });
  const estadoAnalisis: ResultadoOmr['estadoAnalisis'] = decisionEstado.estado;
  if (decisionEstado.anularRespuestas) {
    for (const r of respuestasDetectadas) {
      r.opcion = null;
      r.confianza = 0;
    }
  }
  motivosRevision.push(...decisionEstado.motivos);
  advertencias.push(...decisionEstado.advertencias);
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

