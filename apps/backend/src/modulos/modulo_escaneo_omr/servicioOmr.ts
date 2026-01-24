/**
 * Servicio de escaneo OMR basado en posiciones del PDF.
 */
import sharp from 'sharp';
import jsQR from 'jsqr';

export type ResultadoOmr = {
  respuestasDetectadas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  advertencias: string[];
  qrTexto?: string;
};

type Punto = { x: number; y: number };

type MapaOmrPagina = {
  numeroPagina: number;
  preguntas: Array<{
    numeroPregunta: number;
    idPregunta: string;
    opciones: Array<{ letra: string; x: number; y: number }>;
  }>;
};

const ANCHO_CARTA = 612;
const ALTO_CARTA = 792;
const MM_A_PUNTOS = 72 / 25.4;

function limpiarBase64(entrada: string) {
  return entrada.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
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
    height: h
  };
}

function detectarQr(data: Uint8ClampedArray, width: number, height: number) {
  const resultado = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return resultado?.data;
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

function detectarMarca(gray: Uint8ClampedArray, width: number, height: number, region: { x0: number; y0: number; x1: number; y1: number }) {
  const paso = 2;
  let sumaX = 0;
  let sumaY = 0;
  let conteo = 0;
  let sum = 0;
  let sumSq = 0;

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
  const umbral = Math.max(30, media - Math.max(20, desviacion * 1.2));

  for (let y = region.y0; y < region.y1; y += paso) {
    for (let x = region.x0; x < region.x1; x += paso) {
      const intensidad = obtenerIntensidad(gray, width, height, x, y);
      if (intensidad < umbral) {
        sumaX += x;
        sumaY += y;
        conteo += 1;
      }
    }
  }

  if (!conteo || conteo < 8) return null;
  return { x: sumaX / conteo, y: sumaY / conteo };
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
  margenMm: number
) {
  const region = 0.15;
  const regiones = {
    tl: { x0: 0, y0: 0, x1: width * region, y1: height * region },
    tr: { x0: width * (1 - region), y0: 0, x1: width, y1: height * region },
    bl: { x0: 0, y0: height * (1 - region), x1: width * region, y1: height },
    br: { x0: width * (1 - region), y0: height * (1 - region), x1: width, y1: height }
  };

  const tl = detectarMarca(gray, width, height, regiones.tl);
  const tr = detectarMarca(gray, width, height, regiones.tr);
  const bl = detectarMarca(gray, width, height, regiones.bl);
  const br = detectarMarca(gray, width, height, regiones.br);

  if (!tl || !tr || !bl || !br) {
    // Sin marcas completas, se aproxima con escala simple para no bloquear el flujo.
    advertencias.push('No se detectaron todas las marcas de registro; usando escala simple');
    const escalaX = width / ANCHO_CARTA;
    const escalaY = height / ALTO_CARTA;
    return (punto: Punto) => ({ x: punto.x * escalaX, y: height - punto.y * escalaY });
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
    const escalaX = width / ANCHO_CARTA;
    const escalaY = height / ALTO_CARTA;
    return (punto: Punto) => ({ x: punto.x * escalaX, y: height - punto.y * escalaY });
  }

  return (punto: Punto) => aplicarHomografia(h, { x: punto.x, y: ALTO_CARTA - punto.y });
}

function detectarOpcion(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centro: Punto
) {
  const radio = 6;
  const ringInner = 8;
  const ringOuter = 12;
  const promLocal = mediaEnVentana(integral, width, height, centro.x - ringOuter, centro.y - ringOuter, centro.x + ringOuter, centro.y + ringOuter);
  const umbral = Math.max(40, Math.min(220, promLocal - 18));
  let pixeles = 0;
  let oscuros = 0;
  let pixelesRing = 0;
  let oscurosRing = 0;

  // Cuenta pixeles oscuros dentro de un radio fijo para estimar marca.
  for (let y = -ringOuter; y <= ringOuter; y += 1) {
    for (let x = -ringOuter; x <= ringOuter; x += 1) {
      const dist = x * x + y * y;
      if (dist > ringOuter * ringOuter) continue;
      const intensidad = obtenerIntensidad(gray, width, height, centro.x + x, centro.y + y);
      if (dist <= radio * radio) {
        pixeles += 1;
        if (intensidad < umbral) oscuros += 1;
      } else if (dist >= ringInner * ringInner) {
        pixelesRing += 1;
        if (intensidad < umbral) oscurosRing += 1;
      }
    }
  }

  const ratio = oscuros / Math.max(1, pixeles);
  const ratioRing = oscurosRing / Math.max(1, pixelesRing);
  const score = Math.max(0, ratio - ratioRing * 0.6);
  return { ratio, ratioRing, score };
}

export async function analizarOmr(
  imagenBase64: string,
  mapaPagina: MapaOmrPagina,
  qrEsperado?: string | string[],
  margenMm = 10
): Promise<ResultadoOmr> {
  const advertencias: string[] = [];
  const { data, gray, integral, width, height } = await decodificarImagen(imagenBase64);
  const qrTexto = detectarQr(data, width, height);

  if (!qrTexto) {
    advertencias.push('No se detecto QR en la imagen');
  }
  const qrEsperados = Array.isArray(qrEsperado) ? qrEsperado : qrEsperado ? [qrEsperado] : [];
  if (qrEsperados.length > 0 && qrTexto && !qrEsperados.includes(qrTexto)) {
    advertencias.push('El QR no coincide con el examen esperado');
  }

  const transformar = obtenerTransformacion(gray, width, height, advertencias, margenMm);
  const respuestasDetectadas: ResultadoOmr['respuestasDetectadas'] = [];

  mapaPagina.preguntas.forEach((pregunta) => {
    let mejorOpcion: string | null = null;
    let mejorScore = 0;
    let segundoScore = 0;

    pregunta.opciones.forEach((opcion) => {
      const centro = transformar({ x: opcion.x, y: opcion.y });
      const { score } = detectarOpcion(gray, integral, width, height, centro);
      if (score > mejorScore) {
        segundoScore = mejorScore;
        mejorScore = score;
        mejorOpcion = opcion.letra;
      } else if (score > segundoScore) {
        segundoScore = score;
      }
    });

    const suficiente = mejorScore >= 0.12 && mejorScore - segundoScore >= 0.03;
    const confianzaBase = Math.min(1, Math.max(0, mejorScore * 2));
    const confianza = suficiente ? Math.min(1, confianzaBase + Math.min(0.5, (mejorScore - segundoScore) * 3)) : 0;
    respuestasDetectadas.push({ numeroPregunta: pregunta.numeroPregunta, opcion: suficiente ? mejorOpcion : null, confianza });
  });

  return { respuestasDetectadas, advertencias, qrTexto };
}
