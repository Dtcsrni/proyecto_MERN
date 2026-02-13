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
