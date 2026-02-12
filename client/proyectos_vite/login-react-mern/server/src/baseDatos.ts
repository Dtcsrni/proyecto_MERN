/**
 * [BLOQUE DIDACTICO] server/src/baseDatos.ts
 * Que es: modulo de infraestructura para conexion MongoDB.
 * Que hace: inicializa la conexion principal de Mongoose.
 * Como lo hace: lee `MONGODB_URI` y ejecuta `mongoose.connect` antes de iniciar HTTP.
 */

import mongoose from "mongoose";

/**
 * Inicializa conexion MongoDB para todo el proceso.
 *
 * Qué hace:
 * - Lee `MONGODB_URI` desde entorno.
 * - Abre conexión con Mongoose antes de levantar rutas.
 *
 * Por qué es importante:
 * - Si la DB no conecta, la API no debería arrancar "a medias".
 */
export async function conectarBaseDatos(): Promise<void> {
  // Fallback local util para entorno de desarrollo.
  const uriMongo = process.env.MONGODB_URI || "mongodb://localhost:27017/mern-login";

  if (!uriMongo) {
    throw new Error("No se proporcionó MONGODB_URI.");
  }

  await mongoose.connect(uriMongo);
  console.log("Conexión a MongoDB establecida.");
}
