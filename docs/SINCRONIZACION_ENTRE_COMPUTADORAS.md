# Sincronizacion entre computadoras

Este modulo permite mover datos operativos por dos vias:
1. Paquete por archivo (`.ep-sync.json`).
2. Servidor intermedio (`push/pull`).

## Cobertura
- Periodos y materias
- Alumnos
- Banco de preguntas
- Plantillas
- Examenes generados
- Entregas
- Calificaciones
- Banderas de revision
- PDFs comprimidos (opcional)

## Garantias
- Integridad: checksum SHA-256.
- Conflictos: estrategia LWW por `updatedAt`.
- Idempotencia practica en reimportacion.
- Auditoria por estado de sincronizacion.

## Contrato de backup
- `schemaVersion: 2`
- `businessLogicFingerprint: sync-v2-lww-updatedAt-schema2`
- `createdAt`, `ttlMs`, `expiresAt`

Un backup es invalido si:
1. `expiresAt` no existe o no es valido.
2. `Date.now() > expiresAt`.
3. Fingerprint distinto al esperado.

## Endpoints backend
- `POST /api/sincronizaciones/paquete/exportar`
- `POST /api/sincronizaciones/paquete/importar`
- `POST /api/sincronizaciones/push`
- `POST /api/sincronizaciones/pull`
- `GET /api/sincronizaciones?limite=N`

## Flujo recomendado
1. Exportar backup local.
2. Equipo emisor: `push` o exportacion manual.
3. Equipo receptor: `pull` o importacion con `dryRun`.
4. Verificar conteos y auditoria final.

## Mantenimiento
- Si cambia logica incompatible, actualizar fingerprint y documentar en `CHANGELOG.md`.
- Mantener validaciones de backend y frontend alineadas.
