# DevOps Baseline

Fecha de baseline: 2026-02-13.

## Topología operativa (local + cloud mínimo)
1. Local docente (Docker Compose):
- `mongo_local`
- `api_docente_local`
- `web_docente_local`
- `mongo_express_local` (opcional)
2. Perfil prod local:
- `api_docente_prod`
- `web_docente_prod`
3. Cloud mínimo:
- `apps/portal_alumno_cloud` desplegable en servicio gestionado.

## Entrega y verificación
- Comandos raíz disponibles para CI:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `npm run test:ci`
- Contrato agnóstico de pipeline:
  - `ci/pipeline.contract.md`
  - `ci/pipeline.matrix.json`

## Seguridad de configuración
- Local: `.env` y `.env.example`.
- Cloud: secretos en secret manager del proveedor.
- Validación de entorno:
  - `npm run security:env:check`

## Observabilidad mínima
- Health:
  - backend: `/api/salud`, `/api/salud/live`, `/api/salud/ready`
  - portal: `/api/portal/salud`, `/api/portal/salud/live`, `/api/portal/salud/ready`
- Métricas Prometheus:
  - backend: `/api/salud/metrics`
  - portal: `/api/portal/metrics`
- Logging estructurado JSON con `requestId`.

## Criterio de salida Fase 0/Fase 1
- Baseline versionado + contrato pipeline utilizable en cualquier runner.
