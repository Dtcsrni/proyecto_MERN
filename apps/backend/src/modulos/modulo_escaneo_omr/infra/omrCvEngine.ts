import sharp from 'sharp';

export class ErrorOmrCvNoDisponible extends Error {
  code = 'OMR_CV_NO_DISPONIBLE' as const;
}

type EstadoSmokeOmrCv = {
  enabled: boolean;
  backend: 'opencv';
  cvDisponible: boolean;
  motivo?: string;
};

let openCvLoaderForTests: (() => Promise<unknown>) | null = null;

function limpiarBase64(entrada: string) {
  return String(entrada ?? '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
}

function resolverCvHabilitado() {
  const enabledRaw = String(process.env.OMR_CV_ENGINE_ENABLED ?? '1').trim().toLowerCase();
  const enabledSolicitado = !['0', 'false', 'off', 'no'].includes(enabledRaw);
  if (process.env.NODE_ENV === 'test') return enabledSolicitado;
  return true;
}

export function setOpenCvLoaderForTests(loader?: (() => Promise<unknown>) | null) {
  if (process.env.NODE_ENV !== 'test') return;
  openCvLoaderForTests = loader ?? null;
}

async function validarBackendOpenCv() {
  try {
    if (openCvLoaderForTests) {
      await openCvLoaderForTests();
      return;
    }
    const dynamicImporter = new Function('m', 'return import(m)') as (moduleName: string) => Promise<unknown>;
    await dynamicImporter('opencv4nodejs');
  } catch {
    throw new ErrorOmrCvNoDisponible('Backend OpenCV no disponible en runtime. Instala opencv4nodejs.');
  }
}

export function debeIntentarMotorCv(templateVersion?: number) {
  const enabled = resolverCvHabilitado();
  return enabled && Number(templateVersion ?? 3) === 3;
}

export function describirErrorCv(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'fallo desconocido';
}

export async function ejecutarSmokeTestOmrCv(): Promise<EstadoSmokeOmrCv> {
  const enabled = resolverCvHabilitado();
  const backend = 'opencv' as const;
  if (!enabled) {
    return {
      enabled,
      backend,
      cvDisponible: false,
      motivo: 'OMR_CV_ENGINE_ENABLED desactivado (solo permitido en tests)'
    };
  }
  try {
    await validarBackendOpenCv();
    return {
      enabled,
      backend,
      cvDisponible: true
    };
  } catch (error) {
    return {
      enabled,
      backend,
      cvDisponible: false,
      motivo: describirErrorCv(error)
    };
  }
}

export async function preprocesarImagenOmrCv(imagenBase64: string) {
  await validarBackendOpenCv();

  const limpio = limpiarBase64(imagenBase64);
  if (!limpio) throw new Error('Imagen base64 vacia');
  const input = Buffer.from(limpio, 'base64');
  if (!input.length) throw new Error('Imagen base64 invalida');

  // Preproceso conservador para mejorar contraste local y bordes de burbuja.
  const output = await sharp(input)
    .rotate()
    .normalise()
    .linear(1.12, -8)
    .median(1)
    .sharpen({ sigma: 0.9, m1: 0.5, m2: 1.2 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return `data:image/png;base64,${output.toString('base64')}`;
}
