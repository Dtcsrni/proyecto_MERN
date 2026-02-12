# Seguridad

Estado de controles de seguridad implementados en el sistema.

## Controles activos
- Autenticacion docente por JWT + sesion refrescable.
- Autorizacion por permisos (RBAC) en rutas protegidas.
- Validacion strict de payloads con Zod.
- Rate limit configurable (general, credenciales, refresh).
- Hardening HTTP:
  - Helmet
  - `x-powered-by` deshabilitado
- Sanitizacion de entrada para prevenir operadores inseguros en consultas.
- Manejo central de errores sin fuga de detalle interno.
- API key para operaciones internas de sync/push/pull con portal cloud.

## Seguridad OMR y calificacion
- OMR entrega estado de analisis (`ok`, `requiere_revision`, `rechazado_calidad`).
- Calificacion registra auditoria OMR (`omrAuditoria`).
- Si hay `respuestasDetectadas`, los aciertos se derivan de esas respuestas (evita sobreescritura manual inconsistente).

## Seguridad de datos
- Segregacion por docente en consultas y mutaciones.
- Aislamiento multi-tenant verificado por pruebas de integracion.
- Codigos de acceso alumno con expiracion y control de uso.

## Recomendaciones operativas
- En produccion, definir secretos via gestor seguro (no `.env` en texto plano compartido).
- Rotar API keys y secretos JWT periodicamente.
- Restringir CORS por ambiente.
- Ejecutar `npm run test:ci` antes de desplegar.
- Monitorear logs de errores y de accesos fallidos.

## Riesgos conocidos
- Captura OMR depende de calidad de imagen fisica (enfoque, iluminacion, encuadre).
- El modo `requiere_revision` debe formar parte del procedimiento operativo docente.
