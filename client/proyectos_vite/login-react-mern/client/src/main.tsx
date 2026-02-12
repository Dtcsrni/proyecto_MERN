/**
 * [BLOQUE DIDACTICO] client/src/main.tsx
 * Que es: entrypoint del frontend React.
 * Que hace: carga estilos globales y monta la aplicacion en `#root`.
 * Como lo hace: usa `createRoot` con `StrictMode` para chequeos de desarrollo.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

/**
 * Punto de arranque del arbol React.
 *
 * `StrictMode` se usa en desarrollo para detectar patrones problemáticos
 * (efectos no idempotentes, APIs deprecadas, etc.).
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
