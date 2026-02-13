# Engineering Baseline

Fecha de baseline: 2026-02-13.
Commit de referencia: `dffa43f`.

## Estado actual
- Monorepo NPM workspaces:
  - `apps/backend`
  - `apps/frontend`
  - `apps/portal_alumno_cloud`
- Inventario completo de piezas de codigo/config versionadas:
  - `docs/INVENTARIO_CODIGO_EXHAUSTIVO.md`
- Scripts de calidad centralizados en root:
  - lint, typecheck, build, test, docs-check, diagram checks, routes-check.
- Arquitectura backend: monolito modular por dominio (Ola 2 pendiente).
- Frontend docente en particion incremental (Ola 1 parcial).

## Corte de modularizacion docente (real)
- `apps/frontend/src/apps/app_docente/AppDocente.tsx`: 798 lineas.
- `apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx`: 798 lineas.
- `apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx`: 763 lineas.
- `apps/frontend/src/apps/app_docente/SeccionBanco.tsx`: 777 lineas.

## Riesgos tecnicos actuales
1. Complejidad residual en modulos UI grandes (`Plantillas` y `Banco`).
2. Gate de cobertura bloqueado por deuda historica de frontend.
3. Backend core critico aun monolitico (`OMR/PDF/Sync`) para Ola 2.
4. Dependencia de disciplina documental para mantener trazabilidad multi-agente.

## Validacion reciente (corte)
- `npm run lint`: verde.
- `npm run typecheck`: verde.
- `npm run test:frontend:ci`: verde.
- `npm run test:coverage:ci`: bloqueado por coverage frontend (baseline real 2026-02-13):
  - lines: 39.20
  - functions: 40.28
  - statements: 37.21
  - branches: 31.40

## Baseline de rendimiento (Ola 0)
- Fuente baseline: `docs/perf/baseline.json`
- Captura de corrida: `reports/perf/latest.json` (artefacto CI)
- Comandos:
  - `npm run perf:collect`
  - `npm run perf:baseline`
  - `npm run perf:check`
- Criterio de fallo: `p95` o `failures` por ruta sobre presupuesto.

## Rampa de calidad (quality gates)
| Semana | Cobertura backend | Cobertura frontend | Cobertura portal | Reglas ESLint complejidad |
| --- | --- | --- | --- | --- |
| Semana 1 | 55 | 39/40/31/37 (L/F/B/S) | 50 | `complexity=18`, `max-depth=5`, `max-params=5` |
| Semana 2 | 62 | 52 | 58 | `complexity=16`, `max-depth=4`, `max-params=5` |
| Semana 3 | 70 | 60 | 65 | `complexity=15`, `max-depth=4`, `max-params=4` |

## Reglas de gobernanza acordadas
1. No merge sin checks minimos verdes:
- `npm run lint`
- `npm run typecheck`
- `npm run test:backend:ci`
- `npm run test:portal:ci`
- `npm run test:frontend:ci`
- `npm run build`
2. Convencion de commits:
- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`
3. Todo cambio de rutas/permisos/OMR/sincronizacion debe incluir test o actualizacion de test.
4. Toda sesion agente debe actualizar trazabilidad en:
- `docs/INVENTARIO_PROYECTO.md`
- `docs/ENGINEERING_BASELINE.md`
- `CHANGELOG.md`

## Criterio de salida Fase 0/Fase 1
- Baseline versionado y alineado a estado real verificable.
- Referencia de trazabilidad IA activa:
  - `AGENTS.md`
  - `docs/IA_TRAZABILIDAD_AGENTES.md`
