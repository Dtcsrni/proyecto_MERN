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

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Documentacion funcional/operativa para despliegue, seguridad y cumplimiento.
- Edicion Free (AGPL): flujo operativo base para uso real.
- Edicion Commercial: mas automatizacion, soporte SLA, hardening y roadmap prioritario por tier.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-02-27.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
