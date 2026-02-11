/**
 * [BLOQUE DIDACTICO] server/src/usuarioModelo.ts
 * Que es: Modelo de dominio de usuarios para autenticacion.
 * Que hace: Define roles permitidos, tipos de token y esquema Mongo de Usuario.
 * Como lo hace: Declara constantes tipadas y crea un schema Mongoose con validaciones.
 */

import mongoose from "mongoose";

/**
 * Roles permitidos por la aplicación.
 *
 * Se comparten entre:
 * - Persistencia (esquema Mongo).
 * - JWT (payload tipado).
 * - Autorización por middleware.
 */
export const ROLES_VALIDOS = ["administrador", "usuario", "desarrollador", "super_usuario"] as const;
export type Rol = (typeof ROLES_VALIDOS)[number];

/**
 * Payload mínimo que viaja en el token.
 *
 * Por qué mínimo:
 * - Reduce tamaño del JWT.
 * - Evita exponer datos no necesarios en cada request.
 */
export type UsuarioToken = {
  id: string;
  correo: string;
  rol: Rol;
};

/**
 * Esquema de usuario para autenticación.
 *
 * Decisiones:
 * - `correo` único y normalizado en minúsculas para evitar duplicados lógicos.
 * - `hashContrasena` guarda hash bcrypt, nunca contraseña en texto plano.
 * - `activo` permite deshabilitar cuenta sin borrar historial.
 */
const esquemaUsuario = new mongoose.Schema(
  {
    correo: { type: String, required: true, unique: true, trim: true, lowercase: true },
    hashContrasena: { type: String, required: true },
    rol: { type: String, enum: ROLES_VALIDOS, default: "usuario" },
    activo: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

export const Usuario = mongoose.model("Usuario", esquemaUsuario);
