# Roles, accesos y permisos (RBAC)

## Roles vigentes
- `admin`
- `docente`
- `coordinador`
- `auxiliar`
- `lector`

Fuente de verdad: `apps/backend/src/infraestructura/seguridad/rbac.ts`.

## Permisos
Catalogo principal (resumen):
- Alumnos: `alumnos:leer`, `alumnos:gestionar`, `alumnos:eliminar_dev`
- Periodos: `periodos:leer`, `periodos:gestionar`, `periodos:archivar`, `periodos:eliminar_dev`
- Banco: `banco:leer`, `banco:gestionar`, `banco:archivar`
- Plantillas: `plantillas:leer`, `plantillas:gestionar`, `plantillas:archivar`, `plantillas:previsualizar`, `plantillas:eliminar_dev`
- Examenes: `examenes:leer`, `examenes:generar`, `examenes:archivar`, `examenes:regenerar`, `examenes:descargar`
- Entregas: `entregas:gestionar`
- OMR: `omr:analizar`
- Calificaciones: `calificaciones:calificar`, `calificaciones:publicar`
- Analiticas: `analiticas:leer`
- Sincronizacion: `sincronizacion:listar`, `sincronizacion:exportar`, `sincronizacion:importar`, `sincronizacion:push`, `sincronizacion:pull`
- Cuenta: `cuenta:leer`, `cuenta:actualizar`
- Admin docentes: `docentes:administrar`

## Matriz de capacidades por rol
- `admin`: todos los permisos.
- `docente`: operacion completa docente (sin privilegios administrativos de docentes).
- `coordinador`: gestion academica y generacion, sin OMR/calificacion.
- `auxiliar`: lectura + entrega + OMR + calificacion.
- `lector`: solo lectura.

## Enforcement
- Backend aplica permisos con `requerirPermiso(...)` por endpoint.
- Frontend usa permisos para habilitar/ocultar acciones, pero la autoridad final es backend.
- Endpoint de perfil devuelve roles y permisos efectivos.

## Endpoints admin
Requieren `docentes:administrar`:
- `GET /api/admin/docentes`
- `POST /api/admin/docentes/:docenteId`

## Reglas dev-only
Permisos `*_eliminar_dev` solo se permiten en entorno `development`.
