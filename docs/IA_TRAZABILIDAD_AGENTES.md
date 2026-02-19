# Trazabilidad IA del Proyecto

Fecha de corte: 2026-02-16  
Commit de referencia: `15f7d35`

Objetivo: garantizar continuidad entre agentes/sesiones con estado verificable, reglas unificadas y evidencia reproducible.

## 1) Snapshot operativo real del repositorio

### Estado de olas Big-Bang hacia `1.0-beta`
- Ola 0: implementada.
- Ola 1: completada.
- Ola 2: activa.
- Ola 3: iniciada (bootstrap API v2 en OMR/PDF).
- Ola 4: pendiente.

### Frontend docente (lineas por archivo critico)
- `apps/frontend/src/apps/app_docente/AppDocente.tsx`: 798
- `apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx`: 798
- `apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx`: 763
- `apps/frontend/src/apps/app_docente/SeccionBanco.tsx`: 777

### Backend core (lineas por archivo critico)
- `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts`: fachada v2-only (sin fallback runtime a v1).
- `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrV2.ts`: motor operativo OMR (pipeline modular).
- `apps/backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts`: 1389
- `apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts`: 1396
- `apps/backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts`: 80 (fachada HTTP tras particion interna)

### Cobertura frontend actual (gate W1 recalibrado = 39/40/31/37)
- lines: 39.20
- functions: 40.28
- statements: 37.21
- branches: 31.40

Resultado: `coverage-check` en verde con umbral vigente.

## 2) Inventario exhaustivo de instrucciones para agentes IA

### A. Gobernanza directa para agentes
1. `AGENTS.md`
2. `docs/IA_TRAZABILIDAD_AGENTES.md`
3. `.github/copilot-instructions.md`

### B. Contrato de delivery (agnostico)
1. `ci/pipeline.contract.md`
2. `ci/pipeline.matrix.json`
3. `.github/workflows/ci.yml`
4. `.github/workflows/package.yml`

### C. Gate de release y operacion
1. `docs/RELEASE_GATE_STABLE.md`
2. `docs/RUNBOOK_OPERACION.md`
3. `docs/SEGURIDAD_OPERATIVA.md`
4. `docs/DEVOPS_BASELINE.md`
5. `docs/VERSIONADO.md`

### D. Estado tecnico y documental del proyecto
1. `README.md`
2. `docs/README.md`
3. `docs/ENGINEERING_BASELINE.md`
4. `docs/INVENTARIO_PROYECTO.md`
5. `docs/INVENTARIO_CODIGO_EXHAUSTIVO.md`
6. `docs/handoff/PLANTILLA_HANDOFF_IA.md`
7. `docs/handoff/sesiones/<YYYY-MM-DD>/*`
8. `CHANGELOG.md`
9. `scripts/README.md`
10. `package.json` (scripts raiz)

### F. Fuentes que no gobiernan el proyecto
1. Cualquier archivo bajo `node_modules/**`
2. Cualquier doc externa no versionada en este repo

