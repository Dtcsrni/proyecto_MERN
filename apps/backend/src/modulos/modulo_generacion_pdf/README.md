# Modulo de Generacion de PDF

Estado actual: motor unico moderno TV3 sobre rutas canonicas `/api/examenes/*`.

## Arquitectura

Estructura:

```
modulo_generacion_pdf/
|- application/usecases/
|- domain/
|- infra/
|- shared/
|- controladorGeneracionPdf.ts
|- servicioGeneracionPdf.ts
```

Principios activos:
- Sin feature flags de adopcion.
- Sin motor paralelo antiguo.
- Contrato unico para layout/paginacion TV3.
- Sin compatibilidad de `totalReactivos` en modulo PDF.

## Contrato operativo

- Crear/editar plantilla: `POST /api/examenes/plantillas` y `POST /api/examenes/plantillas/:id`
- Generar examen: `POST /api/examenes/generados`
- Previsualizar: `GET /api/examenes/plantillas/:id/previsualizar`
- Previsualizar PDF: `GET /api/examenes/plantillas/:id/previsualizar/pdf`

## Variables de entorno

- `EXAMEN_LAYOUT_VERSION=3`
- `EXAMEN_LAYOUT_CONFIGURACION='{}'`

## Validacion recomendada

```bash
npm run lint
npm run typecheck
npm -C apps/backend run test -- tests/integracion/pdfImpresionContrato.test.ts
npm run qa:clean-architecture:strict
```

## Referencias

- `docs/ENGINEERING_BASELINE.md`
- `docs/INVENTARIO_PROYECTO.md`
- `scripts/clean-architecture-check.mjs`
