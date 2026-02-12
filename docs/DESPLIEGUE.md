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
npm run dev:portal
```

## Produccion local (ensayo)
```bash
npm run stack:prod
```

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

Referencia completa: `docs/AUTO_ENV.md`.

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
