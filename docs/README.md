# docs/

Documentacion oficial de Sistema EvaluaPro.

Ultima actualizacion integral: 2026-02-25.

## Arranque para agentes IA
- `../AGENTS.md`
- `../.github/copilot-instructions.md`
- `IA_TRAZABILIDAD_AGENTES.md`

## Lectura recomendada
- `ARQUITECTURA.md`
- `ARQUITECTURA_C4.md`
- `FLUJO_EXAMEN.md`
- `FORMATO_PDF.md`
- `ROLES_PERMISOS.md`
- `SEGURIDAD.md`
- `SINCRONIZACION_ENTRE_COMPUTADORAS.md`
- `PRUEBAS.md`
- `DESPLIEGUE.md`
- `VERSIONADO.md`
- `ENGINEERING_BASELINE.md`
- `INVENTARIO_PROYECTO.md`
- `DEVOPS_BASELINE.md`
- `RELEASE_GATE_STABLE.md`

## Documentos auto-generados
- `AUTO_DOCS_INDEX.md`
- `AUTO_ENV.md`

## Calidad y CI
Pipeline principal:
- `CI Checks`
- `CI Frontend Module`
- `Package Images`

Gates principales:
- `lint`, `typecheck`, `test`, `coverage-check`
- `perf-check`, `perf-business-check`
- `qa-manifest`
- `clean-architecture-check`

Comandos canonicos:
- `npm run pipeline:contract:check`
- `npm run qa:clean-architecture:strict`
- `npm run qa:full`

## UI y Temas (actualizado)
- `UX_QUALITY_CRITERIA.md` define criterios UX verificables y gates.
- La GUI docente/alumno se encuentra unificada en:
  - sistema de colores y superficies en `apps/frontend/src/styles.css`
  - diseño responsive contractual en `apps/frontend/tests/gui.responsive.contract.test.tsx`
  - cobertura funcional de secciones en `apps/frontend/tests/appDocente.dominiosCobertura.test.tsx`.
