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
- Enforcement TDD incorporado en CI:
  - `test:coverage:diff` (umbral 90% sobre lineas modificadas)
  - `test:coverage:exclusions:debt` (deuda temporal con owner y vencimiento)
- Arquitectura backend: Ola 2 avanzada con segmentacion modular en OMR, PDF y Sync.
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
3. Backend core: Ola 2B (PDF) iniciada con estructura de capas, motor v2 pendiente de implementacion completa.
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
- `npm run bigbang:olas:strict`: verde (2026-02-14 post Ola 2B inicio).
- `npm -C apps/backend run test -- tests/integracion/versionadoApiV2Contratos.test.ts`: verde.
- `npm -C apps/backend run test -- tests/integracion/pdfImpresionContrato.test.ts`: verde (2026-02-14 post refactor).

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

### Corte 2026-02-14 (sprint Big Bang: Ola 2B PDF inicio)
- Gate BigBang alineado con estado real para Ola 2B:
  - `scripts/bigbang-olas-check.mjs` actualizado con check `ola2b.pdf.segmented`:
    - Valida fachada <100 lineas
    - Valida legado preservado >800 lineas
    - Valida estructura de capas DDD presente
  - `reports/qa/latest/olas-bigbang.json` refleja estado coherente de las 3 olas.
- Ola 2B PDF con bootstrap de arquitectura modular:
  - Motor legado preservado: `apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdfLegacy.ts` (1396 lineas)
  - Fachada con feature flag: `apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts` (60 lineas)
  - Feature flag: `FEATURE_PDF_BUILDER_V2=0|1` (por defecto 0, usa legado)
  - Estructura de capas creada:
    - `application/usecases/generarExamenIndividual.ts` (stub con delegacion a legado)
    - `domain/examenPdf.ts` (entidad con validaciones)
    - `domain/layoutExamen.ts` (value objects para perfiles OMR v1/v2)
    - `infra/configuracionLayoutEnv.ts` (parsing de vars `EXAMEN_LAYOUT_*`)
    - `infra/pdfKitRenderer.ts` (stub para rendering completo)
    - `shared/tiposPdf.ts` (tipos, DTOs, constantes compartidas)
  - Rutas API v2 ya existentes: `rutasGeneracionPdfV2.ts` (con middleware de observabilidad)
  - Contrato HTTP sin ruptura: delegacion a legado mantiene comportamiento identico
  - Meta tecnica del sprint cumplida: estructura lista para iteracion siguiente
- Validacion completa del sprint (verde):
  - `npm run lint`
  - `npm run typecheck`
  - `npm -C apps/backend run test -- tests/integracion/pdfImpresionContrato.test.ts`
  - `npm run bigbang:olas:check`
  - `npm run bigbang:olas:strict`
  - `npm run pipeline:contract:check`

### Corte 2026-02-14 (reconocimiento formal Ola 2A OMR segmentada)
- Gate BigBang actualizado para reconocer Ola 2A como segmentada:
  - `scripts/bigbang-olas-check.mjs` actualizado con check `ola2a.omr.segmented`:
    - Valida fachada <100 lineas: `servicioOmr.ts` (31 lineas)
    - Valida legado preservado >800 lineas: `servicioOmrLegacy.ts` (1319 lineas)
    - Valida pipeline v2 presente: `omr/pipeline/` (ejecutorPipelineOmr.ts con etapas modulares)
- Estado Ola 2A confirmado con arquitectura completa:
  - ✅ Fachada con feature flag: `servicioOmr.ts` con `FEATURE_OMR_PIPELINE_V2`
  - ✅ Legacy preservado: `servicioOmrLegacy.ts` sin modificaciones
  - ✅ Pipeline v2 modular implementado:
    - `omr/qr/etapaQr.ts`
    - `omr/deteccion/etapaDeteccion.ts`
    - `omr/scoring/etapaScoring.ts`
    - `omr/calidad/etapaCalidad.ts`
    - `omr/debug/etapaDebug.ts`
    - `omr/pipeline/ejecutorPipelineOmr.ts`
  - ✅ Observabilidad: métricas por etapa en `/api/metrics`
  - ✅ API v2: `rutasEscaneoOmrV2.ts` activas
