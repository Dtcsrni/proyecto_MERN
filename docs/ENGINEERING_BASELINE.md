# Engineering Baseline

Fecha de baseline: 2026-02-14.
Commit de referencia: `15f7d35`.

## Estado actual
- Monorepo NPM workspaces:
  - `apps/backend`
  - `apps/frontend`
  - `apps/portal_alumno_cloud`
- Inventario completo de piezas de codigo/config versionadas:
  - `docs/INVENTARIO_CODIGO_EXHAUSTIVO.md`
- Scripts de calidad centralizados en root:
  - lint, typecheck, build, test, docs-check, diagram checks, routes-check.
- Arquitectura backend: Ola 2 iniciada en OMR con pipeline modular v2 detras de feature flag.
- API v2 bootstrap activo para OMR/PDF:
  - `/api/v2/omr/*`
  - `/api/v2/examenes/*`
  - adapters explicitos v1->v2 instrumentados en rutas v1 (`/api/omr`, `/api/examenes`).
- Gate dual de performance activo:
  - rapido PR: `npm run perf:check`
  - negocio autenticado: `npm run perf:check:business`
- Frontend docente con cierre de Ola 1 en estado operativo.

## Corte de modularizacion docente (real)
- `apps/frontend/src/apps/app_docente/AppDocente.tsx`: 798 lineas.
- `apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx`: 798 lineas.
- `apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx`: 763 lineas.
- `apps/frontend/src/apps/app_docente/SeccionBanco.tsx`: 777 lineas.

## Riesgos tecnicos actuales
1. Complejidad residual en modulos UI grandes (`Plantillas` y `Banco`) aunque cumplen limite de linea.
2. Rampa de cobertura frontend hacia objetivo 45 aun pendiente (gate actual en 39/40/31/37).
3. Backend core critico aun parcialmente monolitico (PDF/Sync pendientes de particion profunda).
4. Dependencia de disciplina documental para mantener trazabilidad multi-agente.

## Validacion reciente (corte)
- `npm run lint`: verde.
- `npm run typecheck`: verde.
- `npm run test:frontend:ci`: verde.
- `npm run test:coverage:ci`: verde (umbral vigente frontend 39/40/31/37).
- coverage frontend real (2026-02-13):
  - lines: 39.20
  - functions: 40.28
  - statements: 37.21
  - branches: 31.40
- `npm run test:backend:ci`: verde.
- `npm run test:portal:ci`: verde.
- `npm run perf:check`: verde.
- `npm run perf:check:business`: verde.
- `npm run pipeline:contract:check`: verde.
- `npm run bigbang:olas:strict`: verde.
- `npm -C apps/backend run test -- tests/integracion/versionadoApiV2Contratos.test.ts`: verde.

## Avance Ola 2A (OMR)
- Se preservo el motor legado en `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrLegacy.ts`.
- `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts` ahora es fachada con flag canary:
  - `FEATURE_OMR_PIPELINE_V2=0|1`
- Nuevo pipeline modular (sin ruptura de contrato HTTP):
  - `omr/qr/etapaQr.ts`
  - `omr/deteccion/etapaDeteccion.ts`
  - `omr/scoring/etapaScoring.ts`
  - `omr/calidad/etapaCalidad.ts`
  - `omr/debug/etapaDebug.ts`
  - `omr/pipeline/ejecutorPipelineOmr.ts`
  - `omr/types.ts`
- Instrumentacion agregada en `/api/metrics`:
  - `evaluapro_omr_stage_duration_ms`
  - `evaluapro_omr_stage_errors_total`
  - `evaluapro_omr_pipeline_total`
  - `evaluapro_omr_pipeline_error_total`
  - `evaluapro_omr_pipeline_duration_ms`
- `scripts/perf-collect.ts` ampliado con rutas criticas de negocio en backend (modo no autenticado controlado).

### Corte 2026-02-13 (iteracion actual)
- Validacion de estado Big-Bang:
  - `npm run bigbang:olas:check`: verde (`ola0`, `ola1`, `ola2-ready`).
- Ola 2C (sincronizacion) avanzó con particion interna sin romper contrato HTTP:
  - Nuevo modulo: `apps/backend/src/modulos/modulo_sincronizacion_nube/sincronizacionInterna.ts`
  - `controladorSincronizacion.ts` ahora delega utilidades criptograficas, parsing y LWW.
  - Validacion local del dominio sync: `lint`, `typecheck`, `tests/sincronizacion.test.ts` en verde.
