# Inventario Exhaustivo de Codigo

Fecha de generacion: 2026-02-13 06:19:14
Fuente: git ls-files (solo archivos versionados, excluye node_modules).

## Resumen

- Total de piezas de codigo/config ejecutable inventariadas: 391
- Extensiones incluidas: ts, tsx, js, jsx, mjs, cjs, json, yml, yaml, sh, cmd, ps1.

## Conteo por area

| Area | Archivos |
| --- | ---: |
| backend | 159 |
| frontend | 80 |
| portal_alumno_cloud | 32 |
| ci | 3 |
| scripts | 29 |
| ops | 3 |
| docs | 3 |
| raiz | 6 |

## Backend (apps/backend)

- apps/backend/.eslintrc.cjs
- apps/backend/package.json
- apps/backend/scripts/debugCrearPeriodo.ts
- apps/backend/scripts/omr_calibrate.js
- apps/backend/scripts/omr-map.ts
- apps/backend/scripts/omr-run.ts
- apps/backend/scripts/omr-validate-api.js
- apps/backend/scripts/omr-validate.ts
- apps/backend/src/app.ts
- apps/backend/src/compartido/errores/errorAplicacion.ts
- apps/backend/src/compartido/errores/manejadorErrores.ts
- apps/backend/src/compartido/observabilidad/metrics.ts
- apps/backend/src/compartido/observabilidad/middlewareObservabilidad.ts
- apps/backend/src/compartido/salud/rutasSalud.ts
- apps/backend/src/compartido/tipos/dominio.ts
- apps/backend/src/compartido/tipos/jsqr.d.ts
- apps/backend/src/compartido/tipos/observabilidad.ts
- apps/backend/src/compartido/tipos/release.ts
- apps/backend/src/compartido/utilidades/aleatoriedad.ts
- apps/backend/src/compartido/utilidades/calculoCalificacion.ts
- apps/backend/src/compartido/utilidades/correo.ts
- apps/backend/src/compartido/utilidades/texto.ts
- apps/backend/src/compartido/validaciones/esquemas.ts
- apps/backend/src/compartido/validaciones/validar.ts
- apps/backend/src/configuracion.ts
- apps/backend/src/index.ts
- apps/backend/src/infraestructura/archivos/almacenLocal.ts
- apps/backend/src/infraestructura/baseDatos/mongoose.ts
- apps/backend/src/infraestructura/correo/servicioCorreo.ts
- apps/backend/src/infraestructura/logging/logger.ts
- apps/backend/src/infraestructura/seguridad/rbac.ts
- apps/backend/src/infraestructura/seguridad/sanitizarMongo.ts
- apps/backend/src/modulos/modulo_admin_docentes/controladorAdminDocentes.ts
- apps/backend/src/modulos/modulo_admin_docentes/rutasAdminDocentes.ts
- apps/backend/src/modulos/modulo_admin_docentes/validacionesAdminDocentes.ts
- apps/backend/src/modulos/modulo_alumnos/controladorAlumnos.ts
- apps/backend/src/modulos/modulo_alumnos/controladorPeriodos.ts
- apps/backend/src/modulos/modulo_alumnos/modeloAlumno.ts
- apps/backend/src/modulos/modulo_alumnos/modeloPeriodo.ts
- apps/backend/src/modulos/modulo_alumnos/rutasAlumnos.ts
- apps/backend/src/modulos/modulo_alumnos/rutasPeriodos.ts
- apps/backend/src/modulos/modulo_alumnos/validacionesAlumnos.ts
- apps/backend/src/modulos/modulo_alumnos/validacionesPeriodos.ts
- apps/backend/src/modulos/modulo_analiticas/controladorAnaliticas.ts
- apps/backend/src/modulos/modulo_analiticas/modeloBanderaRevision.ts
- apps/backend/src/modulos/modulo_analiticas/modeloEventoUso.ts
- apps/backend/src/modulos/modulo_analiticas/rutasAnaliticas.ts
- apps/backend/src/modulos/modulo_analiticas/servicioExportacionCsv.ts
- apps/backend/src/modulos/modulo_analiticas/servicioExportacionDocx.ts
- apps/backend/src/modulos/modulo_analiticas/servicioFirmaIntegridad.ts
- apps/backend/src/modulos/modulo_analiticas/servicioListaAcademica.ts
- apps/backend/src/modulos/modulo_analiticas/tiposListaAcademica.ts
- apps/backend/src/modulos/modulo_analiticas/validacionesAnaliticas.ts
- apps/backend/src/modulos/modulo_analiticas/validacionesEventosUso.ts
- apps/backend/src/modulos/modulo_autenticacion/controladorAutenticacion.ts
- apps/backend/src/modulos/modulo_autenticacion/middlewareAutenticacion.ts
- apps/backend/src/modulos/modulo_autenticacion/middlewarePermisos.ts
- apps/backend/src/modulos/modulo_autenticacion/modeloDocente.ts
- apps/backend/src/modulos/modulo_autenticacion/modeloSesionDocente.ts
- apps/backend/src/modulos/modulo_autenticacion/rutasAutenticacion.ts
- apps/backend/src/modulos/modulo_autenticacion/seedAdmin.ts
- apps/backend/src/modulos/modulo_autenticacion/servicioGoogle.ts
- apps/backend/src/modulos/modulo_autenticacion/servicioHash.ts
- apps/backend/src/modulos/modulo_autenticacion/servicioSesiones.ts
- apps/backend/src/modulos/modulo_autenticacion/servicioTokens.ts
- apps/backend/src/modulos/modulo_autenticacion/validacionesAutenticacion.ts
- apps/backend/src/modulos/modulo_banco_preguntas/controladorBancoPreguntas.ts
- apps/backend/src/modulos/modulo_banco_preguntas/modeloBancoPregunta.ts
- apps/backend/src/modulos/modulo_banco_preguntas/modeloTemaBanco.ts
- apps/backend/src/modulos/modulo_banco_preguntas/rutasBancoPreguntas.ts
- apps/backend/src/modulos/modulo_banco_preguntas/validacionesBancoPreguntas.ts
- apps/backend/src/modulos/modulo_calificacion/controladorCalificacion.ts
- apps/backend/src/modulos/modulo_calificacion/modeloCalificacion.ts
- apps/backend/src/modulos/modulo_calificacion/rutasCalificaciones.ts
- apps/backend/src/modulos/modulo_calificacion/servicioCalificacion.ts
- apps/backend/src/modulos/modulo_calificacion/validacionesCalificacion.ts
- apps/backend/src/modulos/modulo_escaneo_omr/controladorEscaneoOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/omrCore.ts
- apps/backend/src/modulos/modulo_escaneo_omr/rutasEscaneoOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts
- apps/backend/src/modulos/modulo_escaneo_omr/validacionesOmr.ts
- apps/backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts
- apps/backend/src/modulos/modulo_generacion_pdf/controladorListadoGenerados.ts
- apps/backend/src/modulos/modulo_generacion_pdf/modeloExamenGenerado.ts
- apps/backend/src/modulos/modulo_generacion_pdf/modeloExamenPlantilla.ts
- apps/backend/src/modulos/modulo_generacion_pdf/rutasGeneracionPdf.ts
- apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts
- apps/backend/src/modulos/modulo_generacion_pdf/servicioVariantes.ts
- apps/backend/src/modulos/modulo_generacion_pdf/validacionesExamenes.ts
- apps/backend/src/modulos/modulo_papelera/controladorPapelera.ts
- apps/backend/src/modulos/modulo_papelera/modeloPapelera.ts
- apps/backend/src/modulos/modulo_papelera/rutasPapelera.ts
- apps/backend/src/modulos/modulo_papelera/servicioPapelera.ts
- apps/backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts
- apps/backend/src/modulos/modulo_sincronizacion_nube/modeloCodigoAcceso.ts
- apps/backend/src/modulos/modulo_sincronizacion_nube/modeloSincronizacion.ts
- apps/backend/src/modulos/modulo_sincronizacion_nube/rutasSincronizacionNube.ts
- apps/backend/src/modulos/modulo_sincronizacion_nube/validacionesSincronizacion.ts
- apps/backend/src/modulos/modulo_vinculacion_entrega/controladorVinculacionEntrega.ts
- apps/backend/src/modulos/modulo_vinculacion_entrega/modeloEntrega.ts
- apps/backend/src/modulos/modulo_vinculacion_entrega/rutasVinculacionEntrega.ts
- apps/backend/src/modulos/modulo_vinculacion_entrega/validacionesVinculacion.ts
- apps/backend/src/rutas.ts
- apps/backend/storage/omr_patches/24255CF0/P1/metadata.json
- apps/backend/storage/omr_patches/24255CF0/P2/metadata.json
- apps/backend/storage/omr_patches/364207B6/P1/metadata.json
- apps/backend/storage/omr_patches/364207B6/P2/metadata.json
- apps/backend/storage/omr_patches/41E11592/P1/metadata.json
- apps/backend/storage/omr_patches/41E11592/P2/metadata.json
- apps/backend/storage/omr_patches/44FB6D76/P1/metadata.json
- apps/backend/storage/omr_patches/44FB6D76/P2/metadata.json
- apps/backend/storage/omr_patches/4ABDD6B5/P1/metadata.json
- apps/backend/storage/omr_patches/4ABDD6B5/P2/metadata.json
- apps/backend/storage/omr_patches/D9037A8E/P1/metadata.json
- apps/backend/storage/omr_patches/D9037A8E/P2/metadata.json
- apps/backend/storage/omr_patches/EDCD030C/P1/metadata.json
- apps/backend/storage/omr_patches/EDCD030C/P2/metadata.json
- apps/backend/storage/omr_patches/F531C7E6/P1/metadata.json
- apps/backend/storage/omr_patches/F531C7E6/P2/metadata.json
- apps/backend/tests/aleatoriedad.test.ts
- apps/backend/tests/autenticacionServicios.test.ts
- apps/backend/tests/baseDatos.test.ts
- apps/backend/tests/calificacion.test.ts
- apps/backend/tests/configuracion.test.ts
- apps/backend/tests/contrato/limitesPayload.test.ts
- apps/backend/tests/contrato/validaciones.test.ts
- apps/backend/tests/correo.test.ts
- apps/backend/tests/csv.test.ts
- apps/backend/tests/errores.test.ts
- apps/backend/tests/infraestructura.test.ts
- apps/backend/tests/integracion/_flujoDocenteHelper.ts
- apps/backend/tests/integracion/aislamientoDocente.test.ts
- apps/backend/tests/integracion/alumnosEdicion.test.ts
- apps/backend/tests/integracion/archivarExamenGenerado.test.ts
- apps/backend/tests/integracion/autenticacionSesion.test.ts
- apps/backend/tests/integracion/autorizacion.test.ts
- apps/backend/tests/integracion/bancoPreguntasAsignarMateria.test.ts
- apps/backend/tests/integracion/calificacionOmrPrioridad.test.ts
- apps/backend/tests/integracion/flujoDocenteGlobalE2E.test.ts
- apps/backend/tests/integracion/flujoDocenteParcialE2E.test.ts
- apps/backend/tests/integracion/flujoExamen.test.ts
- apps/backend/tests/integracion/listaAcademicaContratos.test.ts
- apps/backend/tests/integracion/periodosBorradoDuplicados.test.ts
- apps/backend/tests/integracion/plantillasCrudYPreview.test.ts
- apps/backend/tests/integracion/qrEscaneoOmr.test.ts
- apps/backend/tests/integracion/regenerarExamenGenerado.test.ts
- apps/backend/tests/integracion/rolesPermisos.test.ts
- apps/backend/tests/omr.test.ts
- apps/backend/tests/rateLimit.test.ts
- apps/backend/tests/salud.test.ts
- apps/backend/tests/sanitizarMongo.test.ts
- apps/backend/tests/setup.ts
- apps/backend/tests/sincronizacion.test.ts
- apps/backend/tests/utils/mongo.ts
- apps/backend/tests/utils/token.ts
- apps/backend/tests/validar.test.ts
- apps/backend/tests/variantes.test.ts
- apps/backend/tsconfig.json
- apps/backend/vitest.config.ts