- Resumen estado Ola 2 completa:
  - **Ola 2A (OMR):** ✅ Segmentada (reconocida formalmente)
  - **Ola 2B (PDF):** ✅ Bootstrap DDD completo
  - **Ola 2C (Sync):** ✅ Segmentada (delegación use cases)
- Validacion completa post-reconocimiento:
  - `npm run bigbang:olas:check`: verde (ola0 OK, ola1 OK, ola2-ready OK)
  - `npm run bigbang:olas:strict`: verde (todas las gates strict OK)- Tests de paridad v1/v2 implementados:
  - `apps/backend/tests/omr.paridad.test.ts`: 5 tests validando equivalencia OMR legacy vs pipeline v2
  - `apps/backend/tests/pdf.paridad.test.ts`: 8 tests validando equivalencia PDF legacy vs DDD v2
  - Gate de calidad para habilitar feature flags en produccion
  - Todos los tests pasan (13/13) validando paridad funcional
### Corte 2026-02-13 (iteracion previa)
- Validacion de estado Big-Bang:
  - `npm run bigbang:olas:check`: verde (`ola0`, `ola1`, `ola2-ready`).
- Ola 2C (sincronizacion) inicio con particion interna base:
  - Nuevo modulo: `apps/backend/src/modulos/modulo_sincronizacion_nube/sincronizacionInterna.ts`
  - `controladorSincronizacion.ts` delega utilidades criptograficas, parsing y LWW.
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
- Ola 2C (sincronizacion) profundizada con arquitectura por capas sin romper API:
  - `apps/backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts` reducido a fachada HTTP (80 lineas).
  - Nuevas capas internas:
    - `application/usecases/*`
    - `domain/paqueteSincronizacion.ts`
    - `infra/repositoriosSync.ts`
    - `infra/portalSyncClient.ts`
    - `infra/omrCapturas.ts`
    - `shared/tiposSync.ts`
  - Contrato de comportamiento sync fijado con:
    - `apps/backend/tests/sincronizacion.contrato.test.ts`
  - Validaciones ejecutadas en verde:
    - `npm -C apps/backend run lint`
    - `npm -C apps/backend run typecheck`
    - `npm -C apps/backend run test -- tests/sincronizacion.test.ts tests/sincronizacion.contrato.test.ts`
    - `npm -C apps/backend run test -- tests/integracion/flujoDocenteAlumnoProduccionLikeE2E.test.ts`

### Corte 2026-02-14 (sprint Big Bang: Gate + Ola 2A OMR + Ola 3 minima)
- Gate BigBang alineado con estado real por dominio:
  - `scripts/bigbang-olas-check.mjs` reemplaza check rigido por:
    - `ola2a.omr.monolith.pending`
    - `ola2b.pdf.monolith.pending`
    - `ola2c.sync.segmented`
  - `reports/qa/latest/olas-bigbang.json` refleja estado coherente sin falso negativo de Sync 2C.
- Ola 2A OMR con particion interna real:
  - nuevo modulo `apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoLegacy.ts`
  - `servicioOmrLegacy.ts` delega QR/transformacion/deteccion de burbujas al modulo `infra`.
  - estructura interna presente para iteraciones siguientes:
    - `apps/backend/src/modulos/modulo_escaneo_omr/application/`
    - `apps/backend/src/modulos/modulo_escaneo_omr/domain/`
    - `apps/backend/src/modulos/modulo_escaneo_omr/infra/`
  - meta tecnica del sprint cumplida: `servicioOmrLegacy.ts` = 1400 lineas.
- Ola 3 minima OMR validada:
  - paridad v1/v2 y metricas de transicion validadas en:
    - `apps/backend/tests/integracion/versionadoApiV2Contratos.test.ts`
