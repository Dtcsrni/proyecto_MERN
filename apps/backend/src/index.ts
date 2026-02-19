/**
 * Punto de entrada del backend docente.
 * Inicializa configuracion, base de datos y servidor HTTP.
 */
import { crearApp } from './app';
import { configuracion } from './configuracion';
import { conectarBaseDatos } from './infraestructura/baseDatos/mongoose';
import { logError, log } from './infraestructura/logging/logger';
import { seedAdminDocente } from './modulos/modulo_autenticacion/seedAdmin';
import { ejecutarSmokeTestOmrCv } from './modulos/modulo_escaneo_omr/infra/omrCvEngine';
import { asegurarIndicesEscaneoOmrArchivado } from './modulos/modulo_escaneo_omr/modeloEscaneoOmrArchivado';

async function iniciar() {
  await conectarBaseDatos();
  await seedAdminDocente();
  await asegurarIndicesEscaneoOmrArchivado();
  const smokeCv = await ejecutarSmokeTestOmrCv();
  if (smokeCv.enabled && smokeCv.backend === 'opencv' && !smokeCv.cvDisponible) {
    log('warn', 'OMR CV smoke test falló; revise dependencias de visión', {
      backend: smokeCv.backend,
      motivo: smokeCv.motivo
    });
  } else {
    log('info', 'OMR CV smoke test ejecutado', {
      backend: smokeCv.backend,
      enabled: smokeCv.enabled,
      cvDisponible: smokeCv.cvDisponible,
      motivo: smokeCv.motivo
    });
  }

  const app = crearApp();
  app.listen(configuracion.puerto, () => {
    log('ok', 'API docente escuchando', { puerto: configuracion.puerto });
  });
}

iniciar().catch((error) => {
  logError('Error al iniciar el servidor', error);
  process.exit(1);
});
