# Dataset OMR TV3 (Synthetic CI)

Este dataset se regenera automaticamente para el gate bloqueante TV3:

- Script gate: `apps/backend/scripts/omr-tv3-eval-golden.ts`
- Pipeline e2e: `apps/backend/scripts/omr-tv3-e2e.ts`
- Reporte canónico: `reports/qa/latest/omr-tv3-gate.json`
- Comando raíz: `npm run test:omr:tv3:gate:ci`

## Perfil canónico

- Examen sintético: `50` reactivos, `4` páginas, `4` opciones por reactivo.
- Política de inválidas: rechazo estricto (`double` y `smudge` deben detectarse como `null`).
- Ruido: perfil `realista_mixto`.
- Meta de gate: `precision >= 0.95` y `falsePositiveRate <= 0.02`.

## Estructura

- `manifest.json`: contrato del dataset generado.
- `ground_truth.jsonl`: verdad terreno por captura y pregunta.
- `answer_key.json`: clave oficial del examen sintético.
- `images/*.jpg`: capturas sintéticas con ruido.
- `maps/*.json`: mapas OMR por página.
