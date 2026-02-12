/**
 * [BLOQUE DIDACTICO] client/src/App.tsx
 * Que es: ensamblador principal de rutas y layout base de la SPA.
 * Que hace: separa rutas publicas/privadas y monta paneles por rol.
 * Como lo hace: envuelve la app con Provider de auth + Router + guardas RBAC.
 */

import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "./App.css";
import { ProveedorAutenticacion } from "./autenticacion";
import { useAutenticacion } from "./useAutenticacion";
import { RutaProtegida } from "./RutaProtegida";
import Login from "./login";
import Register from "./register";
import Admin from "./admin";
import { ActividadesDesarrollador } from "./ActividadesDesarrollador";

/**
 * Inicio privado.
 *
 * Responsabilidades:
 * - Mostrar identidad/rol de la sesion actual.
 * - Exponer salida de sesion.
 * - Publicar accesos condicionales por rol (admin y actividades desarrollador).
 */
function Inicio() {
  const { usuario, cerrarSesion } = useAutenticacion();
  const puedeVerAdmin = usuario?.rol === "administrador" || usuario?.rol === "super_usuario";

  return (
    <div className="panel-stack">
      <section className="panel">
        <h1>Panel principal</h1>
        <p>Sesión activa como: {usuario?.correo}</p>
        <p>Rol actual: {usuario?.rol}</p>
        <div className="actions">
          {puedeVerAdmin && <Link to="/admin">Ir al módulo admin</Link>}
          <button type="button" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </button>
        </div>
      </section>
      <ActividadesDesarrollador />
    </div>
  );
}

/**
 * Composicion principal de rutas.
 *
 * Orden intencional:
 * 1) `ProveedorAutenticacion`: mantiene estado global de sesion.
 * 2) `BrowserRouter`: resuelve navegacion en cliente.
 * 3) `RutaProtegida`: decide acceso segun autenticacion/rol.
 */
function App() {
  return (
    <ProveedorAutenticacion>
      <BrowserRouter>
        <main className="app-shell">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <RutaProtegida>
                  <Inicio />
                </RutaProtegida>
              }
            />
            <Route
              path="/admin"
              element={
                <RutaProtegida rolesPermitidos={["administrador", "super_usuario"]}>
                  <Admin />
                </RutaProtegida>
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
    </ProveedorAutenticacion>
  );
}

export default App;
