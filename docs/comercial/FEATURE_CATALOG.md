# Catalogo de Capacidades

> Documento auto-generado. No editar manualmente.
> Fecha de sincronizacion: **2026-02-27**

## Matriz por tier

| Capacidad | Categoria | Free (AGPL) | Commercial Pro | Commercial Enterprise | Estado tecnico | Evidencia |
| --- | --- | --- | --- | --- | --- | --- |
| Monitoreo de salud del sistema (`/salud`) | Plataforma | Si | Si | Si | Activa | `tests/salud.test.ts` |
| Metricas Prometheus (`/metrics`) | Plataforma | No | Si | Si | Activa | `apps/backend/src/compartido/observabilidad/metrics.ts` |
| Autenticacion docente y sesion segura (`/autenticacion`) | Seguridad | Si | Si | Si | Activa | `tests/integracion/autenticacionSesion.test.ts` |
| Gestion de alumnos (`/alumnos`) | Operacion Academica | Si | Si | Si | Activa | `tests/integracion/alumnosEdicion.test.ts` |
| Gestion de periodos y materias (`/periodos`) | Operacion Academica | Si | Si | Si | Activa | `tests/integracion/periodosBorradoDuplicados.test.ts` |
| Banco de preguntas y asignacion (`/banco-preguntas`) | Preparacion de Examenes | Si | Si | Si | Activa | `tests/integracion/bancoPreguntasAsignarMateria.test.ts` |
| Generacion de examenes PDF (`/examenes`) | Preparacion de Examenes | Si | Si | Si | Activa | `tests/integracion/pdfImpresionContrato.test.ts` |
| Vinculacion por QR y entregas (`/entregas`) | Aplicacion y Captura | Si | Si | Si | Activa | `tests/integracion/flujoExamen.test.ts` |
| Lectura OMR y validacion de respuestas (`/omr`) | Aplicacion y Captura | Si | Si | Si | Activa | `tests/omr.contrato.test.ts` |
| Calificacion global y reglas institucionales (`/calificaciones`) | Calificacion | Si | Si | Si | Activa | `tests/calificacion.global.reglas.test.ts` |
| Analiticas y exportables (`/analiticas`) | Calificacion | No | Si | Si | Activa | `tests/analiticas.xlsx.sv.contract.test.ts` |
| Politicas de evaluacion por periodo (`/evaluaciones`) | Calificacion | No | Si | Si | Activa | `tests/integracion/evaluaciones.modulo.test.ts` |
| Integracion con Google Classroom (`/integraciones/classroom`) | Integraciones | No | Si | Si | Activa | `tests/integracion/classroom.pull.test.ts` |
| Sincronizacion local-cloud entre equipos (`/sincronizaciones`) | Operacion Distribuida | No | Si | Si | Activa | `tests/sincronizacion.contrato.test.ts` |
| Papelera y recuperacion de registros (`/papelera`) | Operacion Distribuida | No | No | Si | Activa | `apps/backend/src/modulos/modulo_papelera` |
| Cumplimiento (ARCO/DSR, retencion y auditoria) (`/compliance`) | Cumplimiento | No | No | Si | Activa | `tests/integracion/compliance.arco.test.ts` |
| Administracion de docentes (`/admin`) | Gobernanza | No | No | Si | Activa | `apps/backend/src/modulos/modulo_admin_docentes` |

## Aplicacion y Captura

- **Lectura OMR y validacion de respuestas** (`/omr`)
  Tier minimo: Free (AGPL). Estado: activa. Evidencia: `tests/omr.contrato.test.ts`.
- **Vinculacion por QR y entregas** (`/entregas`)
  Tier minimo: Free (AGPL). Estado: activa. Evidencia: `tests/integracion/flujoExamen.test.ts`.

## Calificacion

- **Analiticas y exportables** (`/analiticas`)
  Tier minimo: Commercial Pro. Estado: activa. Evidencia: `tests/analiticas.xlsx.sv.contract.test.ts`.
- **Calificacion global y reglas institucionales** (`/calificaciones`)
  Tier minimo: Free (AGPL). Estado: activa. Evidencia: `tests/calificacion.global.reglas.test.ts`.
- **Politicas de evaluacion por periodo** (`/evaluaciones`)
  Tier minimo: Commercial Pro. Estado: activa. Evidencia: `tests/integracion/evaluaciones.modulo.test.ts`.

## Cumplimiento

- **Cumplimiento (ARCO/DSR, retencion y auditoria)** (`/compliance`)
  Tier minimo: Commercial Enterprise. Estado: activa. Evidencia: `tests/integracion/compliance.arco.test.ts`.

## Gobernanza

- **Administracion de docentes** (`/admin`)
  Tier minimo: Commercial Enterprise. Estado: activa. Evidencia: `apps/backend/src/modulos/modulo_admin_docentes`.

## Integraciones

- **Integracion con Google Classroom** (`/integraciones/classroom`)
  Tier minimo: Commercial Pro. Estado: activa. Evidencia: `tests/integracion/classroom.pull.test.ts`.

## Operacion Academica

- **Gestion de alumnos** (`/alumnos`)
  Tier minimo: Free (AGPL). Estado: activa. Evidencia: `tests/integracion/alumnosEdicion.test.ts`.
- **Gestion de periodos y materias** (`/periodos`)
  Tier minimo: Free (AGPL). Estado: activa. Evidencia: `tests/integracion/periodosBorradoDuplicados.test.ts`.

## Operacion Distribuida

- **Papelera y recuperacion de registros** (`/papelera`)
  Tier minimo: Commercial Enterprise. Estado: activa. Evidencia: `apps/backend/src/modulos/modulo_papelera`.
- **Sincronizacion local-cloud entre equipos** (`/sincronizaciones`)
  Tier minimo: Commercial Pro. Estado: activa. Evidencia: `tests/sincronizacion.contrato.test.ts`.

## Plataforma

- **Metricas Prometheus** (`/metrics`)
  Tier minimo: Commercial Pro. Estado: activa. Evidencia: `apps/backend/src/compartido/observabilidad/metrics.ts`.
- **Monitoreo de salud del sistema** (`/salud`)
  Tier minimo: Free (AGPL). Estado: activa. Evidencia: `tests/salud.test.ts`.

## Preparacion de Examenes

- **Banco de preguntas y asignacion** (`/banco-preguntas`)
  Tier minimo: Free (AGPL). Estado: activa. Evidencia: `tests/integracion/bancoPreguntasAsignarMateria.test.ts`.
- **Generacion de examenes PDF** (`/examenes`)
  Tier minimo: Free (AGPL). Estado: activa. Evidencia: `tests/integracion/pdfImpresionContrato.test.ts`.

## Seguridad

- **Autenticacion docente y sesion segura** (`/autenticacion`)
  Tier minimo: Free (AGPL). Estado: activa. Evidencia: `tests/integracion/autenticacionSesion.test.ts`.
