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

## Runtime OMR único
- La fachada `servicioOmr.ts` ejecuta el pipeline OMR CV TV3.
- El motor operativo se mantiene en `servicioOmrCv.ts` y módulos `omr/*`.
- No existe fallback runtime alterno.

## Runtime CV (backend obligatorio)
- El preproceso CV de OMR TV3 es obligatorio en runtime.
- No existe backend alterno ni fallback `simple`.
- Si el backend CV no está disponible, el backend falla en arranque (smoke test bloqueante).
- Verificación local:
  - `npm -C apps/backend run omr:cv:smoke`
  - `npm -C apps/backend run omr:tv3:eval:synthetic`
  - `npm -C apps/backend run omr:tv3:validate:real -- --dataset ../../omr_samples_tv3_real`

## Gate mixto (release)
- Gate sintético: `omr:tv3:eval:synthetic` (guardrail de regresión controlada).
- Gate real: `omr:tv3:validate:real` (criterio principal de autocalificación confiable).
- Ambos son bloqueantes en CI backend.

## Troubleshooting rápido
- `falsePositiveRate` alto:
  - revisar `OMR_RESPUESTA_CONF_MIN`, `OMR_SCORE_MIN`, `OMR_DELTA_MIN`.
- `autoGradeTrustRate` bajo:
  - revisar `OMR_AUTO_CONF_MIN`, `OMR_AUTO_AMBIGUAS_MAX`, `OMR_AUTO_DETECCION_MIN`.
- `fuera_roi` o errores geométricos:
  - revisar `OMR_ALIGN_RANGE`, `OMR_VERT_RANGE`, rescate de fiduciales y perfil de geometría.

## Nota
- Este README fue generado automáticamente como base; ampliar con decisiones de diseño específicas del módulo cuando aplique.
