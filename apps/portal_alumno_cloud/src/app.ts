/**
 * Crea la app HTTP (Express) del portal alumno.
 *
 * El portal es de solo lectura/consulta + sincronizacion desde el backend.
 * Mantiene defensas basicas (helmet, sanitizacion, rate-limit) y responde con
 * un envelope de error consistente.
 */
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { configuracion } from './configuracion';
import rutasPortal from './rutas';
import { sanitizarMongo } from './infraestructura/seguridad/sanitizarMongo';

export function crearApp() {
  const app = express();

  // Reduce leakage de informacion sobre la tecnologia del servidor.
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: configuracion.corsOrigenes }));
  app.use(express.json({ limit: '25mb' }));
  app.use(sanitizarMongo());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 200,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use('/api/portal', rutasPortal);

  // Manejador final (fallback) para errores no controlados.
  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    void next;
    // Log minimo: en produccion conviene reemplazar por logger estructurado.
    // No se expone stack al cliente.
    if (process.env.NODE_ENV !== 'test' && error instanceof Error) console.error(error);
    const mensaje = error instanceof Error ? error.message : 'Error interno';
    res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje } });
  });

  return app;
}
