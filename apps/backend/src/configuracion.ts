/**
 * Configuracion centralizada del backend.
 */
import dotenv from 'dotenv';
import path from 'node:path';

// Dotenv v17 puede emitir logs informativos; se silencian para mantener
// pruebas y consola limpias.
dotenv.config({
  quiet: true,
  path: path.resolve(__dirname, '..', '..', '..', '.env')
});

const puerto = Number(process.env.PUERTO_API ?? process.env.PORT ?? 4000);
const mongoUri = process.env.MONGODB_URI ?? process.env.MONGO_URI ?? '';
const entorno = process.env.NODE_ENV ?? 'development';
const limiteJson = process.env.LIMITE_JSON ?? '10mb';
const corsOrigenes = (process.env.CORS_ORIGENES ?? 'http://localhost:5173')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

const dominiosCorreoPermitidos = (process.env.DOMINIOS_CORREO_PERMITIDOS ?? '')
  .split(',')
  .map((dominio) => dominio.trim().toLowerCase().replace(/^@/, ''))
  .filter(Boolean);

function parsearNumeroSeguro(valor: unknown, porDefecto: number, { min, max }: { min?: number; max?: number } = {}) {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return porDefecto;
  const clampedMax = typeof max === 'number' ? Math.min(max, n) : n;
  const clamped = typeof min === 'number' ? Math.max(min, clampedMax) : clampedMax;
  return clamped;
}
// En producción, el secreto JWT debe ser proporcionado por entorno.
// En desarrollo/test se permite un valor por defecto para facilitar el setup.
const jwtSecreto = process.env.JWT_SECRETO ?? '';
if (entorno === 'production' && !jwtSecreto) {
  throw new Error('JWT_SECRETO es requerido en producción');
}
if (entorno === 'production' && !mongoUri) {
  throw new Error('MONGODB_URI es requerido en producción');
}
const jwtSecretoEfectivo = jwtSecreto || 'cambia-este-secreto';
const jwtExpiraHoras = Number(process.env.JWT_EXPIRA_HORAS ?? 8);
const refreshTokenDias = Number(process.env.REFRESH_TOKEN_DIAS ?? 30);
const googleOauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
const googleClassroomClientId = process.env.GOOGLE_CLASSROOM_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
const googleClassroomClientSecret = process.env.GOOGLE_CLASSROOM_CLIENT_SECRET ?? '';
const googleClassroomRedirectUri = process.env.GOOGLE_CLASSROOM_REDIRECT_URI ?? '';
const classroomTokenCipherKey = process.env.CLASSROOM_TOKEN_CIPHER_KEY ?? '';
const codigoAccesoHoras = Number(process.env.CODIGO_ACCESO_HORAS ?? 12);
const portalAlumnoUrl = process.env.PORTAL_ALUMNO_URL ?? '';
const portalApiKey = process.env.PORTAL_ALUMNO_API_KEY ?? '';

// Rate limit: configurable por entorno para tuning y para pruebas deterministas.
// Defaults conservan el comportamiento anterior.
const rateLimitWindowMs = parsearNumeroSeguro(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, {
  min: 1_000,
  max: 24 * 60 * 60 * 1000
});
const rateLimitLimit = parsearNumeroSeguro(process.env.RATE_LIMIT_LIMIT, 300, { min: 1, max: 10_000 });
const rateLimitCredencialesLimit = parsearNumeroSeguro(
  process.env.RATE_LIMIT_CREDENCIALES_LIMIT,
  entorno === 'production' ? 40 : 120,
  { min: 1, max: 10_000 }
);
const rateLimitRefrescoLimit = parsearNumeroSeguro(
  process.env.RATE_LIMIT_REFRESCO_LIMIT,
  entorno === 'production' ? 240 : 600,
  { min: 1, max: 10_000 }
);

// OMR: limite del tamaño de la imagen en base64 (en caracteres) para evitar payloads abusivos.
// Nota: base64 suele inflar ~33%, por eso se controla por longitud de string.
const omrImagenBase64MaxChars = parsearNumeroSeguro(process.env.OMR_IMAGEN_BASE64_MAX_CHARS, 2_000_000, {
  min: 1_000,
  max: 50_000_000
});

const complianceModeRaw = String(process.env.COMPLIANCE_MODE ?? 'private').trim().toLowerCase();
const complianceMode: 'private' | 'public-hidalgo' = complianceModeRaw === 'public-hidalgo' ? 'public-hidalgo' : 'private';
const dataRetentionDefaultDays = parsearNumeroSeguro(process.env.DATA_RETENTION_DEFAULT_DAYS, 365, {
  min: 1,
  max: 3650
});
const dataPurgeCron = String(process.env.DATA_PURGE_CRON ?? '0 3 * * *').trim();
const auditLogImmutable = ['1', 'true', 'yes'].includes(String(process.env.AUDIT_LOG_IMMUTABLE ?? 'true').toLowerCase());
const dpoContactEmail = String(process.env.DPO_CONTACT_EMAIL ?? 'armsystechno@gmail.com').trim();
const legalNoticeVersion = String(process.env.LEGAL_NOTICE_VERSION ?? '2026.02').trim();
const superadminGoogleEmails = (process.env.SUPERADMIN_GOOGLE_EMAILS ?? '')
  .split(',')
  .map((correo) => correo.trim().toLowerCase())
  .filter(Boolean);
const mercadoPagoAccessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN ?? '').trim();
const mercadoPagoWebhookSecret = String(process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '').trim();
const licenciaJwtSecreto = String(process.env.LICENCIA_JWT_SECRETO ?? jwtSecretoEfectivo).trim();
const licenciaHeartbeatHoras = parsearNumeroSeguro(process.env.LICENCIA_HEARTBEAT_HORAS, 12, { min: 1, max: 168 });
const licenciaGraciaOfflineDias = parsearNumeroSeguro(process.env.LICENCIA_GRACIA_OFFLINE_DIAS, 7, { min: 1, max: 30 });

export const configuracion = {
  puerto,
  mongoUri,
  entorno,
  limiteJson,
  corsOrigenes,
  dominiosCorreoPermitidos,
  jwtSecreto: jwtSecretoEfectivo,
  jwtExpiraHoras,
  refreshTokenDias,
  googleOauthClientId,
  googleClassroomClientId,
  googleClassroomClientSecret,
  googleClassroomRedirectUri,
  classroomTokenCipherKey,
  codigoAccesoHoras,
  portalAlumnoUrl,
  portalApiKey,
  rateLimitWindowMs,
  rateLimitLimit,
  rateLimitCredencialesLimit,
  rateLimitRefrescoLimit,
  omrImagenBase64MaxChars,
  complianceMode,
  dataRetentionDefaultDays,
  dataPurgeCron,
  auditLogImmutable,
  dpoContactEmail,
  legalNoticeVersion,
  superadminGoogleEmails,
  mercadoPagoAccessToken,
  mercadoPagoWebhookSecret,
  licenciaJwtSecreto,
  licenciaHeartbeatHoras,
  licenciaGraciaOfflineDias
};
