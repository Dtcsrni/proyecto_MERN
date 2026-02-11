import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { conectarBaseDatos } from "./baseDatos.js";
import { rutasAutenticacion } from "./autenticacion.js";

/**
 * Bootstrap del servidor Express.
 *
 * Responsabilidades:
 * - Configurar middlewares base.
 * - Montar rutas.
 * - Manejar errores globales.
 * - Iniciar DB + servidor HTTP.
 */
const aplicacion = express();
const puerto = Number(process.env.PUERTO || 3000);

// CORS con credenciales: necesario para enviar cookie de sesión desde el frontend.
// `origin` restringe qué frontend puede consumir la API.
aplicacion.use(cors({ origin: process.env.ORIGEN_CORS, credentials: true }));
aplicacion.use(express.json());
// Permite leer cookies del request (tokenAcceso).
aplicacion.use(cookieParser());

// Endpoint simple para verificar que la API está viva.
aplicacion.get("/health", (_req, res) => res.json({ ok: true }));
aplicacion.use("/api/auth", rutasAutenticacion);

// Fallback de errores. Debe ir después de las rutas.
aplicacion.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ mensaje: "Error interno del servidor." });
});

// Primero asegura conexión a DB y solo después expone el puerto HTTP.
async function arrancarServidor() {
  await conectarBaseDatos();
  aplicacion.listen(puerto, () => console.log(`✅ API en http://localhost:${puerto}`));
}

arrancarServidor().catch((e) => {
  console.error("❌ No se pudo arrancar:", e);
  process.exit(1);
});
