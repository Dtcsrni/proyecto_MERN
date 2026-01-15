# Seguridad (OWASP API Top 10 2023)

## Checklist base
- Autorizacion por objeto: cada docente solo accede a su grupo/periodo.
- Autenticacion simple y robusta: JWT para docentes y codigos temporales para alumnos.
- Validacion de payload: Zod en rutas criticas.
- Rate limiting: express-rate-limit.
- Sanitizacion de entradas: middleware propio `sanitizarMongo()` (compatible con Express 5).
- Registro y auditoria: logs de cambios y accesos.
- Secretos fuera del repo: usar `.env` y secret managers.
- Transporte seguro: HTTPS en cloud y en red local confiable.
- Manejo de errores: sin filtrar detalles internos.
- Backup y retencion: politicas claras y purga controlada.
- Sync cloud protegido con API key.

## Notas de implementacion
- Express 5: `req.query` es un getter (no asignable). Por eso se evita `express-mongo-sanitize` y se usa un sanitizer que no reasigna `req.query`.
- Secretos JWT: en `production`, `JWT_SECRETO` es obligatorio (fail-fast) para evitar arrancar con defaults inseguros.
- Endurecimiento basico: `app.disable('x-powered-by')` + Helmet para cabeceras.

## Recomendaciones adicionales
- Hash de contrasenas con Argon2/bcrypt.
- Codigo alumno: 12h y 1 uso (configurable).
- CORS restringido a origenes autorizados.
- Monitoreo de intentos fallidos y bloqueo temporal.
