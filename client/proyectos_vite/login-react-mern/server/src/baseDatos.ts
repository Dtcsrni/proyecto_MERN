/**
 * [BLOQUE DIDACTICO] server/src/baseDatos.ts
 * Que es: modulo de infraestructura para conexion MongoDB.
 * Que hace: inicializa la conexion principal de Mongoose y ofrece fallback para desarrollo.
 * Como lo hace: intenta `MONGODB_URI`; si falla en dev, levanta Mongo en memoria.
 */

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let servidorMongoMemoria: MongoMemoryServer | null = null;

async function conectarMongoMemoria(): Promise<void> {
  if (!servidorMongoMemoria) {
    servidorMongoMemoria = await MongoMemoryServer.create({
      instance: { dbName: "mern-login" }
    });
  }

  const uriMemoria = servidorMongoMemoria.getUri();
  await mongoose.connect(uriMemoria);
  console.log("Conexion a MongoDB en memoria establecida.");
}

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
  const uriMongo = process.env.MONGODB_URI?.trim() || "mongodb://localhost:27017/mern-login";
  const modoMemoriaForzado = process.env.MONGO_MEMORIA === "true";
  const permitirFallbackMemoria =
    process.env.NODE_ENV !== "production" && process.env.MONGO_MEMORIA_FALLBACK !== "false";

  if (modoMemoriaForzado) {
    await conectarMongoMemoria();
    return;
  }

  try {
    await mongoose.connect(uriMongo);
    console.log("Conexion a MongoDB establecida.");
  } catch (errorConexion) {
    if (!permitirFallbackMemoria) throw errorConexion;

    console.warn(
      "No se pudo conectar a MongoDB local. Activando fallback temporal en memoria para desarrollo."
    );
    await conectarMongoMemoria();
  }
}
