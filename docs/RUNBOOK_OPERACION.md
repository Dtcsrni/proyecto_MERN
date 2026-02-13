# Runbook Operación (Local + Cloud mínimo)

## 1. Verificación rápida de salud
Backend:
- `GET /api/salud/live`
- `GET /api/salud/ready`
- `GET /api/salud/metrics`

Portal:
- `GET /api/portal/salud/live`
- `GET /api/portal/salud/ready`
- `GET /api/portal/metrics`

## 2. Síntoma: API no responde
1. Revisar contenedores/proceso:
- `docker compose ps`
2. Verificar logs:
- backend/portal en formato JSON con `requestId`.
3. Comprobar readiness:
- Si `ready` da 503, validar conectividad MongoDB.

## 3. Síntoma: incremento de errores 5xx
1. Revisar métrica de errores y latencia p95.
2. Filtrar logs por `level=error` y `requestId`.
3. Verificar últimas modificaciones desplegadas.

## 4. Síntoma: problemas de autenticación
1. Confirmar variables:
- `JWT_SECRETO`
- `PORTAL_API_KEY`
- `PORTAL_ALUMNO_API_KEY`
2. Revisar expiración y sincronización horaria.

## 5. Smoke post-deploy mínimo
1. Autenticación docente.
2. Crear materia.
3. Crear alumno.
4. Generar examen.
5. Flujo de publicación/sincronización básico.

## 6. Escalamiento
- Si hay degradación sostenida (`ready` inestable + errores altos), activar rollback al último release estable.

## 7. Verificacion de integridad de lista academica (SHA-256)
1. Descargar:
- `lista-academica.csv`
- `lista-academica.docx`
- `lista-academica.manifest.json`
2. Calcular hash local SHA-256 de ambos archivos.
3. Comparar contra `archivos[].sha256` del manifiesto.
4. Si no coincide:
- no distribuir el archivo
- regenerar exportacion
- revisar logs por `requestId` y repetir validacion

## 8. Levantar observabilidad local en 5 minutos
1. Iniciar Prometheus con la configuracion versionada:
- `prometheus --config.file=ops/observabilidad/prometheus.yml`
2. Verificar targets:
- backend: `http://host.docker.internal:3000/api/metrics`
- portal: `http://host.docker.internal:3001/api/portal/metrics`
3. Importar dashboard base en Grafana:
- `ops/observabilidad/grafana/dashboard-evaluapro.json`
4. Confirmar reglas de alerta cargadas:
- `ops/observabilidad/alert.rules.yml`
5. Puertos sugeridos:
- Prometheus `9090`
- Grafana `3002`

## 9. Gate estable con docente humano en produccion
1. Confirmar prerequisitos:
- 10 corridas CI consecutivas verdes.
- checklist de rollback listo.
2. Ejecutar flujo humano completo con docente activo.
3. Generar evidencia automatizada:
- `npm run release:gate:prod-flow -- --version=<version> --periodo-id=<periodoId> --manual=docs/release/manual/prod-flow.json`
4. Verificar artefactos:
- `docs/release/evidencias/<version>/manifest.json`
- `docs/release/evidencias/<version>/timeline.md`
- `docs/release/evidencias/<version>/metrics_snapshot.txt`
- `docs/release/evidencias/<version>/integridad_sha256.json`
5. Si el resultado del manifiesto es `fallo`, bloquear promocion y ejecutar rollback/correccion.

## 10. Validacion preproduccion automatizada (sin prueba humana)
1. Ejecutar:
- `npm run test:dataset-prodlike:ci`
- `npm run test:e2e:docente-alumno:ci`
- `npm run test:global-grade:ci`
- `npm run test:pdf-print:ci`
- `npm run test:ux-visual:ci`
2. Consolidar evidencia:
- `npm run test:qa:manifest`
3. Verificar artefactos en `reports/qa/latest/`:
- `dataset-prodlike.json`
- `e2e-docente-alumno.json`
- `global-grade.json`
- `pdf-print.json`
- `ux-visual.json`
- `manifest.json`
4. Regla Go/No-Go:
- Todos los comandos y artefactos OK: `GO beta`.
- Cualquier falla o artefacto faltante: `NO-GO`.

## 11. Preflight operativo para generacion de examenes globales
Objetivo: validar que una materia/curso en produccion tiene todas las precondiciones para generar examenes globales desde banco + plantillas.

Comando recomendado (sin mutar datos):
- `npm run release:preflight:global -- --api-base=<https://api-dominio/api> --token=<jwt_docente> --periodo-id=<periodoId> --modo=readonly`

Smoke opcional (muta datos de forma controlada: genera 1 examen y lo archiva):
- `npm run release:preflight:global -- --api-base=<https://api-dominio/api> --token=<jwt_docente> --periodo-id=<periodoId> --modo=smoke --alumno-id=<alumnoId>`

Salida verificable:
- `reports/qa/latest/preflight-global-prod.json`

Regla Go/No-Go:
- `GO`: estado `ok` y todos los checks en verde.
- `NO-GO`: cualquier check en `fallo` (periodo, alumnos, banco, plantillas globales, previsualizacion o smoke).
