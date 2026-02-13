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
- `npm run test:coverage:ci`
- `npm run perf:check`
- `npm run test:portal`
- `npm run test:frontend`
- `npm run routes:check`
- `npm run docs:check`
- `npm run diagramas:check`
- `npm run diagramas:render:check`
- `npm run diagramas:consistencia:check`

## Rampa de calidad asociada a releases
| Semana | Cobertura backend | Cobertura frontend | Cobertura portal | Reglas ESLint complejidad |
| --- | --- | --- | --- | --- |
| Semana 1 | 55 | 45 | 50 | `complexity=18`, `max-depth=5`, `max-params=5` |
| Semana 2 | 62 | 52 | 58 | `complexity=16`, `max-depth=4`, `max-params=5` |
| Semana 3 | 70 | 60 | 65 | `complexity=15`, `max-depth=4`, `max-params=4` |

## Convenciones de cambio
- Cambios funcionales relevantes: actualizar docs y pruebas en el mismo ciclo.
- Cambios en rutas o permisos: validar guardarrailes y diagramas.
- Cambios OMR/calificacion: incluir pruebas de regresion.
- Convencion de commits recomendada:
  - `feat:`
  - `fix:`
  - `refactor:`
  - `docs:`
  - `chore:`

## Proceso de release (mínimo)
1. Ejecutar contrato de calidad:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test:ci`
   - `npm run build`
2. Verificar pipeline contract:
   - `npm run pipeline:contract:check`
3. Actualizar `CHANGELOG.md` y publicar versión SemVer.