## Frontend (apps/frontend)

- apps/frontend/.eslintrc.cjs
- apps/frontend/package-lock.json
- apps/frontend/package.json
- apps/frontend/public/portal-sw.js
- apps/frontend/src/App.tsx
- apps/frontend/src/apps/app_alumno/AppAlumno.tsx
- apps/frontend/src/apps/app_docente/AppDocente.tsx
- apps/frontend/src/apps/app_docente/AyudaFormulario.tsx
- apps/frontend/src/apps/app_docente/clienteApiDocente.ts
- apps/frontend/src/apps/app_docente/features/banco/components/BancoAjustePreguntas.tsx
- apps/frontend/src/apps/app_docente/features/banco/components/BancoFormularioPregunta.tsx
- apps/frontend/src/apps/app_docente/features/banco/components/BancoGestionTemas.tsx
- apps/frontend/src/apps/app_docente/features/banco/components/BancoListadoPreguntas.tsx
- apps/frontend/src/apps/app_docente/features/banco/components/types.ts
- apps/frontend/src/apps/app_docente/features/banco/hooks/useBancoAjustes.ts
- apps/frontend/src/apps/app_docente/features/banco/hooks/useBancoPreguntas.ts
- apps/frontend/src/apps/app_docente/features/banco/hooks/useBancoTemas.ts
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasFormulario.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasGenerados.tsx
- apps/frontend/src/apps/app_docente/features/plantillas/components/PlantillasListado.tsx
- apps/frontend/src/apps/app_docente/hooks/usePermisosDocente.ts
- apps/frontend/src/apps/app_docente/hooks/useSesionDocente.ts
- apps/frontend/src/apps/app_docente/mensajeInline.ts
- apps/frontend/src/apps/app_docente/QrAccesoMovil.tsx
- apps/frontend/src/apps/app_docente/SeccionAlumnos.tsx
- apps/frontend/src/apps/app_docente/SeccionAutenticacion.tsx
- apps/frontend/src/apps/app_docente/SeccionBanco.helpers.ts
- apps/frontend/src/apps/app_docente/SeccionBanco.tsx
- apps/frontend/src/apps/app_docente/SeccionCalificaciones.tsx
- apps/frontend/src/apps/app_docente/SeccionCalificar.tsx
- apps/frontend/src/apps/app_docente/SeccionCuenta.tsx
- apps/frontend/src/apps/app_docente/SeccionEntregaInterna.tsx
- apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx
- apps/frontend/src/apps/app_docente/SeccionPaqueteSincronizacion.tsx
- apps/frontend/src/apps/app_docente/SeccionPeriodos.tsx
- apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx
- apps/frontend/src/apps/app_docente/SeccionPublicar.tsx
- apps/frontend/src/apps/app_docente/SeccionRegistroEntrega.tsx
- apps/frontend/src/apps/app_docente/SeccionSincronizacion.tsx
- apps/frontend/src/apps/app_docente/SeccionSincronizacionEquipos.tsx
- apps/frontend/src/apps/app_docente/services/bancoApi.ts
- apps/frontend/src/apps/app_docente/ShellDocente.tsx
- apps/frontend/src/apps/app_docente/telemetriaDocente.ts
- apps/frontend/src/apps/app_docente/tipos.ts
- apps/frontend/src/apps/app_docente/utilidades.ts
- apps/frontend/src/main.tsx
- apps/frontend/src/pwa.ts
- apps/frontend/src/servicios_api/clienteApi.ts
- apps/frontend/src/servicios_api/clienteComun.ts
- apps/frontend/src/servicios_api/clientePortal.ts
- apps/frontend/src/tema/tema.ts
- apps/frontend/src/tema/TemaBoton.tsx
- apps/frontend/src/tema/TemaProvider.tsx
- apps/frontend/src/tipos/jsqr.d.ts
- apps/frontend/src/tipos/observabilidad.ts
- apps/frontend/src/ui/errores/ErrorBoundary.tsx
- apps/frontend/src/ui/iconos.tsx
- apps/frontend/src/ui/toast/toastBus.ts
- apps/frontend/src/ui/toast/ToastProvider.tsx
- apps/frontend/src/ui/ux/componentes/Boton.tsx
- apps/frontend/src/ui/ux/componentes/CampoTexto.tsx
- apps/frontend/src/ui/ux/componentes/InlineMensaje.tsx
- apps/frontend/src/ui/ux/sesion.ts
- apps/frontend/src/ui/ux/tooltip/TooltipLayer.tsx
- apps/frontend/tests/appAlumno.test.tsx
- apps/frontend/tests/appDocente.secciones.test.tsx
- apps/frontend/tests/appDocente.test.tsx
- apps/frontend/tests/banco.refactor.test.tsx
- apps/frontend/tests/clienteApi.test.tsx
- apps/frontend/tests/clienteComun.test.ts
- apps/frontend/tests/clienteComunMensajes.test.ts
- apps/frontend/tests/clientePortal.test.tsx
- apps/frontend/tests/escaneo.refactor.test.tsx
- apps/frontend/tests/mensajeInline.test.ts
- apps/frontend/tests/plantillas.refactor.test.tsx
- apps/frontend/tests/setup.ts
- apps/frontend/tsconfig.json
- apps/frontend/tsconfig.node.json
- apps/frontend/vite.config.ts
- apps/frontend/vitest.config.ts

