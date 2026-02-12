/**
 * [BLOQUE DIDACTICO] server/src/autenticacion.ts
 * Que es: router del dominio de autenticacion y autorizacion RBAC.
 * Que hace: expone login/registro/sesion y operaciones administrativas de usuarios.
 * Como lo hace: combina JWT en cookie HttpOnly + middlewares + consultas Mongoose.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { ROLES_VALIDOS, Usuario, type UsuarioToken, type Rol } from "./usuarioModelo.js";

/**
 * GUIA (Backend) - router de autenticacion y autorizacion
 *
 * 1) Que es:
 * - Conjunto de endpoints y middlewares para controlar acceso.
 *
 * 2) Endpoints incluidos:
 * - POST /register
 * - POST /login
 * - GET  /me
 * - POST /logout
 * - GET  /admin (ejemplo RBAC)
 *
 * 3) Por que se disena asi:
 * - Se separa autenticacion (quien eres) de autorizacion (que puedes hacer).
 */
export const rutasAutenticacion = Router();

// Seguridad - Paso A: costo bcrypt (mas alto = mas seguro, pero consume mas CPU).
const RONDAS_SAL = 12;
// Seguridad - Paso B: tiempo de vida de token de sesion.
const DURACION_TOKEN = "2h";

/**
 * Utilidad - validar correo.
 *
 * Por que:
 * - Corta rapido requests claramente invalidas.
 * - Mantiene el ejemplo simple para estudio.
 */
function esCorreoValido(correo: unknown): correo is string {
  return typeof correo === "string" && correo.includes("@") && correo.includes(".");
}

/**
 * Crea JWT firmado.
 *
 * Por que:
 * - El backend puede verificar integridad del token en cada request sin guardar sesion en memoria.
 */
function firmarToken(usuarioToken: UsuarioToken): string {
  const secretoJWT = process.env.JWT_SECRETO;
  if (!secretoJWT) throw new Error("Falta JWT_SECRETO en .env");
  return jwt.sign(usuarioToken, secretoJWT, { expiresIn: DURACION_TOKEN });
}

/**
 * Centraliza la configuración de la cookie de sesión.
 *
 * Por qué:
 * - Evita divergencias entre login y registro.
 */
function establecerCookieSesion(respuesta: Response, tokenAcceso: string): void {
  respuesta.cookie("tokenAcceso", tokenAcceso, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 2 * 60 * 60 * 1000
  });
}

/**
 * Verifica JWT recibido.
 *
 * Que valida:
 * - Firma criptográfica.
 * - Expiración.
 */
function verificarToken(tokenAcceso: string): UsuarioToken {
  const secretoJWT = process.env.JWT_SECRETO;
  if (!secretoJWT) throw new Error("Falta JWT_SECRETO en .env");
  return jwt.verify(tokenAcceso, secretoJWT) as UsuarioToken;
}

// Tipo auxiliar para pasar usuario autenticado entre middlewares/controladores.
type SolicitudConUsuario = Request & { usuario?: UsuarioToken };

// Alias explicito para roles editables en endpoint PATCH /usuarios/:id/rol.
type RolEditable = Exclude<Rol, "super_usuario"> | "super_usuario";

/**
 * RBAC estricta (KISS):
 * en cada request autenticada tomamos el rol real desde DB y no el rol del JWT.
 * Así, un cambio de rol aplica de inmediato sin esperar a que expire el token.
 */
async function cargarUsuarioVigente(desdeToken: UsuarioToken): Promise<UsuarioToken | null> {
  const usuario = await Usuario.findOne({ _id: desdeToken.id, activo: true }, { correo: 1, rol: 1 }).lean();
  if (!usuario) return null;
  return {
    id: String(usuario._id),
    correo: usuario.correo,
    rol: usuario.rol
  };
}

/**
 * Middleware de autenticacion.
 *
 * Flujo didactico:
 * - Lee cookie `tokenAcceso`.
 * - Verifica token.
 * - Inyecta `solicitud.usuario` para handlers siguientes.
 */
async function autenticarJWT(
  solicitud: SolicitudConUsuario,
  respuesta: Response,
  siguiente: NextFunction
): Promise<void> {
  try {
    const tokenAcceso = solicitud.cookies?.tokenAcceso as string | undefined;
    if (!tokenAcceso) {
      respuesta.status(401).json({ mensaje: "No autenticado." });
      return;
    }

    const usuarioToken = verificarToken(tokenAcceso);
    const usuarioVigente = await cargarUsuarioVigente(usuarioToken);
    if (!usuarioVigente) {
      respuesta.clearCookie("tokenAcceso", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      });
      respuesta.status(401).json({ mensaje: "Sesión no válida o cuenta inactiva." });
      return;
    }

    solicitud.usuario = usuarioVigente;
    siguiente();
  } catch {
    respuesta.clearCookie("tokenAcceso", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
    respuesta.status(401).json({ mensaje: "Token inválido o expirado." });
  }
}

/**
 * Middleware de autorizacion por roles (RBAC).
 *
 * Por que separado:
 * - Reutilizable en cualquier endpoint que necesite permisos distintos.
 */
