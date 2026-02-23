# modulo escaneo omr

Módulo de dominio del backend docente (rutas, controlador, servicios, modelos y validaciones).

Ruta: `apps/backend/src/modulos/modulo_escaneo_omr`.

## Archivos clave
- `controladorEscaneoOmr.ts`
- `omrCore.ts`
- `rutasEscaneoOmr.ts`
- `servicioOmr.ts`
- `validacionesOmr.ts`

## Reglas de mantenimiento
- Mantener cambios pequeños y trazables con pruebas/validación asociada.
- Actualizar documentación relacionada cuando cambie el comportamiento observable.
- Respetar multi-tenancy por docente y contratos de error/validación.

## Perfil geometrico operativo
- Variable principal: `OMR_GEOMETRY_PROFILE`.
- Valores soportados:
	- `actual` (default)
	- `geo_tight_search` (ganador del sweep geométrico)
- En `NODE_ENV=production`, cualquier perfil distinto de `actual` se ignora salvo que se defina `OMR_GEOMETRY_PROFILE_FORCE_PROD=true`.
- Overrides explícitos por variable (`OMR_ALIGN_RANGE`, `OMR_VERT_RANGE`, `OMR_LOCAL_SEARCH_RATIO`, `OMR_OFFSET_X`, `OMR_OFFSET_Y`) siguen teniendo prioridad sobre el perfil.

### Activación rápida
- `npm run dev:omr:geo-tight` inicia backend local con `geo_tight_search`.
- `npm run dev:omr:actual` inicia backend local con perfil base.

## Runtime OMR v2-only
- La fachada `servicioOmr.ts` ejecuta el pipeline OMR v2 de forma nominal.
- El motor operativo se mantiene en `servicioOmrV2.ts` y módulos `omr/*`.
- No existe fallback runtime a `servicioOmrLegacy`.

## Runtime CV (backend obligatorio)
- El preproceso CV de OMR TV3 usa backend `sharp`.
- No existe backend `simple`.
- Si el backend CV no está disponible, el backend falla en arranque (smoke test bloqueante).
- Verificación local:
  - `npm -C apps/backend run omr:cv:smoke`
  - `npm -C apps/backend run omr:tv3:eval:synthetic`

## Nota
- Este README fue generado automáticamente como base; ampliar con decisiones de diseño específicas del módulo cuando aplique.
