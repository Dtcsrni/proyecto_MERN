# Catalogo de Capacidades

> Documento auto-generado. No editar manualmente.
> Fecha de sincronizacion: **2026-02-27**

## Matriz por nivel

| Capacidad | Categoria | Edicion Comunitaria (AGPL) | Edicion Comercial | Edicion Institucional | Estado tecnico | Evidencia |
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
  Nivel minimo: Edicion Comunitaria (AGPL). Estado: activa. Evidencia: `tests/omr.contrato.test.ts`.
- **Vinculacion por QR y entregas** (`/entregas`)
  Nivel minimo: Edicion Comunitaria (AGPL). Estado: activa. Evidencia: `tests/integracion/flujoExamen.test.ts`.

## Calificacion

- **Analiticas y exportables** (`/analiticas`)
  Nivel minimo: Edicion Comercial. Estado: activa. Evidencia: `tests/analiticas.xlsx.sv.contract.test.ts`.
- **Calificacion global y reglas institucionales** (`/calificaciones`)
  Nivel minimo: Edicion Comunitaria (AGPL). Estado: activa. Evidencia: `tests/calificacion.global.reglas.test.ts`.
- **Politicas de evaluacion por periodo** (`/evaluaciones`)
  Nivel minimo: Edicion Comercial. Estado: activa. Evidencia: `tests/integracion/evaluaciones.modulo.test.ts`.

## Cumplimiento

- **Cumplimiento (ARCO/DSR, retencion y auditoria)** (`/compliance`)
  Nivel minimo: Edicion Institucional. Estado: activa. Evidencia: `tests/integracion/compliance.arco.test.ts`.

## Gobernanza

- **Administracion de docentes** (`/admin`)
  Nivel minimo: Edicion Institucional. Estado: activa. Evidencia: `apps/backend/src/modulos/modulo_admin_docentes`.

## Integraciones

- **Integracion con Google Classroom** (`/integraciones/classroom`)
  Nivel minimo: Edicion Comercial. Estado: activa. Evidencia: `tests/integracion/classroom.pull.test.ts`.

## Operacion Academica

- **Gestion de alumnos** (`/alumnos`)
  Nivel minimo: Edicion Comunitaria (AGPL). Estado: activa. Evidencia: `tests/integracion/alumnosEdicion.test.ts`.
- **Gestion de periodos y materias** (`/periodos`)
  Nivel minimo: Edicion Comunitaria (AGPL). Estado: activa. Evidencia: `tests/integracion/periodosBorradoDuplicados.test.ts`.

## Operacion Distribuida

- **Papelera y recuperacion de registros** (`/papelera`)
  Nivel minimo: Edicion Institucional. Estado: activa. Evidencia: `apps/backend/src/modulos/modulo_papelera`.
- **Sincronizacion local-cloud entre equipos** (`/sincronizaciones`)
  Nivel minimo: Edicion Comercial. Estado: activa. Evidencia: `tests/sincronizacion.contrato.test.ts`.

## Plataforma

- **Metricas Prometheus** (`/metrics`)
  Nivel minimo: Edicion Comercial. Estado: activa. Evidencia: `apps/backend/src/compartido/observabilidad/metrics.ts`.
- **Monitoreo de salud del sistema** (`/salud`)
  Nivel minimo: Edicion Comunitaria (AGPL). Estado: activa. Evidencia: `tests/salud.test.ts`.

## Preparacion de Examenes

- **Banco de preguntas y asignacion** (`/banco-preguntas`)
  Nivel minimo: Edicion Comunitaria (AGPL). Estado: activa. Evidencia: `tests/integracion/bancoPreguntasAsignarMateria.test.ts`.
- **Generacion de examenes PDF** (`/examenes`)
  Nivel minimo: Edicion Comunitaria (AGPL). Estado: activa. Evidencia: `tests/integracion/pdfImpresionContrato.test.ts`.

## Seguridad

- **Autenticacion docente y sesion segura** (`/autenticacion`)
  Nivel minimo: Edicion Comunitaria (AGPL). Estado: activa. Evidencia: `tests/integracion/autenticacionSesion.test.ts`.
