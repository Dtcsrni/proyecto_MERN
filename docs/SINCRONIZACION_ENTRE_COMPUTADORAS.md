# Sincronizacion entre computadoras (paquete y servidor)

Este modulo permite mover datos operativos de un docente entre instalaciones de EvaluaPro por dos vias:

1. **Paquete por archivo** (`.ep-sync.json`): exportar/importar manualmente.
2. **Servidor intermedio** (`push/pull`): sincronizacion incremental con cursor.

---

## Cobertura de sincronizacion

- Periodos/materias
- Alumnos
- Banco de preguntas
- Plantillas
- Examenes generados
- Entregas
- Calificaciones
- Banderas de revision
- PDFs comprimidos (opcional)

---

## Garantias del proceso

- **Integridad**: checksum SHA-256 del paquete.
- **Conflictos**: estrategia LWW por `updatedAt` (gana el registro mas reciente).
- **Idempotencia practica**: re-importar un mismo paquete no duplica datos si no hay cambios mas nuevos.
- **Trazabilidad**: auditoria por registro de sincronizacion (`pendiente`, `exitoso`, `fallido`).

---

## Flujo A: backup por archivo (`exportar`/`importar`)

### Exportar backup

Endpoint: `POST /api/sincronizaciones/paquete/exportar`

1. El backend arma el paquete con `schemaVersion=1`.
2. Calcula `checksumSha256` del JSON.
3. Comprime (gzip) y genera `paqueteBase64`.
4. La UI descarga un archivo `.ep-sync.json` con metadatos de backup.

Campos principales del archivo:

- `version`
- `exportadoEn`
- `checksumSha256`
- `checksumGzipSha256`
- `conteos`
- `paqueteBase64`
- `backupMeta`

### Importar backup

Endpoint: `POST /api/sincronizaciones/paquete/importar`

1. La UI valida archivo y metadatos.
2. Ejecuta `dryRun=true` para validar integridad/compatibilidad.
3. Si pasa validacion y el usuario confirma, ejecuta importacion real.
4. El backend aplica upserts con LWW por `updatedAt`.
5. Si hay PDFs, intenta restaurarlos de forma segura (best-effort).

---

## Politica de backup (TTL + invalidacion por logica)

Para backup por archivo se agrega `backupMeta`:

- `schemaVersion`: version de formato de backup.
- `createdAt`: fecha de creacion del respaldo.
- `ttlMs`: tiempo de vida del backup.
- `expiresAt`: fecha/hora de expiracion efectiva.
- `businessLogicFingerprint`: huella de la logica de negocio compatible.

Valor actual de huella: `sync-v1-lww-updatedAt-schema1`.

### Reglas de validez

Un backup se considera **invalido** cuando:

1. `expiresAt` falta o no es fecha valida.
2. `Date.now() > expiresAt` (backup expirado).
3. `businessLogicFingerprint` no coincide con la huella actual.

### Comportamiento al invalidarse

- **UI web** (`SeccionPaqueteSincronizacion`):
	- Rechaza la importacion y muestra mensaje de error.
	- Por limitaciones del navegador, no puede borrar fisicamente archivos del disco del usuario.
- **Backend** (`POST /api/sincronizaciones/paquete/importar`):
	- Rechaza la importacion si `backupMeta` indica expiracion o fingerprint incompatible.
	- Este enforcement evita bypass de validacion cliente.
- **CLI local** (`scripts/import-backup.mjs`):
	- Rechaza la importacion.
	- Intenta eliminar automaticamente el archivo `.ep-sync.json` invalido o expirado.

---

## Flujo B: sincronizacion con servidor (`push`/`pull`)

### Push

Endpoint: `POST /api/sincronizaciones/push`

1. Determina `desde` (payload o ultimo push exitoso).
2. Genera paquete incremental.
3. Si no hay cambios, responde `Sin cambios para enviar`.
4. Si hay cambios, envia a portal con `schemaVersion=1`.
5. Guarda cursor/auditoria.

### Pull

Endpoint: `POST /api/sincronizaciones/pull`

1. Determina cursor inicial (`desde` o ultimo pull exitoso).
2. Solicita lotes al portal con limite controlado.
3. Valida y aplica cada paquete recibido.
4. Acumula `pdfsGuardados` y actualiza `ultimoCursor`.
5. Guarda auditoria final.

---

## Endpoints backend

- `POST /api/sincronizaciones/paquete/exportar`
- `POST /api/sincronizaciones/paquete/importar`
- `POST /api/sincronizaciones/push`
- `POST /api/sincronizaciones/pull`
- `GET /api/sincronizaciones?limite=N`

---

## Seguridad

- Requiere sesion docente y permisos de sincronizacion.
- Import valida pertenencia del paquete al docente (ID/correo).
- Push/pull hacia portal usa cliente controlado y manejo de errores normalizado.

---

## Operacion recomendada

1. Antes de cambios grandes: exportar backup local.
2. Equipo emisor: push o exportar archivo.
3. Equipo receptor: pull o importar archivo (siempre con dry-run previo).
4. Verificar conteos y ultimo estado en panel de sincronizacion.

---

## Notas de mantenimiento

- Si cambia la logica de negocio de sincronizacion de forma incompatible, actualizar `businessLogicFingerprint`.
- Mantener compatibilidad hacia atras de forma explicita cuando se modifique formato del backup.
- Documentar cualquier cambio de contrato observable en `CHANGELOG.md`.
