# Pruebas automatizadas

## Objetivo
Asegurar confiabilidad funcional y de seguridad del sistema completo en cada cambio.

## Politica TDD (obligatoria)
- Todo cambio funcional debe incluir prueba nueva o ajuste de regresion en el mismo PR.
- Se exige cobertura en lineas modificadas (`diff coverage`) con umbral minimo `90%`.
- Las exclusiones de cobertura solo se aceptan como deuda temporal con:
  - owner asignado,
  - fecha de expiracion,
  - razon tecnica,
  - registro en `docs/tdd-exclusions-debt.json`.
- El gate `test:coverage:exclusions:debt` falla si una deuda temporal vence.

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
- Subproyectos Vite legacy (`client/proyectos_vite/**`):
  - smoke estructural por proyecto (entrypoints + scripts minimos)

## CI modular por dominio
- Workflows independientes activos:
  - `.github/workflows/ci-backend.yml` (`CI Backend Module`)
  - `.github/workflows/ci-frontend.yml` (`CI Frontend Module`)
  - `.github/workflows/ci-portal.yml` (`CI Portal Module`)
  - `.github/workflows/ci-docs.yml` (`CI Docs Module`)
- Objetivo:
  - aislar fallos por dominio y mantener señal de calidad de los demas modulos.
- Comportamiento esperado:
  - si falla un modulo, los otros workflows siguen ejecutando y reportando resultado.
  - el workflow monolitico `CI Checks` permanece como gate integrador de compatibilidad global.
- Hardening aplicado:
  - `CI Backend Module` prepara runtime `sharp` en linux (`npm install --no-save --include=optional --os=linux --cpu=x64 sharp`) para evitar fallos de dependencias nativas.

## Proteccion de rama main (Ruleset)
- Ruleset activo: `main-v1b-minimo`.
- Alcance: `refs/heads/main`.
- Reglas activas:
  - bloqueo de borrado de rama (`deletion`),
  - bloqueo de force-push (`non_fast_forward`),
  - PR obligatorio con 1 aprobación mínima,
  - descarte de approvals stale al recibir nuevos commits,
  - resolucion obligatoria de conversaciones,
  - branch actualizado obligatoriamente antes de merge (`strict required status checks policy`).
- Check requerido para merge:
  - `Verificaciones Core (PR bloqueante)` (workflow integrador `CI Checks`).
- Nota operativa:
  - los workflows modulares por `paths` no se marcan como `required` para evitar PR bloqueados por checks no disparados.

## Flujos criticos cubiertos
- Flujo de examen end-to-end backend.
- Generacion/regeneracion de examenes y PDF.
- Vinculacion de entrega por folio.
- Escaneo QR/OMR y deteccion de mismatch.
- Calificacion y reglas de topes.
- Aislamiento entre docentes.
- Publicacion/sincronizacion hacia portal.
- Gate Extended OMR TV3 con dataset real (`omr_samples_tv3`).

## Criterio de calidad para release
Se considera candidato estable cuando pasan:
```bash
npm run test:ci
npm run test:flujo-docente:ci
npm run test:coverage:ci
npm run test:tdd:enforcement:ci
npm run test:client:proyectos:ci
npm run test:omr:tv3:gate:ci
npm run perf:check
npm run security:env:check
npm run security:audit
npm run test:portal
npm run test:frontend
npm run routes:check
npm run docs:check
npm run diagramas:check
npm run diagramas:render:check
npm run diagramas:consistencia:check
```

Adicional obligatorio para promover a estable:
- 10 corridas CI consecutivas en verde.
- evidencia de flujo docente humano en producción (`docs/release/evidencias/<version>/`).

## Criterio candidato v1b
Se considera candidato `v1b` cuando ademas de los gates funcionales se cumple:
- `CI Backend Module` en verde.
- `CI Frontend Module` en verde.
- `CI Portal Module` en verde.
- `CI Docs Module` en verde.
- `CI Checks` en verde.

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
- Smoke legacy client:
```bash
npm run test:client:smoke
```
- Smoke subproyectos Vite legacy:
```bash
npm run test:client:proyectos:ci
```
- Suite integrada raiz:
```bash
npm run test:ci
```

## Estado operativo actual
- El backend mantiene una bateria amplia de pruebas de contrato e integracion.
- OMR tiene pruebas unitarias especificas (doble marca, burbuja hueca, trazos lineales, colorimetria).
- Existen pruebas de integracion para QR/OMR y flujo de examen.
- OMR en produccion se considera TV3-only para auto-calificacion.

## Regla de mantenimiento
Todo cambio en:
- rutas,
- permisos,
- OMR,
- calificacion,
- sincronizacion,
debe acompanarse de prueba nueva o ajuste de regresion.
