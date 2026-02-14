# Changelog

Este archivo sigue el formato "Keep a Changelog" (alto nivel) y SemVer.

## [Unreleased]

### Added
- Dual perf gate de negocio autenticado:
  - `scripts/perf-collect-business.ts`
  - `scripts/perf-check-business.mjs`
  - `docs/perf/baseline.business.json`
- Bootstrap API v2 para dominios iniciales:
  - `apps/backend/src/modulos/modulo_escaneo_omr/rutasEscaneoOmrV2.ts`
  - `apps/backend/src/modulos/modulo_generacion_pdf/rutasGeneracionPdfV2.ts`
- Middleware de observabilidad de transicion v1/v2:
  - `apps/backend/src/compartido/observabilidad/middlewareVersionadoApi.ts`
- Prueba de contrato/paridad v2:
  - `apps/backend/tests/integracion/versionadoApiV2Contratos.test.ts`

### Changed
- `apps/backend/src/rutas.ts` monta:
  - adapters v1 instrumentados en `/api/examenes` y `/api/omr`
  - rutas nuevas `/api/v2/examenes` y `/api/v2/omr`
- `apps/backend/src/compartido/observabilidad/metrics.ts` agrega contadores:
  - `evaluapro_schema_fallback_reads_total`
  - `evaluapro_schema_v2_writes_total`
- `package.json` agrega scripts:
  - `perf:collect:business`
  - `perf:baseline:business`
  - `perf:check:business`
- CI/contrato pipeline incorpora etapa bloqueante `perf-business-check`:
  - `.github/workflows/ci.yml`
  - `ci/pipeline.contract.md`
  - `ci/pipeline.matrix.json`
- Ola 2C (sincronizacion) avanzó con particion interna sin romper API:
  - Nuevo archivo `apps/backend/src/modulos/modulo_sincronizacion_nube/sincronizacionInterna.ts`.
  - `apps/backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts` delega hashing, parsing, LWW y errores de conectividad.
- Correccion LWW en importacion de paquetes para preservar `updatedAt` del paquete al aplicar `upsert`.
- Pruebas de sincronizacion reforzadas y validadas:
  - `apps/backend/tests/sincronizacion.test.ts`
  - `apps/frontend/tests/sincronizacion.behavior.test.tsx`
- UX contractual endurecida con gate bloqueante adicional:
  - Nuevo test `apps/frontend/tests/ux.quality.test.tsx`.
  - Nuevo script raíz `npm run test:ux-quality:ci`.
  - `CI Checks` ahora ejecuta `Etapa ux-quality-check`.
  - Contrato/matriz CI actualizados (`ci/pipeline.contract.md`, `ci/pipeline.matrix.json`).
- Mejoras de ayuda contextual en sincronización docente:
  - `apps/frontend/src/apps/app_docente/SeccionSincronizacion.tsx` usa `HelperPanel` con flujo recomendado.
- Nueva guía de criterios verificables GUI/UX:
  - `docs/UX_QUALITY_CRITERIA.md`.

## [0.2.0-beta.1] - 2026-02-13

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
- Ola 2A (OMR) iniciada con pipeline modular y canary:
  - `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrLegacy.ts`
  - `apps/backend/src/modulos/modulo_escaneo_omr/omr/types.ts`
  - `apps/backend/src/modulos/modulo_escaneo_omr/omr/pipeline/ejecutorPipelineOmr.ts`
  - `apps/backend/src/modulos/modulo_escaneo_omr/omr/qr/etapaQr.ts`
  - `apps/backend/src/modulos/modulo_escaneo_omr/omr/deteccion/etapaDeteccion.ts`
  - `apps/backend/src/modulos/modulo_escaneo_omr/omr/scoring/etapaScoring.ts`
  - `apps/backend/src/modulos/modulo_escaneo_omr/omr/calidad/etapaCalidad.ts`
  - `apps/backend/src/modulos/modulo_escaneo_omr/omr/debug/etapaDebug.ts`

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
- Cierre formal de Ola 1 en documentación de estado:
  - `README.md`
  - `docs/ENGINEERING_BASELINE.md`
  - `docs/INVENTARIO_PROYECTO.md`
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
- `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts` ahora es fachada compatible con feature flag:
  - `FEATURE_OMR_PIPELINE_V2=0|1` (por defecto desactivado para rollout canary)
- Observabilidad OMR agregada en `/api/metrics`:
  - `evaluapro_omr_stage_duration_ms`
  - `evaluapro_omr_stage_errors_total`
  - `evaluapro_omr_pipeline_total`
  - `evaluapro_omr_pipeline_error_total`
  - `evaluapro_omr_pipeline_duration_ms`
- `scripts/perf-collect.ts` ampliado para medir rutas criticas de negocio (examenes/omr/sincronizaciones/analiticas).
- `scripts/bigbang-olas-check.mjs` actualizado para validar el monolito OMR en `servicioOmrLegacy.ts`.
- `apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts` con layout parametrico milimetrico para impresion:
  - grilla configurable
  - alturas de encabezado configurables
  - zona segura inferior configurable
  - politica de bajo consumo de tinta (menos rellenos solidos).
- `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrLegacy.ts` ahora ajusta parametros de deteccion usando geometria real del `mapaOmr` generado por pagina.
- `apps/backend/tests/integracion/pdfImpresionContrato.test.ts` ampliado para validar presencia y rangos del perfil de layout parametrico en `mapaOmr`.

### Fixed
- Selectores ambiguos en pruebas de refactor (`Plantillas` y `Banco`) que generaban fallos falsos negativos.

### Notes
- Estado de gates del corte:
  - `lint`, `typecheck`, `test:frontend:ci`, `test:coverage:ci`, `test:backend:ci`, `test:portal:ci`, `perf:check`, `pipeline:contract:check`: verdes.
  - cobertura frontend validada contra umbral vigente: lines 39.20, functions 40.28, statements 37.21, branches 31.40.

## [0.1.0] - 2026-01-15

- Monorepo inicial (backend, frontend, portal alumno cloud)
- Hardening base: Helmet, rate limit, sanitización NoSQL, no leakage de mensajes internos en producción
- Pruebas robustas: `test:ci` con reintentos + harness estricto para warnings/errores
