# Handoff IA

Este directorio centraliza la continuidad entre sesiones de agentes IA.

## Archivos
- `PLANTILLA_HANDOFF_IA.md`: formato minimo obligatorio de cierre de sesion.
- `sesiones/<YYYY-MM-DD>/<sesion>.md`: reportes generados automaticamente.

## Generacion automatica
- Modo rapido (recomendado por sesion):
  - `npm run ia:handoff:quick`
- Modo completo (incluye gates pesados):
  - `npm run ia:handoff:full`

## Notas
- El reporte generado no reemplaza la actualizacion de:
  - `docs/INVENTARIO_PROYECTO.md`
  - `docs/ENGINEERING_BASELINE.md`
  - `CHANGELOG.md`
