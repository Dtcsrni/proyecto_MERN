import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Usuario, type UsuarioToken, type Rol } from "./usuarioModelo.js";

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

/**
 * Middleware de autenticacion.
 *
 * Flujo didactico:
 * - Lee cookie `tokenAcceso`.
 * - Verifica token.
 * - Inyecta `solicitud.usuario` para handlers siguientes.
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
