//Router de autenticación 
//  /registrar crea un usuario 
//  /login valida credenciales y devuelve token JWT
//  /me devuelve datos del usuario autenticado (protegido por middleware de autenticación)
// /logout invalida el token (opcional, dependiendo de la estrategia de manejo de tokens)
// /admin solo accesible para usuarios con rol de administrador (protegido por middleware de autorización)

import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Usuario, type UsuarioToken, type Rol } from "./usuarioModelo";

export const rutasAutenticacion = Router();

const RONDAS_SAL = 12; 
const DURACION_TOKEN = "2h";

//Validación minima
function esCorreoValido(correo: string) {
    return typeof correo === "string" && correo.includes("@") && correo.includes(".");
}
//Firmar JWT con secreto del .env
function firmarToken(usuarioToken: UsuarioToken):string {
    const secretoJWT = process.env.JWT_SECRETO || "secreto_por_defecto";
    if(!process.env.JWT_SECRETO) {
        console.warn("JWT_SECRETO no definido en .env, usando valor por defecto. Esto no es seguro para producción.");
    }
    return jwt.sign(usuarioToken, secretoJWT, { expiresIn: DURACION_TOKEN });
}

//Verificar token JWT para ejecutar permisos
function verificarToken(tokenAceso: string): UsuarioToken {
    const secretoJWT = process.env.JWT_SECRETO || "secreto_por_defecto";
    if(!process.env.JWT_SECRETO) {
        console.warn("JWT_SECRETO no definido en .env, usando valor por defecto. Esto no es seguro para producción.");
    }
    return jwt.verify(tokenAceso, secretoJWT) as UsuarioToken;
     }

     //Definir request local
     type SolicitudConUsuario = Request & { usuario?: UsuarioToken };

     //Middleware de autenticacion para proteger rutas

    function autenticarToken(solicitud: SolicitudConUsuario, respuesta: Response, siguiente: NextFunction) {
        try{
            const tokenAcceso = solicitud.cookies?.tokenAcceso as string || solicitud.headers["authorization"]?.split(" ")[1];
            if(!tokenAcceso) {
                return respuesta.status(401).json({ mensaje: "Token de acceso requerido" });
            }
            solicitud.usuario = verificarToken(tokenAcceso);
            siguiente();
        }catch(error) {
            return respuesta.status(401).json({ mensaje: "Token de acceso inválido" });
        }
    }

    //Middleware de autorización para roles específicos
    function autorizarRoles(...rolesPermitidos: Rol[]) {
        return (solicitud: SolicitudConUsuario, respuesta: Response, siguiente: NextFunction) => {
            const rolActual = solicitud.usuario?.rol;
            if(!rolActual || !rolesPermitidos.includes(rolActual)) {
                return respuesta.status(403).json({ mensaje: "Acceso denegado: rol insuficiente" });
            }
            siguiente();
        }
    }

    