function autorizarRoles(...rolesPermitidos: Rol[]) {
  return (solicitud: SolicitudConUsuario, respuesta: Response, siguiente: NextFunction): void => {
    const rolActual = solicitud.usuario?.rol;
    if (!rolActual || !rolesPermitidos.includes(rolActual)) {
      respuesta.status(403).json({ mensaje: "Acceso denegado por rol." });
      return;
    }
    siguiente();
  };
}

// Valida que el rol recibido por request exista en la lista canonical.
function esRolValido(rol: unknown): rol is RolEditable {
  return typeof rol === "string" && ROLES_VALIDOS.includes(rol as Rol);
}

// Regla de negocio de administracion de roles.
// `super_usuario` gestiona todo; `administrador` no toca cuentas super.
function puedeGestionarRol(actorRol: Rol, rolObjetivo: Rol): boolean {
  if (actorRol === "super_usuario") return true;
  if (actorRol === "administrador") {
    return rolObjetivo !== "super_usuario";
  }
  return false;
}

/**
 * POST /register
 *
 * Paso 1 (registro):
 * - Valida inputs básicos.
 * - Normaliza correo.
 * - Evita correo duplicado.
 * - Guarda contraseña como hash bcrypt.
 *
 * Por que:
 * - Nunca se debe persistir contraseña en texto plano.
 */
