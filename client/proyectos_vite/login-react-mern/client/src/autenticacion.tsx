/** @jsx React.createElement */
import React, { createContext, useContext, useEffect, useState } from "react";
import { consultarApi } from "./api.ts";

/** Roles del sistema (2.1.3) */
export type Rol = "usuario" | "administrador" | "desarrollador" | "super_usuario";

/** Sesión mínima (lo que regresa /me y /login) */
export type UsuarioToken = {
  id: string;
  correo: string;
  rol: Rol;
};

type ContextoAutenticacion = {
  usuario: UsuarioToken | null;
  cargando: boolean;
  iniciarSesion: (correo: string, contrasena: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const Contexto = createContext<ContextoAutenticacion | null>(null);

/**
 * ProveedorAutenticacion:
 * - Al iniciar la app, consulta /api/auth/me
 * - Si hay cookie válida, carga usuario
 * - Si no, queda en null
 */
export function ProveedorAutenticacion({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioToken | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const respuesta = await consultarApi<{ usuario: UsuarioToken }>("/api/auth/me");
        setUsuario(respuesta.usuario);
      } catch {
        setUsuario(null);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  /**
   * iniciarSesion:
   * - Llama al backend /login
   * - Si es correcto, backend setea cookie y regresa usuario
   */
  async function iniciarSesion(correo: string, contrasena: string) {
    const respuesta = await consultarApi<{ usuario: UsuarioToken }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ correo, contrasena })
    });
    setUsuario(respuesta.usuario);
  }

  /**
   * cerrarSesion:
   * - Llama al backend /logout
   * - Borra cookie en backend
   * - Limpia estado local
   */
  async function cerrarSesion() {
    await consultarApi("/api/auth/logout", { method: "POST" });
    setUsuario(null);
  }

  return (
    <Contexto.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </Contexto.Provider>
  );
}

export function usarAutenticacion() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("usarAutenticacion debe usarse dentro de ProveedorAutenticacion");
  return contexto;
}