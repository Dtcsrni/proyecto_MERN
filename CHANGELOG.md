# Changelog

Este archivo sigue el formato "Keep a Changelog" (alto nivel) y SemVer.

## [Unreleased] - 2026-02-13

### Added
- Documento de inventario técnico integral: `docs/INVENTARIO_PROYECTO.md`.
- Inventario exhaustivo de codigo/config versionado: `docs/INVENTARIO_CODIGO_EXHAUSTIVO.md`.
- Shell de UI docente extraído a `apps/frontend/src/apps/app_docente/ShellDocente.tsx`.
- Guía de operación para agentes IA: `AGENTS.md`.
- Documento de trazabilidad IA multi-sesion: `docs/IA_TRAZABILIDAD_AGENTES.md`.

### Changed
- Actualización integral de documentación raíz y técnica:
  - `README.md`
  - `docs/README.md`
  - `docs/FILES.md`
  - `docs/ENGINEERING_BASELINE.md`
  - `docs/DEVOPS_BASELINE.md`
  - `docs/VERSIONADO.md`
  - `docs/INVENTARIO_PROYECTO.md`
- Inventario de instrucciones IA ampliado para incluir `.github/copilot-instructions.md` como fuente activa de gobierno técnico para asistentes IDE.
- `AppDocente.tsx` reducido a 757 líneas (meta de partición progresiva).
- `SeccionBanco.tsx` reducido a 807 líneas (deuda residual documentada para cierre de Ola 1).
- Tests de comportamiento ajustados en frontend:
  - `apps/frontend/tests/plantillas.refactor.test.tsx`
  - `apps/frontend/tests/banco.refactor.test.tsx`
  - `apps/frontend/tests/escaneo.refactor.test.tsx`
- Comentarios de mantenimiento añadidos en componentes/servicios criticos:
  - `apps/frontend/src/apps/app_docente/AppDocente.tsx`
  - `apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx`
  - `apps/frontend/src/apps/app_docente/SeccionBanco.tsx`
  - `apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx`
  - `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts`

### Fixed
- Selectores ambiguos en pruebas de refactor (`Plantillas` y `Banco`) que generaban fallos falsos negativos.

### Notes
- Estado de gates del corte:
  - `lint`, `typecheck`, `test:frontend:ci`: verdes.
  - `test:coverage:ci`: con brecha abierta en cobertura frontend (detallada en `docs/INVENTARIO_PROYECTO.md`).

## [0.1.0] - 2026-01-15

- Monorepo inicial (backend, frontend, portal alumno cloud)
- Hardening base: Helmet, rate limit, sanitización NoSQL, no leakage de mensajes internos en producción
- Pruebas robustas: `test:ci` con reintentos + harness estricto para warnings/errores
