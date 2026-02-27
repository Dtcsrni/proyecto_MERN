# Sistema Comercial Integral y Operacion (V1)

## Arquitectura recomendada
1. Control plane central en SaaS (Render + MongoDB Atlas + Cloudflare).
2. Distribucion hibrida: SaaS multi-tenant + on-prem con licencia activable.
3. On-prem con heartbeat cada 12 horas y gracia offline de 7 dias.

## Panel exclusivo de negocio
- Destino frontend: `VITE_APP_DESTINO=admin_negocio`.
- Ruta API privada: `/api/admin-negocio/*`.
- Alcance: tenants, planes, suscripciones, licencias, cupones, campanas, cobranza, auditoria y metricas.

## Root admin Google
- Variable: `SUPERADMIN_GOOGLE_EMAILS=tu-correo@dominio.com`.
- En login/registro con Google, si el correo esta en allowlist se agregan roles:
  - `superadmin_negocio`
  - `admin`
  - `docente`

## Endpoints privados principales
1. `GET /api/admin-negocio/dashboard/resumen`
2. `GET|POST|PATCH /api/admin-negocio/tenants`
3. `GET|POST|PATCH /api/admin-negocio/planes`
4. `GET|POST /api/admin-negocio/suscripciones`
5. `POST /api/admin-negocio/suscripciones/:id/cambiar-plan`
6. `POST /api/admin-negocio/suscripciones/:id/aplicar-cupon`
7. `POST /api/admin-negocio/suscripciones/:id/estado`
8. `GET|POST|PATCH /api/admin-negocio/cupones`
9. `GET|POST|PATCH /api/admin-negocio/campanas`
10. `GET /api/admin-negocio/metricas/mrr|conversion|churn|ltv-cac|guardrails`
11. `GET /api/admin-negocio/licencias`
12. `POST /api/admin-negocio/licencias/generar`
13. `POST /api/admin-negocio/licencias/:id/revocar`
14. `POST /api/admin-negocio/licencias/:id/reasignar-dispositivo`
15. `GET|POST|PATCH /api/admin-negocio/plantillas-notificacion`
16. `GET /api/admin-negocio/cobranza`
17. `POST /api/admin-negocio/cobranza/mercadopago/preferencia`
18. `POST /api/admin-negocio/cobranza/ciclo/ejecutar`
19. `POST /api/admin-negocio/consentimientos`
20. `GET /api/admin-negocio/auditoria`

## Endpoints publicos comerciales
1. `POST /api/comercial-publico/licencias/activar`
2. `POST /api/comercial-publico/licencias/heartbeat`
3. `POST /api/comercial-publico/mercadopago/webhook`
4. `heartbeat` requiere `nonce` + `contador` monotono para mitigar replay.

## Lógica comercial validada en backend
1. Margen bruto minimo por plan/oferta: `>= 60%`.
2. Cupones con vigencia, usos maximos y restricciones por plan/persona.
3. Rechazo de cupon si rompe margen minimo.
4. Trial requiere consentimiento granular (producto + ventas).
5. Webhook Mercado Pago idempotente por `webhookEventId`.
6. Licencia revocada invalida activacion/heartbeat.
7. Licencia queda vinculada a un solo dispositivo (`huella + host`) hasta reasignacion administrativa.
8. Intentos repetidos de token/dispositivo invalido activan autobloqueo de licencia.
9. Webhook de pago valida firma, tipo de evento, tenant/suscripcion, moneda y monto dentro de tolerancia.
10. Webhook duplicado por `eventId` o `paymentId+estado` no reprocesa cambios.
11. En modo estricto, firma MP usa manifiesto oficial: `id:[data.id_url];request-id:[x-request-id];ts:[ts];`.

## Variables de entorno nuevas
- `SUPERADMIN_GOOGLE_EMAILS`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_WEBHOOK_MAX_EDAD_SEGUNDOS`
- `MERCADOPAGO_WEBHOOK_FIRMA_ESTRICTA`
- `COBRANZA_MONTO_TOLERANCIA_PCT`
- `COBRANZA_MONTO_TOLERANCIA_ABS`
- `LICENCIA_JWT_SECRETO`
- `LICENCIA_JWT_KID_ACTIVO`
- `LICENCIA_JWT_LLAVE_PRIVADA_PEM`
- `LICENCIA_JWT_LLAVE_PUBLICA_PEM`
- `LICENCIA_JWT_LLAVES_PUBLICAS_JSON`
- `LICENCIA_JWT_PERMITIR_LEGACY_HS256`
- `LICENCIA_HEARTBEAT_HORAS`
- `LICENCIA_GRACIA_OFFLINE_DIAS`
- `COBRANZA_AUTOMATICA_INTERVAL_MIN`
- `COBRANZA_DIAS_SUSPENSION_PARCIAL`
- `COBRANZA_DIAS_SUSPENSION_TOTAL`
- `NOTIFICACIONES_WEBHOOK_URL`
- `NOTIFICACIONES_WEBHOOK_TOKEN`

## Notificaciones de cobranza
1. El ciclo de mora envia notificaciones best-effort por correo.
2. Si se configura `NOTIFICACIONES_WEBHOOK_URL`, se envian eventos para canal WhatsApp/CRM.
3. Se emiten avisos en:
- recordatorio
- suspension parcial
- suspension total

## Operacion recomendada
1. Arrancar ventas en SaaS como canal primario para reducir friccion de cobro y actualizaciones.
2. Ofrecer on-prem para cuentas institucionales o sector publico con requerimientos de control local.
3. Mantener pricing guardrails (margen >= 60%) y auditar excepciones en `/admin-negocio/auditoria`.
4. En produccion de licencias, usar `RS256` con `kid` activo y conservar llaves publicas historicas para verificacion durante rotacion.

## Rotacion de llaves de licencia
1. Generar nuevo par RSA con `node scripts/comercial/generar-llaves-licencia-rs256.mjs`.
2. Publicar nuevo `LICENCIA_JWT_KID_ACTIVO` y agregar llaves publicas historicas en `LICENCIA_JWT_LLAVES_PUBLICAS_JSON`.
3. Mantener `LICENCIA_JWT_PERMITIR_LEGACY_HS256=true` durante migracion de tokens antiguos y desactivarlo cuando ya no existan.
