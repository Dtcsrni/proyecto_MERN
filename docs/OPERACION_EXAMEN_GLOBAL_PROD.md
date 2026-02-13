# Operacion de Examen Global en Produccion

## Objetivo
Dejar una validacion falsable para habilitar el siguiente paso docente: generar examenes `global` por materia/curso usando banco de preguntas y plantilla activa.

## Precondiciones obligatorias
1. API docente accesible y autenticacion JWT funcional.
2. Materia/curso (`periodoId`) activo.
3. Al menos un alumno activo en la materia.
4. Banco de preguntas activo para esa materia.
5. Al menos una plantilla `global` activa en esa materia.
6. Permisos del docente:
- `banco:leer`
- `plantillas:leer`
- `examenes:generar`
- `examenes:descargar`
- `examenes:archivar` (solo para smoke)

## Comando de preflight (sin mutaciones)
```bash
npm run release:preflight:global -- \
  --api-base=https://api.midominio.com/api \
  --token=<jwt_docente> \
  --periodo-id=<periodoId> \
  --modo=readonly
```

## Smoke controlado (muta y limpia)
Genera un examen global y luego lo archiva.

```bash
npm run release:preflight:global -- \
  --api-base=https://api.midominio.com/api \
  --token=<jwt_docente> \
  --periodo-id=<periodoId> \
  --modo=smoke \
  --alumno-id=<alumnoId>
```

## Evidencia y regla Go/No-Go
Salida:
- `reports/qa/latest/preflight-global-prod.json`

Regla:
1. `estado = ok` y todos los checks en `ok` -> `GO`.
2. Cualquier check en `fallo` -> `NO-GO` (no avanzar a operacion docente).

## Integracion recomendada de release
Ejecutar antes del gate humano a estable:
1. `npm run test:global-grade:ci`
2. `npm run test:flujo-docente:ci`
3. `npm run test:pdf-print:ci`
4. `npm run release:preflight:global -- --api-base=<...> --token=<...> --periodo-id=<...> --modo=readonly`

Con esto se valida:
- calculo global,
- flujo docente parcial/global,
- contrato PDF,
- precondiciones de negocio para la materia real.
