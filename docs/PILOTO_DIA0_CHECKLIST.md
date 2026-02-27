# Checklist Operativo Dia 0 (Piloto Hibrido)

Objetivo: dejar operativo el piloto (1 institucion, 1-3 docentes) con backend local + portal cloud.

## 1. Preflight tecnico (antes de tocar produccion)
- [ ] Confirmar version candidata (`package.json`) y registrar commit.
- [ ] Ejecutar gates:
  - [ ] `npm run test:ci`
  - [ ] `npm run test:installer-hub:contract`
- [ ] Confirmar salud de rutas nuevas:
  - [ ] `GET /api/version`
  - [ ] `GET /api/portal/version`
  - [ ] `GET /api/salud/ready` con `dependencies.mongodb`
  - [ ] `GET /api/portal/salud/ready` con `dependencies.mongodb`

## 2. Artefactos de distribucion Windows
- [ ] Generar MSI:
  - [ ] `npm run msi:build`
- [ ] Generar Installer Hub:
  - [ ] `npm run installer:hub:build`
- [ ] Generar hashes/manifiesto:
  - [ ] `npm run installer:hashes`
- [ ] Firmar artefactos (si hay certificado):
  - [ ] `npm run installer:sign`
- [ ] Verificar artefactos esperados en `dist/installer`:
  - [ ] `EvaluaPro.msi`
  - [ ] `EvaluaPro.msi.sha256`
  - [ ] `EvaluaPro-InstallerHub.exe`
  - [ ] `EvaluaPro-InstallerHub.exe.sha256`
  - [ ] `EvaluaPro-release-manifest.json`
- [ ] Validar manifiesto extendido:
  - [ ] `build.version`
  - [ ] `build.commit`
  - [ ] `artifacts[]` con `sha256` y `signed`
  - [ ] `deployment.target`

## 3. Despliegue portal cloud (Cloud Run free-tier)
- [ ] Desplegar `apps/portal_alumno_cloud`.
- [ ] Configurar variables/secretos obligatorios:
  - [ ] `MONGODB_URI`
  - [ ] `PORTAL_API_KEY`
  - [ ] `CORS_ORIGENES` (sin `*`)
  - [ ] `CODIGO_ACCESO_HORAS`
- [ ] Verificar endpoints cloud:
  - [ ] `GET /api/portal/salud/live` => 200
  - [ ] `GET /api/portal/salud/ready` => 200
  - [ ] `GET /api/portal/metrics` => 200
  - [ ] `GET /api/portal/version` => 200

## 4. Configuracion backend local (sitio piloto)
- [ ] En entorno docente definir:
  - [ ] `MONGODB_URI`
  - [ ] `JWT_SECRETO`
  - [ ] `PORTAL_ALUMNO_URL` (URL cloud real)
  - [ ] `PORTAL_ALUMNO_API_KEY` (misma clave del portal)
  - [ ] `CORS_ORIGENES`
- [ ] Iniciar stack:
  - [ ] `npm run stack:prod`
  - [ ] `npm run portal:prod` (si aplica en host local)
- [ ] Verificar backend:
  - [ ] `GET /api/salud/live` => 200
  - [ ] `GET /api/salud/ready` => 200
  - [ ] `GET /api/metrics` => 200
  - [ ] `GET /api/version` => 200

## 5. Onboarding funcional (1-3 docentes)
- [ ] Instalar via `EvaluaPro-InstallerHub.exe` en equipos objetivo.
- [ ] Confirmar acceso directo `EvaluaPro - Prod`.
- [ ] Smoke funcional minimo por docente:
  - [ ] Login docente
  - [ ] Crear materia
  - [ ] Crear alumno
  - [ ] Generar examen
  - [ ] Publicar al portal cloud
  - [ ] Alumno consulta resultado en portal

## 6. Smoke operativo diario
- [ ] Ejecutar:
  - [ ] `npm run ops:smoke:pilot -- --backend-base=http://localhost:4000/api --portal-base=https://<portal>/api/portal`
- [ ] Confirmar reporte:
  - [ ] `reports/ops/latest/smoke-piloto-hibrido.json`
- [ ] Guardar evidencia diaria (fecha, estado, responsable, incidencias).

## 7. Incidentes y rollback
- [ ] Si hay degradacion sostenida (`ready` inestable o errores 5xx):
  - [ ] activar rollback al ultimo release estable
  - [ ] registrar incidente con `requestId` y ventana horaria
  - [ ] repetir smoke de verificacion post-rollback

## 8. Cierre del Dia 0
- [ ] Estado final: GO / NO-GO.
- [ ] Lista de bloqueos abiertos con dueño y ETA.
- [ ] Programar siguiente ventana de cambio (bajo demanda).
