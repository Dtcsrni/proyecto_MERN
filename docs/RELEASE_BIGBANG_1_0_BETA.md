# Cierre Big-Bang `1.0-beta`

## Objetivo
Estandarizar una salida de `1.0-beta` con gates bloqueantes, evidencia QA completa y estado de olas trazable.

## Definicion de completitud
- `segmentada`: la ola tiene desacople tecnico inicial y gates parciales.
- `completada`: migracion funcional integral cerrada + retiro/encapsulado final de legado + evidencia QA en verde.

## Politica de gates para beta
- Cierre beta exige `core` + `extended` operativo.
- `canary-rollout-check` debe existir como evidencia en `latest`, pero su bloqueo formal aplica en estable.

## Gate operativo diario (rapido)
Ejecutar:

```bash
npm run bigbang:beta:quick
```

Este comando ejecuta en secuencia:
1. `test:dataset-prodlike:ci`
2. `test:e2e:docente-alumno:ci`
3. `test:global-grade:ci`
4. `test:pdf-print:ci`
5. `test:ux-visual:ci`
6. `test:qa:manifest` (falla si falta cualquier evidencia en `reports/qa/latest`)

## Gate pre-release (completo)
Ejecutar:

```bash
npm run bigbang:beta:check
```

Este comando ejecuta en secuencia:
1. todo el gate rapido (`bigbang:beta:quick`)
2. `bigbang:olas:strict`

## Verificacion de completitud de ola (retiro/encapsulado)
Ejecutar:

```bash
npm run bigbang:olas:completion
```

Opcional (con strict gates):

```bash
npm run bigbang:olas:completion:strict
```

Estos comandos distinguen `readiness` tecnico de `completion` funcional y fallan si persisten fallbacks v1/legado fuera de encapsulado permitido.

Incluyen validacion explicita de que el use case puente PDF no delega de forma directa al servicio legado.

## Evidencias obligatorias en latest
- `reports/qa/latest/dataset-prodlike.json`
- `reports/qa/latest/e2e-docente-alumno.json`
- `reports/qa/latest/global-grade.json`
- `reports/qa/latest/pdf-print.json`
- `reports/qa/latest/ux-visual.json`
- `reports/qa/latest/manifest.json`
- `reports/qa/latest/olas-bigbang.json`
- `reports/qa/latest/canary-rollout-check.json` (evidencia requerida para transición a estable)

## Criterio Go/No-Go para beta
- **Go**: todos los comandos del gate operativo en verde, sin bypass manual, y artefactos presentes/consistentes.
- **No-Go**: cualquier falla de comando o artefacto faltante en `latest`.

## Referencias
- `docs/QA_GATE_CRITERIA.md`
- `ci/pipeline.contract.md`
- `docs/INVENTARIO_PROYECTO.md`
