# Inventario Tecnico del Proyecto

Fecha de corte: 2026-02-14.
Commit de referencia: `15f7d35`.

## 1) Alcance del inventario
- Monorepo completo (`apps/*`, `ci/*`, `.github/workflows/*`, `docs/*`, `scripts/*`, `ops/*`).
- Estado de avance Big-Bang hacia `1.0-beta`.
- Estado de calidad por gates (local + contrato CI).
- Inventario exhaustivo de instrucciones para agentes IA y trazabilidad multi-sesion.
- Inventario exhaustivo de piezas de codigo/config en `docs/INVENTARIO_CODIGO_EXHAUSTIVO.md`.
- Paquete de handoff IA automatico por sesion en `docs/handoff/`.

## 2) Estructura actual del repositorio
- Apps:
  - `apps/backend`
  - `apps/frontend`
  - `apps/portal_alumno_cloud`
- CI/CD:
  - `ci/pipeline.contract.md`
  - `ci/pipeline.matrix.json`
  - `.github/workflows/ci.yml`
  - `.github/workflows/package.yml`
- Operacion y observabilidad:
  - `ops/observabilidad/prometheus.yml`
  - `ops/observabilidad/alert.rules.yml`
  - `ops/observabilidad/grafana/dashboard-evaluapro.json`
- Gobernanza y release:
  - `AGENTS.md`
  - `docs/IA_TRAZABILIDAD_AGENTES.md`
  - `docs/ENGINEERING_BASELINE.md`
  - `docs/DEVOPS_BASELINE.md`
  - `docs/RELEASE_GATE_STABLE.md`
  - `docs/RUNBOOK_OPERACION.md`
  - `docs/SEGURIDAD_OPERATIVA.md`

## 3) Estado Big-Bang (olas)
- Ola 0: implementada y operativa.
  - baseline perf activo (`docs/perf/baseline.json`)
  - gate `perf-check` integrado a contrato/workflow
- Ola 1: completada (bloque estructural de frontend docente cerrado).
  - `AppDocente.tsx`: 798 lineas (cumple <800)
  - `SeccionEscaneo.tsx`: 798 lineas (cumple <800)
  - `SeccionPlantillas.tsx`: 763 lineas (cumple <800)
  - `SeccionBanco.tsx`: 777 lineas (cumple <800)
  - sin referencias activas a `app_docente_legacy` o `docente_core`
- Ola 2: activa (backend core) - TODAS las sub-olas segmentadas
  - OMR (Ola 2A): ✅ segmentada (reconocida formalmente 2026-02-14)
    - `servicioOmr.ts`: fachada compacta 31 lineas (feature flag `FEATURE_OMR_PIPELINE_V2`)
    - `servicioOmrLegacy.ts`: motor legado preservado 1319 lineas
    - Pipeline v2 modular completo:
      - `omr/qr/etapaQr.ts`
      - `omr/deteccion/etapaDeteccion.ts`
      - `omr/scoring/etapaScoring.ts`
      - `omr/calidad/etapaCalidad.ts`
      - `omr/debug/etapaDebug.ts`
      - `omr/pipeline/ejecutorPipelineOmr.ts`
    - API v2: `rutasEscaneoOmrV2.ts` activas
    - Observabilidad: metricas por etapa en `/api/metrics`
  - PDF (Ola 2B): ✅ segmentada (bootstrap DDD 2026-02-14)
    - `servicioGeneracionPdf.ts`: fachada 60 lineas (feature flag `FEATURE_PDF_BUILDER_V2`)
    - `servicioGeneracionPdfLegacy.ts`: motor legado preservado 1396 lineas
    - `controladorGeneracionPdf.ts`: 1389 lineas
    - Estructura DDD creada:
      - `application/usecases/generarExamenIndividual.ts` (stub)
      - `domain/examenPdf.ts`, `domain/layoutExamen.ts`
      - `infra/configuracionLayoutEnv.ts`, `infra/pdfKitRenderer.ts` (stub)
      - `shared/tiposPdf.ts`
    - API v2: `rutasGeneracionPdfV2.ts` existentes
  - Sincronizacion (Ola 2C): ✅ segmentada (delegacion use cases)
    - `controladorSincronizacion.ts`: 80 lineas (fachada HTTP)
    - `domain/paqueteSincronizacion.ts`: ensamblado/procesado de paquetes y guardrails
    - `infra/repositoriosSync.ts`: auditoria + cursores/fechas de sync
    - `infra/portalSyncClient.ts`: cliente HTTP unificado hacia portal
    - `infra/omrCapturas.ts`: extraccion de capturas OMR para publicacion
    - `application/usecases/*`: orquestacion por endpoint sin cambiar contrato HTTP
- Ola 3: iniciada en OMR/PDF (bootstrap `api/v2` + metricas de migracion dual)
- Ola 4: pendiente (hardening final + retiro de compatibilidad temporal)

## 4) Inventario exhaustivo de instrucciones para agentes IA

### 4.1 Fuentes de verdad de agente
1. `AGENTS.md`
2. `docs/IA_TRAZABILIDAD_AGENTES.md`
3. `.github/copilot-instructions.md`

