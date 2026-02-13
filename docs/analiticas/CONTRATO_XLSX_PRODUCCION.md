# Contrato XLSX de Produccion (Calificaciones)

## Fuente de verdad usada
- Archivo: `Sistemas_Visuales_Enero-Febrero-2026.xlsx`
- Hoja contractual: `LIBRO DE CALIFICACIONES`
- Tabla Excel: `Calificaciones`
- Rango base de tabla detectado: `C10:AY14`

## Estructura del libro
1. Cabecera institucional con merges/estilos predefinidos en filas 1-9.
2. Encabezado de datos en fila 10.
3. Datos por alumno desde fila 11.
4. Formatos numéricos:
- Columnas de calificación: 1 o 2 decimales según estilo original.
- Base 10 final: columna `BA` con formato numérico.

## Columnas y semántica (C..BA)
- `C`: `Nombre del alumno`
- `D`: `Id. del alumno` (matrícula)
- `E`: `Correo Alumno`
- `AJ`: `Tareas y Ejercicios 1er Parcial (60%)`
- `AK`: `Practica 1er Parcial (40%)`
- `AL`: `Evaluación Continua 1er Parcial` (0..5)
- `AM`: `Exámen 1er Parcial` (0..5)
- `AN`: `Calificación Primer Parcial` (0..10)
- `AO`: `Tareas y Ejercicios 2do Parcial`
- `AP`: `Practica 2do Parcial`
- `AQ`: `Evaluación Continua 2do Parcial` (0..5)
- `AR`: `Exámen 2do Parcial` (0..5)
- `AS`: `Calificación Segundo Parcial` (0..10)
- `AT`: `Exámen Global` (0..5)
- `AU`: `Evaluación Continua 3er Parcial (Proyecto)` (0..5)
- `AV`: `Calificación Tercer Parcial` (0..10)
- `AW`: `Porcentaje 3er Parcial`
- `AX`: `Porcentaje 1er y Segundo Parcial`
- `AY`: `Porcentaje 1er y Segundo Parcial (ponderado)`
- `AZ`: `Calificación Final`
- `BA`: `Calificación Final (Base 10)`

## Fórmulas contractuales detectadas
- `AL = (((AJ*10/$AJ$7)*0.6 + AK*0.4)/1)*5/10`
- `AN = AL + AM`
- `AQ = (((AO*10/$AJ$8)*0.6 + AP*0.4)/1)*5/10`
- `AS = AQ + AR`
- `AV = AT + AU`
- `AW = (AV*5/10)*60/5`
- `AX = (AN*5)/10 + (AS*5)/10`
- `AY = (AX*5/10)*40/5`
- `AZ = AW + AY`
- `BA = AZ * 0.1`

## Mapeo a MongoDB actual
Colecciones:
- `alumnos`: nombre, matrícula, correo
- `calificaciones`: valores por examen parcial/global

Mapeo actual implementado para salida XLSX:
- `AL <- evaluacionContinuaTexto (parcial 1)`
- `AM <- calificacionExamenFinalTexto (parcial 1)`
- `AN <- calificacionParcialTexto (parcial 1)` o `AL+AM`
- `AQ <- evaluacionContinuaTexto (parcial 2)`
- `AR <- calificacionExamenFinalTexto (parcial 2)`
- `AS <- calificacionParcialTexto (parcial 2)` o `AQ+AR`
- `AT <- calificacionExamenFinalTexto (global)`
- `AU <- proyectoTexto (global)`
- `AV <- calificacionGlobalTexto (global)` o `AT+AU`
- `AW..BA` se recalculan con fórmula contractual.

Nota importante:
- Los campos de tareas/prácticas (`AJ`, `AK`, `AO`, `AP`) no existen hoy como datos persistidos explícitos en Mongo; por eso se preserva el layout 1:1 y se priorizan calificaciones consolidadas (`AL..AV`) provenientes de datos reales productivos.

## Endpoint contractual
- `GET /api/analiticas/calificaciones-xlsx?periodoId=<id>`
- Tipo: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Archivo: `calificaciones-produccion.xlsx`

## Criterios de validación
1. El archivo abre en Excel sin reparación.
2. Mantiene hoja `LIBRO DE CALIFICACIONES` y estilo base de plantilla.
3. Respeta fórmulas `AN..BA` para cada fila generada.
4. Las calificaciones de Mongo para parcial/global coinciden en columnas `AL..AV`.
