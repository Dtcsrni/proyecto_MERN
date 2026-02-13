# Engineering Baseline

Fecha de baseline: 2026-02-13.

## Estado actual
- Monorepo NPM workspaces:
  - `apps/backend`
  - `apps/frontend`
  - `apps/portal_alumno_cloud`
- Scripts de calidad ya centralizados en root:
  - lint, typecheck, build, test, docs-check, diagram checks, routes-check.
- Arquitectura backend: monolito modular por dominio.
- Frontend docente en proceso activo de partición por secciones (reducción de archivos grandes).

## Riesgos técnicos actuales
1. Complejidad residual en módulos UI grandes.
2. Falta de contrato formal de pipeline (resuelto con `ci/pipeline.contract.md`).
3. Cobertura de pruebas en rampa progresiva hasta objetivo final por app.
4. Dependencia de ejecución local para parte de validaciones operativas.

## Rampa de calidad (quality gates)
| Semana | Cobertura backend | Cobertura frontend | Cobertura portal | Reglas ESLint complejidad |
| --- | --- | --- | --- | --- |
| Semana 1 | 55 | 45 | 50 | `complexity=18`, `max-depth=5`, `max-params=5` |
| Semana 2 | 62 | 52 | 58 | `complexity=16`, `max-depth=4`, `max-params=5` |
| Semana 3 | 70 | 60 | 65 | `complexity=15`, `max-depth=4`, `max-params=4` |

## Reglas de gobernanza acordadas
1. No merge sin checks mínimos verdes:
- `npm run lint`
- `npm run typecheck`
- `npm run test:backend:ci`
- `npm run test:portal:ci`
- `npm run test:frontend:ci`
- `npm run build`
2. Convención de commits:
- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`
3. Todo cambio de rutas/permisos/OMR/sincronización debe incluir test o actualización de test.

## Criterio de salida Fase 0
- Baseline versionado y usado como referencia de progreso.
