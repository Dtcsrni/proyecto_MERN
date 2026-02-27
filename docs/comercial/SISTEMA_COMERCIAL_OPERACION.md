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
14. `GET /api/admin-negocio/cobranza`
15. `POST /api/admin-negocio/cobranza/mercadopago/preferencia`
16. `POST /api/admin-negocio/consentimientos`
17. `GET /api/admin-negocio/auditoria`

## Endpoints publicos comerciales
1. `POST /api/comercial-publico/licencias/activar`
2. `POST /api/comercial-publico/licencias/heartbeat`
3. `POST /api/comercial-publico/mercadopago/webhook`

## Lógica comercial validada en backend
1. Margen bruto minimo por plan/oferta: `>= 60%`.
2. Cupones con vigencia, usos maximos y restricciones por plan/persona.
3. Rechazo de cupon si rompe margen minimo.
4. Trial requiere consentimiento granular (producto + ventas).
5. Webhook Mercado Pago idempotente por `webhookEventId`.
6. Licencia revocada invalida activacion/heartbeat.

## Variables de entorno nuevas
- `SUPERADMIN_GOOGLE_EMAILS`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `LICENCIA_JWT_SECRETO`
- `LICENCIA_HEARTBEAT_HORAS`
- `LICENCIA_GRACIA_OFFLINE_DIAS`

## Operacion recomendada
1. Arrancar ventas en SaaS como canal primario para reducir friccion de cobro y actualizaciones.
2. Ofrecer on-prem para cuentas institucionales o sector publico con requerimientos de control local.
3. Mantener pricing guardrails (margen >= 60%) y auditar excepciones en `/admin-negocio/auditoria`.
