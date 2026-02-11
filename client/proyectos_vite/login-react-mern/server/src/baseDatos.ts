import mongoose from "mongoose";

/**
 * Inicializa conexión MongoDB para todo el proceso.
 *
 * Qué hace:
 * - Lee `MONGODB_URI` desde entorno.
 * - Abre conexión con Mongoose antes de levantar rutas.
 *
 * Por qué es importante:
 * - Si la DB no conecta, la API no debería arrancar "a medias".
 */
export async function conectarBaseDatos(): Promise<void> {
  const uriMongo = process.env.MONGODB_URI || "mongodb://localhost:27017/mern-login";

  if (!uriMongo) {
    throw new Error("No se proporcionó MONGODB_URI.");
  }

  await mongoose.connect(uriMongo);
  console.log("Conexión a MongoDB establecida.");
}
