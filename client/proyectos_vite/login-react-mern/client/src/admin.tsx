/**
 * [BLOQUE DIDACTICO] client/src/admin.tsx
 * Que es: modulo de administracion de roles y permisos.
 * Que hace: lista cuentas, permite seleccionar un nuevo rol y persistir cambios.
 * Como lo hace: consume endpoints protegidos, aplica reglas RBAC en UI y sincroniza estado local.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { consultarApi } from "./api";
import type { Rol } from "./authTipos";
import { useAutenticacion } from "./useAutenticacion";

type UsuarioAdmin = {
  id: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const ROLES_DISPONIBLES: Rol[] = ["usuario", "desarrollador", "administrador", "super_usuario"];

const PERMISOS_POR_ROL: Record<Rol, string> = {
  usuario: "Acceso al panel principal",
  desarrollador: "Acceso al panel principal y recursos de desarrollo",
  administrador: "Gestiona usuarios (excepto super usuario)",
  super_usuario: "Control total de permisos y administración"
};

/**
 * Pantalla de administracion.
 *
 * Flujo resumido:
 * 1) Cargar usuarios al montar.
 * 2) Permitir edicion temporal del rol por fila.
 * 3) Confirmar cambio con PATCH y refrescar solo la fila afectada.
 */
export default function Admin() {
  const { usuario } = useAutenticacion();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [ediciones, setEdiciones] = useState<Record<string, Rol>>({});
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const puedeAsignarSuper = usuario?.rol === "super_usuario";
  const rolesEditables = puedeAsignarSuper
    ? ROLES_DISPONIBLES
    : ROLES_DISPONIBLES.filter((rol) => rol !== "super_usuario");

  useEffect(() => {
    // Carga inicial de la tabla administrativa.
    void cargarUsuarios();
  }, []);

  /**
   * Obtiene el listado base para la tabla.
   * Se reinician mensajes para evitar mostrar errores viejos entre recargas.
   */
  async function cargarUsuarios() {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await consultarApi<{ usuarios: UsuarioAdmin[] }>("/api/auth/usuarios");
      setUsuarios(respuesta.usuarios);
    } catch (errorDesconocido: unknown) {
      const mensaje =
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No se pudo cargar la lista de usuarios.";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  /**
   * Guarda en memoria el rol elegido sin persistir todavia.
   * La persistencia real ocurre en `guardarRol`.
   */
  function cambiarRolTemporal(idUsuario: string, rol: Rol) {
    setEdiciones((estadoActual) => ({ ...estadoActual, [idUsuario]: rol }));
    setAviso(null);
    setError(null);
  }

  /**
   * Persiste un cambio de rol para una fila especifica.
   *
   * Reglas de seguridad de UI:
   * - no enviar PATCH si no hubo cambio.
   * - deshabilitar fila mientras se guarda para evitar doble envio.
   */
  async function guardarRol(usuarioFila: UsuarioAdmin) {
    const rolNuevo = ediciones[usuarioFila.id] ?? usuarioFila.rol;
    if (rolNuevo === usuarioFila.rol) return;

    setGuardandoId(usuarioFila.id);
    setError(null);
    setAviso(null);
    try {
      const respuesta = await consultarApi<{ usuario: UsuarioAdmin }>(
        `/api/auth/usuarios/${usuarioFila.id}/rol`,
        {
          method: "PATCH",
          body: JSON.stringify({ rol: rolNuevo })
        }
      );

      setUsuarios((estadoActual) =>
        estadoActual.map((item) => (item.id === respuesta.usuario.id ? respuesta.usuario : item))
      );
      setEdiciones((estadoActual) => {
        const copia = { ...estadoActual };
        delete copia[usuarioFila.id];
        return copia;
      });
      setAviso(`Permisos actualizados para ${respuesta.usuario.correo}.`);
    } catch (errorDesconocido: unknown) {
      const mensaje =
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No se pudo actualizar el rol.";
      setError(mensaje);
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <section className="panel">
      <h1>Módulo administrador</h1>
      <p>Gestiona los permisos de acceso de todos los usuarios registrados.</p>
      <p className="aux-link">
        <Link to="/">Volver al inicio</Link>
      </p>

      {cargando && <p>Cargando usuarios...</p>}
      {error && <p className="error-message">{error}</p>}
      {aviso && <p className="success-message">{aviso}</p>}

      {!cargando && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Rol actual</th>
                <th>Permisos</th>
                <th>Nuevo rol</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuarioFila) => {
                // `rolSeleccionado` refleja lo que el admin eligio en UI,
                // aunque aun no se haya enviado al backend.
                const rolSeleccionado = ediciones[usuarioFila.id] ?? usuarioFila.rol;
                const huboCambio = rolSeleccionado !== usuarioFila.rol;
                // Un admin no-super no puede editar cuentas super_usuario.
                const bloqueadoPorSuper = !puedeAsignarSuper && usuarioFila.rol === "super_usuario";
                // Proteccion adicional: evitar autoedicion del rol propio.
                const esMismoUsuario = usuario?.id === usuarioFila.id;
                const deshabilitado =
                  guardandoId === usuarioFila.id || bloqueadoPorSuper || esMismoUsuario;

                return (
                  <tr key={usuarioFila.id}>
                    <td>{usuarioFila.correo}</td>
                    <td>{usuarioFila.rol}</td>
                    <td>{PERMISOS_POR_ROL[rolSeleccionado]}</td>
                    <td>
                      <select
                        value={rolSeleccionado}
                        onChange={(e) => cambiarRolTemporal(usuarioFila.id, e.target.value as Rol)}
                        disabled={deshabilitado}
                      >
                        {rolesEditables.map((rolOpcion) => (
                          <option key={rolOpcion} value={rolOpcion}>
                            {rolOpcion}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void guardarRol(usuarioFila)}
                        disabled={deshabilitado || !huboCambio}
                      >
                        {guardandoId === usuarioFila.id ? "Guardando..." : "Guardar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
