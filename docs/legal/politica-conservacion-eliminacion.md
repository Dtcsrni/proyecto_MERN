# Politica de Conservacion y Eliminacion de Datos

Version: 2026.02

## Objetivo
Definir retencion, expurgo y evidencia de eliminacion para datos personales y operativos.

## Parametros tecnicos
- `DATA_RETENTION_DEFAULT_DAYS`
- `DATA_PURGE_CRON`
- `AUDIT_LOG_IMMUTABLE`

## Reglas de retencion base
- Solicitudes DSR resueltas/rechazadas: hasta TTL vigente.
- Eventos de cumplimiento: hasta TTL vigente.
- Datos academicos: conforme politica institucional del cliente.
- Backups: cifrados y con vigencia documentada.

## Expurgo
1. Expurgo automatico por TTL (job programado).
2. Expurgo manual autorizado por rol `compliance:expurgar`.
3. Todo expurgo debe dejar evidencia auditable.

## Excepciones
Cuando exista mandato legal, auditoria activa o litigio, se aplica retencion extendida con trazabilidad.
