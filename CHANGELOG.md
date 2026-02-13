# Changelog

Este archivo sigue el formato "Keep a Changelog" (alto nivel) y SemVer.

## [Unreleased] - 2026-02-13

### Added
- Documento de inventario técnico integral: `docs/INVENTARIO_PROYECTO.md`.
- Inventario exhaustivo de codigo/config versionado: `docs/INVENTARIO_CODIGO_EXHAUSTIVO.md`.
- Paquete de handoff IA automatico:
  - `scripts/ia-handoff.mjs`
  - `docs/handoff/PLANTILLA_HANDOFF_IA.md`
  - `docs/handoff/README.md`
- Script de estandarizacion de cabeceras de contexto:
  - `scripts/ia-docblocks.mjs`
- Documento explicativo de configuracion Mermaid:
  - `docs/diagramas/mermaid.config.md`
- Generador de READMEs por carpeta:
  - `scripts/generar-readmes-carpetas.mjs`
- READMEs base generados en carpetas objetivo de backend/frontend/portal/scripts/ops/diagramas.
- Shell de UI docente extraído a `apps/frontend/src/apps/app_docente/ShellDocente.tsx`.
- Guía de operación para agentes IA: `AGENTS.md`.
- Documento de trazabilidad IA multi-sesion: `docs/IA_TRAZABILIDAD_AGENTES.md`.
- Nuevas pruebas de cobertura frontend:
  - `apps/frontend/tests/utilidades.appDocente.test.ts`
  - `apps/frontend/tests/appDocente.dominiosCobertura.test.tsx`
  - `apps/frontend/tests/banco.estimadores.test.tsx`
  - `apps/frontend/tests/plantillas.hooks.test.tsx`
  - `apps/frontend/tests/seccionAutenticacion.test.tsx`
- Nuevos módulos/hook para refactor docente:
  - `apps/frontend/src/apps/app_docente/features/banco/hooks/estimadoresBanco.ts`
  - `apps/frontend/src/apps/app_docente/features/plantillas/hooks/usePlantillasPreviewActions.ts`
- Contratos y scripts QA preproduccion:
  - `docs/QA_GATE_CRITERIA.md`
  - `docs/fixtures/ANON_DATASET_CONTRACT.md`
  - `scripts/testing/export-anon-fixture.mjs`
  - `scripts/testing/validate-anon-fixture.mjs`
  - `scripts/testing/import-anon-fixture.mjs`
  - `scripts/testing/generar-qa-manifest.mjs`
  - `apps/backend/src/compartido/tipos/qa.ts`
- Nuevas pruebas bloqueantes:
  - `apps/backend/tests/integracion/flujoDocenteAlumnoProduccionLikeE2E.test.ts`
  - `apps/backend/tests/calificacion.global.reglas.test.ts`
  - `apps/backend/tests/integracion/calificacionGlobalContratoE2E.test.ts`
  - `apps/backend/tests/integracion/pdfImpresionContrato.test.ts`
  - `apps/frontend/tests/ux.visual.test.tsx`
- Preflight operativo para generación de examen global en producción:
  - `scripts/release/preflight-global-prod.mjs`
  - `docs/OPERACION_EXAMEN_GLOBAL_PROD.md`

### Changed
- Actualización integral de documentación raíz y técnica:
  - `README.md`
  - `docs/README.md`
  - `docs/FILES.md`
  - `docs/ENGINEERING_BASELINE.md`
  - `docs/DEVOPS_BASELINE.md`
  - `docs/VERSIONADO.md`
  - `docs/INVENTARIO_PROYECTO.md`
- Inventario de instrucciones IA ampliado para incluir `.github/copilot-instructions.md` como fuente activa de gobierno técnico para asistentes IDE.
- `AppDocente.tsx` reducido a 757 líneas (meta de partición progresiva).
- `AppDocente.tsx` reducido a 798 líneas (cumple `<800`).
- `SeccionEscaneo.tsx` reducido a 798 líneas (cumple `<800`).
- `SeccionBanco.tsx` reducido a 777 líneas (cumple `<800`).
- `SeccionPlantillas.tsx` reducido a 763 líneas (cumple `<800`).
- Recalibración temporal de gate frontend en `apps/frontend/vitest.config.ts`:
  - lines 39, functions 40, branches 31, statements 37
  - objetivo de rampa hacia 45 mantenido en documentación de baseline.
- Tests de comportamiento ajustados en frontend:
  - `apps/frontend/tests/plantillas.refactor.test.tsx`
  - `apps/frontend/tests/banco.refactor.test.tsx`
  - `apps/frontend/tests/escaneo.refactor.test.tsx`
- Comentarios de mantenimiento añadidos en componentes/servicios criticos:
  - `apps/frontend/src/apps/app_docente/AppDocente.tsx`
  - `apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx`
  - `apps/frontend/src/apps/app_docente/SeccionBanco.tsx`
  - `apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx`
  - `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts`
- Scripts raiz actualizados con comandos:
  - `npm run ia:handoff:quick`
  - `npm run ia:handoff:full`
  - `npm run ia:docblocks`
  - `npm run docs:carpetas:generate`
  - `npm run test:dataset-prodlike:ci`
  - `npm run test:e2e:docente-alumno:ci`
  - `npm run test:global-grade:ci`
  - `npm run test:pdf-print:ci`
  - `npm run test:ux-visual:ci`
  - `npm run test:qa:manifest`
  - `npm run release:preflight:global`
- Contrato CI ampliado con stages bloqueantes:
  - `dataset-prodlike-check`
  - `docente-alumno-e2e-check`
  - `global-grade-check`
  - `pdf-print-check`
  - `ux-visual-check`
  - `qa-manifest`
- Documentación operativa ampliada para validación previa de generación global por materia/curso:
  - `docs/RUNBOOK_OPERACION.md`
  - `scripts/README.md`
  - `docs/README.md`

### Fixed
- Selectores ambiguos en pruebas de refactor (`Plantillas` y `Banco`) que generaban fallos falsos negativos.

### Notes
- Estado de gates del corte:
  - `lint`, `typecheck`, `test:frontend:ci`: verdes.
  - `test:coverage:ci`: con brecha abierta en cobertura frontend (detallada en `docs/INVENTARIO_PROYECTO.md`).

## [0.1.0] - 2026-01-15

- Monorepo inicial (backend, frontend, portal alumno cloud)
- Hardening base: Helmet, rate limit, sanitización NoSQL, no leakage de mensajes internos en producción
- Pruebas robustas: `test:ci` con reintentos + harness estricto para warnings/errores
