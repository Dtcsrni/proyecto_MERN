/**
 * [BLOQUE DIDACTICO] client/src/main.tsx
 * Que es: Punto de entrada del frontend React.
 * Que hace: Monta la aplicacion en el DOM e inicializa estilos globales.
 * Como lo hace: Usa createRoot para renderizar App dentro del elemento #root.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

/**
 * Punto de entrada del frontend.
 *
 * `StrictMode` se usa en desarrollo para detectar patrones problemáticos
 * (efectos no idempotentes, APIs deprecadas, etc.).
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
