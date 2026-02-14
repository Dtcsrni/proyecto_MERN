# Cierre Big-Bang `1.0-beta`

## Objetivo
Estandarizar una salida de `1.0-beta` con gates bloqueantes, evidencia QA completa y estado de olas trazable.

## Definicion de completitud
- `segmentada`: la ola tiene desacople tecnico inicial y gates parciales.
- `completada`: migracion funcional integral cerrada + retiro/encapsulado final de legado + evidencia QA en verde.

## Gate operativo unico
Ejecutar:

```bash
npm run bigbang:beta:check
```

Este comando ejecuta en secuencia:
1. `test:dataset-prodlike:ci`
2. `test:e2e:docente-alumno:ci`
3. `test:global-grade:ci`
4. `test:pdf-print:ci`
5. `test:ux-visual:ci`
6. `test:qa:manifest` (falla si falta cualquier evidencia en `reports/qa/latest`)
7. `bigbang:olas:strict`

## Evidencias obligatorias en latest
- `reports/qa/latest/dataset-prodlike.json`
- `reports/qa/latest/e2e-docente-alumno.json`
- `reports/qa/latest/global-grade.json`
- `reports/qa/latest/pdf-print.json`
- `reports/qa/latest/ux-visual.json`
- `reports/qa/latest/manifest.json`
- `reports/qa/latest/olas-bigbang.json`

## Criterio Go/No-Go para beta
- **Go**: todos los comandos del gate operativo en verde, sin bypass manual, y artefactos presentes/consistentes.
- **No-Go**: cualquier falla de comando o artefacto faltante en `latest`.

## Referencias
- `docs/QA_GATE_CRITERIA.md`
- `ci/pipeline.contract.md`
- `docs/INVENTARIO_PROYECTO.md`