rutasAutenticacion.post("/register", async (solicitud, respuesta, siguiente) => {
  try {
    const { correo, contrasena } = solicitud.body as { correo?: unknown; contrasena?: unknown };

    if (!esCorreoValido(correo) || typeof contrasena !== "string") {
      respuesta.status(400).json({ mensaje: "Correo y contraseña son obligatorios y válidos." });
      return;
    }
    if (contrasena.length < 8) {
      respuesta.status(400).json({ mensaje: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }

    const correoNormalizado = correo.toLowerCase().trim();

    const existente = await Usuario.findOne({ correo: correoNormalizado }).lean();
    if (existente) {
      respuesta.status(409).json({ mensaje: "Ya existe una cuenta con ese correo" });
      return;
    }

    const hashContrasena = await bcrypt.hash(contrasena, RONDAS_SAL);

    const usuarioCreado = await Usuario.create({
      correo: correoNormalizado,
      hashContrasena,
      rol: "usuario"
    });

    const usuarioToken: UsuarioToken = {
      id: String(usuarioCreado._id),
      correo: usuarioCreado.correo,
      rol: usuarioCreado.rol
    };
    const tokenAcceso = firmarToken(usuarioToken);
    establecerCookieSesion(respuesta, tokenAcceso);

    respuesta.status(201).json({ usuario: usuarioToken });
  } catch (error) {
    // Si hay carrera de concurrencia y Mongo detecta duplicado por índice único.
    if (error instanceof Error && "code" in error && error.code === 11000) {
      respuesta.status(409).json({ mensaje: "Ya existe una cuenta con ese correo" });
      return;
    }
    siguiente(error);
  }
});

/**
 * POST /login
 *
 * Paso 2 (login):
 * - Busca usuario activo por correo.
 * - Compara contraseña ingresada con hash almacenado.
 * - Emite JWT y lo envía en cookie HttpOnly.
 *
 * Por que cookie HttpOnly:
 * - Reduce exposición frente a lectura por scripts en el navegador.
 */
rutasAutenticacion.post("/login", async (solicitud, respuesta, siguiente) => {
  try {
    const { correo, contrasena } = solicitud.body as { correo?: unknown; contrasena?: unknown };

    if (!esCorreoValido(correo) || typeof contrasena !== "string") {
      respuesta.status(400).json({ mensaje: "Correo y contraseña son obligatorios." });
      return;
    }

    const correoNormalizado = correo.toLowerCase().trim();
    const usuario = await Usuario.findOne({ correo: correoNormalizado, activo: true });

    if (!usuario) {
      respuesta.status(401).json({ mensaje: "Credenciales inválidas." });
      return;
    }

    const coincide = await bcrypt.compare(contrasena, usuario.hashContrasena);
    if (!coincide) {
      respuesta.status(401).json({ mensaje: "Credenciales inválidas." });
      return;
    }

    const usuarioToken: UsuarioToken = {
      id: String(usuario._id),
      correo: usuario.correo,
      rol: usuario.rol
    };

    const tokenAcceso = firmarToken(usuarioToken);

    // Seguridad cookie:
    // - HttpOnly: JS del navegador no puede leer token.
    // - sameSite=lax: reduce riesgo CSRF.
    // - secure en produccion: solo via HTTPS.
    establecerCookieSesion(respuesta, tokenAcceso);

    respuesta.json({ usuario: usuarioToken });
  } catch (error) {
    siguiente(error);
  }
});

/**
 * GET /me
 *
 * Paso 3 (sesion):
 * Devuelve el usuario autenticado a partir del token ya validado por middleware.
 * Se usa en frontend para restaurar sesión al recargar la página.
 */
rutasAutenticacion.get("/me", autenticarJWT, (solicitud: SolicitudConUsuario, respuesta) => {
  respuesta.json({ usuario: solicitud.usuario });
});

/**
 * POST /logout
 *
 * Paso 4 (logout):
 * Elimina cookie de sesión en cliente.
 * Se usan los mismos flags base de la cookie original para asegurar borrado consistente.
 */
rutasAutenticacion.post("/logout", (_solicitud, respuesta) => {
  respuesta.clearCookie("tokenAcceso", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  respuesta.json({ mensaje: "Sesión cerrada." });
});

/**
 * GET /admin
 *
 * Paso 5 (autorizacion por rol):
 * Ejemplo de endpoint protegido por:
 * - autenticación válida
 * - rol permitido
 */
rutasAutenticacion.get(
  "/admin",
  autenticarJWT,
  autorizarRoles("administrador", "super_usuario"),
  (_solicitud, respuesta) => {
    respuesta.json({ ok: true, mensaje: "Zona admin autorizada." });
  }
);

/**
 * GET /usuarios/resumen
 *
 * Lista un resumen de cuentas para exportacion de reportes PDF.
 *
 * Decisiones de diseño:
 * - Solo devuelve campos de lectura necesarios para el documento.
 * - Evita exponer `hashContrasena` u otros atributos sensibles.
 * - Ordena por fecha descendente para que el reporte priorice altas recientes.
 */
rutasAutenticacion.get(
  "/usuarios/resumen",
  autenticarJWT,
  autorizarRoles("desarrollador", "administrador", "super_usuario"),
  async (_solicitud, respuesta, siguiente) => {
    try {
      // Proyección mínima para reducir payload y costo de serialización.
      const cuentas = await Usuario.find({}, { correo: 1, rol: 1, activo: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .lean();

      // Respuesta minimalista: solo campos usados por el exportador.
      const serializadas = cuentas.map((cuenta) => ({
        correo: cuenta.correo,
        rol: cuenta.rol,
        activo: cuenta.activo,
        createdAt: cuenta.createdAt
      }));

      // `total` evita que el frontend recalcule y mantiene trazabilidad del lote.
      respuesta.json({ cuentas: serializadas, total: serializadas.length });
    } catch (error) {
      siguiente(error);
    }
  }
);

/**
 * GET /usuarios
 *
 * Lista usuarios para administración de permisos.
 */
rutasAutenticacion.get(
  "/usuarios",
  autenticarJWT,
  autorizarRoles("administrador", "super_usuario"),
  async (_solicitud, respuesta, siguiente) => {
    try {
      const usuarios = await Usuario.find({}, { correo: 1, rol: 1, activo: 1, createdAt: 1, updatedAt: 1 })
        .sort({ createdAt: -1 })
        .lean();
      const serializados = usuarios.map((usuario) => ({
        id: String(usuario._id),
        correo: usuario.correo,
        rol: usuario.rol,
        activo: usuario.activo,
        createdAt: usuario.createdAt,
        updatedAt: usuario.updatedAt
      }));

      respuesta.json({ usuarios: serializados });
    } catch (error) {
      siguiente(error);
    }
  }
);

/**
 * PATCH /usuarios/:id/rol
 *
 * Cambia el rol/permisos de un usuario.
 */
rutasAutenticacion.patch(
  "/usuarios/:id/rol",
  autenticarJWT,
  autorizarRoles("administrador", "super_usuario"),
  async (solicitud: SolicitudConUsuario, respuesta, siguiente) => {
    try {
      const idUsuario = solicitud.params.id;
      const actor = solicitud.usuario;
      const { rol } = solicitud.body as { rol?: unknown };

      if (!actor) {
        respuesta.status(401).json({ mensaje: "No autenticado." });
        return;
      }
      if (!mongoose.isValidObjectId(idUsuario)) {
        respuesta.status(400).json({ mensaje: "El id del usuario es inválido." });
        return;
      }
      if (!esRolValido(rol)) {
        respuesta.status(400).json({ mensaje: "El rol enviado no es válido." });
        return;
      }
      if (!puedeGestionarRol(actor.rol, rol)) {
        respuesta.status(403).json({ mensaje: "No tienes permisos para asignar ese rol." });
        return;
      }
      if (actor.id === idUsuario) {
        respuesta.status(400).json({ mensaje: "No puedes cambiar tu propio rol desde este módulo." });
        return;
      }

      const usuarioObjetivo = await Usuario.findById(idUsuario);
      if (!usuarioObjetivo) {
        respuesta.status(404).json({ mensaje: "Usuario no encontrado." });
        return;
      }

      if (!puedeGestionarRol(actor.rol, usuarioObjetivo.rol)) {
        respuesta.status(403).json({ mensaje: "No tienes permisos para modificar a este usuario." });
        return;
      }

      usuarioObjetivo.rol = rol;
      await usuarioObjetivo.save();

      respuesta.json({
        usuario: {
          id: String(usuarioObjetivo._id),
          correo: usuarioObjetivo.correo,
          rol: usuarioObjetivo.rol,
          activo: usuarioObjetivo.activo,
          createdAt: usuarioObjetivo.createdAt,
          updatedAt: usuarioObjetivo.updatedAt
        }
      });
    } catch (error) {
      siguiente(error);
    }
  }
);
