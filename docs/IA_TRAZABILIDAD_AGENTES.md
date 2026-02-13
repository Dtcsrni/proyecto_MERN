# Trazabilidad IA del Proyecto

Fecha de corte: 2026-02-13  
Commit de referencia: `dffa43f`

Objetivo: garantizar continuidad entre agentes/sesiones con estado verificable, reglas unificadas y evidencia reproducible.

## 1) Snapshot operativo real del repositorio

### Estado de olas Big-Bang hacia `1.0-beta`
- Ola 0: implementada.
- Ola 1: parcial.
- Ola 2: pendiente.
- Ola 3: pendiente.
- Ola 4: pendiente.

### Frontend docente (lineas por archivo critico)
- `apps/frontend/src/apps/app_docente/AppDocente.tsx`: 757
- `apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx`: 783
- `apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx`: 964
- `apps/frontend/src/apps/app_docente/SeccionBanco.tsx`: 807

### Backend core pendiente (lineas por archivo critico)
- `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts`: 1854
- `apps/backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts`: 1260
- `apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts`: 1158
- `apps/backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts`: 989

### Cobertura frontend actual (gate W1 = 45)
- lines: 24.83
- functions: 26.32
- statements: 23.44
- branches: 21.16

Resultado: `coverage-check` sigue bloqueando.

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
5. `CHANGELOG.md`
6. `scripts/README.md`
7. `package.json` (scripts raiz)

### F. Fuentes que no gobiernan el proyecto
1. Cualquier archivo bajo `node_modules/**`
2. Cualquier doc externa no versionada en este repo

## 2.1) Matriz de trazabilidad de instrucciones
| Archivo | Tipo | Alcance | Estado |
| --- | --- | --- | --- |
| `AGENTS.md` | Gobernanza IA | Reglas obligatorias multi-agente | Activo |
| `docs/IA_TRAZABILIDAD_AGENTES.md` | Estado IA | Snapshot, handoff y reglas de cierre | Activo |
| `.github/copilot-instructions.md` | Asistente IDE | Convenciones de arquitectura/codigo | Activo |
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

Usar este formato en reporte final:

1. Objetivo de sesion
2. Archivos modificados
3. Resultado por comando (verde/rojo + dato clave)
4. Cambios que quedaron pendientes
5. Riesgos abiertos
6. Siguiente paso exacto recomendado

## 6) Siguiente objetivo recomendado (segun estado actual)
1. Cerrar Ola 1:
- bajar `SeccionBanco.tsx` a <=350,
- bajar `SeccionPlantillas.tsx` a <=800.
2. Subir cobertura frontend hacia 45 sin exclusiones.
3. Solo despues avanzar a Ola 2 (backend core/performance).