- Refinamiento de generacion PDF para impresion:
  - `apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts`
  - Nuevo perfil de layout parametrico por variables de entorno:
    - `EXAMEN_LAYOUT_GRID_MM`
    - `EXAMEN_LAYOUT_HEADER_FIRST_MM`
    - `EXAMEN_LAYOUT_HEADER_OTHER_MM`
    - `EXAMEN_LAYOUT_BOTTOM_SAFE_MM`
    - `EXAMEN_LAYOUT_USAR_RELLENOS_DECORATIVOS`
    - `EXAMEN_LAYOUT_USAR_ETIQUETA_OMR_SOLIDA`
  - Ajuste visual para ahorro de tinta:
    - menos rellenos solidos
    - bordes y lineas ligeras en encabezados/etiquetas
    - mantenimiento de contrato Carta y trazabilidad QR/Folio.
- Mejora de robustez OMR ante cambios de layout:
  - `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrLegacy.ts`
  - El perfil de deteccion ahora se ajusta con metrica real del `mapaOmr` (radio/caja/offset) por mediana.
- Pruebas ejecutadas en backend (verde):
  - `tests/integracion/pdfImpresionContrato.test.ts`
  - `tests/omr.test.ts`
  - `npm -C apps/backend run lint`
  - `npm -C apps/backend run typecheck`

### Corte 2026-02-14 (iteracion actual)
- Observabilidad de migracion dual agregada en metricas Prometheus:
  - `evaluapro_schema_fallback_reads_total`
  - `evaluapro_schema_v2_writes_total`
- Middleware de versionado agregado:
  - `apps/backend/src/compartido/observabilidad/middlewareVersionadoApi.ts`
- Rutas v2 iniciales activas:
  - `apps/backend/src/modulos/modulo_escaneo_omr/rutasEscaneoOmrV2.ts`
  - `apps/backend/src/modulos/modulo_generacion_pdf/rutasGeneracionPdfV2.ts`
- Prueba de contrato/paridad v2 agregada:
  - `apps/backend/tests/integracion/versionadoApiV2Contratos.test.ts`

## QA preproduccion automatizada (nuevo)
- Gates bloqueantes agregados:
  - `test:dataset-prodlike:ci`
  - `test:e2e:docente-alumno:ci`
  - `test:global-grade:ci`
  - `test:pdf-print:ci`
  - `test:ux-visual:ci`
  - `test:qa:manifest`
- Evidencias:
  - `reports/qa/latest/dataset-prodlike.json`
  - `reports/qa/latest/e2e-docente-alumno.json`
  - `reports/qa/latest/global-grade.json`
  - `reports/qa/latest/pdf-print.json`
  - `reports/qa/latest/ux-visual.json`
  - `reports/qa/latest/manifest.json`

## Baseline de rendimiento (Ola 0)
- Fuente baseline: `docs/perf/baseline.json`
- Captura de corrida: `reports/perf/latest.json` (artefacto CI)
- Comandos:
  - `npm run perf:collect`
  - `npm run perf:baseline`
  - `npm run perf:check`
- Criterio de fallo: `p95` o `failures` por ruta sobre presupuesto.

## Rampa de calidad (quality gates)
| Semana | Cobertura backend | Cobertura frontend | Cobertura portal | Reglas ESLint complejidad |
| --- | --- | --- | --- | --- |
| Semana 1 | 55 | 39/40/31/37 (L/F/B/S) | 50 | `complexity=18`, `max-depth=5`, `max-params=5` |
| Semana 2 | 62 | 52 | 58 | `complexity=16`, `max-depth=4`, `max-params=5` |
| Semana 3 | 70 | 60 | 65 | `complexity=15`, `max-depth=4`, `max-params=4` |

## Reglas de gobernanza acordadas
1. No merge sin checks minimos verdes:
- `npm run lint`
- `npm run typecheck`
- `npm run test:backend:ci`
- `npm run test:portal:ci`
- `npm run test:frontend:ci`
- `npm run build`
2. Convencion de commits:
- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`
3. Todo cambio de rutas/permisos/OMR/sincronizacion debe incluir test o actualizacion de test.
4. Toda sesion agente debe actualizar trazabilidad en:
- `docs/INVENTARIO_PROYECTO.md`
- `docs/ENGINEERING_BASELINE.md`
- `CHANGELOG.md`

## Criterio de salida Fase 0/Fase 1
- Baseline versionado y alineado a estado real verificable.
- Referencia de trazabilidad IA activa:
  - `AGENTS.md`
  - `docs/IA_TRAZABILIDAD_AGENTES.md`
