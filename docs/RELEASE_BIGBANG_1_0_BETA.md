# Cierre Beta `1.0.0-beta.0`

Este documento conserva el nombre historico por compatibilidad de enlaces, pero su contenido refleja el gate actual.

## Objetivo
Estandarizar salida beta con gates bloqueantes y evidencia QA completa.

## Gate rapido diario
```bash
npm run qa:evidence:quick
```

## Gate pre-release completo
```bash
npm run qa:full
```

## Evidencias obligatorias (`reports/qa/latest`)
- `dataset-prodlike.json`
- `e2e-docente-alumno.json`
- `global-grade.json`
- `pdf-print.json`
- `ux-visual.json`
- `clean-architecture.json`
- `manifest.json`

## Criterio Go/No-Go
- Go: todos los gates en verde y evidencias presentes.
- No-Go: cualquier falla de gate o evidencia faltante.

## Referencias
- `docs/QA_GATE_CRITERIA.md`
- `ci/pipeline.contract.md`
- `docs/RELEASE_GATE_STABLE.md`
