# Despliegue

## Estrategia general
- Operacion docente local recomendada con Docker Compose.
- Portal alumno desacoplado para despliegue cloud.

## Desarrollo local
Levantar stack base:
```bash
npm run stack:dev
```

Alternativa separada:
```bash
npm run dev:backend
npm run dev:frontend
npm run dev:frontend:alumno
npm run dev:portal
```

## Produccion local (ensayo)
```bash
npm run stack:prod
```

Portal prod local (sin watch):
```bash
npm run portal:prod
```

Notas:
- `portal:prod` compila `apps/portal_alumno_cloud` solo si falta `dist/index.js`.
- Los accesos directos `EvaluaPro - Dev` y `EvaluaPro - Prod` aplican arranque estricto:
  - levantan dashboard/tray si no estaba activo,
  - solicitan inicio de stack/portal,
  - esperan salud (`apiDocente` + `apiPortal`) antes de abrir la UI.

## Servicios locales tipicos
- `mongo_local`
- `api_docente_local` / `api_docente_prod`
- `web_docente_prod` (segun perfil)

## Portal alumno cloud
App objetivo: `apps/portal_alumno_cloud`.

Recomendaciones:
1. Build de imagen Docker del portal.
2. Deploy a servicio administrado (ej. Cloud Run).
3. Configurar variables de entorno y API key.
4. Restringir CORS a origenes esperados.
5. Programar limpieza/retencion segun politica.

## Variables clave
Backend docente:
- `MONGODB_URI`
- `JWT_SECRETO`
- `PORTAL_ALUMNO_URL`
- `PORTAL_ALUMNO_API_KEY`

Portal cloud:
- `MONGODB_URI`
- `PORTAL_API_KEY`
- `CODIGO_ACCESO_HORAS`
- `CORS_ORIGENES`

Frontend alumno/docente (build separado):
- `VITE_APP_DESTINO` (`alumno` | `docente`)
- `VITE_PORTAL_BASE_URL`

Referencia completa: `docs/AUTO_ENV.md`.

## Distribuible estable Windows (MSI/WiX)
Estructura:
- `packaging/wix/Product.wxs`
- `packaging/wix/Bundle.wxs`
- `packaging/wix/Fragments/*`

Build local:
```powershell
npm run msi:build
```

Garantia de estabilidad para distribuible:
- `msi:build` ejecuta checks obligatorios antes de empaquetar:
  - `lint`
  - `typecheck`
  - `test:backend:ci`
  - `test:portal:ci`
  - `test:frontend:ci`
  - `qa:clean-architecture:check`
  - `pipeline:contract:check`
- si algun check falla, no se genera instalador.

Artefactos:
- `dist/installer/EvaluaPro.msi`
- `dist/installer/EvaluaPro-Setup.exe`

Prerequisitos de instalacion:
- Node.js 24+
- Docker Desktop
- WiX Toolset v6+ estable (solo para generar instalador)

Autoconfiguracion durante uso:
- shortcuts Dev/Prod instalados automaticamente.
- acceso directo Prod intenta iniciar stack+portal si no estan activos.
- instalacion/actualizacion crea accesos directos automaticamente.
- escritorio habilitado por defecto (`InstallDesktopShortcuts=1`).
- menu inicio agrega accesos operativos: Abrir Dashboard, Reiniciar Stack, Detener Todo, Reparar Entorno.

Regenerar accesos directos locales (repo + escritorio + menu inicio):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-shortcuts.ps1 -Force
```

No autoconfigurable por instalador:
- instalacion de Node.js/Docker Desktop.
- credenciales/secretos de entorno de produccion real.

## Operacion y verificacion
- Estado rapido:
```bash
npm run status
```
- Checks previos a liberar:
```bash
npm run test:ci
npm run docs:check
```

## Notas de retencion y respaldo
- Mantener respaldo local antes de purgas cloud.
- Si se sincronizan PDFs comprimidos, monitorear peso y politica de almacenamiento.

