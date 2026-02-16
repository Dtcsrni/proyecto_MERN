# Roadmap de Requisitos Verificables

Fecha de roadmap: 2026-02-15.
Base de evidencias: `reports/qa/latest/*`, `reports/perf/*.json`, `docs/ENGINEERING_BASELINE.md` (seccion "Requisitos verificables").

## Objetivo
Cerrar brechas entre estado beta operativo y estado estable auditable, manteniendo trazabilidad requisito -> evidencia -> gate.

## Principios de ejecucion
- Sin ruptura de contratos HTTP v1/v2 en dominios productivos.
- Todo cambio funcional debe venir con prueba y evidencia de gate.
- Ningun criterio de "estable" se da por cumplido sin artefacto verificable.

## Fase 1 - Consolidacion documental y de gates (1-2 semanas)
### Resultado esperado
- Requisitos funcionales y no funcionales formalizados y trazables.
- Roadmap enlazado desde documentacion oficial.

### Entregables
- `docs/ENGINEERING_BASELINE.md` actualizado con matriz RF/RNF.
- `docs/ROADMAP_REQUISITOS.md` versionado.
- Enlaces en `docs/README.md` y consistencia de inventario.

### Criterio de salida
- `npm run docs:check` en verde.
- Sin contradicciones entre baseline, inventario y criterios QA/release.

## Fase 2 - Cierre de beta operativa robusta (2-5 semanas)
### Resultado esperado
- Gates beta completos en verde de forma repetible.

### Entregables
- Evidencias `latest` completas y consistentes:
  - `dataset-prodlike.json`
  - `e2e-docente-alumno.json`
  - `global-grade.json`
  - `pdf-print.json`
  - `ux-visual.json`
  - `manifest.json`
  - `olas-bigbang.json`
  - `canary-rollout-check.json`
- Cierre de pendientes de ola en backend core (OMR/PDF/Sync) sin ruptura contractual.

### Criterio de salida
- `npm run bigbang:beta:check` en verde.
- `npm run perf:check` y `npm run perf:check:business` en verde.
- `npm run test:tdd:enforcement:ci` en verde.

## Fase 3 - Transicion beta -> estable (3-6 semanas)
### Resultado esperado
- Promocion a estable con evidencia automatizada y validacion humana de produccion.

### Entregables
- 10 corridas CI consecutivas en verde.
- Evidencias de gate humano versionadas en `docs/release/evidencias/<version>/`:
  - `manifest.json`
  - `timeline.md`
  - `metrics_snapshot.txt`
  - `integridad_sha256.json`
- Checklist de rollback readiness validado.

### Criterio de salida
- `npm run release:gate:prod-flow -- --version=<version> --periodo-id=<periodoId> --manual=docs/release/manual/prod-flow.json` con estado final `ok`.
- Cumplimiento integral de `docs/RELEASE_GATE_STABLE.md`.

## Fase 4 - Hardening post-estable (continuo)
### Resultado esperado
- Operacion sostenible con control de deuda tecnica y regresiones.

### Entregables
- Seguimiento de adopcion canary y retiro de compatibilidad temporal restante.
- Mejora progresiva de cobertura frontend por encima del umbral actual.
- Mantenimiento de baselines de rendimiento y seguridad por release.

### Criterio de salida
- Ningun gate bloqueante en regresion durante dos ciclos de release consecutivos.

## Matriz de riesgos y mitigaciones
| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Deriva entre docs y estado real | Alto | Gate `docs:check` + actualizacion de evidencia al cierre de cada sprint |
| Falso verde por evidencia incompleta | Alto | `test:qa:manifest` obligatorio en pre-release |
| Regresion por migracion v2 | Alto | Pruebas de contrato/paridad y canary progresivo |
| Presion por release sin gate humano | Alto | Bloqueo de promocion a estable hasta completar `release:gate:prod-flow` |

## Indicadores de avance
- `% requisitos RF/RNF en estado cumple` (fuente: matriz baseline).
- `% gates bloqueantes en verde por semana`.
- `p95 vs presupuesto` en rutas criticas.
- `corridas CI consecutivas verdes`.