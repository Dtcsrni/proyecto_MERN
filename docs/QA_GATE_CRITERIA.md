# QA Gate Criteria (`1.0-beta`)

## Objetivo
Definir criterios falsables para aprobar una release candidata antes de validación humana en producción.

## Gates bloqueantes (`1.0-beta`)
Perfil operativo exigido para cierre beta: `core` + `extended` con excepción de bloqueo formal de canary (se exige como evidencia y pasa a bloqueo en estable).

1. `npm run test:dataset-prodlike:ci`
2. `npm run test:e2e:docente-alumno:ci`
3. `npm run test:global-grade:ci`
4. `npm run test:pdf-print:ci`
5. `npm run test:ux-visual:ci`
6. `npm run test:qa:manifest`
7. `npm run test:flujo-docente:ci`
8. `npm run perf:check`
9. `npm run perf:check:business`
10. `npm run bigbang:olas:strict`

## Evidencias obligatorias (`latest`)
- `reports/qa/latest/dataset-prodlike.json`
- `reports/qa/latest/e2e-docente-alumno.json`
- `reports/qa/latest/global-grade.json`
- `reports/qa/latest/pdf-print.json`
- `reports/qa/latest/ux-visual.json`
- `reports/qa/latest/manifest.json`
- `reports/qa/latest/olas-bigbang.json`

## Evidencia de transición (beta -> estable)
- `reports/qa/latest/canary-rollout-check.json` (obligatoria como evidencia en beta, bloqueo formal solo en estable)

## Criterios de aprobación
- Todos los comandos anteriores en verde.
- Sin bypass manual de jobs en CI.
- Artefactos de evidencia presentes y consistentes con la corrida.

## Criterios de rechazo
- Cualquier hallazgo de PII/token en dataset anonimizado.
- Cualquier falla en flujo docente->portal->alumno.
- Cualquier incumplimiento de contrato PDF (Carta, nombre trazable, tamaño por página).
- Regresión visual no aprobada.

