# Flujo de examen

Flujo funcional vigente del sistema (2026-02-11).

## 1) Preparacion academica
- Crear materia/periodo.
- Registrar alumnos activos.
- Crear/editar banco de preguntas versionadas.

## 2) Plantilla de examen
- Crear plantilla de tipo `parcial` o `global`.
- Seleccionar preguntas directas o por temas.
- Definir numero de paginas e instrucciones.
- Previsualizar plantilla antes de generar.

## 3) Generacion de examen
- Generar examen individual o por lote.
- El backend produce:
  - PDF imprimible por examen.
  - `mapaVariante` (orden preguntas/opciones).
  - `mapaOmr` (coordenadas QR, fiduciales y burbujas).
  - `folio` unico por examen.

## 4) Aplicacion y entrega
- Imprimir y aplicar examen.
- Vincular examen entregado con alumno via folio/QR.
- Estado del examen: `generado` -> `entregado`.

## 5) Escaneo OMR
- Subir imagen por pagina (`/api/v2/omr/analizar`).
- El motor OMR:
  - detecta QR/pagina/template
  - corrige geometria (homografia o escala controlada)
  - evalua marcas y confianza por pregunta
  - calcula calidad de pagina y estado de analisis
- Resultado por pagina: respuestas detectadas + auditoria OMR.

## 6) Calificacion
- Endpoint: `/api/calificaciones/calificar`.
- Si se envian `respuestasDetectadas`, los aciertos se calculan desde OMR.
- Si no se envian, puede usarse captura manual.
- Se guarda:
  - aciertos y total
  - calificacion examen/final/parcial/global
  - auditoria OMR (`omrAuditoria`)
- Estado del examen: `entregado` -> `calificado`.

## 7) Analitica y exportacion
- Export CSV por periodo:
  - `GET /api/analiticas/calificaciones-csv?periodoId=...`
- Banderas y reportes de revision disponibles para seguimiento.

## 8) Publicacion y portal alumno
- Publicar resultados al portal cloud (`/api/sincronizaciones/publicar`).
- Generar codigo de acceso temporal (`/api/sincronizaciones/codigo-acceso`).
- Alumno consulta en portal con matricula + codigo.

## 9) Sincronizacion entre equipos
- Exportar paquete (`/api/sincronizaciones/paquete/exportar`).
- Importar paquete (`/api/sincronizaciones/paquete/importar`).
- Opcional: push/pull asincrono con servidor intermedio.

## Puntos de control de confiabilidad
- RBAC por permisos por endpoint.
- Validaciones strict de payload (Zod).
- Estado OMR con criterios de revision/rechazo.
- Suite automatizada de pruebas en backend, portal y frontend.
