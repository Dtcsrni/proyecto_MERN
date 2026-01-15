/**
 * Servicio de correo (placeholder para integraciones futuras).
 *
 * Nota:
 * - En este repositorio se deja como stub para mantener el core sin dependencias
 *   externas (SMTP/API providers).
 * - En produccion se recomienda implementar este modulo y manejar fallas como
 *   best-effort cuando el envio sea un efecto secundario no critico.
 */
export async function enviarCorreo(_destinatario: string, _asunto: string, _contenido: string) {
  void _destinatario;
  void _asunto;
  void _contenido;
  throw new Error('Servicio de correo no configurado');
}