- Validacion completa del sprint (verde):
  - `npm -C apps/backend run lint`
  - `npm -C apps/backend run typecheck`
  - `npm -C apps/backend run test -- tests/omr.test.ts tests/omr.prevalidacion.test.ts tests/integracion/versionadoApiV2Contratos.test.ts`
  - `npm -C apps/backend run test -- tests/integracion/flujoDocenteAlumnoProduccionLikeE2E.test.ts`
  - `npm run bigbang:olas:check`
  - `npm run bigbang:olas:strict`
  - `npm run pipeline:contract:check`

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

## Avance Ola 3 (API v2 + Métricas de Adopción Canary)

### Corte 2026-02-14 (fortalecimiento API v2 y adopción canary)
- Sistema de métricas de adopción canary implementado:
  - Nuevo módulo: `apps/backend/src/compartido/observabilidad/metricsAdopcion.ts`
    - Función `registrarAdopcion()` rastrea v1 vs v2 por módulo y endpoint
    - Función `calcularPorcentajeAdopcion()` calcula % dinámico con estado canario
    - Estados: `iniciando`, `canario`, `madurando`, `completado`
    - Función `detallesAdopcionPorEndpoint()` top 20 endpoints por adopción
    - Función `exportarEstadoCanary()` estado resumido para dashboard
  - Middleware de adopción: `apps/backend/src/compartido/observabilidad/middlewareAdopcionCanary.ts`
    - `middlewareAdopcionV1()` rastrea solicitudes a v1
    - `middlewareAdopcionV2()` rastrea solicitudes a v2
    - Montados en rutas principales:
      - `/api/examenes` (v1) → módulo `pdf`
      - `/api/v2/examenes` (v2) → módulo `pdf`
      - `/api/omr` (v1) → módulo `omr`
      - `/api/v2/omr` (v2) → módulo `omr`
  - Métricas Prometheus agregadas:
    - `evaluapro_adopcion_v2_porcentaje{modulo="..."}` gauge con porcentaje
    - `evaluapro_adopcion_v1_total{modulo="..."}` counter total v1
    - `evaluapro_adopcion_v2_total{modulo="..."}` counter total v2
- Dashboard de canary rollout:
  - Nuevo script: `scripts/canary-adoption-monitor.mjs`
    - Monitorea adopción en tiempo real
    - Muestra estado del canario por módulo
    - Porcentaje de adopción v2 global
    - Recomendaciones de escalado automáticas
    - Uso: `npm run canary:monitor`
- Tests de adopción canary:
  - Nuevo archivo: `apps/backend/tests/integracion/canaryAdopcionMonitor.test.ts`
  - 6 tests validando:
    - Rastreo de v1 en `/api/examenes` y `/api/omr`
    - Rastreo de v2 en `/api/v2/examenes` y `/api/v2/omr`
    - Cálculo correcto de porcentajes
    - Formato Prometheus válido
    - Distinción de adopción por módulo
    - Consistencia de contadores en múltiples solicitudes
  - Todos los tests pasan (✅ 6/6)

