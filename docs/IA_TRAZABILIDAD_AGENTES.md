# Trazabilidad IA del Proyecto

Fecha de corte: 2026-02-19
Objetivo: continuidad entre agentes con estado verificable y evidencia reproducible.

## 1) Snapshot operativo
- Version: `1.0.0-beta.0`.
- API activa: `/api/*`.
- Sync activo: schema v2 + fingerprint `sync-v2-lww-updatedAt-schema2`.
- Gate de arquitectura limpia activo en CI.

## 2) Fuentes de verdad para agentes
1. `AGENTS.md`
2. `.github/copilot-instructions.md`
3. `ci/pipeline.contract.md`
4. `ci/pipeline.matrix.json`
5. `.github/workflows/ci.yml`
6. `.github/workflows/ci-frontend.yml`
7. `docs/INVENTARIO_PROYECTO.md`
8. `docs/ENGINEERING_BASELINE.md`
9. `docs/RELEASE_GATE_STABLE.md`
10. `CHANGELOG.md`

## 3) Reglas obligatorias de ejecucion
1. Verificar estado real antes de editar.
2. No reducir gates/umbrales para forzar verde.
3. Mantener contrato unico y eliminar rutas/flags retiradas.
4. Cerrar con evidencia de comandos ejecutados.

## 4) Matriz minima de cierre
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:frontend:ci`
4. `npm run test:coverage:ci`
5. `npm run perf:check`
6. `npm run pipeline:contract:check`
7. `npm run qa:clean-architecture:strict`

## 5) Handoff
- Plantilla: `docs/handoff/PLANTILLA_HANDOFF_IA.md`
- Generadores:
  - `npm run ia:handoff:quick`
  - `npm run ia:handoff:full`
