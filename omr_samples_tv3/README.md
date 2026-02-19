# Dataset Golden OMR TV3 (Real)

Este dataset se usa para el gate bloqueante `Extended`:

- Script: `apps/backend/scripts/omr-tv3-eval-golden.ts`
- Reporte: `reports/qa/latest/omr-tv3-gate.json`
- Comando raíz: `npm run test:omr:tv3:gate:ci`

## Requisitos

1. Solo capturas reales de hoja OMR TV3.
2. Cada captura debe incluir:
- `captureId`
- `imagePath`
- `mapaOmrPath`
- `folio`
- `numeroPagina`
- `templateVersion: 3`
3. `ground_truth.jsonl` debe incluir una línea por pregunta:
- `captureId`
- `numeroPregunta`
- `opcionEsperada` (`A-E` o `null`)

## Nota

El `manifest.json` inicial se entrega vacío para permitir versionar la estructura.
El gate fallará hasta que se carguen capturas reales y verdad-terreno.