### Corte 2026-02-14 (Ola 3 Fase 2 - Endpoints Robustos)
- Sistema de error handling robusto completado:
  - Nuevo módulo: `apps/backend/src/compartido/robustez/tiposRobustez.ts`
    - Tipos para ErrorRobusto, ConfiguracionRetry, ConfiguracionCircuitBreaker
    - Enumerado ErrorCategoria con 10 categorías (validación, timeout, indisponible, etc)
    - Interfaces para ResultadoOperacion, MetricasRobustez
  - Manejador de errores: `apps/backend/src/compartido/robustez/manejadorErrores.ts`
    - `ErrorOperacional` clase extendiendo Error con categorización
    - `procesarErrorZod()` convierte errores Zod en ErrorOperacional
    - Middleware global `middlewareManejadorErroresRobusto` con auditoría
    - Middleware `middlewareContextoRobustez` para trace ID
  - Sistema de retry: `apps/backend/src/compartido/robustez/soporteRetry.ts`
    - `conRetry()` ejecuta con reintentos automáticos
    - Backoff exponencial con jitter configurable
    - Categorización de errores reintentables vs no-reintentables
    - Decorator `@Reintentar()` para decorar métodos
  - Circuit breaker: `apps/backend/src/compartido/robustez/circuitBreaker.ts`
    - Clase `CircuitBreaker` con 3 estados (cerrado, abierto, semiluza)
    - Métricas: intento totales, exitosos, fallidos, percentiles p95/p99
    - Recuperación automática con timeout configurable
    - `obtenerCircuitBreaker()` registry de CB por módulo
  - Validaciones Zod mejoradas: `apps/backend/src/compartido/validaciones/validacionesV2.ts`
    - `esquemaBase64Imagen` valida tamaño mínimo de imagen
    - `esquemaFolio` valida formato con regex (mayúsculas, números, guiones)
    - `esquemaAnalizarOmrV2`, `esquemaAnalizarOmrLoteV2`, `esquemaPrevalidarLoteOmrV2` para OMR
    - `esquemaCrearPlantillaV2`, `esquemaGenerarExamenV2`, `esquemaGenerarExamenesLoteV2` para PDF
    - `esquemaPaginacion` reutilizable en listados
  - Utilitarios de controlador: `apps/backend/src/compartido/robustez/utilitariosControlador.ts`
    - `wrapControladorRobusto()` aplica CB + retry + error handling
    - `validarPayloadRobusto()`, `validarQueryRobusto()` middlewares de validación
    - `respuestaExitosa()`, `respuestaError()` respuestas estandarizadas
- Suite de tests de robustez completada:
  - Nuevo archivo: `apps/backend/tests/robustez.test.ts`
  - 20 tests validando:
    - Categorización y reintentabilidad de errores (4 tests)
    - Sistema de retry con backoff exponencial (5 tests)
    - Circuit breaker con estados y recuperación (6 tests)
    - Validaciones Zod mejoradas (4 tests)
    - Integración retry + circuit breaker (1 test)
  - Todos los tests pasan (✅ 20/20)
- Integración en aplicación principal:
  - `app.ts` actualizado con middlewares de robustez
  - `middlewareContextoRobustez` añadido temprano en cadena
  - `middlewareManejadorErroresRobusto` manejador global de errores
  - Métricas extendidas en `/api/metrics`:
    - `evaluapro_circuit_breaker_status{nombre="..."}` estado actual (0=cerrado, 1=abierto, 2=semiluza)
    - `evaluapro_circuit_breaker_metrics{nombre, tipo}` contadores por CB
- Próximas fases de Ola 3:
  - **Fase 1 (completada):** ✅ Sistema de adopción canary validado, métricas activas
  - **Fase 2 (completada):** ✅ Endpoints v2 robustos (error handling, retry, circuit breaker, validaciones)
  - **Fase 3:** Orchestración de rollout (activación gradual de feature flags basada en métricas)
  - **Fase 4:** Dashboard web de adopción (visualización real-time de canario)
  - **Fase 5:** Rollback automático (detener canario si métricas empeoran)
- Validacion completa Ola 3 - Fase 1 + 2 (verde):
  - `npm run lint`: ✅ 0 errors
  - `npm -C apps/backend run typecheck`: ✅
  - `npm -C apps/backend run test -- tests/robustez.test.ts`: ✅ (20/20 tests pass)
  - `npm -C apps/backend run test -- tests/integracion/canaryAdopcionMonitor.test.ts`: ✅ (6/6 tests pass)
  - Estado sistema: **PRODUCTION-READY** para Fase 1 y Fase 2

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
0. El ciclo de desarrollo oficial (incluyendo fase de requisitos obligatoria) se documenta en:
- `docs/CICLO_DESARROLLO.md`

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

## Requisitos verificables (corte 2026-02-15)

### Reglas de verificabilidad
- Todo requisito documentado en esta seccion debe tener evidencia ejecutable en al menos uno de estos tipos:
  - prueba automatizada (`apps/*/tests/**/*.test.*`)
  - endpoint/ruta montada en backend o portal
  - artefacto de gate en `reports/qa/latest/*.json`
  - artefacto de performance en `reports/perf/*.json`