### 4.2 Contrato de delivery
1. `ci/pipeline.contract.md`
2. `ci/pipeline.matrix.json`
3. `.github/workflows/ci.yml`
4. `.github/workflows/package.yml`

### 4.3 Operacion, seguridad y release
1. `docs/RELEASE_GATE_STABLE.md`
2. `docs/RUNBOOK_OPERACION.md`
3. `docs/SEGURIDAD_OPERATIVA.md`
4. `docs/DEVOPS_BASELINE.md`
5. `docs/VERSIONADO.md`

### 4.4 Estado tecnico/documental del proyecto
1. `README.md`
2. `docs/README.md`
3. `docs/ENGINEERING_BASELINE.md`
4. `CHANGELOG.md`
5. `scripts/README.md`
6. `package.json` (scripts raiz)

### 4.5 Reglas de inventario exhaustivo
1. El inventario de instrucciones IA se considera completo solo si cubre:
- gobernanza IA,
- contrato CI/CD,
- workflows ejecutables,
- runbooks de operacion/seguridad/release,
- entradas oficiales (`README` raiz y docs).
2. Exclusion obligatoria:
- `node_modules/**` no forma parte del contrato de instrucciones del proyecto.
3. Verificacion recomendada:
- escaneo por rutas versionadas y validacion manual de enlaces.

## 5) Contrato CI/CD auditado
- Workflows separados por responsabilidad:
  - `CI Checks`: quality/security/perf/docs gates bloqueantes.
  - `Package Images`: empaquetado Docker + `image-digests.txt`.
- Stages bloqueantes activos en `CI Checks`:
  - `setup`, `contract-check`, `lint`, `typecheck`, `test`
  - `flujo-docente-check`, `dataset-prodlike-check`, `docente-alumno-e2e-check`
  - `global-grade-check`, `pdf-print-check`, `ux-visual-check`
  - `coverage-check`, `perf-check`, `qa-manifest`
  - `perf-business-check`
  - `build`, `docs-check`, `security-scan`

## 6) Estado de gates (corte reciente)
- Verdes:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:frontend:ci`
  - `npm run test:coverage:ci`
  - `npm run test:backend:ci`
  - `npm run test:portal:ci`
  - `npm run perf:check`
  - `npm run perf:check:business`
  - `npm run pipeline:contract:check`
  - `npm run bigbang:olas:strict`
  - `npm run bigbang:olas:check`
  - `npm -C apps/backend run test -- tests/omr.test.ts tests/omr.prevalidacion.test.ts tests/integracion/versionadoApiV2Contratos.test.ts`
  - `npm -C apps/backend run test -- tests/integracion/flujoDocenteAlumnoProduccionLikeE2E.test.ts`
  - `npm -C apps/backend run test -- tests/integracion/versionadoApiV2Contratos.test.ts`
- Cobertura frontend observada:
  - lines 39.20
  - functions 40.28
  - statements 37.21
  - branches 31.40
  - estado: pasa umbral vigente (39/40/31/37)

## 7) Seguridad y operacion
- Gate estricto de entorno en CI:
  - `NODE_ENV=production STRICT_ENV_CHECK=1 npm run security:env:check`
- Auditoria de dependencias:
  - `npm audit --audit-level=high --json > npm-audit-report.json`
- Endpoints operativos:
  - backend: `/api/salud/live`, `/api/salud/ready`, `/api/metrics`
  - portal: `/api/portal/salud/live`, `/api/portal/salud/ready`, `/api/portal/metrics`

## 8) Salida academica firmada
- Endpoints implementados:
  - `GET /api/analiticas/lista-academica-csv?periodoId=<id>`
  - `GET /api/analiticas/lista-academica-docx?periodoId=<id>`
  - `GET /api/analiticas/lista-academica-firma?periodoId=<id>`
- Integridad:
  - `lista-academica.manifest.json` con SHA-256 por archivo.

## 9) Brechas para `1.0-beta`
1. Completar Ola 2:
- OMR 2A: continuar particion interna del motor legado (corte actual: 1400 lineas, pendiente bajar <800 final).
- PDF 2B: separar controller/use-case/domain/infra.
- Sync 2C: continuar separacion de politicas y contratos internos (controlador ya segmentado).
2. Completar Ola 3 (`api/v2` + migracion dual integral):
- Ya existe bootstrap inicial para `OMR/PDF` y contadores de fallback/v2 writes; falta expandir al resto de dominios breaking.
3. Completar Ola 4 (hardening final + retiro de compatibilidad temporal).
4. Continuar rampa de cobertura frontend hacia 45 en 4 metricas sin exclusiones artificiales.

## 10) Brechas para estable
1. Completar Olas 2, 3 y 4.
2. 10 corridas CI consecutivas verdes.
3. Ejecutar gate humano en produccion por release candidata:
- `npm run release:gate:prod-flow -- --version=<version> --periodo-id=<periodoId> --manual=docs/release/manual/prod-flow.json`
4. Versionar evidencias en:
- `docs/release/evidencias/<version>/`
