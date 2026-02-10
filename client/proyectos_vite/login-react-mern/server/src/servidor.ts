import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { conectarBaseDatos } from "./baseDatos.js";
import { rutasAutenticacion } from "./autenticacion.js";

/**
 * Servidor Express mínimo con CORS + cookies:
 * - credentials:true permite que el navegador mande cookies
 * - origin limita desde qué frontend se acepta la petición
 */
const aplicacion = express();
const puerto = Number(process.env.PUERTO || 3000);

aplicacion.use(cors({ origin: process.env.ORIGEN_CORS, credentials: true }));
aplicacion.use(express.json());
aplicacion.use(cookieParser());

aplicacion.get("/health", (_req, res) => res.json({ ok: true }));
aplicacion.use("/api/auth", rutasAutenticacion);

/**
 * Manejador global de errores.
 * Debe ir al final y tener 4 parámetros. ([expressjs.com](https://expressjs.com/en/guide/error-handling.html?utm_source=chatgpt.com))
 */
aplicacion.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ mensaje: "Error interno del servidor." });
});

async function arrancarServidor() {
  await conectarBaseDatos();
  aplicacion.listen(puerto, () => console.log(`✅ API en http://localhost:${puerto}`));
}

arrancarServidor().catch((e) => {
  console.error("❌ No se pudo arrancar:", e);
  process.exit(1);
});