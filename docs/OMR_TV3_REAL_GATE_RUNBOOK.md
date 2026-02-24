# Runbook OMR TV3 Real Gate

## Objetivo
Ejecutar y validar el gate mixto de confiabilidad OMR TV3 (sintético + real) para liberar autocalificación con evidencia trazable.

## Prerrequisitos
- Node 24.
- Dependencias instaladas (`npm ci`).
- Backend CV operativo (`npm -C apps/backend run omr:cv:smoke`).
- Dataset real golden disponible en `omr_samples_tv3_real/`.

## Flujo operativo
1. Generar/actualizar dataset real golden:
```bash
npm -C apps/backend run omr:tv3:generate:real
```

2. Capturar baseline reproducible:
```bash
npm -C apps/backend run omr:tv3:baseline:snapshot
```

3. Ejecutar gate sintético:
```bash
npm -C apps/backend run omr:tv3:eval:synthetic
```

4. Ejecutar gate real:
```bash
npm -C apps/backend run omr:tv3:validate:real -- --dataset ../../omr_samples_tv3_real
```

5. Ejecutar calibración iterativa:
```bash
npm -C apps/backend run omr:tv3:calibrate:real
```

## Evidencia generada
- `reports/qa/latest/omr/baseline_snapshot.json`
- `reports/qa/latest/omr/synthetic-eval*.json`
- `reports/qa/latest/omr/tv3-real-validation*.json`
- `reports/qa/latest/omr/tv3-real-failure-analysis*.json`
- `reports/qa/latest/omr/calibration_iterations.json`
- `reports/qa/latest/omr/calibration_decision.md`

## Checklist de liberación
- Smoke CV `ok`.
- Gate sintético `ok`.
- Gate real `ok`.
- `autoPages > 0`.
- `autoGradeTrustRate >= 0.95`.
- Sin regresión en tests OMR críticos.
- Artefactos OMR publicados en CI backend.

## Troubleshooting
- `falsePositiveRate` alto:
  - subir `OMR_RESPUESTA_CONF_MIN`
  - subir `OMR_SCORE_MIN`
  - subir `OMR_DELTA_MIN`
- `autoGradeTrustRate` bajo:
  - ajustar `OMR_AUTO_CONF_MIN`
  - reducir `OMR_AUTO_AMBIGUAS_MAX`
  - subir `OMR_AUTO_DETECCION_MIN`
- `fuera_roi`/geometría:
  - revisar perfil geométrico y umbrales `OMR_ALIGN_RANGE`/`OMR_VERT_RANGE`.
