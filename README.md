# Sistema EvaluaPro (EP)

Plataforma MERN para gestion de evaluaciones universitarias con generacion de examenes PDF, vinculacion por QR, analisis OMR, calificacion automatica asistida y sincronizacion local/cloud.

Estado actual del repositorio: 2026-02-11.

## Estado actual
- Monorepo activo con 3 apps: `backend`, `frontend`, `portal_alumno_cloud`.
- Flujo central implementado: plantilla -> examen generado -> entrega/vinculacion -> OMR -> calificacion -> exportacion/publicacion.
- RBAC activo en backend con roles `admin`, `docente`, `coordinador`, `auxiliar`, `lector`.
- OMR con deteccion por mapa de posiciones + QR + marcas/fiduciales + estado de calidad (`ok`, `requiere_revision`, `rechazado_calidad`).
- Sincronizacion entre computadoras por paquete y sincronizacion push/pull con servidor intermedio.

## Apps del monorepo
- `apps/backend`: API docente (Express + TypeScript + MongoDB/Mongoose).
- `apps/frontend`: web docente/alumno (React + Vite + TypeScript).
- `apps/portal_alumno_cloud`: API y portal alumno (solo lectura para alumno + endpoints de sync).

## Requisitos
- Node.js >= 24
- npm
- Docker Desktop (para stack local recomendado)

## Arranque rapido
1. Instalar dependencias:
```bash
npm install
```

2. Levantar backend local con Docker:
```bash
npm run dev:backend
```

3. Levantar frontend:
```bash
npm run dev:frontend
```

4. (Opcional) levantar portal cloud local:
```bash
npm run dev:portal
```

## Scripts clave
- Desarrollo:
  - `npm run dev`
  - `npm run dev:backend`
  - `npm run dev:frontend`
  - `npm run dev:portal`
- Operacion:
  - `npm run stack:dev`
  - `npm run stack:prod`
  - `npm run status`
  - `npm run reset:local`
- Calidad:
  - `npm run test`
  - `npm run test:portal`
  - `npm run test:frontend`
  - `npm run test:ci`
  - `npm run routes:check`
  - `npm run docs:check`

## Capacidades funcionales actuales
- Gestion academica: periodos/materias, alumnos, banco de preguntas versionado.
- Plantillas: por preguntas o por temas, previsualizacion, archivado.
- Examenes generados:
  - generacion individual y por lote
  - PDF con QR por pagina y mapa OMR
  - descarga y regeneracion controlada
- Vinculacion de entrega por folio/QR.
- OMR:
  - analisis por pagina
  - deteccion de respuestas y confianza
  - auditoria de calidad para auto-calificacion
- Calificacion:
  - calculo exacto y topes
  - parcial/global
  - almacenamiento de auditoria OMR
- Analiticas:
  - exportacion CSV de calificaciones
  - banderas de revision
- Sincronizacion:
  - publicar resultados al portal
  - codigo de acceso alumno
  - export/import de paquete entre computadoras
  - push/pull asincrono

## Seguridad y control de acceso
- JWT de docente + middleware de autenticacion obligatorio para rutas privadas.
- Middleware de permisos por accion (`requerirPermiso`).
- Validaciones Zod strict en payloads.
- Rate limit y hardening HTTP (Helmet, no `x-powered-by`).
- Sanitizacion de entradas para prevenir operadores peligrosos.

## Variables de entorno
Ver referencias actualizadas:
- `docs/AUTO_ENV.md`
- `.env` de cada entorno

## Documentacion
- `docs/README.md`
- `docs/ARQUITECTURA.md`
- `docs/FLUJO_EXAMEN.md`
- `docs/FORMATO_PDF.md`
- `docs/PRUEBAS.md`
- `docs/SEGURIDAD.md`
- `docs/DESPLIEGUE.md`
- `docs/ROLES_PERMISOS.md`
- `docs/SINCRONIZACION_ENTRE_COMPUTADORAS.md`
- `docs/VERSIONADO.md`