## 2.1) Matriz de trazabilidad de instrucciones
| Archivo | Tipo | Alcance | Estado |
| --- | --- | --- | --- |
| `AGENTS.md` | Gobernanza IA | Reglas obligatorias multi-agente | Activo |
| `docs/IA_TRAZABILIDAD_AGENTES.md` | Estado IA | Snapshot, handoff y reglas de cierre | Activo |
| `.github/copilot-instructions.md` | Asistente IDE | Convenciones de arquitectura/codigo | Activo |
| `scripts/ia-handoff.mjs` | Automatizacion IA | Checklist ejecutable y reporte de handoff por sesion | Activo |
| `scripts/ia-docblocks.mjs` | Automatizacion IA | Refuerzo de cabeceras autoexplicativas por archivo | Activo |
| `docs/handoff/PLANTILLA_HANDOFF_IA.md` | Plantilla IA | Formato base obligatorio para cierre de sesion | Activo |
| `ci/pipeline.contract.md` | Contrato CI | Etapas y criterios bloqueantes | Activo |
| `ci/pipeline.matrix.json` | Contrato CI | Matriz de apps y comandos | Activo |
| `.github/workflows/ci.yml` | Ejecucion CI | Implementacion del contrato de checks | Activo |
| `.github/workflows/package.yml` | Ejecucion CI | Empaquetado Docker/artefactos | Activo |
| `docs/RELEASE_GATE_STABLE.md` | Release gate | Promocion beta->estable | Activo |
| `docs/RUNBOOK_OPERACION.md` | Operacion | Procedimientos y troubleshooting | Activo |
| `docs/SEGURIDAD_OPERATIVA.md` | Seguridad | Checklist operativo bloqueante | Activo |
| `docs/ENGINEERING_BASELINE.md` | Baseline | Estado tecnico y brechas | Activo |
| `docs/DEVOPS_BASELINE.md` | Baseline | Estado de entrega/operacion | Activo |
| `docs/VERSIONADO.md` | Gobierno release | Regla semver/promocion | Activo |
| `README.md` | Entrada raiz | Navegacion oficial del repo | Activo |
| `docs/README.md` | Entrada docs | Navegacion oficial de documentos | Activo |
| `CHANGELOG.md` | Historial | Evidencia de cambios aplicados | Activo |

### E. Evidencia de release estable
1. `docs/release/manual/prod-flow.template.json`
2. `scripts/release/gate-prod-flow.mjs`
3. `docs/release/evidencias/<version>/*`

## 3) Reglas obligatorias para cualquier agente

1. Verificar estado real antes de planear:
- lineas de archivos criticos,
- gates actuales,
- cobertura real.

2. No ocultar deuda tecnica:
- no bajar umbrales,
- no excluir modulos para pasar coverage,
- no introducir wrappers/stubs vacios.

3. Trazabilidad minima por sesion:
- objetivo,
- cambios,
- comandos de verificacion,
- resultados exactos,
- bloqueos y causa.

4. Actualizacion documental obligatoria al cerrar sesion:
- `docs/INVENTARIO_PROYECTO.md`
- `docs/ENGINEERING_BASELINE.md`
- `CHANGELOG.md`
5. Para archivos nuevos sin cabecera contextual:
- ejecutar `npm run ia:docblocks` y revisar manualmente cabeceras en modulos criticos.

## 4) Matriz de validacion para cerrar trabajo

Orden recomendado:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:frontend:ci`
4. `npm run test:coverage:ci`
5. `npm run test:backend:ci`
6. `npm run test:portal:ci`
7. `npm run perf:check`
8. `npm run pipeline:contract:check`

Si falla un gate, no avanzar de ola. Corregir, revalidar y actualizar estado.

## 5) Formato de handoff entre sesiones/agentes

Generacion automatica recomendada:
- `npm run ia:handoff:quick`
- `npm run ia:handoff:full`

Plantilla oficial:
- `docs/handoff/PLANTILLA_HANDOFF_IA.md`

Salida automatica por sesion:
- `docs/handoff/sesiones/<YYYY-MM-DD>/<sesion>.md`

## 6) Siguiente objetivo recomendado (segun estado actual)
1. Continuar Ola 2:
- OMR 2A: profundizar separacion del motor legado por etapas reales (actualmente 1400 lineas con modulo `infra/imagenProcesamientoLegacy.ts` extraido).
- PDF 2B: separar controller/use-case/domain/infra.
- Sync 2C: consolidar politicas internas restantes tras la fachada + use cases.
2. Continuar rampa de cobertura frontend hacia 45 sin exclusiones.
3. Completar Ola 3 de migracion dual histórica para dominios breaking pendientes.

## 7) Corte Sprint Big Bang (2026-02-14)
- Gate `bigbang:olas:strict` alineado con estado real:
  - checks por dominio en `scripts/bigbang-olas-check.mjs` (`ola2a`, `ola2b`, `ola2c`).
  - reporte coherente en `reports/qa/latest/olas-bigbang.json`.
- Ola 3 minima OMR validada por contrato:
  - `apps/backend/tests/integracion/versionadoApiV2Contratos.test.ts` verifica paridad histórica y metricas de fallback/writes.
