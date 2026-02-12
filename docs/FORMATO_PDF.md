# Formato PDF y OMR

Especificacion operativa del formato de examen y su lectura OMR.

## Formato de pagina
- Carta US (`612x792 pt`).
- Margen configurable (default 10 mm).
- QR por pagina con texto: `EXAMEN:<FOLIO>:P<n>[:TV<1|2>]`.
- Marcas de registro/fiduciales incluidas en layout.

## Plantillas OMR soportadas
- Template v1 (compatibilidad y menor densidad grafica).
- Template v2 (burbujas y QR mas robustos en captura real).
- Seleccion de template por estrategia interna de generacion.

## Mapa OMR persistido
Cada examen generado guarda `mapaOmr` con:
- perfil de template
- QR por pagina (posicion y tamano)
- marcas de pagina
- preguntas por pagina
- opciones por pregunta con coordenadas exactas
- fiduciales por bloque OMR

Esto permite que el escaneo no dependa de OCR libre, sino de geometria conocida.

## Pipeline OMR actual
1. Decodifica imagen y normaliza colorimetria.
2. Detecta QR y template.
3. Elige transformacion geometrica (QR/homografia/escala) con heuristica de coherencia.
4. Ajusta centros por fiduciales y caja OMR.
5. Evalua burbujas por rasgos fotometricos e hibridos.
6. Clasifica respuesta por pregunta (opcion/confianza).
7. Calcula calidad de pagina y estado de analisis:
   - `ok`
   - `requiere_revision`
   - `rechazado_calidad`

## Criterios de salida OMR
- `respuestasDetectadas`: arreglo por pregunta.
- `confianzaPromedioPagina` y `ratioAmbiguas`.
- `calidadPagina` en rango `[0,1]`.
- `motivosRevision` y `advertencias` para trazabilidad.

## Consideraciones operativas
- OMR puede degradarse por desenfoque, distorsion severa, contraste pobre o recortes.
- El sistema mantiene modo de revision manual cuando la calidad no permite auto-calificar con seguridad.
- La calificacion final usa `mapaVariante` para comparar respuestas detectadas contra clave correcta real.
