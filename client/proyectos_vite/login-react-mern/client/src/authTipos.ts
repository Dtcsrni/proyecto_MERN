/**
 * Rol de aplicación.
 *
 * Qué es:
 * - El conjunto de perfiles que pueden venir en el token.
 *
 * Por qué está así:
 * - Es un union type literal para que TypeScript detecte errores de rol
 *   en compilación (por ejemplo, "admin" vs "administrador").
 */
export type Rol = "usuario" | "administrador" | "desarrollador" | "super_usuario";

/**
 * Forma mínima del usuario autenticado en frontend.
 *
 * Qué contiene:
 * - Solo lo necesario para UI y autorización.
 *
 * Por qué no incluye más campos:
 * - Menos datos en sesión reduce acoplamiento y superficie de exposición.
 */
export type UsuarioToken = {
  id: string;
  correo: string;
  rol: Rol;
};

/**
 * Contrato público del contexto de autenticación.
 *
 * Qué ofrece:
 * - Estado (`usuario`, `cargando`) + acciones (`iniciarSesion`, `cerrarSesion`).
 *
 * Por qué existe:
 * - Permite que cualquier componente use autenticación sin depender de la API HTTP directa.
 */
export type ContextoAutenticacion = {
  usuario: UsuarioToken | null;
  cargando: boolean;
  iniciarSesion: (correo: string, contrasena: string) => Promise<void>;
  registrarCuenta: (correo: string, contrasena: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};
