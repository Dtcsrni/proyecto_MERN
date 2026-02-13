# Criterios UX de Calidad (Gate Verificable)

Ultima actualizacion: 2026-02-13.

## Objetivo
Definir un estandar UX verificable para que la calidad de GUI no dependa solo de revision visual manual.

## Criterios bloqueantes
1. Pantallas criticas con ayuda contextual visible.
2. Navegacion principal con etiquetas claras y consistentes.
3. Iconografia consistente en acciones primarias.
4. Accesibilidad basica: labels en campos y landmarks navegables.

## Cobertura minima contractual
Se valida automaticamente en `test:ux-quality:ci` sobre:
- `AppDocente` (sin token y con token).
- `AppAlumno` (sin token).

## Gates CI relacionados
1. `ux-quality-check` (core): `npm run test:ux-quality:ci`.
2. `ux-visual-check` (extended):
- `npm run test:ux-quality:ci`
- `npm run test:ux-visual:ci`
- `npm run test:e2e:journeys:ci`

## Evidencia
- Test contractual: `apps/frontend/tests/ux.quality.test.tsx`
- Reporte visual: `apps/frontend/reports/qa/latest/ux-visual.json`

## Regla de cambio
Si se modifica una pantalla critica, debe actualizarse:
1. El test contractual `ux.quality.test.tsx`.
2. La evidencia visual `ux.visual.test.tsx` (snapshot).
3. Esta guia si cambia el criterio de calidad.
