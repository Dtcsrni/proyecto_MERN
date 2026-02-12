/**
 * [BLOQUE DIDACTICO] server/src/usuarioModelo.ts
 * Que es: modelo de dominio para cuentas autenticadas.
 * Que hace: define roles validos, tipo del token y esquema Mongo de usuario.
 * Como lo hace: combina tipos TS + esquema Mongoose con restricciones.
 */

import mongoose from "mongoose";

/**
 * Roles permitidos por la aplicacion.
 *
 * Se comparten entre:
 * - Persistencia (esquema Mongo).
 * - JWT (payload tipado).
 * - Autorización por middleware.
 */
export const ROLES_VALIDOS = ["administrador", "usuario", "desarrollador", "super_usuario"] as const;
export type Rol = (typeof ROLES_VALIDOS)[number];

/**
 * Payload minimo que viaja en el token.
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
 * Esquema de usuario para autenticacion.
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
