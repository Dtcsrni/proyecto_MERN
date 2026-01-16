import type { TipoMensaje } from '../../ui/ux/componentes/InlineMensaje';

/**
 * Clasifica mensajes cortos mostrados debajo de formularios.
 *
 * Regla general:
 * - `error`: fallos accionables (credenciales invalidas, validaciones, etc.)
 * - `ok`: confirmaciones positivas (cambios guardados, etc.)
 * - `info`: estados neutrales/guia (pasos siguientes, invitacion a registrar, etc.)
 */
export function tipoMensajeInline(texto: string): TipoMensaje {
  const lower = String(texto || '').trim().toLowerCase();
  if (!lower) return 'info';

  // Casos informativos que no deben pintarse como OK.
  if (lower.includes('no existe una cuenta')) return 'info';
  if (lower.includes('completa tus datos')) return 'info';
  if (lower.includes('reautentica') || lower.includes('reautentica')) return 'info';
  if (lower.includes('google listo')) return 'info';

  // Errores comunes.
  if (lower.includes('incorrect')) return 'error';
  if (lower.includes('no se pudo')) return 'error';
  if (lower.includes('no se recibio') || lower.includes('no se recibió')) return 'error';
  if (lower.includes('no permitido') || lower.includes('no se permite')) return 'error';
  if (lower.includes('falta')) return 'error';
  if (lower.includes('inval') || lower.includes('invál')) return 'error';
  if (lower.includes('error')) return 'error';

  // Confirmaciones positivas.
  if (lower.includes('actualizada') || lower.includes('actualizado')) return 'ok';
  if (lower.includes('guardada') || lower.includes('guardado')) return 'ok';
  if (lower.includes('sesion iniciada') || lower.includes('sesión iniciada')) return 'ok';
  if (lower.includes('cuenta creada')) return 'ok';

  // Por defecto, preferimos info para evitar falsos "éxito".
  return 'info';
}