## Portal (apps/portal_alumno_cloud)

- apps/portal_alumno_cloud/.eslintrc.cjs
- apps/portal_alumno_cloud/package.json
- apps/portal_alumno_cloud/src/app.ts
- apps/portal_alumno_cloud/src/compartido/errores/manejadorErrores.ts
- apps/portal_alumno_cloud/src/configuracion.ts
- apps/portal_alumno_cloud/src/index.ts
- apps/portal_alumno_cloud/src/infraestructura/baseDatos/mongoose.ts
- apps/portal_alumno_cloud/src/infraestructura/logging/logger.ts
- apps/portal_alumno_cloud/src/infraestructura/observabilidad/metrics.ts
- apps/portal_alumno_cloud/src/infraestructura/observabilidad/middlewareObservabilidad.ts
- apps/portal_alumno_cloud/src/infraestructura/seguridad/sanitizarMongo.ts
- apps/portal_alumno_cloud/src/modelos/modeloCodigoAcceso.ts
- apps/portal_alumno_cloud/src/modelos/modeloEventoUsoAlumno.ts
- apps/portal_alumno_cloud/src/modelos/modeloPaqueteSyncDocente.ts
- apps/portal_alumno_cloud/src/modelos/modeloResultadoAlumno.ts
- apps/portal_alumno_cloud/src/modelos/modeloSesionAlumno.ts
- apps/portal_alumno_cloud/src/rutas.ts
- apps/portal_alumno_cloud/src/servicios/middlewareSesion.ts
- apps/portal_alumno_cloud/src/servicios/servicioSesion.ts
- apps/portal_alumno_cloud/tests/apiKey.test.ts
- apps/portal_alumno_cloud/tests/contrato/validaciones.test.ts
- apps/portal_alumno_cloud/tests/errores.test.ts
- apps/portal_alumno_cloud/tests/integracion/portal.test.ts
- apps/portal_alumno_cloud/tests/middlewareSesion.test.ts
- apps/portal_alumno_cloud/tests/rateLimit.test.ts
- apps/portal_alumno_cloud/tests/salud.test.ts
- apps/portal_alumno_cloud/tests/sanitizarMongo.test.ts
- apps/portal_alumno_cloud/tests/sesion.test.ts
- apps/portal_alumno_cloud/tests/setup.ts
- apps/portal_alumno_cloud/tests/utils/mongo.ts
- apps/portal_alumno_cloud/tsconfig.json
- apps/portal_alumno_cloud/vitest.config.ts

