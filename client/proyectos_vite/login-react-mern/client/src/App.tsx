import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "./App.css";
import { ProveedorAutenticacion } from "./autenticacion";
import { useAutenticacion } from "./useAutenticacion";
import { RutaProtegida } from "./RutaProtegida";
import Login from "./login";
import Register from "./register";
import Admin from "./admin";

/**
 * Home privada.
 *
 * Qué muestra:
 * - Identidad y rol del usuario autenticado.
 *
 * Por qué es útil:
 * - Permite validar rápidamente que sesión y claims de rol están llegando bien.
 */
function Inicio() {
  const { usuario, cerrarSesion } = useAutenticacion();
  const puedeVerAdmin = usuario?.rol === "administrador" || usuario?.rol === "super_usuario";

  return (
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
  );
}

/**
 * Composición principal de la SPA.
 *
 * Estructura:
 * - `ProveedorAutenticacion`: estado global de sesión.
 * - `BrowserRouter`: navegación cliente.
 * - `RutaProtegida`: guard de autenticación/autorización.
 *
 * Por qué este orden:
 * - Las rutas necesitan acceder al contexto de auth para decidir acceso.
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
