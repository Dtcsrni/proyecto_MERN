# Pruebas automatizadas

## Objetivo
Asegurar confiabilidad funcional y de seguridad del sistema completo en cada cambio.

## Capas de prueba
- Backend (`apps/backend/tests`):
  - unitarias
  - contrato/validaciones
  - integracion de flujo
  - seguridad/autorizacion/RBAC
  - OMR y calificacion
- Portal cloud (`apps/portal_alumno_cloud/tests`):
  - sesion alumno
  - sincronizacion
  - seguridad por API key y middleware
- Frontend (`apps/frontend/tests`):
  - smoke y comportamiento de cliente

## Flujos criticos cubiertos
- Flujo de examen end-to-end backend.
- Generacion/regeneracion de examenes y PDF.
- Vinculacion de entrega por folio.
- Escaneo QR/OMR y deteccion de mismatch.
- Calificacion y reglas de topes.
- Aislamiento entre docentes.
- Publicacion/sincronizacion hacia portal.

## Criterio de calidad para release
Se considera candidato estable cuando pasan:
```bash
npm run test:ci
npm run test:portal
npm run test:frontend
npm run routes:check
npm run docs:check
npm run diagramas:check
npm run diagramas:render:check
npm run diagramas:consistencia:check
```

## Comandos de uso frecuente
- Backend completo:
```bash
npm -C apps/backend run test
```
- Portal cloud:
```bash
npm -C apps/portal_alumno_cloud run test
```
- Frontend:
```bash
npm -C apps/frontend run test
```
- Suite integrada raiz:
```bash
npm run test:ci
```

## Estado operativo actual
- El backend mantiene una bateria amplia de pruebas de contrato e integracion.
- OMR tiene pruebas unitarias especificas (doble marca, burbuja hueca, trazos lineales, colorimetria).
- Existen pruebas de integracion para QR/OMR y flujo de examen.

## Regla de mantenimiento
Todo cambio en:
- rutas,
- permisos,
- OMR,
- calificacion,
- sincronizacion,
debe acompanarse de prueba nueva o ajuste de regresion.