## CI/CD (ci + .github/workflows)

- .github/workflows/ci.yml
- .github/workflows/package.yml
- ci/pipeline.matrix.json

## Scripts (scripts)

- scripts/contrast-check.mjs
- scripts/create-shortcuts.ps1
- scripts/dashboard-sw.js
- scripts/dashboard.mjs
- scripts/detect-host-ip.mjs
- scripts/diagramas-consistencia.mjs
- scripts/diagramas-render.mjs
- scripts/diagramas.mjs
- scripts/docs.mjs
- scripts/ensure-dev-cert.ps1
- scripts/ia-handoff.mjs
- scripts/import-backup.mjs
- scripts/launch-dev.cmd
- scripts/launch-prod.cmd
- scripts/launcher-dashboard.mjs
- scripts/launcher-dashboard.ps1
- scripts/launcher-tray.ps1
- scripts/perf-baseline.mjs
- scripts/perf-check.mjs
- scripts/perf-collect.ts
- scripts/release/gate-prod-flow.mjs
- scripts/reset-local.mjs
- scripts/retry.mjs
- scripts/routes-check.mjs
- scripts/security-env-check.mjs
- scripts/start-tray.mjs
- scripts/vscode-prune-extensions.mjs
- scripts/vscode-tune.mjs
- scripts/wait-api.mjs

## Observabilidad/Ops (ops)

- ops/observabilidad/alert.rules.yml
- ops/observabilidad/grafana/dashboard-evaluapro.json
- ops/observabilidad/prometheus.yml

## Documentacion tecnica/contractual (docs)

- docs/diagramas/mermaid.config.json
- docs/perf/baseline.json
- docs/release/manual/prod-flow.template.json

## Raiz del repositorio

- .eslintrc.cjs
- docker-compose.yml
- package-lock.json
- package.json
- tsconfig.base.json
- vitest.base.ts
