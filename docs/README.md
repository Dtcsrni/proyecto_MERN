# docs/

Documentacion oficial del estado actual de Sistema EvaluaPro.

Ultima actualizacion integral: 2026-02-13.

## Arranque para agentes IA
- `../AGENTS.md`: reglas operativas obligatorias para agentes.
- `../.github/copilot-instructions.md`: convenciones de arquitectura/codigo para asistentes IDE.
- `IA_TRAZABILIDAD_AGENTES.md`: snapshot real del proyecto + inventario exhaustivo de instrucciones.

## Lectura recomendada
- `ARQUITECTURA.md`: vista tecnica del sistema completo.
- `ARQUITECTURA_C4.md`: vista C4 (contexto/contenedores/componentes).
- `FLUJO_EXAMEN.md`: flujo funcional end-to-end.
- `FORMATO_PDF.md`: especificacion PDF/OMR.
- `ROLES_PERMISOS.md`: RBAC backend y capacidades por rol.
- `SEGURIDAD.md`: controles implementados y pendientes.
- `SINCRONIZACION_ENTRE_COMPUTADORAS.md`: paquete export/import y push/pull.
- `PRUEBAS.md`: estrategia de pruebas y criterios de salida.
- `UX_QUALITY_CRITERIA.md`: criterios bloqueantes y verificables de calidad GUI/UX.
- `DESPLIEGUE.md`: despliegue local y cloud.
- `VERSIONADO.md`: politica de version y release.
- `ENGINEERING_BASELINE.md`: baseline de ingeniería y reglas de gobernanza técnica.
- `DEVOPS_BASELINE.md`: baseline de operación/entrega y contrato CI/CD.
- `SEGURIDAD_OPERATIVA.md`: checklist operativo de seguridad.
- `RUNBOOK_OPERACION.md`: troubleshooting y operación diaria.
- `OPERACION_EXAMEN_GLOBAL_PROD.md`: preflight y checklist para habilitar generación global por materia/curso en producción.
- `RELEASE_GATE_STABLE.md`: gate formal beta -> estable con validación humana en producción.
- `INVENTARIO_PROYECTO.md`: inventario técnico integral (estado de olas, gates y brechas a `1.0-beta`/estable).
- `INVENTARIO_CODIGO_EXHAUSTIVO.md`: inventario completo de piezas de codigo/config versionadas por area.
- `IA_TRAZABILIDAD_AGENTES.md`: trazabilidad multi-sesion para continuidad entre agentes.
- `handoff/README.md`: paquete de handoff IA automatico por sesion (plantilla + checklist ejecutable).

## Documentos auto-generados
- `AUTO_DOCS_INDEX.md`: indice de docs.
- `AUTO_ENV.md`: inventario de variables de entorno detectadas.

## Diagramas
- Catalogo y convenciones: `DIAGRAMAS.md`
- Fuentes Mermaid: `diagramas/src/`
- Render SVG: `diagramas/rendered/`
- Observabilidad base:
  - Prometheus: `ops/observabilidad/prometheus.yml`
  - Alertas: `ops/observabilidad/alert.rules.yml`
  - Dashboard Grafana: `ops/observabilidad/grafana/dashboard-evaluapro.json`

## Calidad y CI (rampa activa)
El pipeline `CI Checks` ejecuta gates bloqueantes y progresivos.

Gate adicional bloqueante:
- `flujo-docente-check`: valida flujo docente E2E (`parcial` + `global`) y exportacion de lista academica firmada.
- `dataset-prodlike-check`: valida fixture anonimizado sin PII/token.
- `docente-alumno-e2e-check`: valida cadena completa backend->portal->alumno.
- `global-grade-check`: valida reglas y contrato de calificacion global.
- `pdf-print-check`: valida contrato PDF de impresion (Carta y trazabilidad).
- `ux-visual-check`: valida regresion visual de pantallas criticas.
- `ux-quality-check`: valida contrato UX basico (ayudas, iconografia y accesibilidad minima).
- `perf-check`: valida presupuesto p95/failures contra baseline (`docs/perf/baseline.json`).

Estado de referencia del corte 2026-02-13:
- `lint`, `typecheck`, `test:frontend:ci`: en verde.
- `coverage-check`: con brecha abierta en frontend (detalle en `INVENTARIO_PROYECTO.md`).
- Evidencias QA: `reports/qa/latest/*` y criterios en `QA_GATE_CRITERIA.md`.

| Semana | Cobertura backend | Cobertura frontend | Cobertura portal | Reglas ESLint complejidad |
| --- | --- | --- | --- | --- |
| Semana 1 | 55 | 39/40/31/37 (L/F/B/S) | 50 | `complexity=18`, `max-depth=5`, `max-params=5` |
| Semana 2 | 62 | 52 | 58 | `complexity=16`, `max-depth=4`, `max-params=5` |
| Semana 3 | 70 | 60 | 65 | `complexity=15`, `max-depth=4`, `max-params=4` |

## Salida academica firmada
Endpoints backend:
- `GET /api/analiticas/lista-academica-csv?periodoId=<id>`
- `GET /api/analiticas/lista-academica-docx?periodoId=<id>`
- `GET /api/analiticas/lista-academica-firma?periodoId=<id>`
- `GET /api/analiticas/calificaciones-xlsx?periodoId=<id>` (formato contractual 1:1 basado en plantilla de producción)

Archivos:
- `lista-academica.csv`
- `lista-academica.docx`
- `lista-academica.manifest.json`
- `docs/analiticas/CONTRATO_XLSX_PRODUCCION.md`

Firma de integridad:
- algoritmo `sha256`
- manifiesto con hash por archivo y tamano en bytes

## Seguridad/Operación (iteración fase 4/5)
- `security-scan` en CI corre en modo producción estricto:
  - `NODE_ENV=production STRICT_ENV_CHECK=1 npm run security:env:check`
- CI genera artefacto de auditoría:
  - `npm-audit-report.json`
