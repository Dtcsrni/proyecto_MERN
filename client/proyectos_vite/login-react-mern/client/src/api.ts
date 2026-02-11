/**
 * [BLOQUE DIDACTICO] client/src/api.ts
 * Que es: Cliente HTTP reutilizable del frontend.
 * Que hace: Centraliza llamadas API, manejo de errores y envio de credenciales.
 * Como lo hace: Envuelve fetch, normaliza headers y parsea respuestas JSON.
 */

/**
 * Capa mínima de acceso HTTP del frontend.
 *
 * Qué es:
 * - Un helper genérico para llamar endpoints del backend.
 *
 * Qué hace:
 * - Normaliza headers.
 * - Incluye cookies (`credentials: "include"`) en todas las llamadas.
 * - Unifica el manejo de errores HTTP.
 *
 * Por qué está así:
 * - En este proyecto la sesión vive en cookie HttpOnly, no en localStorage.
 * - Centralizar fetch evita repetir lógica en cada componente.
 */
export async function consultarApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const headers = new Headers(opciones.headers);

  // Si el cuerpo es JSON, fija Content-Type automáticamente.
  // Si es FormData, NO lo fija para que el navegador agregue el boundary correcto.
  if (!headers.has("Content-Type") && opciones.body && !(opciones.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const respuesta = await fetch(ruta, {
    ...opciones,
    headers,
    credentials: "include"
  });

  // El backend devuelve JSON en éxito y en error.
  // Si por alguna razón llega algo no-JSON, caemos a {} y evitamos romper la UI.
  const datos = (await respuesta.json().catch(() => ({}))) as { mensaje?: string };
  if (!respuesta.ok) {
    // Propagamos un mensaje legible hacia los componentes (login, rutas, etc.).
    throw new Error(datos.mensaje || "No se pudo completar la solicitud.");
  }

  return datos as T;
}
