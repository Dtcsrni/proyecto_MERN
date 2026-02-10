import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Usuario, type UsuarioToken, type Rol } from "./usuarioModelo.js";

/**
 * Router de autenticación:
 * - /register: crea usuario (solo práctica)
 * - /login: valida credenciales y crea cookie con JWT
 * - /me: devuelve sesión actual
 * - /logout: borra cookie
 * - /admin: demo RBAC real
 */
export const rutasAutenticacion = Router();

const RONDAS_SAL = 12;      // costo de bcrypt (seguridad vs tiempo)
const DURACION_TOKEN = "2h";

/** Validación mínima (didáctica) */
function esCorreoValido(correo: unknown): correo is string {
  return typeof correo === "string" && correo.includes("@") && correo.includes(".");
}

/** Firma JWT (sign) con secreto del .env */
function firmarToken(usuarioToken: UsuarioToken): string {
  const secretoJWT = process.env.JWT_SECRETO;
  if (!secretoJWT) throw new Error("Falta JWT_SECRETO en .env");
  return jwt.sign(usuarioToken, secretoJWT, { expiresIn: DURACION_TOKEN });
}

/**
 * Verifica JWT (verify) = valida firma + expiración.
 * No usar decode() para autorizar, porque NO valida firma. ([npmjs.com](https://www.npmjs.com/package/jsonwebtoken?utm_source=chatgpt.com))
 */
function verificarToken(tokenAcceso: string): UsuarioToken {
  const secretoJWT = process.env.JWT_SECRETO;
  if (!secretoJWT) throw new Error("Falta JWT_SECRETO en .env");
  return jwt.verify(tokenAcceso, secretoJWT) as UsuarioToken;
}

/** Request local con usuario para no crear archivo de tipos extra */
type SolicitudConUsuario = Request & { usuario?: UsuarioToken };

/**
 * Middleware de autenticación:
 * - Lee cookie tokenAcceso (HttpOnly)
 * - Si existe y es válida, guarda solicitud.usuario
 */
function autenticarJWT(solicitud: SolicitudConUsuario, respuesta: Response, siguiente: NextFunction): void {
  try {
    const tokenAcceso = solicitud.cookies?.tokenAcceso as string | undefined;
    if (!tokenAcceso) {
      respuesta.status(401).json({ mensaje: "No autenticado." });
      return;
    }

    solicitud.usuario = verificarToken(tokenAcceso);
    siguiente();
  } catch {
    respuesta.status(401).json({ mensaje: "Token inválido o expirado." });
  }
}

/** Middleware RBAC por roles */
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

/**
 * POST /register
 * - Normaliza correo
 * - Aplica bcrypt.hash
 * - Crea usuario con rol "usuario"
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

    respuesta.status(201).json({ id: usuarioCreado._id, correo: usuarioCreado.correo, rol: usuarioCreado.rol });
  } catch (error) {
    siguiente(error);
  }
});

/**
 * POST /login
 * - Busca usuario
 * - bcrypt.compare contra hash
 * - Firma token y lo guarda en cookie HttpOnly
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

    // Cookie HttpOnly: el JS del navegador no puede leerla
    respuesta.cookie("tokenAcceso", tokenAcceso, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "development",
      maxAge: 2 * 60 * 60 * 1000
    });

    respuesta.json({ usuario: usuarioToken });
  } catch (error) {
    siguiente(error);
  }
});

/** GET /me: requiere sesión */
rutasAutenticacion.get("/me", autenticarJWT, (solicitud: SolicitudConUsuario, respuesta) => {
  respuesta.json({ usuario: solicitud.usuario });
});

/** POST /logout: borra cookie */
rutasAutenticacion.post("/logout", (_solicitud, respuesta) => {
  respuesta.clearCookie("tokenAcceso");
  respuesta.json({ mensaje: "Sesión cerrada." });
});

/** GET /admin: demo RBAC real */
rutasAutenticacion.get(
  "/admin",
  autenticarJWT,
  autorizarRoles("administrador", "super_usuario"),
  (_solicitud, respuesta) => {
    respuesta.json({ ok: true, mensaje: "Zona admin autorizada." });
  }
);