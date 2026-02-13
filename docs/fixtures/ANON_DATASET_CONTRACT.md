# Contrato de Dataset Anonimizado (Prod-like)

Este contrato define el formato mínimo y reglas de seguridad del fixture usado en `test:dataset-prodlike:ci`.

## Objetivo
- Simular cardinalidad/relaciones de producción sin exponer PII ni secretos.
- Mantener ejecución reproducible entre agentes y sesiones.

## Archivo canónico
- `tests/fixtures/prodlike/prodlike-anon.json.gz`

## Estructura mínima esperada
```json
{
  "version": "1",
  "periodos": [],
  "docentes": [],
  "alumnos": [],
  "bancoPreguntas": [],
  "plantillas": [],
  "examenes": [],
  "entregas": [],
  "calificaciones": []
}
```

## Reglas de anonimización obligatorias
- `correo` y equivalentes: `*@example.invalid`.
- `matricula`: prefijo `ANON`.
- `nombre`/`apellido`: valores sintéticos (`Anon ####`).
- Prohibido incluir secretos o tokens (`jwt`, `apiKey`, `password`, `secret`).

## Validación automática
- Script: `scripts/testing/validate-anon-fixture.mjs`
- Reporte: `reports/qa/latest/dataset-prodlike.json`
- Gate falla si detecta:
  - correos reales,
  - matrículas reales (`CUH...`),
  - tokens tipo JWT.