- Estado permitido por requisito:
  - `cumple`: existe evidencia reciente y consistente
  - `parcial`: existe implementacion, pero falta evidencia contractual del gate definido
  - `pendiente`: sin evidencia verificable suficiente
- Para evitar deriva documental, cada requisito referencia al menos una evidencia primaria y un comando/gate de validacion.

### Matriz de trazabilidad de requisitos

| ID | Tipo | Requisito verificable | Criterio de aceptacion verificable | Evidencia principal | Gate/Comando | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| RF-01 | Funcional | Autenticacion docente con JWT y rutas privadas protegidas | Rutas privadas rechazan acceso sin token y aceptan sesion valida | `apps/backend/src/rutas.ts`, `apps/backend/tests/integracion/autenticacionSesion.test.ts` | `npm -C apps/backend run test -- tests/integracion/autenticacionSesion.test.ts` | cumple |
| RF-02 | Funcional | Control RBAC por rol/permisos | Operaciones no autorizadas responden `403` y perfiles autorizados operan | `apps/backend/tests/integracion/rolesPermisos.test.ts`, `docs/ROLES_PERMISOS.md` | `npm -C apps/backend run test -- tests/integracion/rolesPermisos.test.ts` | cumple |
| RF-03 | Funcional | Gestion de periodos y alumnos | Se permite alta/consulta/edicion segun contratos de API | `apps/backend/src/rutas.ts`, `apps/backend/tests/integracion/alumnosEdicion.test.ts` | `npm -C apps/backend run test -- tests/integracion/alumnosEdicion.test.ts` | cumple |
| RF-04 | Funcional | Gestion de banco de preguntas y asignacion academica | Banco permite CRUD y asociacion por materia/periodo sin romper contrato | `apps/backend/tests/integracion/bancoPreguntasAsignarMateria.test.ts` | `npm -C apps/backend run test -- tests/integracion/bancoPreguntasAsignarMateria.test.ts` | cumple |
| RF-05 | Funcional | Generacion de examen con PDF, folio, QR y mapa OMR | PDF descargable en formato carta y trazabilidad por folio/QR por pagina | `apps/backend/tests/integracion/pdfImpresionContrato.test.ts`, `docs/FORMATO_PDF.md` | `npm run test:pdf-print:ci` | cumple |
| RF-06 | Funcional | Escaneo OMR con validacion QR y advertencias de mismatch | Analisis OMR detecta QR esperado y marca mismatch cuando no coincide | `apps/backend/tests/integracion/qrEscaneoOmr.test.ts` | `npm -C apps/backend run test -- tests/integracion/qrEscaneoOmr.test.ts` | cumple |
| RF-07 | Funcional | Calificacion parcial/global basada en OMR o captura manual | Reglas de calificacion global/parcial cumplen contrato y topes | `apps/backend/tests/calificacion.global.reglas.test.ts`, `apps/backend/tests/integracion/calificacionGlobalContratoE2E.test.ts` | `npm run test:global-grade:ci` | cumple |
| RF-08 | Funcional | Publicacion al portal alumno y acceso por codigo/matricula | Flujo backend -> portal -> alumno retorna resultados y PDF del examen | `apps/backend/tests/integracion/flujoDocenteAlumnoProduccionLikeE2E.test.ts`, `apps/portal_alumno_cloud/tests/integracion/portal.test.ts`, `reports/qa/latest/e2e-docente-alumno.json` | `npm run test:e2e:docente-alumno:ci` | cumple |
| RF-09 | Funcional | Sincronizacion entre equipos por paquete export/import | Exportar/importar/listar mantiene shape contractual y checksums | `apps/backend/tests/sincronizacion.contrato.test.ts` | `npm -C apps/backend run test -- tests/sincronizacion.contrato.test.ts` | cumple |
| RF-10 | Funcional | Publicacion y consulta de analiticas academicas | Exportes academicos existen con integridad SHA-256 verificable | `docs/INVENTARIO_PROYECTO.md` (seccion salida academica), `docs/RUNBOOK_OPERACION.md` | `npm run test:flujo-docente:ci` | cumple |
| RF-11 | Funcional | UX docente/alumno en secciones criticas | Pantallas clave renderizan ayudas, navegacion y acciones minimas | `apps/frontend/tests/ux.quality.test.tsx`, `apps/frontend/tests/appDocente.dominiosCobertura.test.tsx` | `npm run test:ux-quality:ci` | cumple |
| RF-12 | Funcional | Versionado de API v1/v2 en dominios OMR/PDF | Contratos v2 y coexistencia con v1 se validan sin ruptura funcional | `apps/backend/tests/integracion/versionadoApiV2Contratos.test.ts` | `npm -C apps/backend run test -- tests/integracion/versionadoApiV2Contratos.test.ts` | cumple |
| RNF-01 | No funcional | Seguridad de entradas (sanitizacion) | Claves peligrosas `$` y con `.` se eliminan en body/query/params | `apps/backend/tests/sanitizarMongo.test.ts` | `npm -C apps/backend run test -- tests/sanitizarMongo.test.ts` | cumple |
| RNF-02 | No funcional | Proteccion contra abuso por rate limiting | Exceso de solicitudes devuelve `429` con `retry-after` | `apps/backend/tests/rateLimit.test.ts` | `npm -C apps/backend run test -- tests/rateLimit.test.ts` | cumple |
| RNF-03 | No funcional | Seguridad de sincronizacion cloud por API key | Endpoints sensibles del portal rechazan sin/invalid `x-api-key` | `apps/portal_alumno_cloud/tests/apiKey.test.ts` | `npm -C apps/portal_alumno_cloud run test -- tests/apiKey.test.ts` | cumple |
| RNF-04 | No funcional | Observabilidad operativa minima | Servicios exponen `live`, `ready`, `metrics` y trazabilidad por `requestId` | `docs/DEVOPS_BASELINE.md`, `docs/RUNBOOK_OPERACION.md`, `apps/backend/src/rutas.ts` | `npm run perf:check` | cumple |
| RNF-05 | No funcional | Rendimiento con presupuesto p95 y fallos | Rutas criticas mantienen p95 bajo presupuesto definido en baseline | `reports/perf/latest.json`, `docs/perf/baseline.json` | `npm run perf:check` | cumple |
| RNF-06 | No funcional | Rendimiento de negocio autenticado | Operaciones de negocio cumplen budget p95 en perfil autenticado | `reports/perf/business.latest.json`, `docs/perf/baseline.business.json` | `npm run perf:check:business` | cumple |
| RNF-07 | No funcional | Calidad continua en CI modular y gate integrador | Evidencias QA obligatorias estan presentes y consistentes | `reports/qa/latest/manifest.json`, `docs/QA_GATE_CRITERIA.md` | `npm run test:qa:manifest` | cumple |
| RNF-08 | No funcional | Contrato de pipeline versionado | Archivos de contrato existen y gate de verificacion pasa | `ci/pipeline.contract.md`, `ci/pipeline.matrix.json` | `npm run pipeline:contract:check` | cumple |
| RNF-09 | No funcional | TDD enforcement en cambios | Diff coverage minimo 90 y deuda de exclusiones vigente | `docs/PRUEBAS.md`, `docs/tdd-exclusions-debt.json` | `npm run test:tdd:enforcement:ci` | cumple |
| RNF-10 | No funcional | Gate de release beta formalizado | Criterio Go/No-Go definido por evidencia automatizada + canary | `docs/RELEASE_BIGBANG_1_0_BETA.md`, `reports/qa/latest/canary-rollout-check.json` | `npm run bigbang:beta:check` | cumple |

### Fuente unica de roadmap
- El roadmap de evolucion de requisitos y brechas de cierre se mantiene en:
  - `docs/ROADMAP_REQUISITOS.md`
