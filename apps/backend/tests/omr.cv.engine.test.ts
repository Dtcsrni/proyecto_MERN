import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
  debeIntentarMotorCv,
  ejecutarSmokeTestOmrCv,
  preprocesarImagenOmrCv
} from '../src/modulos/modulo_escaneo_omr/infra/omrCvEngine';

const ENV_BACKUP = {
  OMR_CV_ENGINE_ENABLED: process.env.OMR_CV_ENGINE_ENABLED,
  OMR_CV_BACKEND: process.env.OMR_CV_BACKEND
};

afterEach(() => {
  process.env.OMR_CV_ENGINE_ENABLED = ENV_BACKUP.OMR_CV_ENGINE_ENABLED;
  process.env.OMR_CV_BACKEND = ENV_BACKUP.OMR_CV_BACKEND;
});

async function crearImagenBase64() {
  const buffer = await sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

describe('omrCvEngine', () => {
  it('marca smoke como modo simple cuando backend no es opencv', async () => {
    process.env.OMR_CV_ENGINE_ENABLED = '1';
    process.env.OMR_CV_BACKEND = 'simple';

    const smoke = await ejecutarSmokeTestOmrCv();
    expect(smoke.enabled).toBe(true);
    expect(smoke.backend).toBe('simple');
    expect(smoke.cvDisponible).toBe(false);
  });

  it('respeta apagado global del engine CV', async () => {
    process.env.OMR_CV_ENGINE_ENABLED = '0';
    process.env.OMR_CV_BACKEND = 'opencv';

    const smoke = await ejecutarSmokeTestOmrCv();
    expect(smoke.enabled).toBe(false);
    expect(smoke.backend).toBe('opencv');
    expect(smoke.cvDisponible).toBe(false);
    expect(debeIntentarMotorCv(3)).toBe(false);
  });

  it('preprocesa imagen cuando backend simple está activo', async () => {
    process.env.OMR_CV_ENGINE_ENABLED = '1';
    process.env.OMR_CV_BACKEND = 'simple';
    const imagen = await crearImagenBase64();
    const salida = await preprocesarImagenOmrCv(imagen);
    expect(salida.startsWith('data:image/png;base64,')).toBe(true);
  });
});
