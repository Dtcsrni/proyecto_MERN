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
  - `npm run test:coverage:exclusions:debt`
  - `npm run test:coverage:diff`
- Contrato agnóstico de pipeline:
  - `ci/pipeline.contract.md`
  - `ci/pipeline.matrix.json`
- Workflows separados por responsabilidad:
  - `.github/workflows/ci.yml` (`CI Checks`): quality gates bloqueantes.
  - `.github/workflows/package.yml` (`Package Images`): empaquetado Docker + `image-digests.txt`.
  - `.github/workflows/autogen-docs.yml` (`Auto-Generate Docs`): autogeneracion y versionado de docs/diagramas.
  - `.github/workflows/ci-backend.yml` (`CI Backend Module`): pipeline aislado de backend.
  - `.github/workflows/ci-frontend.yml` (`CI Frontend Module`): pipeline aislado de frontend.
  - `.github/workflows/ci-portal.yml` (`CI Portal Module`): pipeline aislado de portal alumno cloud.
  - `.github/workflows/ci-docs.yml` (`CI Docs Module`): pipeline aislado de docs/diagramas/rutas.

## Aislamiento operativo CI (modular)
- Un fallo en un modulo no cancela la ejecucion de los demas workflows modulares.
- Los modulos no exitosos reportan fallo localizado y los modulos sanos siguen entregando señal en verde.
- `CI Checks` se mantiene como señal integradora global para release gating.

## Proteccion de rama main (Ruleset activo)
- Ruleset: `main-1-0-beta-minimo` (target `branch`, enforcement `active`).
- Alcance: `refs/heads/main`.
- Reglas vigentes:
  - bloqueo de borrado de rama (`deletion`),
  - bloqueo de force-push (`non_fast_forward`),
  - pull request obligatorio con 1 aprobación mínima,
  - descarte de approvals stale al recibir nuevos commits,
  - resolucion obligatoria de conversaciones,
  - branch actualizado obligatoriamente antes de merge (`strict required status checks policy`).
- Status check requerido para merge en `main`:
  - `Verificaciones Core (PR bloqueante)` (workflow integrador `CI Checks`).
- Criterio operativo:
  - los workflows modulares con filtros por `paths` no se marcan como required para evitar bloqueos por checks no disparados.

## Fallback y resiliencia
- Fallback de pipeline: aislamiento por workflow (degradacion por dominio, no falla sistémica de toda la malla).
- Hardening de dependencias nativas en backend module:
  - instalacion explicita de `sharp` linux-x64 antes de pruebas para evitar errores de runtime nativo en runners Linux.

## Enforcements TDD activos
- Diff coverage bloqueante en CI (`DIFF_COVERAGE_MIN=90`).
- Registro de deuda temporal de exclusiones de coverage:
  - `docs/tdd-exclusions-debt.json`
- Verificador bloqueante de deuda vencida:
  - `npm run test:coverage:exclusions:debt`

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

## Estado operativo del corte (2026-02-13)
- Security scan estricto activo:
  - `NODE_ENV=production STRICT_ENV_CHECK=1 npm run security:env:check`
  - `npm audit --audit-level=high --json > npm-audit-report.json`
- Evidencias operativas centralizadas en `docs/INVENTARIO_PROYECTO.md`.
- Trazabilidad multi-sesion de agentes centralizada en:
  - `AGENTS.md`
  - `docs/IA_TRAZABILIDAD_AGENTES.md`

