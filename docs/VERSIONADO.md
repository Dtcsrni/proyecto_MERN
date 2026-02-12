# Versionado

## Politica
Se usa SemVer en raiz del monorepo.

## Estado actual
- Version declarada actual: `0.1.0`.
- Canal operativo: beta funcional (MVP extendido).

## Definiciones
- Alpha: cambios de alto movimiento con contratos inestables.
- Beta: contratos principales funcionales con ajustes controlados.
- Estable: release candidata cuando pasa bateria completa de calidad y no hay cambios breaking pendientes.

## Criterios para promover release estable
Debe pasar:
- `npm run test:ci`
- `npm run test:portal`
- `npm run test:frontend`
- `npm run routes:check`
- `npm run docs:check`
- `npm run diagramas:check`
- `npm run diagramas:render:check`
- `npm run diagramas:consistencia:check`

## Convenciones de cambio
- Cambios funcionales relevantes: actualizar docs y pruebas en el mismo ciclo.
- Cambios en rutas o permisos: validar guardarrailes y diagramas.
- Cambios OMR/calificacion: incluir pruebas de regresion.
