import mongoose from "mongoose";

//Conectar a mongoDB con mongoose
export async function conectarBaseDatos():Promise<void> {
    const uriMongo = process.env.MONGODB_URI || "mongodb://localhost:27017/mern-login";
    if(!uriMongo) {
        throw new Error("No se ha proporcionado la URI de MongoDB");
    }
    await mongoose.connect(uriMongo);
    console.log("Conexión a MongoDB establecida");