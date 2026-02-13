/**
 * App docente: panel basico para banco, examenes, entrega y calificacion.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guardarTokenDocente, limpiarTokenDocente, obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { accionToastSesionParaError, mensajeUsuarioDeErrorConSugerencia, onSesionInvalidada } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { TemaBoton } from '../../tema/TemaBoton';
import { AyudaFormulario } from '../app_docente/AyudaFormulario';
import { clienteApi } from '../app_docente/clienteApiDocente';
import { SeccionAutenticacion } from '../app_docente/SeccionAutenticacion';
import { SeccionAlumnos } from '../app_docente/SeccionAlumnos';
import { SeccionBanco } from '../app_docente/SeccionBanco';
import { SeccionCuenta } from '../app_docente/SeccionCuenta';
import { QrAccesoMovil, SeccionEscaneo } from '../app_docente/SeccionEscaneo';
import { SeccionPlantillas } from '../app_docente/SeccionPlantillas';
import { SeccionPeriodos, SeccionPeriodosArchivados } from '../app_docente/SeccionPeriodos';
import { registrarAccionDocente } from '../app_docente/telemetriaDocente';
import type {
  Alumno,
  Docente,
  EnviarConPermiso,
  ExamenGeneradoClave,
  Periodo,
  PermisosUI,
  Plantilla,
  Pregunta,
  PreviewCalificacion,
  PreviewPlantilla,
  RegistroSincronizacion,
  RespuestaSyncPull,
  RespuestaSyncPush,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RevisionExamenOmr,
  RevisionPaginaOmr
} from '../app_docente/tipos';
import {
  combinarRespuestasOmrPaginas,
  construirClaveCorrectaExamen,
  consolidarResultadoOmrExamen,
  esMensajeError,
  etiquetaMateria,
  mensajeDeError,
  normalizarResultadoOmr,
  obtenerSesionDocenteId,
  obtenerVistaInicial,
} from '../app_docente/utilidades';


export function AppDocente() {
  const [docente, setDocente] = useState<Docente | null>(null);
  const [vista, setVista] = useState(obtenerVistaInicial());
  const esDev = import.meta.env.DEV;
  const esAdmin = Boolean(docente?.roles?.includes('admin'));
  const permisosDocente = useMemo(() => new Set(docente?.permisos ?? []), [docente?.permisos]);
  const puede = useCallback((permiso: string) => permisosDocente.has(permiso), [permisosDocente]);
  const permisosUI = useMemo(
    () => ({
      periodos: {
        leer: puede('periodos:leer'),
        gestionar: puede('periodos:gestionar'),
        archivar: puede('periodos:archivar')
      },
      alumnos: {
        leer: puede('alumnos:leer'),
        gestionar: puede('alumnos:gestionar')
      },
      banco: {
        leer: puede('banco:leer'),
        gestionar: puede('banco:gestionar'),
        archivar: puede('banco:archivar')
      },
      plantillas: {
        leer: puede('plantillas:leer'),
        gestionar: puede('plantillas:gestionar'),
        archivar: puede('plantillas:archivar'),
        previsualizar: puede('plantillas:previsualizar')
      },
      examenes: {
        leer: puede('examenes:leer'),
        generar: puede('examenes:generar'),
        archivar: puede('examenes:archivar'),
        regenerar: puede('examenes:regenerar'),
        descargar: puede('examenes:descargar')
      },
      entregas: { gestionar: puede('entregas:gestionar') },
      omr: { analizar: puede('omr:analizar') },
      calificaciones: { calificar: puede('calificaciones:calificar') },
      publicar: { publicar: puede('calificaciones:publicar') },
      sincronizacion: {
        listar: puede('sincronizacion:listar'),
        exportar: puede('sincronizacion:exportar'),
        importar: puede('sincronizacion:importar'),
        push: puede('sincronizacion:push'),
        pull: puede('sincronizacion:pull')
      },
      cuenta: { leer: puede('cuenta:leer'), actualizar: puede('cuenta:actualizar') }
    }),
    [puede]
  );
  const puedeEliminarPlantillaDev = esDev && esAdmin && puede('plantillas:eliminar_dev');
  const puedeEliminarMateriaDev = esDev && esAdmin && puede('periodos:eliminar_dev');
  const puedeEliminarAlumnoDev = esDev && esAdmin && puede('alumnos:eliminar_dev');
  const avisarSinPermiso = useCallback((mensaje: string) => {
    emitToast({ level: 'warn', title: 'Sin permisos', message: mensaje, durationMs: 4200 });
  }, []);
  const enviarConPermiso = useCallback(
    <T,>(
      permiso: string,
      ruta: string,
      payload: unknown,
      mensaje: string,
      opciones?: { timeoutMs?: number }
    ): Promise<T> => {
      if (!puede(permiso)) {
        avisarSinPermiso(mensaje);
        return Promise.reject(new Error('SIN_PERMISO'));
      }
      return clienteApi.enviar(ruta, payload, opciones);
    },
    [avisarSinPermiso, puede]
  );
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodosArchivados, setPeriodosArchivados] = useState<Periodo[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [previewPorPlantillaId, setPreviewPorPlantillaId] = useState<Record<string, PreviewPlantilla>>({});
  const [cargandoPreviewPlantillaId, setCargandoPreviewPlantillaId] = useState<string | null>(null);
  const [plantillaPreviewId, setPlantillaPreviewId] = useState<string | null>(null);
  const [previewPdfUrlPorPlantillaId, setPreviewPdfUrlPorPlantillaId] = useState<Record<string, string>>({});
  const [cargandoPreviewPdfPlantillaId, setCargandoPreviewPdfPlantillaId] = useState<string | null>(null);
  const paginasEstimadasBackendPorTema = useMemo(() => {
    const mapa = new Map<string, number>();
    const listaPlantillas = Array.isArray(plantillas) ? plantillas : [];
    for (const plantilla of listaPlantillas) {
      const temas = Array.isArray((plantilla as unknown as { temas?: unknown[] }).temas)
        ? (((plantilla as unknown as { temas?: unknown[] }).temas ?? []) as unknown[])
            .map((t) => String(t ?? '').trim())
            .filter(Boolean)
        : [];
      if (temas.length !== 1) continue;
      const preview = previewPorPlantillaId[plantilla._id];
      if (!preview) continue;
      const paginas = Number((preview as { numeroPaginas?: unknown }).numeroPaginas);
      if (!Number.isFinite(paginas) || paginas <= 0) continue;
      const key = String(temas[0] ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
      mapa.set(key, Math.floor(paginas));
    }
    return mapa;
  }, [plantillas, previewPorPlantillaId]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [resultadoOmr, setResultadoOmr] = useState<ResultadoOmr | null>(null);
  const [respuestasEditadas, setRespuestasEditadas] = useState<
    Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>
  >([]);
  const [revisionOmrConfirmada, setRevisionOmrConfirmada] = useState(false);
  const [examenIdOmr, setExamenIdOmr] = useState<string | null>(null);
  const [examenAlumnoId, setExamenAlumnoId] = useState<string | null>(null);
  const [paginaOmrActiva, setPaginaOmrActiva] = useState<number | null>(null);
  const [revisionesOmr, setRevisionesOmr] = useState<RevisionExamenOmr[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [ultimaActualizacionDatos, setUltimaActualizacionDatos] = useState<number | null>(null);

  function cerrarSesion() {
    // Best-effort: limpia refresh token server-side.
    void clienteApi.enviar('/autenticacion/salir', {});
    limpiarTokenDocente();
    setDocente(null);
    emitToast({ level: 'info', title: 'Sesion', message: 'Sesion cerrada', durationMs: 2200 });
    registrarAccionDocente('logout', true);
  }

  useEffect(() => {
    return onSesionInvalidada((tipo) => {
      if (tipo !== 'docente') return;
      cerrarSesion();
    });
  }, []);

  const itemsVista = useMemo(() => {
    const puedeCalificar = puede('calificaciones:calificar') || puede('omr:analizar');
    const puedePublicar = puede('sincronizacion:listar') || puede('calificaciones:publicar');
    const items = [
      { id: 'periodos', label: 'Materias', icono: 'periodos' as const, mostrar: puede('periodos:leer') },
      { id: 'alumnos', label: 'Alumnos', icono: 'alumnos' as const, mostrar: puede('alumnos:leer') },
      { id: 'banco', label: 'Banco', icono: 'banco' as const, mostrar: puede('banco:leer') },
      { id: 'plantillas', label: 'Plantillas', icono: 'plantillas' as const, mostrar: puede('plantillas:leer') },
      { id: 'entrega', label: 'Entrega', icono: 'recepcion' as const, mostrar: puede('entregas:gestionar') },
      { id: 'calificaciones', label: 'Calificaciones', icono: 'calificar' as const, mostrar: puedeCalificar },
      { id: 'publicar', label: 'Sincronización', icono: 'publicar' as const, mostrar: puedePublicar },
      { id: 'cuenta', label: 'Cuenta', icono: 'info' as const, mostrar: puede('cuenta:leer') }
    ];
    return items.filter((item) => item.mostrar);
  }, [puede]);

  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const montadoRef = useRef(true);

  // Nota UX: ocultamos el badge de estado API (no aporta al flujo docente).

  useEffect(() => {
    if (itemsVista.length === 0) return;
    const vistaBase = vista === 'periodos_archivados' ? 'periodos' : vista;
    if (!itemsVista.some((item) => item.id === vistaBase)) {
      setVista(itemsVista[0].id);
    }
  }, [itemsVista, vista]);

  useEffect(() => {
    let activo = true;

    (async () => {
      // Si no hay token local, intenta restaurar sesion via refresh token (cookie httpOnly).
      if (!obtenerTokenDocente()) {
        await clienteApi.intentarRefrescarToken();
      }
      if (!activo) return;
      if (!obtenerTokenDocente()) return;

      clienteApi
        .obtener<{ docente: Docente }>('/autenticacion/perfil')
        .then((payload) => {
          if (!activo) return;
          setDocente(payload.docente);
        })
        .catch(() => {
          if (!activo) return;
          setDocente(null);
        });
    })();

    return () => {
      activo = false;
    };
  }, []);

  const refrescarPerfil = useCallback(async () => {
    if (!obtenerTokenDocente()) return;
    try {
      const payload = await clienteApi.obtener<{ docente: Docente }>('/autenticacion/perfil');
      if (montadoRef.current) setDocente(payload.docente);
    } catch {
      // No interrumpir la sesion si falla el refresh.
    }
  }, []);

  useEffect(() => {
    const intervaloMs = 5 * 60 * 1000;
    const id = window.setInterval(() => {
      void refrescarPerfil();
    }, intervaloMs);
    return () => window.clearInterval(id);
  }, [refrescarPerfil]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void refrescarPerfil();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refrescarPerfil]);

  // Sesion de UI (no sensible) para analiticas best-effort.
  useEffect(() => {
    if (!obtenerTokenDocente()) return;
    obtenerSesionDocenteId();
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const refrescarDatos = useCallback(async () => {
    if (!docente) return;
    if (montadoRef.current) setCargandoDatos(true);
    try {
      const tareas: Array<Promise<void>> = [];

      if (permisosUI.alumnos.leer) {
        tareas.push(
          clienteApi.obtener<{ alumnos: Alumno[] }>('/alumnos').then((al) => {
            if (montadoRef.current) setAlumnos(al.alumnos);
          })
        );
      } else {
        setAlumnos([]);
      }

      if (permisosUI.periodos.leer) {
        tareas.push(
          Promise.all([
            clienteApi.obtener<{ periodos?: Periodo[]; materias?: Periodo[] }>('/periodos?activo=1'),
            clienteApi.obtener<{ periodos?: Periodo[]; materias?: Periodo[] }>('/periodos?activo=0')
          ]).then(([peActivas, peArchivadas]) => {
            if (!montadoRef.current) return;
            const activas = (peActivas as unknown as { periodos?: Periodo[]; materias?: Periodo[] }).periodos ??
              (peActivas as unknown as { periodos?: Periodo[]; materias?: Periodo[] }).materias ??
              [];
            const archivadas = (peArchivadas as unknown as { periodos?: Periodo[]; materias?: Periodo[] }).periodos ??
              (peArchivadas as unknown as { periodos?: Periodo[]; materias?: Periodo[] }).materias ??
              [];

            const activasArray = Array.isArray(activas) ? activas : [];
            const archivadasArray = Array.isArray(archivadas) ? archivadas : [];

            const ids = (lista: Periodo[]) => lista.map((m) => m._id).filter(Boolean).sort().join('|');
            const mismoContenido = activasArray.length > 0 && ids(activasArray) === ids(archivadasArray);

            // Fallback: si el backend ignora ?activo y devuelve lo mismo, separa localmente.
            if (mismoContenido) {
              setPeriodos(activasArray.filter((m) => m.activo !== false));
              setPeriodosArchivados(activasArray.filter((m) => m.activo === false));
            } else {
              setPeriodos(activasArray);
              setPeriodosArchivados(archivadasArray);
            }
          })
        );
      } else {
        setPeriodos([]);
        setPeriodosArchivados([]);
      }

      if (permisosUI.plantillas.leer) {
        tareas.push(
          clienteApi.obtener<{ plantillas: Plantilla[] }>('/examenes/plantillas').then((pl) => {
            if (montadoRef.current) setPlantillas(pl.plantillas);
          })
        );
      } else {
        setPlantillas([]);
      }

      if (permisosUI.banco.leer) {
        tareas.push(
          clienteApi.obtener<{ preguntas: Pregunta[] }>('/banco-preguntas').then((pr) => {
            if (montadoRef.current) setPreguntas(pr.preguntas);
          })
        );
      } else {
        setPreguntas([]);
      }

      await Promise.all(tareas);
      setUltimaActualizacionDatos(Date.now());
    } finally {
      if (montadoRef.current) setCargandoDatos(false);
    }
  }, [docente, permisosUI.alumnos.leer, permisosUI.banco.leer, permisosUI.periodos.leer, permisosUI.plantillas.leer]);

  useEffect(() => {
    void refrescarDatos();
  }, [refrescarDatos]);

  function refrescarMaterias() {
    if (!permisosUI.periodos.leer) {
      setPeriodos([]);
      setPeriodosArchivados([]);
      return Promise.resolve();
    }
    return Promise.all([
      clienteApi.obtener<{ periodos?: Periodo[]; materias?: Periodo[] }>('/periodos?activo=1'),
      clienteApi.obtener<{ periodos?: Periodo[]; materias?: Periodo[] }>('/periodos?activo=0')
    ]).then(([peActivas, peArchivadas]) => {
      const activas = peActivas.periodos ?? peActivas.materias ?? [];
      const archivadas = peArchivadas.periodos ?? peArchivadas.materias ?? [];

      const activasArray = Array.isArray(activas) ? activas : [];
      const archivadasArray = Array.isArray(archivadas) ? archivadas : [];

      const ids = (lista: Periodo[]) => lista.map((m) => m._id).filter(Boolean).sort().join('|');
      const mismoContenido = activasArray.length > 0 && ids(activasArray) === ids(archivadasArray);

      if (mismoContenido) {
        setPeriodos(activasArray.filter((m) => m.activo !== false));
        setPeriodosArchivados(activasArray.filter((m) => m.activo === false));
      } else {
        setPeriodos(activasArray);
        setPeriodosArchivados(archivadasArray);
      }
      setUltimaActualizacionDatos(Date.now());
    });
  }

  const examenOmrActivo = useMemo(
    () => revisionesOmr.find((item) => item.examenId === examenIdOmr) ?? null,
    [examenIdOmr, revisionesOmr]
  );
  const respuestasOmrConsolidadas = useMemo(() => {
    if (!examenOmrActivo) return respuestasEditadas;
    const combinadas = combinarRespuestasOmrPaginas(examenOmrActivo.paginas);
    return combinadas.length > 0 ? combinadas : respuestasEditadas;
  }, [examenOmrActivo, respuestasEditadas]);
  const resultadoOmrConsolidado = useMemo(() => {
    if (!examenOmrActivo) return resultadoOmr;
    return consolidarResultadoOmrExamen(examenOmrActivo.paginas) ?? resultadoOmr;
  }, [examenOmrActivo, resultadoOmr]);
  const claveCorrectaOmrActiva = useMemo(
    () => (examenOmrActivo?.claveCorrectaPorNumero ? examenOmrActivo.claveCorrectaPorNumero : {}),
    [examenOmrActivo]
  );
  const ordenPreguntasClaveOmrActiva = useMemo(
    () =>
      Array.isArray(examenOmrActivo?.ordenPreguntas)
        ? examenOmrActivo!.ordenPreguntas
        : Object.keys(claveCorrectaOmrActiva)
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n))
            .sort((a, b) => a - b),
    [claveCorrectaOmrActiva, examenOmrActivo]
  );

  const seleccionarRevisionOmr = useCallback(
    (examenId: string, numeroPagina: number) => {
      const examen = revisionesOmr.find((item) => item.examenId === examenId);
      if (!examen) return;
      const pagina = examen.paginas.find((item) => item.numeroPagina === numeroPagina);
      if (!pagina) return;
      setExamenIdOmr(examen.examenId);
      setExamenAlumnoId(examen.alumnoId ?? null);
      setPaginaOmrActiva(pagina.numeroPagina);
      setResultadoOmr(pagina.resultado);
      setRespuestasEditadas(pagina.respuestas);
      setRevisionOmrConfirmada(Boolean(examen.revisionConfirmada));
    },
    [revisionesOmr]
  );

  const actualizarRespuestasOmrActivas = useCallback(
    (nuevas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>) => {
      setRespuestasEditadas(nuevas);
      if (!examenIdOmr || !Number.isFinite(Number(paginaOmrActiva))) return;
      const paginaObjetivo = Number(paginaOmrActiva);
      setRevisionOmrConfirmada(false);
      setRevisionesOmr((prev) =>
        prev.map((examen) => {
          if (examen.examenId !== examenIdOmr) return examen;
          const paginas = examen.paginas.map((pagina) =>
            pagina.numeroPagina === paginaObjetivo
              ? {
                  ...pagina,
                  respuestas: nuevas,
                  resultado: {
                    ...pagina.resultado,
                    respuestasDetectadas: nuevas
                  },
                  actualizadoEn: Date.now()
                }
              : pagina
          );
          return {
            ...examen,
            paginas,
            revisionConfirmada: false,
            actualizadoEn: Date.now()
          };
        })
      );
    },
    [examenIdOmr, paginaOmrActiva]
  );

  const actualizarRespuestaPreguntaOmrActiva = useCallback(
    (numeroPregunta: number, opcion: string | null) => {
      const numero = Number(numeroPregunta);
      if (!Number.isFinite(numero) || numero <= 0) return;
      if (!examenIdOmr) return;
      setRevisionOmrConfirmada(false);
      setRevisionesOmr((prev) =>
        prev.map((examen) => {
          if (examen.examenId !== examenIdOmr) return examen;
          const paginaActivaNum = Number(paginaOmrActiva);
          let indicePagina = examen.paginas.findIndex((pagina) => pagina.respuestas.some((item) => item.numeroPregunta === numero));
          if (indicePagina < 0 && Number.isFinite(paginaActivaNum)) {
            indicePagina = examen.paginas.findIndex((pagina) => pagina.numeroPagina === paginaActivaNum);
          }
          if (indicePagina < 0 && examen.paginas.length > 0) indicePagina = 0;
          if (indicePagina < 0) return examen;
          const paginas = examen.paginas.map((pagina, idx) => {
            if (idx !== indicePagina) return pagina;
            const respuestas = [...pagina.respuestas];
            const indiceRespuesta = respuestas.findIndex((item) => item.numeroPregunta === numero);
            if (indiceRespuesta >= 0) {
              respuestas[indiceRespuesta] = { ...respuestas[indiceRespuesta], opcion };
            } else {
              respuestas.push({ numeroPregunta: numero, opcion, confianza: 0 });
            }
            respuestas.sort((a, b) => a.numeroPregunta - b.numeroPregunta);
            return {
              ...pagina,
              respuestas,
              resultado: {
                ...pagina.resultado,
                respuestasDetectadas: respuestas
              },
              actualizadoEn: Date.now()
            };
          });
          return {
            ...examen,
            paginas,
            revisionConfirmada: false,
            actualizadoEn: Date.now()
          };
        })
      );
      setRespuestasEditadas((prev) => {
        const siguiente = [...prev];
        const indice = siguiente.findIndex((item) => item.numeroPregunta === numero);
        if (indice >= 0) {
          siguiente[indice] = { ...siguiente[indice], opcion };
        } else {
          siguiente.push({ numeroPregunta: numero, opcion, confianza: 0 });
        }
        siguiente.sort((a, b) => a.numeroPregunta - b.numeroPregunta);
        return siguiente;
      });
    },
    [examenIdOmr, paginaOmrActiva]
  );

  const confirmarRevisionOmrActiva = useCallback(
    (confirmada: boolean) => {
      setRevisionOmrConfirmada(confirmada);
      if (!examenIdOmr) return;
      setRevisionesOmr((prev) =>
        prev.map((examen) => (examen.examenId === examenIdOmr ? { ...examen, revisionConfirmada: confirmada, actualizadoEn: Date.now() } : examen))
      );
    },
    [examenIdOmr]
  );

  const contenido = docente ? (
    <div className="panel">
      <nav
        className="tabs tabs--scroll tabs--sticky"
        aria-label="Secciones del portal docente"
      >
        {itemsVista.map((item, idx) => (
          (() => {
            const activa = vista === item.id || (vista === 'periodos_archivados' && item.id === 'periodos');
            return (
          <button
            key={item.id}
            ref={(el) => {
              tabsRef.current[idx] = el;
            }}
            type="button"
            className={activa ? 'tab activa' : 'tab'}
            aria-current={activa ? 'page' : undefined}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
                return;
              }
              event.preventDefault();

              const ultimo = itemsVista.length - 1;
              let idxNuevo = idx;

              if (event.key === 'ArrowLeft') idxNuevo = Math.max(0, idx - 1);
              if (event.key === 'ArrowRight') idxNuevo = Math.min(ultimo, idx + 1);
              if (event.key === 'Home') idxNuevo = 0;
              if (event.key === 'End') idxNuevo = ultimo;

              const nuevoId = itemsVista[idxNuevo]?.id;
              if (!nuevoId) return;
              setVista(nuevoId);
              requestAnimationFrame(() => tabsRef.current[idxNuevo]?.focus());
            }}
            onClick={() => setVista(item.id)}
          >
            <Icono nombre={item.icono} />
            {item.label}
          </button>
            );
          })()
        ))}
      </nav>

      {cargandoDatos && (
        <div className="panel" aria-live="polite">
          <InlineMensaje tipo="info" leading={<Spinner />}>
            Cargando datos…
          </InlineMensaje>
        </div>
      )}

      {vista === 'banco' && (
        <SeccionBanco
          preguntas={preguntas}
          periodos={periodos}
          permisos={permisosUI}
          enviarConPermiso={enviarConPermiso}
          avisarSinPermiso={avisarSinPermiso}
          paginasEstimadasBackendPorTema={paginasEstimadasBackendPorTema}
          onRefrescar={() => {
            if (!permisosUI.banco.leer) {
              avisarSinPermiso('No tienes permiso para ver el banco.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.obtener<{ preguntas: Pregunta[] }>('/banco-preguntas').then((p) => setPreguntas(p.preguntas));
          }}
          onRefrescarPlantillas={() => {
            if (!permisosUI.plantillas.leer) {
              avisarSinPermiso('No tienes permiso para ver plantillas.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.obtener<{ plantillas: Plantilla[] }>('/examenes/plantillas').then((p) => setPlantillas(p.plantillas));
          }}
        />
      )}

      {vista === 'periodos' && (
        <SeccionPeriodos
          periodos={periodos}
          onRefrescar={refrescarMaterias}
          onVerArchivadas={() => setVista('periodos_archivados')}
          permisos={permisosUI}
          puedeEliminarMateriaDev={puedeEliminarMateriaDev}
          enviarConPermiso={enviarConPermiso}
          avisarSinPermiso={avisarSinPermiso}
        />
      )}

      {vista === 'periodos_archivados' && (
        <SeccionPeriodosArchivados
          periodos={periodosArchivados}
          onVerActivas={() => setVista('periodos')}
        />
      )}

      {vista === 'alumnos' && (
        <SeccionAlumnos
          alumnos={alumnos}
          periodosActivos={periodos}
          periodosTodos={[...periodos, ...periodosArchivados]}
          permisos={permisosUI}
          puedeEliminarAlumnoDev={puedeEliminarAlumnoDev}
          enviarConPermiso={enviarConPermiso}
          avisarSinPermiso={avisarSinPermiso}
          onRefrescar={() => {
            if (!permisosUI.alumnos.leer) {
              avisarSinPermiso('No tienes permiso para ver alumnos.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.obtener<{ alumnos: Alumno[] }>('/alumnos').then((p) => setAlumnos(p.alumnos));
          }}
        />
      )}

      {vista === 'plantillas' && (
        <SeccionPlantillas
          plantillas={plantillas}
          periodos={periodos}
          preguntas={preguntas}
          permisos={permisosUI}
          puedeEliminarPlantillaDev={puedeEliminarPlantillaDev}
          enviarConPermiso={enviarConPermiso}
          avisarSinPermiso={avisarSinPermiso}
          alumnos={alumnos}
          previewPorPlantillaId={previewPorPlantillaId}
          setPreviewPorPlantillaId={setPreviewPorPlantillaId}
          cargandoPreviewPlantillaId={cargandoPreviewPlantillaId}
          setCargandoPreviewPlantillaId={setCargandoPreviewPlantillaId}
          plantillaPreviewId={plantillaPreviewId}
          setPlantillaPreviewId={setPlantillaPreviewId}
          previewPdfUrlPorPlantillaId={previewPdfUrlPorPlantillaId}
          setPreviewPdfUrlPorPlantillaId={setPreviewPdfUrlPorPlantillaId}
          cargandoPreviewPdfPlantillaId={cargandoPreviewPdfPlantillaId}
          setCargandoPreviewPdfPlantillaId={setCargandoPreviewPdfPlantillaId}
          onRefrescar={() => {
            if (!permisosUI.plantillas.leer) {
              avisarSinPermiso('No tienes permiso para ver plantillas.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.obtener<{ plantillas: Plantilla[] }>('/examenes/plantillas').then((p) => setPlantillas(p.plantillas));
          }}
        />
      )}

      {vista === 'entrega' && (
        <SeccionEntrega
          alumnos={alumnos}
          plantillas={plantillas}
          periodos={periodos}
          permisos={permisosUI}
          avisarSinPermiso={avisarSinPermiso}
          enviarConPermiso={enviarConPermiso}
          onVincular={(folio, alumnoId) => {
            if (!permisosUI.entregas.gestionar) {
              avisarSinPermiso('No tienes permiso para vincular entregas.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar('/entregas/vincular-folio', { folio, alumnoId });
          }}
        />
      )}

      {vista === 'calificaciones' && (
        <SeccionCalificaciones
          alumnos={alumnos}
          permisos={permisosUI}
          avisarSinPermiso={avisarSinPermiso}
          onAnalizar={async (folio, numeroPagina, imagenBase64, contexto) => {
            if (!permisosUI.omr.analizar) {
              avisarSinPermiso('No tienes permiso para analizar OMR.');
              throw new Error('SIN_PERMISO');
            }
            const respuesta = await clienteApi.enviar<ResultadoAnalisisOmr>('/omr/analizar', {
              folio,
              numeroPagina,
              imagenBase64
            });
            const resultadoNormalizado = normalizarResultadoOmr(respuesta?.resultado);
            const respuestaNormalizada: ResultadoAnalisisOmr = {
              ...respuesta,
              resultado: resultadoNormalizado
            };
            let claveCorrectaPorNumero: Record<number, string> = {};
            let ordenPreguntas: number[] = [];
            try {
              const examenPayload = await clienteApi.obtener<{ examen?: ExamenGeneradoClave }>(
                `/examenes/generados/folio/${encodeURIComponent(respuesta.folio)}`
              );
              const examenDetalle = examenPayload?.examen;
              let clave = construirClaveCorrectaExamen(examenDetalle, preguntas);
              if (Object.keys(clave.claveCorrectaPorNumero).length === 0 && examenDetalle?.periodoId) {
                const bancoPeriodo = await clienteApi.obtener<{ preguntas: Pregunta[] }>(
                  `/banco-preguntas?periodoId=${encodeURIComponent(String(examenDetalle.periodoId))}`
                );
                clave = construirClaveCorrectaExamen(examenDetalle, Array.isArray(bancoPeriodo?.preguntas) ? bancoPeriodo.preguntas : []);
              }
              claveCorrectaPorNumero = clave.claveCorrectaPorNumero;
              ordenPreguntas = clave.ordenPreguntas;
            } catch {
              claveCorrectaPorNumero = {};
              ordenPreguntas = [];
            }
            const ahora = Date.now();
            let revisionExamenConfirmada = resultadoNormalizado.estadoAnalisis === 'ok';
            setRevisionesOmr((prev) => {
              const siguiente = [...prev];
              const indiceExamen = siguiente.findIndex((item) => item.examenId === respuesta.examenId);
              const nuevaPagina: RevisionPaginaOmr = {
                numeroPagina: respuesta.numeroPagina,
                resultado: resultadoNormalizado,
                respuestas: resultadoNormalizado.respuestasDetectadas,
                imagenBase64,
                nombreArchivo: contexto?.nombreArchivo,
                actualizadoEn: ahora
              };
              if (indiceExamen >= 0) {
                const examen = siguiente[indiceExamen];
                const indicePagina = examen.paginas.findIndex((item) => item.numeroPagina === respuesta.numeroPagina);
                const paginas = [...examen.paginas];
                if (indicePagina >= 0) {
                  paginas[indicePagina] = nuevaPagina;
                } else {
                  paginas.push(nuevaPagina);
                }
                paginas.sort((a, b) => a.numeroPagina - b.numeroPagina);
                const requiereRevisionPagina = resultadoNormalizado.estadoAnalisis !== 'ok';
                const revisionConfirmada = requiereRevisionPagina ? false : examen.revisionConfirmada;
                revisionExamenConfirmada = revisionConfirmada;
                siguiente[indiceExamen] = {
                  ...examen,
                  folio: respuesta.folio || examen.folio,
                  alumnoId: respuesta.alumnoId ?? examen.alumnoId ?? null,
                  paginas,
                  claveCorrectaPorNumero:
                    Object.keys(claveCorrectaPorNumero).length > 0 ? claveCorrectaPorNumero : examen.claveCorrectaPorNumero,
                  ordenPreguntas: ordenPreguntas.length > 0 ? ordenPreguntas : examen.ordenPreguntas,
                  revisionConfirmada,
                  actualizadoEn: ahora
                };
              } else {
                revisionExamenConfirmada = resultadoNormalizado.estadoAnalisis === 'ok';
                siguiente.push({
                  examenId: respuesta.examenId,
                  folio: respuesta.folio,
                  alumnoId: respuesta.alumnoId ?? null,
                  paginas: [nuevaPagina],
                  claveCorrectaPorNumero,
                  ordenPreguntas,
                  revisionConfirmada: revisionExamenConfirmada,
                  creadoEn: ahora,
                  actualizadoEn: ahora
                });
              }
              siguiente.sort((a, b) => b.actualizadoEn - a.actualizadoEn);
              return siguiente;
            });
            setResultadoOmr(resultadoNormalizado);
            setRespuestasEditadas(resultadoNormalizado.respuestasDetectadas);
            setRevisionOmrConfirmada(revisionExamenConfirmada);
            setExamenIdOmr(respuesta.examenId);
            setExamenAlumnoId(respuesta.alumnoId ?? null);
            setPaginaOmrActiva(respuesta.numeroPagina);
            return respuestaNormalizada;
          }}
          onPrevisualizar={async (payload) => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para calificar.');
              throw new Error('SIN_PERMISO');
            }
            return clienteApi.enviar<{ preview: PreviewCalificacion }>('/calificaciones/calificar', { ...payload, soloPreview: true });
          }}
          resultado={resultadoOmr}
          onActualizar={actualizarRespuestasOmrActivas}
          onActualizarPregunta={actualizarRespuestaPreguntaOmrActiva}
          claveCorrectaPorNumero={claveCorrectaOmrActiva}
          ordenPreguntasClave={ordenPreguntasClaveOmrActiva}
          revisionOmrConfirmada={revisionOmrConfirmada}
          onConfirmarRevisionOmr={confirmarRevisionOmrActiva}
          revisionesOmr={revisionesOmr}
          examenIdActivo={examenIdOmr}
          paginaActiva={paginaOmrActiva}
          onSeleccionarRevision={seleccionarRevisionOmr}
          examenId={examenIdOmr}
          alumnoId={examenAlumnoId}
          resultadoParaCalificar={resultadoOmrConsolidado}
          respuestasParaCalificar={respuestasOmrConsolidadas}
          onCalificar={(payload) => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para calificar.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar('/calificaciones/calificar', payload);
          }}
        />
      )}

      {vista === 'publicar' && (
        <SeccionSincronizacion
          periodos={periodos}
          periodosArchivados={periodosArchivados}
          alumnos={alumnos}
          plantillas={plantillas}
          preguntas={preguntas}
          ultimaActualizacionDatos={ultimaActualizacionDatos}
          docenteCorreo={docente?.correo}
          onPublicar={(periodoId) => {
            if (!permisosUI.publicar.publicar) {
              avisarSinPermiso('No tienes permiso para publicar resultados.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar('/sincronizaciones/publicar', { periodoId });
          }}
          onCodigo={(periodoId) => {
            if (!permisosUI.publicar.publicar) {
              avisarSinPermiso('No tienes permiso para generar codigos.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<{ codigo?: string; expiraEn?: string }>('/sincronizaciones/codigo-acceso', { periodoId });
          }}
          onExportarPaquete={(payload) => {
            if (!permisosUI.sincronizacion.exportar) {
              avisarSinPermiso('No tienes permiso para exportar.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<{
              paqueteBase64: string;
              checksumSha256: string;
              checksumGzipSha256?: string;
              exportadoEn: string;
              conteos: Record<string, number>;
            }>('/sincronizaciones/paquete/exportar', payload);
          }}
          onImportarPaquete={(payload) =>
            (async () => {
              if (!permisosUI.sincronizacion.importar) {
                avisarSinPermiso('No tienes permiso para importar.');
                throw new Error('SIN_PERMISO');
              }
              const respuesta = await clienteApi.enviar<
                | { mensaje?: string; resultados?: unknown[]; pdfsGuardados?: number }
                | { mensaje?: string; checksumSha256?: string; conteos?: Record<string, number> }
              >('/sincronizaciones/paquete/importar', payload);
              if (!payload?.dryRun) {
                await refrescarDatos();
              }
              return respuesta;
            })()
          }
          onPushServidor={(payload) => {
            if (!permisosUI.sincronizacion.push) {
              avisarSinPermiso('No tienes permiso para enviar al servidor.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<RespuestaSyncPush>('/sincronizaciones/push', payload);
          }}
          onPullServidor={(payload) => {
            if (!permisosUI.sincronizacion.pull) {
              avisarSinPermiso('No tienes permiso para traer del servidor.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<RespuestaSyncPull>('/sincronizaciones/pull', payload);
          }}
        />
      )}

      {vista === 'cuenta' && (
        <SeccionCuenta
          docente={docente}
          onDocenteActualizado={setDocente}
          esAdmin={esAdmin}
          esDev={esDev}
        />
      )}
    </div>
  ) : (
    <SeccionAutenticacion
      onIngresar={(token) => {
        guardarTokenDocente(token);
        clienteApi
          .obtener<{ docente: Docente }>('/autenticacion/perfil')
          .then((payload) => setDocente(payload.docente));
      }}
    />
  );

  return (
    <section className="card anim-entrada">
      <div className="cabecera">
        <div>
          <p className="eyebrow">
            <Icono nombre="docente" /> Plataforma Docente
          </p>
          <h1>Banco y Examenes</h1>
        </div>
        <div className="cabecera__acciones">
          <TemaBoton />
          {docente && (
            <Boton
              variante="secundario"
              type="button"
              icono={<Icono nombre="salir" />}
              onClick={() => cerrarSesion()}
            >
              Salir
            </Boton>
          )}
        </div>
      </div>
      {docente && (
        <InlineMensaje tipo="info">
          Sesion: {[docente.nombres, docente.apellidos].filter(Boolean).join(' ').trim() || docente.nombreCompleto} ({docente.correo})
        </InlineMensaje>
      )}
      {contenido}
    </section>
  );
}

function SeccionRegistroEntrega({
  alumnos,
  onVincular,
  puedeGestionar,
  avisarSinPermiso,
  examenesPorFolio
}: {
  alumnos: Alumno[];
  onVincular: (folio: string, alumnoId: string) => Promise<unknown>;
  puedeGestionar: boolean;
  avisarSinPermiso: (mensaje: string) => void;
  examenesPorFolio: Map<string, { alumnoId?: string | null }>;
}) {
  const [folio, setFolio] = useState('');
  const [alumnoId, setAlumnoId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [vinculando, setVinculando] = useState(false);
  const [scanError, setScanError] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const inputCamRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const jsQrRef = useRef<((data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }) => { data: string } | null) | null>(null);
  type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
    detect: (img: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
  };

  const puedeVincular = Boolean(folio.trim() && alumnoId);
  const bloqueoEdicion = !puedeGestionar;

  function prepararAudio() {
    if (typeof window === 'undefined') return;
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      // ignore
    }
  }

  function reproducirSonido(tipo: 'scan' | 'ok') {
    if (typeof window === 'undefined') return;
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      if (ctx.state === 'suspended') return;
      const ahora = ctx.currentTime;
      const salida = ctx.createGain();
      salida.gain.setValueAtTime(0.0001, ahora);
      salida.gain.exponentialRampToValueAtTime(0.08, ahora + 0.02);
      salida.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.35);
      salida.connect(ctx.destination);

      const frecuencias = tipo === 'scan' ? [523.25, 659.25] : [440, 554.37, 659.25];
      const duracion = tipo === 'scan' ? 0.28 : 0.38;
      for (const freq of frecuencias) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ahora);
        osc.connect(salida);
        osc.start(ahora);
        osc.stop(ahora + duracion);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const folioLimpio = folio.trim().toUpperCase();
    if (!folioLimpio) return;
    const examen = examenesPorFolio.get(folioLimpio);
    const alumnoDetectado = String(examen?.alumnoId ?? '').trim();
    if (alumnoDetectado && alumnoDetectado !== alumnoId) {
      setAlumnoId(alumnoDetectado);
    }
  }, [alumnoId, examenesPorFolio, folio]);

  async function ejecutarVinculacion(folioValor: string, alumnoValor: string, origen: 'manual' | 'auto') {
    if (!folioValor || !alumnoValor) return;
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para vincular entregas.');
        return;
      }
      setVinculando(true);
      setMensaje('');
      await onVincular(folioValor.trim(), alumnoValor);
      setMensaje('Entrega vinculada');
      emitToast({ level: 'ok', title: 'Entrega', message: origen === 'auto' ? 'Entrega vinculada automaticamente' : 'Entrega vinculada', durationMs: 2200 });
      reproducirSonido('ok');
      registrarAccionDocente('vincular_entrega', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo vincular');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo vincular',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('vincular_entrega', false);
    } finally {
      setVinculando(false);
    }
  }

  async function manejarFolioDetectado(folioDetectado: string) {
    setScanError('');
    setFolio(folioDetectado);
    reproducirSonido('scan');
    const folioNormalizado = folioDetectado.toUpperCase();
    let alumnoDetectado = String(examenesPorFolio.get(folioNormalizado)?.alumnoId ?? '').trim();
    if (!alumnoDetectado) {
      try {
        const payload = await clienteApi.obtener<{ examen?: { alumnoId?: string | null } }>(
          `/examenes/generados/folio/${encodeURIComponent(folioNormalizado)}`
        );
        alumnoDetectado = String(payload?.examen?.alumnoId ?? '').trim();
      } catch {
        // ignore
      }
    }
    if (alumnoDetectado) {
      setAlumnoId(alumnoDetectado);
      await ejecutarVinculacion(folioDetectado, alumnoDetectado, 'auto');
      return;
    }
    emitToast({ level: 'ok', title: 'QR', message: 'Folio capturado. Selecciona el alumno para vincular.', durationMs: 2400 });
  }

  function extraerFolioDesdeQr(texto: string) {
    const limpio = String(texto ?? '').trim();
    if (!limpio) return '';
    const upper = limpio.toUpperCase();
    const matchExamen = upper.match(/EXAMEN:([^:\s]+)(:P\d+)?/);
    if (matchExamen?.[1]) return String(matchExamen[1] ?? '').trim();
    const matchFolio = upper.match(/\bFOLIO[-_ ]?[A-Z0-9]+\b/);
    if (matchFolio?.[0]) return matchFolio[0].replace(/\s+/g, '').trim();
    if (/^https?:\/\//i.test(upper)) return '';
    if (upper.startsWith('EXAMEN:')) {
      const partes = upper.split(':');
      return String(partes[1] ?? '').trim();
    }
    return upper;
  }

  async function cargarImagen(file: File): Promise<HTMLImageElement> {
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  async function leerQrConBarcodeDetector(file: File) {
    if (typeof window === 'undefined') return '';
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector || typeof createImageBitmap !== 'function') return '';
    try {
      const detector = new Detector({ formats: ['qr_code'] });
      const bitmap = await createImageBitmap(file);
      const codigos = await detector.detect(bitmap);
      if (typeof bitmap.close === 'function') bitmap.close();
      return String(codigos?.[0]?.rawValue ?? '').trim();
    } catch {
      return '';
    }
  }

  async function leerQrConJsQr(file: File) {
    if (typeof window === 'undefined') return '';
    const { default: jsQR } = await import('jsqr');
    const source = typeof createImageBitmap === 'function' ? await createImageBitmap(file) : await cargarImagen(file);
    const width = 'width' in source ? Number(source.width) : Number((source as HTMLImageElement).naturalWidth);
    const height = 'height' in source ? Number(source.height) : Number((source as HTMLImageElement).naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(source, 0, 0, width, height);
    if ('close' in source && typeof source.close === 'function') source.close();
    const imageData = ctx.getImageData(0, 0, width, height);
    const resultado = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
    return String(resultado?.data ?? '').trim();
  }

  async function asegurarJsQr() {
    if (jsQrRef.current) return jsQrRef.current;
    const { default: jsQR } = await import('jsqr');
    jsQrRef.current = jsQR;
    return jsQR;
  }

  function detenerCamara() {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    setEscaneando(false);
  }

  async function esperarVideoRef() {
    for (let intento = 0; intento < 8; intento += 1) {
      const video = videoRef.current;
      if (video) return video;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    return null;
  }

  async function iniciarCamara() {
    setScanError('');
    if (!navigator?.mediaDevices?.getUserMedia) {
      setScanError('Este navegador no permite camara en vivo. Usa foto.');
      inputCamRef.current?.click();
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setScanError('La camara en vivo suele requerir HTTPS. Si falla, usa foto.');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      mediaStreamRef.current = stream;
      setEscaneando(true);
      const video = await esperarVideoRef();
      if (!video) {
        detenerCamara();
        setScanError('No se pudo iniciar la vista previa de la camara. Usa foto.');
        inputCamRef.current?.click();
        return;
      }
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      const jsQR = await asegurarJsQr();
      const scan = () => {
        const currentVideo = videoRef.current;
        if (!currentVideo || !mediaStreamRef.current) return;
        if (currentVideo.readyState < 2) {
          rafRef.current = window.requestAnimationFrame(scan);
          return;
        }
        const width = currentVideo.videoWidth || 0;
        const height = currentVideo.videoHeight || 0;
        if (!width || !height) {
          rafRef.current = window.requestAnimationFrame(scan);
          return;
        }
        const canvas = canvasRef.current ?? document.createElement('canvas');
        canvasRef.current = canvas;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          rafRef.current = window.requestAnimationFrame(scan);
          return;
        }
        ctx.drawImage(currentVideo, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const resultado = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        const valor = String(resultado?.data ?? '').trim();
        const folioDetectado = extraerFolioDesdeQr(valor);
        if (folioDetectado) {
          void manejarFolioDetectado(folioDetectado);
          detenerCamara();
          return;
        }
        rafRef.current = window.requestAnimationFrame(scan);
      };
      rafRef.current = window.requestAnimationFrame(scan);
    } catch (error) {
      detenerCamara();
      const msg = mensajeUsuarioDeErrorConSugerencia(error, 'No se pudo abrir la camara. Usa foto.');
      setScanError(msg);
      inputCamRef.current?.click();
    }
  }

  async function analizarQrDesdeImagen(file: File) {
    if (typeof window === 'undefined') return;
    try {
      let valor = await leerQrConBarcodeDetector(file);
      if (!valor) {
        valor = await leerQrConJsQr(file);
      }
      if (!valor) {
        setScanError('No se detecto ningun QR. Intenta de nuevo con buena luz.');
        return;
      }
      const folioDetectado = extraerFolioDesdeQr(valor);
      if (!folioDetectado) {
        const esUrl = /^https?:\/\//i.test(valor);
        setScanError(esUrl
          ? 'Se detecto un enlace (QR de acceso). Escanea el QR del examen.'
          : 'No se detecto un folio valido. Escanea el QR del examen.');
        return;
      }
      await manejarFolioDetectado(folioDetectado);
    } catch (error) {
      const msg = mensajeUsuarioDeErrorConSugerencia(error, 'No se pudo leer el QR. Intenta de nuevo o captura el folio manualmente.');
      setScanError(msg);
    }
  }

  function abrirCamara() {
    setScanError('');
    prepararAudio();
    void iniciarCamara();
  }

  useEffect(() => {
    return () => {
      detenerCamara();
    };
  }, []);

  async function vincular() {
    await ejecutarVinculacion(folio.trim(), alumnoId, 'manual');
  }

  return (
    <div className="panel">
      <h2>
        <Icono nombre="recepcion" /> Registro de entrega
      </h2>
      <AyudaFormulario titulo="Para que sirve y como llenarlo">
        <p>
          <b>Proposito:</b> vincular el folio del examen entregado (papel) con el alumno correcto. Esto evita errores al calificar.
        </p>
        <ul className="lista">
          <li>
            <b>Folio:</b> copialo exactamente del examen (o del QR).
          </li>
          <li>
            <b>Alumno:</b> selecciona al alumno que entrego ese examen.
          </li>
        </ul>
        <p>
          Ejemplo: folio <code>FOLIO-000123</code> y alumno <code>2024-001 - Ana Maria</code>.
        </p>
      </AyudaFormulario>
      <div className="subpanel guia-visual">
        <h3>
          <Icono nombre="recepcion" /> Guia rapida (movil o manual)
        </h3>
        <div className="guia-flujo" aria-hidden="true">
          <Icono nombre="pdf" />
          <Icono nombre="chevron" className="icono icono--muted" />
          <Icono nombre="escaneo" />
          <Icono nombre="chevron" className="icono icono--muted" />
          <Icono nombre="alumno" />
          <span>Examen a folio a alumno</span>
        </div>
        <div className="guia-grid">
          <QrAccesoMovil vista="entrega" />
          <div className="item-glass guia-card">
            <div className="guia-card__header">
              <span className="chip chip-static" aria-hidden="true">
                <Icono nombre="escaneo" /> Con movil
              </span>
            </div>
            <ul className="guia-pasos">
              <li className="guia-paso">
                <span className="paso-num">1</span>
                <div>
                  <div className="paso-titulo">Abre la vista en el movil</div>
                  <p className="nota">
                    Si ya estas en movil, el QR no se muestra. Si estas en PC, escanea el QR para abrir esta vista en el telefono.
                  </p>
                </div>
              </li>
              <li className="guia-paso">
                <span className="paso-num">2</span>
                <div>
                  <div className="paso-titulo">Escanea el QR del examen</div>
                  <p className="nota">
                    Usa la camara del celular (desde la app o la camara del sistema) para leer el folio.
                  </p>
                </div>
              </li>
              <li className="guia-paso">
                <span className="paso-num">3</span>
                <div>
                  <div className="paso-titulo">Selecciona al alumno</div>
                  <p className="nota">Vincula y confirma para evitar errores de calificacion.</p>
                </div>
              </li>
            </ul>
          </div>
          <div className="item-glass guia-card">
            <div className="guia-card__header">
              <span className="chip chip-static" aria-hidden="true">
                <Icono nombre="recepcion" /> Manual
              </span>
            </div>
            <ul className="guia-pasos">
              <li className="guia-paso">
                <span className="paso-num">1</span>
                <div>
                  <div className="paso-titulo">Ubica el folio impreso</div>
                  <p className="nota">Copialo tal cual aparece en la hoja.</p>
                </div>
              </li>
              <li className="guia-paso">
                <span className="paso-num">2</span>
                <div>
                  <div className="paso-titulo">Captura folio y alumno</div>
                  <p className="nota">Elige el alumno correcto antes de vincular.</p>
                </div>
              </li>
              <li className="guia-paso">
                <span className="paso-num">3</span>
                <div>
                  <div className="paso-titulo">Vincula y guarda</div>
                  <p className="nota">Confirma el mensaje de Entrega vinculada.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="subpanel">
        <Boton type="button" icono={<Icono nombre="escaneo" />} onClick={abrirCamara}>
          Escanear QR del examen
        </Boton>
        {escaneando && (
          <div className="item-glass guia-card">
            <div className="guia-card__header">
              <span className="chip chip-static" aria-hidden="true">
                <Icono nombre="escaneo" /> Camara activa
              </span>
              <Boton type="button" variante="secundario" onClick={detenerCamara}>
                Cerrar camara
              </Boton>
            </div>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', maxWidth: '320px', borderRadius: '16px', background: '#000' }}
            />
            <div className="nota">Apunta al QR del examen para capturar el folio.</div>
          </div>
        )}
        <input
          ref={inputCamRef}
          className="input-file-oculto"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void analizarQrDesdeImagen(file);
            event.currentTarget.value = '';
          }}
        />
        {scanError && (
          <InlineMensaje tipo="warning">
            {scanError}
          </InlineMensaje>
        )}
      </div>
      <label className="campo">
        Folio
        <input value={folio} onChange={(event) => setFolio(event.target.value)} disabled={bloqueoEdicion} />
      </label>
      <label className="campo">
        Alumno
        <select value={alumnoId} onChange={(event) => setAlumnoId(event.target.value)} disabled={bloqueoEdicion}>
          <option value="">Selecciona</option>
          {alumnos.map((alumno) => (
            <option key={alumno._id} value={alumno._id}>
              {alumno.matricula} - {alumno.nombreCompleto}
            </option>
          ))}
        </select>
      </label>
      <Boton
        type="button"
        icono={<Icono nombre="recepcion" />}
        cargando={vinculando}
        disabled={!puedeVincular || bloqueoEdicion}
        onClick={vincular}
      >
        {vinculando ? 'Vinculando…' : 'Vincular'}
      </Boton>
      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
    </div>
  );
}

function SeccionEntrega({
  alumnos,
  plantillas,
  periodos,
  onVincular,
  permisos,
  avisarSinPermiso,
  enviarConPermiso
}: {
  alumnos: Alumno[];
  plantillas: Plantilla[];
  periodos: Periodo[];
  onVincular: (folio: string, alumnoId: string) => Promise<unknown>;
  permisos: PermisosUI;
  avisarSinPermiso: (mensaje: string) => void;
  enviarConPermiso: EnviarConPermiso;
}) {
  type ExamenGeneradoEntrega = {
    _id: string;
    folio: string;
    alumnoId?: string | null;
    estado?: string;
    periodoId?: string;
    plantillaId?: string;
    generadoEn?: string;
    entregadoEn?: string;
  };

  const [periodoId, setPeriodoId] = useState('');
  const [filtro, setFiltro] = useState('');
  const [examenes, setExamenes] = useState<ExamenGeneradoEntrega[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [deshaciendoFolio, setDeshaciendoFolio] = useState<string | null>(null);
  const puedeGestionar = permisos.entregas.gestionar;
  const puedeLeer = permisos.examenes.leer;

  useEffect(() => {
    if (periodoId || periodos.length === 0) return;
    const primero = periodos[0]?._id ?? '';
    if (primero) setPeriodoId(primero);
  }, [periodoId, periodos]);

  const alumnosPorId = useMemo(() => {
    const mapa = new Map<string, Alumno>();
    for (const a of Array.isArray(alumnos) ? alumnos : []) {
      mapa.set(a._id, a);
    }
    return mapa;
  }, [alumnos]);

  const plantillasPorId = useMemo(() => {
    const mapa = new Map<string, Plantilla>();
    for (const plantilla of Array.isArray(plantillas) ? plantillas : []) {
      mapa.set(plantilla._id, plantilla);
    }
    return mapa;
  }, [plantillas]);

  const examenesPorFolio = useMemo(() => {
    const mapa = new Map<string, ExamenGeneradoEntrega>();
    for (const examen of Array.isArray(examenes) ? examenes : []) {
      const folio = String(examen.folio ?? '').trim().toUpperCase();
      if (folio) {
        mapa.set(folio, examen);
      }
    }
    return mapa;
  }, [examenes]);

  const formatearFechaHora = useCallback((valor?: string) => {
    const v = String(valor || '').trim();
    if (!v) return '-';
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return v;
    return d.toLocaleString();
  }, []);

  const cargarExamenes = useCallback(async () => {
    if (!periodoId) {
      setExamenes([]);
      return;
    }
    if (!puedeLeer && !puedeGestionar) {
      setExamenes([]);
      return;
    }
    try {
      setCargando(true);
      setMensaje('');
      const payload = await clienteApi.obtener<{ examenes: ExamenGeneradoEntrega[] }>(
        `/examenes/generados?periodoId=${encodeURIComponent(periodoId)}`
      );
      setExamenes(Array.isArray(payload.examenes) ? payload.examenes : []);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo cargar el listado de examenes');
      setMensaje(msg);
    } finally {
      setCargando(false);
    }
  }, [periodoId, puedeLeer, puedeGestionar]);

  useEffect(() => {
    void cargarExamenes();
  }, [cargarExamenes]);

  const vincularYRefrescar = useCallback(
    async (folio: string, alumnoId: string) => {
      await onVincular(folio, alumnoId);
      await cargarExamenes();
    },
    [onVincular, cargarExamenes]
  );

  const deshacerEntrega = useCallback(
    async (folio: string) => {
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para deshacer entregas.');
        return;
      }
      const confirmar = window.confirm(
        `¿Deshacer la entrega del folio ${folio}? Esto desvincula al alumno y regresa el examen a "generado".`
      );
      if (!confirmar) return;
      const motivo = window.prompt('Motivo para deshacer la entrega:', '');
      try {
        setDeshaciendoFolio(folio);
        const payload: Record<string, string> = { folio };
        if (motivo && motivo.trim()) payload.motivo = motivo.trim();
        await enviarConPermiso('entregas:gestionar', '/entregas/deshacer-folio', payload, 'No tienes permiso para deshacer entregas.');
        emitToast({ level: 'ok', title: 'Entrega', message: 'Entrega revertida', durationMs: 2200 });
        await cargarExamenes();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo deshacer la entrega');
        emitToast({
          level: 'error',
          title: 'No se pudo deshacer',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setDeshaciendoFolio((actual) => (actual === folio ? null : actual));
      }
    },
    [avisarSinPermiso, cargarExamenes, enviarConPermiso, puedeGestionar]
  );

  const filtroNormalizado = filtro.trim().toLowerCase();
  const examenesFiltrados = useMemo(() => {
    if (!filtroNormalizado) return examenes;
    return examenes.filter((examen) => {
      const alumno = examen.alumnoId ? alumnosPorId.get(examen.alumnoId) : null;
      const texto = [
        examen.folio,
        alumno?.matricula ?? '',
        alumno?.nombreCompleto ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return texto.includes(filtroNormalizado);
    });
  }, [examenes, filtroNormalizado, alumnosPorId]);

  const entregados = useMemo(() => {
    return examenesFiltrados.filter((examen) => {
      const estado = String(examen.estado ?? '').toLowerCase();
      return estado === 'entregado' || estado === 'calificado';
    }).sort((a, b) => {
      const aTime = a.entregadoEn ? new Date(a.entregadoEn).getTime() : 0;
      const bTime = b.entregadoEn ? new Date(b.entregadoEn).getTime() : 0;
      return bTime - aTime;
    });
  }, [examenesFiltrados]);

  const pendientes = useMemo(() => {
    return examenesFiltrados.filter((examen) => {
      const estado = String(examen.estado ?? '').toLowerCase();
      return estado !== 'entregado' && estado !== 'calificado';
    });
  }, [examenesFiltrados]);

  return (
    <>
      <div className="panel">
        <h2>
          <Icono nombre="recepcion" /> Entrega de examenes
        </h2>
        <AyudaFormulario titulo="Resumen de entrega">
          <p>
            <b>Proposito:</b> registrar entregas y ver el estado de cada examen generado.
            Los entregados muestran fecha de entrega; los pendientes indican folios sin registro.
          </p>
          <ul className="lista">
            <li>
              <b>Entregados:</b> estado entregado o calificado.
            </li>
            <li>
              <b>Pendientes:</b> estado generado (aun sin entrega).
            </li>
          </ul>
        </AyudaFormulario>
      </div>

      <SeccionRegistroEntrega
        alumnos={alumnos}
        onVincular={vincularYRefrescar}
        puedeGestionar={puedeGestionar}
        avisarSinPermiso={avisarSinPermiso}
        examenesPorFolio={examenesPorFolio}
      />

      <div className="panel">
        <div className="item-row">
          <div>
            <h3>Estado de entregas</h3>
            <div className="nota">
              Total: {examenesFiltrados.length} · Entregados: {entregados.length} · Pendientes: {pendientes.length}
            </div>
          </div>
          <div className="item-actions">
            <Boton type="button" variante="secundario" onClick={() => void cargarExamenes()}>
              Refrescar
            </Boton>
          </div>
        </div>

        <label className="campo">
          Materia
          <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
            <option value="">Selecciona</option>
            {periodos.map((periodo) => (
              <option key={periodo._id} value={periodo._id}>
                {periodo.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          Buscar (folio o alumno)
          <input
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
            placeholder="FOLIO-000123 o 2024-001"
          />
        </label>

        {mensaje && <InlineMensaje tipo="error">{mensaje}</InlineMensaje>}
        {cargando && (
          <p className="mensaje" role="status">
            <Spinner /> Cargando entregas…
          </p>
        )}

        <div className="resultado">
          <h3>Entregados</h3>
          {entregados.length === 0 && !cargando && <p className="nota">Aun no hay entregas registradas.</p>}
          <ul className="lista lista-items">
            {entregados.map((examen) => {
              const alumno = examen.alumnoId ? alumnosPorId.get(examen.alumnoId) : null;
              const alumnoTexto = alumno ? `${alumno.matricula} - ${alumno.nombreCompleto}` : 'Sin alumno';
              const plantilla = examen.plantillaId ? plantillasPorId.get(examen.plantillaId) : null;
              const parcialTexto = plantilla
                ? (plantilla.tipo === 'parcial'
                  ? (plantilla.titulo || 'Parcial')
                  : (plantilla.titulo ? `Global: ${plantilla.titulo}` : 'Global'))
                : '-';
              const bloqueando = deshaciendoFolio === examen.folio;
              return (
                <li key={examen._id}>
                  <div className="item-glass">
                    <div className="item-row">
                      <div>
                        <div className="item-title">Folio {examen.folio}</div>
                        <div className="item-meta">
                          <span>Alumno: {alumnoTexto}</span>
                          <span>Parcial: {parcialTexto}</span>
                          <span>Entrega: {formatearFechaHora(examen.entregadoEn)}</span>
                          <span>Estado: {String(examen.estado ?? 'entregado')}</span>
                        </div>
                      </div>
                      <div className="item-actions">
                        <Boton
                          type="button"
                          variante="secundario"
                          disabled={bloqueando || !puedeGestionar}
                          onClick={() => void deshacerEntrega(examen.folio)}
                        >
                          {bloqueando ? (
                            <>
                              <Spinner /> Deshaciendo…
                            </>
                          ) : (
                            'Deshacer entrega'
                          )}
                        </Boton>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="resultado">
          <h3>Pendientes</h3>
          {pendientes.length === 0 && !cargando && <p className="nota">No hay pendientes.</p>}
          <ul className="lista lista-items">
            {pendientes.map((examen) => {
              const alumno = examen.alumnoId ? alumnosPorId.get(examen.alumnoId) : null;
              const alumnoTexto = alumno ? `${alumno.matricula} - ${alumno.nombreCompleto}` : 'Sin alumno';
              const plantilla = examen.plantillaId ? plantillasPorId.get(examen.plantillaId) : null;
              const parcialTexto = plantilla
                ? (plantilla.tipo === 'parcial'
                  ? (plantilla.titulo || 'Parcial')
                  : (plantilla.titulo ? `Global: ${plantilla.titulo}` : 'Global'))
                : '-';
              return (
                <li key={examen._id}>
                  <div className="item-glass">
                    <div className="item-row">
                      <div>
                        <div className="item-title">Folio {examen.folio}</div>
                        <div className="item-meta">
                          <span>Alumno: {alumnoTexto}</span>
                          <span>Parcial: {parcialTexto}</span>
                          <span>Generado: {formatearFechaHora(examen.generadoEn)}</span>
                          <span>Estado: {String(examen.estado ?? 'generado')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}

function SeccionCalificaciones({
  alumnos,
  onAnalizar,
  onPrevisualizar,
  resultado,
  onActualizar,
  onActualizarPregunta,
  revisionOmrConfirmada,
  onConfirmarRevisionOmr,
  revisionesOmr,
  examenIdActivo,
  paginaActiva,
  onSeleccionarRevision,
  claveCorrectaPorNumero,
  ordenPreguntasClave,
  examenId,
  alumnoId,
  resultadoParaCalificar,
  respuestasParaCalificar,
  onCalificar,
  permisos,
  avisarSinPermiso
}: {
  alumnos: Alumno[];
  onAnalizar: (
    folio: string,
    numeroPagina: number,
    imagenBase64: string,
    contexto?: { nombreArchivo?: string }
  ) => Promise<ResultadoAnalisisOmr>;
  onPrevisualizar: (payload: {
    examenGeneradoId: string;
    alumnoId?: string | null;
    respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
  }) => Promise<{ preview: PreviewCalificacion }>;
  resultado: ResultadoOmr | null;
  onActualizar: (respuestas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>) => void;
  onActualizarPregunta: (numeroPregunta: number, opcion: string | null) => void;
  revisionOmrConfirmada: boolean;
  onConfirmarRevisionOmr: (confirmada: boolean) => void;
  revisionesOmr: RevisionExamenOmr[];
  examenIdActivo: string | null;
  paginaActiva: number | null;
  onSeleccionarRevision: (examenId: string, numeroPagina: number) => void;
  claveCorrectaPorNumero: Record<number, string>;
  ordenPreguntasClave: number[];
  examenId: string | null;
  alumnoId: string | null;
  resultadoParaCalificar: ResultadoOmr | null;
  respuestasParaCalificar: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  onCalificar: (payload: {
    examenGeneradoId: string;
    alumnoId?: string | null;
    aciertos?: number;
    totalReactivos?: number;
    bonoSolicitado?: number;
    evaluacionContinua?: number;
    proyecto?: number;
    retroalimentacion?: string;
    respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
    omrAnalisis?: {
      estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
      calidadPagina: number;
      confianzaPromedioPagina: number;
      ratioAmbiguas: number;
      templateVersionDetectada: 1 | 2;
      motivosRevision: string[];
      revisionConfirmada: boolean;
    };
  }) => Promise<unknown>;
  permisos: PermisosUI;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const puedeAnalizar = permisos.omr.analizar;
  const puedeCalificar = permisos.calificaciones.calificar;
  const revisionesSeguras = Array.isArray(revisionesOmr) ? revisionesOmr : [];
  const totalPaginas = revisionesSeguras.reduce((acumulado, examen) => acumulado + examen.paginas.length, 0);
  const paginasPendientes = revisionesSeguras.reduce(
    (acumulado, examen) => acumulado + examen.paginas.filter((pagina) => pagina.resultado.estadoAnalisis !== 'ok').length,
    0
  );
  const examenesListos = revisionesSeguras.filter((examen) => examen.revisionConfirmada).length;
  return (
    <>
      <div className="panel">
        <h2>
          <Icono nombre="calificar" /> Calificaciones
        </h2>
        <p className="nota">
          Escanea por página, revisa por examen y guarda solo cuando la revisión esté confirmada.
        </p>
        <div className="item-meta">
          <span>{revisionesSeguras.length} examen(es) en flujo</span>
          <span>{totalPaginas} página(s) procesadas</span>
          <span>{paginasPendientes} página(s) pendientes</span>
          <span>{examenesListos} examen(es) listos</span>
        </div>
      </div>
      <div className="calificaciones-layout">
        <div className="calificaciones-layout__main">
          <SeccionEscaneo
            alumnos={alumnos}
            onAnalizar={onAnalizar}
            onPrevisualizar={onPrevisualizar}
            resultado={resultado}
            onActualizar={onActualizar}
            onActualizarPregunta={onActualizarPregunta}
            respuestasCombinadas={respuestasParaCalificar}
            claveCorrectaPorNumero={claveCorrectaPorNumero}
            ordenPreguntasClave={ordenPreguntasClave}
            revisionOmrConfirmada={revisionOmrConfirmada}
            onConfirmarRevisionOmr={onConfirmarRevisionOmr}
            revisionesOmr={revisionesOmr}
            examenIdActivo={examenIdActivo}
            paginaActiva={paginaActiva}
            onSeleccionarRevision={onSeleccionarRevision}
            puedeAnalizar={puedeAnalizar}
            puedeCalificar={puedeCalificar}
            avisarSinPermiso={avisarSinPermiso}
          />
        </div>
        <aside className="calificaciones-layout__aside" aria-label="Panel de calificación">
          <SeccionCalificar
            examenId={examenId}
            alumnoId={alumnoId}
            resultadoOmr={resultadoParaCalificar}
            revisionOmrConfirmada={revisionOmrConfirmada}
            respuestasDetectadas={respuestasParaCalificar}
            claveCorrectaPorNumero={claveCorrectaPorNumero}
            ordenPreguntasClave={ordenPreguntasClave}
            onCalificar={onCalificar}
            puedeCalificar={puedeCalificar}
            avisarSinPermiso={avisarSinPermiso}
          />
        </aside>
      </div>
    </>
  );
}

function SeccionCalificar({
  examenId,
  alumnoId,
  resultadoOmr,
  revisionOmrConfirmada,
  respuestasDetectadas,
  claveCorrectaPorNumero,
  ordenPreguntasClave,
  onCalificar,
  puedeCalificar,
  avisarSinPermiso
}: {
  examenId: string | null;
  alumnoId: string | null;
  resultadoOmr: ResultadoOmr | null;
  revisionOmrConfirmada: boolean;
  respuestasDetectadas: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
  claveCorrectaPorNumero: Record<number, string>;
  ordenPreguntasClave: number[];
  onCalificar: (payload: {
    examenGeneradoId: string;
    alumnoId?: string | null;
    aciertos?: number;
    totalReactivos?: number;
    bonoSolicitado?: number;
    evaluacionContinua?: number;
    proyecto?: number;
    retroalimentacion?: string;
    respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
    omrAnalisis?: {
      estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
      calidadPagina: number;
      confianzaPromedioPagina: number;
      ratioAmbiguas: number;
      templateVersionDetectada: 1 | 2;
      motivosRevision: string[];
      revisionConfirmada: boolean;
    };
  }) => Promise<unknown>;
  puedeCalificar: boolean;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const [bono, setBono] = useState(0);
  const [evaluacionContinua, setEvaluacionContinua] = useState(0);
  const [proyecto, setProyecto] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const respuestasSeguras = useMemo(
    () => (Array.isArray(respuestasDetectadas) ? respuestasDetectadas : []),
    [respuestasDetectadas]
  );
  const respuestasPorNumero = useMemo(
    () =>
      new Map(
        respuestasSeguras
          .filter((item) => Number.isFinite(Number(item?.numeroPregunta)))
          .map((item) => [Number(item.numeroPregunta), item])
      ),
    [respuestasSeguras]
  );
  const ordenPreguntas = useMemo(() => {
    if (Array.isArray(ordenPreguntasClave) && ordenPreguntasClave.length > 0) return ordenPreguntasClave;
    const desdeRespuestas = respuestasSeguras
      .map((item) => Number(item?.numeroPregunta))
      .filter((numero) => Number.isFinite(numero));
    const desdeClave = Object.keys(claveCorrectaPorNumero)
      .map((numero) => Number(numero))
      .filter((numero) => Number.isFinite(numero));
    return Array.from(new Set([...desdeClave, ...desdeRespuestas])).sort((a, b) => a - b);
  }, [claveCorrectaPorNumero, ordenPreguntasClave, respuestasSeguras]);
  const resumenDinamico = useMemo(() => {
    if (ordenPreguntas.length === 0) {
      return { total: 0, aciertos: 0, contestadas: 0, notaSobre5: 0 };
    }
    let aciertos = 0;
    let contestadas = 0;
    for (const numero of ordenPreguntas) {
      const correcta = claveCorrectaPorNumero[numero] ?? null;
      const opcion = respuestasPorNumero.get(numero)?.opcion ?? null;
      if (opcion) contestadas += 1;
      if (correcta && opcion && correcta === opcion) aciertos += 1;
    }
    const total = ordenPreguntas.length;
    const notaSobre5 = Number(((aciertos / Math.max(1, total)) * 5).toFixed(2));
    return { total, aciertos, contestadas, notaSobre5 };
  }, [claveCorrectaPorNumero, ordenPreguntas, respuestasPorNumero]);

  const requiereRevisionConfirmacion = Boolean(
    resultadoOmr && resultadoOmr.estadoAnalisis !== 'ok' && !revisionOmrConfirmada
  );
  const bloqueoPorCalidad = resultadoOmr?.estadoAnalisis === 'rechazado_calidad';
  const puedeCalificarLocal = Boolean(examenId && alumnoId) && !requiereRevisionConfirmacion && !bloqueoPorCalidad;
  const bloqueoCalificar = !puedeCalificar;

  async function calificar() {
    if (!examenId || !alumnoId) {
      setMensaje('Falta examen o alumno');
      return;
    }
    try {
      const inicio = Date.now();
      if (!puedeCalificar) {
        avisarSinPermiso('No tienes permiso para calificar.');
        return;
      }
      setGuardando(true);
      setMensaje('');
      await onCalificar({
        examenGeneradoId: examenId,
        alumnoId,
        bonoSolicitado: bono,
        evaluacionContinua,
        proyecto,
        respuestasDetectadas,
        omrAnalisis: resultadoOmr
          ? {
              estadoAnalisis: resultadoOmr.estadoAnalisis,
              calidadPagina: resultadoOmr.calidadPagina,
              confianzaPromedioPagina: resultadoOmr.confianzaPromedioPagina,
              ratioAmbiguas: resultadoOmr.ratioAmbiguas,
              templateVersionDetectada: resultadoOmr.templateVersionDetectada,
              motivosRevision: Array.isArray(resultadoOmr.motivosRevision) ? resultadoOmr.motivosRevision : [],
              revisionConfirmada: revisionOmrConfirmada
            }
          : undefined
      });
      setMensaje('Calificacion guardada');
      emitToast({ level: 'ok', title: 'Calificacion', message: 'Calificacion guardada', durationMs: 2200 });
      registrarAccionDocente('calificar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo calificar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo calificar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('calificar', false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="panel calif-grade-card">
      <h2>
        <Icono nombre="calificar" /> Calificar examen
      </h2>
      <div className="item-sub">Examen: {examenId ?? 'Sin examen'}</div>
      <div className="item-sub">Alumno: {alumnoId ?? 'Sin alumno'}</div>
      <div className="item-meta">
        <span>Respuestas listas: {respuestasSeguras.length}</span>
        <span>
          Aciertos dinámicos: {resumenDinamico.aciertos}/{resumenDinamico.total}
        </span>
        <span>Nota estimada: {resumenDinamico.notaSobre5.toFixed(2)} / 5.00</span>
      </div>
      {resultadoOmr && (
        <div className="item-meta">
          <span className={`badge ${resultadoOmr.estadoAnalisis === 'ok' ? 'ok' : resultadoOmr.estadoAnalisis === 'rechazado_calidad' ? 'error' : 'warning'}`}>
            OMR: {resultadoOmr.estadoAnalisis}
          </span>
          <span>Calidad {Math.round(resultadoOmr.calidadPagina * 100)}%</span>
          <span>Confianza {Math.round(resultadoOmr.confianzaPromedioPagina * 100)}%</span>
          <span>Ambiguas {(resultadoOmr.ratioAmbiguas * 100).toFixed(1)}%</span>
        </div>
      )}
      {requiereRevisionConfirmacion && (
        <InlineMensaje tipo="warning">Debes confirmar la revisión OMR antes de guardar la calificación.</InlineMensaje>
      )}
      {bloqueoPorCalidad && (
        <InlineMensaje tipo="error">Calificación bloqueada: el análisis OMR fue rechazado por calidad.</InlineMensaje>
      )}
      <div className="calif-grade-grid">
        <label className="campo">
          Bono (max 0.5)
          <input
            type="number"
            step="0.1"
            min={0}
            max={0.5}
            value={bono}
            onChange={(event) => setBono(Math.max(0, Math.min(0.5, Number(event.target.value))))}
            disabled={bloqueoCalificar}
          />
        </label>
        <label className="campo">
          Evaluacion continua (parcial)
          <input
            type="number"
            value={evaluacionContinua}
            onChange={(event) => setEvaluacionContinua(Math.max(0, Number(event.target.value)))}
            disabled={bloqueoCalificar}
          />
        </label>
        <label className="campo">
          Proyecto (global)
          <input
            type="number"
            value={proyecto}
            onChange={(event) => setProyecto(Math.max(0, Number(event.target.value)))}
            disabled={bloqueoCalificar}
          />
        </label>
      </div>
      <Boton
        type="button"
        icono={<Icono nombre="calificar" />}
        cargando={guardando}
        disabled={!puedeCalificarLocal || bloqueoCalificar}
        onClick={calificar}
      >
        {guardando ? 'Guardando…' : 'Guardar calificación'}
      </Boton>
      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
      <details className="colapsable">
        <summary>Ayuda para calificar</summary>
        <ul className="lista nota">
          <li>La nota estimada se recalcula automáticamente sobre 5.00.</li>
          <li>
            Si el estado es <code>requiere_revision</code>, confirma la revisión manual antes de guardar.
          </li>
          <li>
            Si el estado es <code>rechazado_calidad</code>, recaptura y vuelve a analizar.
          </li>
        </ul>
      </details>
    </div>
  );
}

function SeccionPublicar({
  periodos,
  onPublicar,
  onCodigo
}: {
  periodos: Periodo[];
  onPublicar: (periodoId: string) => Promise<unknown>;
  onCodigo: (periodoId: string) => Promise<{ codigo?: string; expiraEn?: string }>;
}) {
  const [periodoId, setPeriodoId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [codigo, setCodigo] = useState('');
  const [expiraEn, setExpiraEn] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [generando, setGenerando] = useState(false);

  const puedeAccionar = Boolean(periodoId);

  async function publicar() {
    try {
      const inicio = Date.now();
      setPublicando(true);
      setMensaje('');
      await onPublicar(periodoId);
      setMensaje('Resultados publicados');
      emitToast({ level: 'ok', title: 'Publicacion', message: 'Resultados publicados', durationMs: 2800 });
      registrarAccionDocente('publicar_resultados', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo publicar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo publicar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('publicar_resultados', false);
    } finally {
      setPublicando(false);
    }
  }

  async function generarCodigo() {
    try {
      const inicio = Date.now();
      setGenerando(true);
      setMensaje('');
      const respuesta = await onCodigo(periodoId);
      setCodigo(respuesta.codigo ?? '');
      setExpiraEn(respuesta.expiraEn ?? '');
      emitToast({ level: 'ok', title: 'Codigo', message: 'Codigo generado', durationMs: 2200 });
      registrarAccionDocente('generar_codigo', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo generar codigo');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo generar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('generar_codigo', false);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="shell">
      <div className="panel shell-main">
        <h2>
          <Icono nombre="publicar" /> Publicar en portal
        </h2>
        <label className="campo">
          Materia
          <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
            <option value="">Selecciona</option>
            {periodos.map((periodo) => (
              <option key={periodo._id} value={periodo._id} title={periodo._id}>
                {etiquetaMateria(periodo)}
              </option>
            ))}
          </select>
        </label>
        <div className="acciones">
          <Boton type="button" icono={<Icono nombre="publicar" />} cargando={publicando} disabled={!puedeAccionar} onClick={publicar}>
            {publicando ? 'Publicando…' : 'Publicar'}
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="info" />}
            cargando={generando}
            disabled={!puedeAccionar}
            onClick={generarCodigo}
          >
            {generando ? 'Generando…' : 'Generar codigo'}
          </Boton>
        </div>
        {codigo && (
          <p>
            Codigo generado: {codigo} {expiraEn ? `(expira ${new Date(expiraEn).toLocaleString()})` : ''}
          </p>
        )}
        {mensaje && (
          <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
            {mensaje}
          </p>
        )}
      </div>

      <aside className="shell-aside" aria-label="Ayuda y referencia">
        <div className="shell-asideCard">
          <AyudaFormulario titulo="Para que sirve y como llenarlo">
            <p>
              <b>Proposito:</b> enviar los resultados de la materia al portal alumno y emitir un codigo de acceso para consulta.
            </p>
            <ul className="lista">
              <li>
                <b>Materia:</b> selecciona la materia a publicar.
              </li>
              <li>
                <b>Publicar:</b> sincroniza resultados de la materia hacia el portal.
              </li>
              <li>
                <b>Generar codigo:</b> crea un codigo temporal; compartelo con alumnos junto con su matricula.
              </li>
            </ul>
            <p>
              Ejemplo de mensaje a alumnos: &quot;Tu codigo es <code>ABC123</code>. Entra al portal y usa tu matricula <code>2024-001</code>.&quot;
            </p>
          </AyudaFormulario>
        </div>
      </aside>
    </div>
  );
}

function SeccionPaqueteSincronizacion({
  periodos,
  docenteCorreo,
  onExportar,
  onImportar
}: {
  periodos: Periodo[];
  docenteCorreo?: string;
  onExportar: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<{
    paqueteBase64: string;
    checksumSha256: string;
    checksumGzipSha256?: string;
    exportadoEn: string;
    conteos: Record<string, number>;
  }>;
  onImportar: (payload: { paqueteBase64: string; checksumSha256?: string; dryRun?: boolean; docenteCorreo?: string }) => Promise<
    | { mensaje?: string; resultados?: unknown[]; pdfsGuardados?: number }
    | { mensaje?: string; checksumSha256?: string; conteos?: Record<string, number> }
  >;
}) {
  const [periodoId, setPeriodoId] = useState('');
  const [desde, setDesde] = useState('');
  const [incluirPdfs, setIncluirPdfs] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [ultimoResumen, setUltimoResumen] = useState<Record<string, number> | null>(null);
  const [ultimoExportEn, setUltimoExportEn] = useState<string | null>(null);
  const [ultimoArchivoExportado, setUltimoArchivoExportado] = useState<string | null>(null);
  const [ultimoArchivoImportado, setUltimoArchivoImportado] = useState<string | null>(null);
  const [ultimoChecksum, setUltimoChecksum] = useState<string | null>(null);

  function descargarJson(nombreArchivo: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportar() {
    try {
      const inicio = Date.now();
      setExportando(true);
      setMensaje('');
      setUltimoResumen(null);

      const payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean } = {
        incluirPdfs
      };
      if (periodoId) payload.periodoId = periodoId;
      if (desde) payload.desde = new Date(desde).toISOString();

      const resp = await onExportar(payload);
      setUltimoResumen(resp.conteos);
      setUltimoExportEn(resp.exportadoEn);
      setUltimoChecksum(resp.checksumSha256 || null);

      const nombre = `sincronizacion_${(resp.exportadoEn || new Date().toISOString()).replace(/[:.]/g, '-')}.ep-sync.json`;
      descargarJson(nombre, {
        version: 1,
        exportadoEn: resp.exportadoEn,
        checksumSha256: resp.checksumSha256,
        conteos: resp.conteos,
        paqueteBase64: resp.paqueteBase64,
        ...(docenteCorreo ? { docenteCorreo } : {})
      });
      setUltimoArchivoExportado(nombre);

      setMensaje('Paquete exportado (descarga iniciada)');
      emitToast({ level: 'ok', title: 'Sincronizacion', message: 'Paquete exportado', durationMs: 2400 });
      registrarAccionDocente('sync_paquete_exportar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo exportar el paquete');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo exportar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('sync_paquete_exportar', false);
    } finally {
      setExportando(false);
    }
  }

  async function importar(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;

    try {
      const inicio = Date.now();
      setImportando(true);
      setMensaje('');
      setUltimoArchivoImportado(archivo.name);

      const texto = await archivo.text();
      const json = JSON.parse(texto) as {
        paqueteBase64?: string;
        checksumSha256?: string;
        conteos?: Record<string, number>;
        docenteCorreo?: string;
      };
      const paqueteBase64 = String(json?.paqueteBase64 || '').trim();
      const checksumSha256 = String(json?.checksumSha256 || '').trim();
      const correoArchivo = typeof json?.docenteCorreo === 'string' ? json.docenteCorreo.trim() : '';
      const correoFinal = correoArchivo || docenteCorreo || '';
      if (!paqueteBase64) {
        throw new Error('Archivo invalido: no contiene paqueteBase64');
      }

      // 1) Validar en servidor (dry-run) para detectar corrupcion antes de escribir.
      const validacion = await onImportar({
        paqueteBase64,
        checksumSha256: checksumSha256 || undefined,
        dryRun: true,
        ...(correoFinal ? { docenteCorreo: correoFinal } : {})
      });
      const conteos = (validacion as { conteos?: Record<string, number> })?.conteos;
      const resumen = conteos
        ? `\n\nContenido: ${Object.entries(conteos)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}`
        : '';

      const ok = window.confirm(
        `Paquete valido.${resumen}\n\n¿Deseas importar y aplicar los cambios en esta computadora?\n\nRecomendacion: haz un export antes de importar.`
      );
      if (!ok) {
        setMensaje('Importacion cancelada');
        registrarAccionDocente('sync_paquete_importar_cancelado', true, Date.now() - inicio);
        return;
      }

      // 2) Importar realmente.
      const resp = await onImportar({
        paqueteBase64,
        checksumSha256: checksumSha256 || undefined,
        ...(correoFinal ? { docenteCorreo: correoFinal } : {})
      });
      setMensaje((resp as { mensaje?: string })?.mensaje || 'Paquete importado');
      emitToast({ level: 'ok', title: 'Sincronizacion', message: 'Paquete importado', durationMs: 2600 });
      registrarAccionDocente('sync_paquete_importar', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo importar el paquete');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo importar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('sync_paquete_importar', false);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="panel">
      <h2>
        <Icono nombre="recargar" /> Backups y exportaciones
      </h2>
      <AyudaFormulario titulo="Como funciona">
        <p>
          <b>Objetivo:</b> crear respaldos locales y mover tus materias/alumnos/banco/plantillas/examenes entre instalaciones (por archivo).
        </p>
        <ul className="lista">
          <li>
            <b>Exportar:</b> genera un archivo <code>.ep-sync.json</code> (compatible con <code>.seu-sync.json</code>).
          </li>
          <li>
            <b>Guardar backup:</b> mueve el archivo exportado a una carpeta de respaldo (sugerido: <code>backups/</code> del proyecto).
          </li>
          <li>
            <b>Importar:</b> selecciona ese archivo en la otra computadora (misma cuenta docente).
          </li>
          <li>
            <b>Integridad:</b> el sistema valida checksum antes de aplicar (si no coincide, se bloquea).
          </li>
          <li>
            <b>Conflictos:</b> se conserva el registro mas nuevo (por fecha de actualizacion).
          </li>
        </ul>
        <p className="nota">
          Sugerencia: conserva al menos 2 backups recientes. Esta funcion es compatible con el flujo de recuperacion y la papeleria (dev).
        </p>
      </AyudaFormulario>

      {(ultimoExportEn || ultimoArchivoExportado || ultimoArchivoImportado) && (
        <div className="subpanel">
          <h3>Resumen de backup</h3>
          <div className="item-glass">
            <div className="item-row">
              <div>
                <div className="item-title">Ultima actividad</div>
                <div className="item-meta">
                  <span>Exportado: {ultimoExportEn ? new Date(ultimoExportEn).toLocaleString() : '-'}</span>
                  <span>Archivo exportado: {ultimoArchivoExportado || '-'}</span>
                  <span>Archivo importado: {ultimoArchivoImportado || '-'}</span>
                </div>
                <div className="item-sub">
                  {ultimoChecksum ? `Checksum: ${ultimoChecksum.slice(0, 12)}…` : 'Checksum: -'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <label className="campo">
        Materia (opcional)
        <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
          <option value="">Todas</option>
          {periodos.map((periodo) => (
            <option key={periodo._id} value={periodo._id} title={periodo._id}>
              {etiquetaMateria(periodo)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid">
        <label className="campo">
          Desde (opcional)
          <input
            type="datetime-local"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
            placeholder="YYYY-MM-DDThh:mm"
          />
        </label>
        <label className="campo campo--checkbox">
          <input type="checkbox" checked={incluirPdfs} onChange={(e) => setIncluirPdfs(e.target.checked)} />
          Incluir PDFs (puede ser pesado)
        </label>
      </div>

      <div className="acciones">
        <Boton type="button" icono={<Icono nombre="publicar" />} cargando={exportando} onClick={exportar}>
          {exportando ? 'Exportando…' : 'Exportar backup'}
        </Boton>
        <label className={importando ? 'boton boton--secundario boton--disabled' : 'boton boton--secundario'}>
          <Icono nombre="entrar" /> {importando ? 'Importando…' : 'Importar backup'}
          <input
            type="file"
            accept="application/json,.json,.ep-sync.json,.seu-sync.json"
            onChange={importar}
            disabled={importando}
            className="input-file-oculto"
          />
        </label>
      </div>

      {ultimoResumen && (
        <InlineMensaje tipo="info">
          Ultimo export{ultimoExportEn ? ` (${new Date(ultimoExportEn).toLocaleString()})` : ''}: {Object.entries(ultimoResumen)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')}
        </InlineMensaje>
      )}

      {(ultimoArchivoExportado || ultimoArchivoImportado) && (
        <div className="nota">
          {ultimoArchivoExportado ? `Exportado: ${ultimoArchivoExportado}` : ''}
          {ultimoArchivoExportado && ultimoArchivoImportado ? ' · ' : ''}
          {ultimoArchivoImportado ? `Importado: ${ultimoArchivoImportado}` : ''}
        </div>
      )}

      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
    </div>
  );
}

function SeccionSincronizacionEquipos({
  onPushServidor,
  onPullServidor
}: {
  onPushServidor: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<RespuestaSyncPush>;
  onPullServidor: (payload: { desde?: string; limite?: number }) => Promise<RespuestaSyncPull>;
}) {
  const [incluyePdfs, setIncluyePdfs] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'info' | 'ok' | 'warning' | 'error'>('info');
  const [ultimoCursor, setUltimoCursor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [trayendo, setTrayendo] = useState(false);

  async function enviarCambios() {
    try {
      const inicio = Date.now();
      setEnviando(true);
      setMensaje('');
      const respuesta = await onPushServidor({ incluirPdfs: incluyePdfs });
      const msg = respuesta.mensaje || 'Paquete enviado';
      setMensaje(msg);
      setTipoMensaje(msg.toLowerCase().includes('sin cambios') ? 'info' : 'ok');
      setUltimoCursor(respuesta.cursor || respuesta.exportadoEn || null);
      emitToast({ level: 'ok', title: 'Sincronizacion', message: msg, durationMs: 2400 });
      registrarAccionDocente('sync_push_servidor', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo enviar');
      setMensaje(msg);
      setTipoMensaje('error');
      emitToast({
        level: 'error',
        title: 'No se pudo enviar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('sync_push_servidor', false);
    } finally {
      setEnviando(false);
    }
  }

  async function traerCambios() {
    try {
      const inicio = Date.now();
      setTrayendo(true);
      setMensaje('');
      const respuesta = await onPullServidor({});
      const msg = respuesta.mensaje || 'Paquetes aplicados';
      setMensaje(msg);
      setTipoMensaje(msg.toLowerCase().includes('sin cambios') ? 'info' : 'ok');
      if (respuesta.ultimoCursor) {
        setUltimoCursor(respuesta.ultimoCursor);
      }
      emitToast({ level: 'ok', title: 'Sincronizacion', message: msg, durationMs: 2400 });
      registrarAccionDocente('sync_pull_servidor', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron traer cambios');
      setMensaje(msg);
      setTipoMensaje('error');
      emitToast({
        level: 'error',
        title: 'No se pudo traer cambios',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('sync_pull_servidor', false);
    } finally {
      setTrayendo(false);
    }
  }

  return (
    <div className="shell">
      <div className="panel shell-main">
        <h2>
          <Icono nombre="recargar" /> Sincronizacion entre equipos
        </h2>
        <p className="nota">
          Usa un servidor intermedio para mantener una sola fuente de verdad por docente, sin requerir que los equipos esten en linea al mismo tiempo.
        </p>
        <InlineMensaje tipo="info">
          Esta funcion no reemplaza los backups locales: exporta un respaldo antes de cambios grandes.
        </InlineMensaje>
        <label className="campo campo--checkbox">
          <input type="checkbox" checked={incluyePdfs} onChange={(e) => setIncluyePdfs(e.target.checked)} />
          Incluir PDFs en el envio (mas pesado)
        </label>
        <div className="acciones">
          <Boton type="button" icono={<Icono nombre="publicar" />} cargando={enviando} onClick={enviarCambios}>
            {enviando ? 'Enviando.' : 'Enviar cambios'}
          </Boton>
          <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={trayendo} onClick={traerCambios}>
            {trayendo ? 'Trayendo.' : 'Traer cambios'}
          </Boton>
        </div>
        {ultimoCursor && <div className="nota">Ultima marca recibida: {new Date(ultimoCursor).toLocaleString()}</div>}
        {mensaje && <InlineMensaje tipo={tipoMensaje}>{mensaje}</InlineMensaje>}
      </div>

      <aside className="shell-aside" aria-label="Ayuda de sincronizacion">
        <div className="shell-asideCard">
          <AyudaFormulario titulo="Para que sirve y como usarlo">
            <p>
              <b>Proposito:</b> sincronizar cambios entre equipos del mismo docente usando un servidor intermedio.
            </p>
            <ul className="lista">
              <li>
                <b>Enviar cambios:</b> sube tus cambios al servidor para que otros equipos los puedan traer despues.
              </li>
              <li>
                <b>Traer cambios:</b> aplica los cambios pendientes del servidor en esta computadora.
              </li>
              <li>
                <b>Cuenta:</b> usa el mismo docente en todos los equipos para conservar la fuente de verdad.
              </li>
            </ul>
          </AyudaFormulario>
        </div>
      </aside>
    </div>
  );
}

function SeccionSincronizacion({
  periodos,
  periodosArchivados,
  alumnos,
  plantillas,
  preguntas,
  ultimaActualizacionDatos,
  docenteCorreo,
  onPublicar,
  onCodigo,
  onExportarPaquete,
  onImportarPaquete,
  onPushServidor,
  onPullServidor
}: {
  periodos: Periodo[];
  periodosArchivados: Periodo[];
  alumnos: Alumno[];
  plantillas: Plantilla[];
  preguntas: Pregunta[];
  ultimaActualizacionDatos: number | null;
  docenteCorreo?: string;
  onPublicar: (periodoId: string) => Promise<unknown>;
  onCodigo: (periodoId: string) => Promise<{ codigo?: string; expiraEn?: string }>;
  onExportarPaquete: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<{
    paqueteBase64: string;
    checksumSha256: string;
    checksumGzipSha256?: string;
    exportadoEn: string;
    conteos: Record<string, number>;
  }>;
  onImportarPaquete: (payload: { paqueteBase64: string; checksumSha256?: string; dryRun?: boolean; docenteCorreo?: string }) => Promise<
    | { mensaje?: string; resultados?: unknown[]; pdfsGuardados?: number }
    | { mensaje?: string; checksumSha256?: string; conteos?: Record<string, number> }
  >;
  onPushServidor: (payload: { periodoId?: string; desde?: string; incluirPdfs?: boolean }) => Promise<RespuestaSyncPush>;
  onPullServidor: (payload: { desde?: string; limite?: number }) => Promise<RespuestaSyncPull>;
}) {
  const [sincronizaciones, setSincronizaciones] = useState<RegistroSincronizacion[]>([]);
  const [cargandoEstado, setCargandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState('');
  const montadoRef = useRef(true);

  const resumenDatos = useMemo(
    () => ({
      materiasActivas: periodos.length,
      materiasArchivadas: periodosArchivados.length,
      alumnos: alumnos.length,
      plantillas: plantillas.length,
      banco: preguntas.length
    }),
    [periodos.length, periodosArchivados.length, alumnos.length, plantillas.length, preguntas.length]
  );

  function formatearFecha(valor?: string) {
    if (!valor) return '-';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  }

  function normalizarEstado(estado?: string) {
    const lower = String(estado || '').toLowerCase();
    if (lower.includes('exitos')) return { clase: 'ok', texto: 'Exitosa' };
    if (lower.includes('fall')) return { clase: 'error', texto: 'Fallida' };
    if (lower.includes('pend')) return { clase: 'warn', texto: 'Pendiente' };
    return { clase: 'info', texto: 'Sin dato' };
  }

  const ordenarSincronizaciones = useCallback((lista: RegistroSincronizacion[]) => {
    return [...lista].sort((a, b) => {
      const fechaA = new Date(a.ejecutadoEn || a.createdAt || 0).getTime();
      const fechaB = new Date(b.ejecutadoEn || b.createdAt || 0).getTime();
      return fechaB - fechaA;
    });
  }, []);

  const sincronizacionReciente = sincronizaciones[0];
  const fechaActualizacion = ultimaActualizacionDatos ? new Date(ultimaActualizacionDatos).toLocaleString() : '-';

  const refrescarEstado = useCallback(() => {
    setCargandoEstado(true);
    setErrorEstado('');
    clienteApi
      .obtener<{ sincronizaciones?: RegistroSincronizacion[] }>('/sincronizaciones?limite=6')
      .then((payload) => {
        if (!montadoRef.current) return;
        const lista = Array.isArray(payload.sincronizaciones) ? payload.sincronizaciones : [];
        setSincronizaciones(ordenarSincronizaciones(lista));
      })
      .catch((error) => {
        if (!montadoRef.current) return;
        setSincronizaciones([]);
        setErrorEstado(mensajeDeError(error, 'No se pudo obtener el estado de sincronización'));
      })
      .finally(() => {
        if (!montadoRef.current) return;
        setCargandoEstado(false);
      });
  }, [ordenarSincronizaciones]);

  useEffect(() => {
    montadoRef.current = true;
    const timer = window.setTimeout(() => {
      if (!montadoRef.current) return;
      refrescarEstado();
    }, 0);
    return () => {
      montadoRef.current = false;
      window.clearTimeout(timer);
    };
  }, [refrescarEstado]);

  return (
    <div className="panel">
      <div className="panel">
        <h2>
          <Icono nombre="publicar" /> Sincronización, backups y estado de datos
        </h2>
        <p className="nota">
          Esta pantalla concentra la sincronización con el portal y el flujo de backups/exportaciones entre equipos.
        </p>
        <div className="estado-datos-grid">
          <div className="item-glass estado-datos-card">
            <div className="estado-datos-header">
              <div>
                <div className="estado-datos-titulo">Estado de datos locales</div>
                <div className="nota">Actualizado: {fechaActualizacion}</div>
              </div>
              <span className="estado-chip info">Local</span>
            </div>
            <div className="estado-datos-cifras">
              <div>
                <div className="estado-datos-numero">{resumenDatos.materiasActivas}</div>
                <div className="nota">Materias activas</div>
              </div>
              <div>
                <div className="estado-datos-numero">{resumenDatos.materiasArchivadas}</div>
                <div className="nota">Materias archivadas</div>
              </div>
              <div>
                <div className="estado-datos-numero">{resumenDatos.alumnos}</div>
                <div className="nota">Alumnos</div>
              </div>
              <div>
                <div className="estado-datos-numero">{resumenDatos.plantillas}</div>
                <div className="nota">Plantillas</div>
              </div>
              <div>
                <div className="estado-datos-numero">{resumenDatos.banco}</div>
                <div className="nota">Banco de preguntas</div>
              </div>
            </div>
          </div>
          <div className="item-glass estado-datos-card">
            <div className="estado-datos-header">
              <div>
                <div className="estado-datos-titulo">Ultima sincronización</div>
                <div className="nota">
                  {sincronizacionReciente ? formatearFecha(sincronizacionReciente.ejecutadoEn || sincronizacionReciente.createdAt) : 'Sin registros'}
                </div>
              </div>
              <span className={`estado-chip ${normalizarEstado(sincronizacionReciente?.estado).clase}`}>
                {normalizarEstado(sincronizacionReciente?.estado).texto}
              </span>
            </div>
            <div className="estado-datos-lista">
              {(sincronizaciones.length ? sincronizaciones : [{} as RegistroSincronizacion]).slice(0, 4).map((item, idx) => {
                if (!item || !item.estado) {
                  return (
                    <div key={`vacio-${idx}`} className="estado-datos-item">
                      <div className="nota">No hay historial disponible.</div>
                    </div>
                  );
                }
                const estado = normalizarEstado(item.estado);
                return (
                  <div key={item._id || `sync-${idx}`} className="estado-datos-item">
                    <span className={`estado-chip ${estado.clase}`}>{estado.texto}</span>
                    <div>
                      <div className="estado-datos-item__titulo">{String(item.tipo || 'publicacion').toUpperCase()}</div>
                      <div className="nota">{formatearFecha(item.ejecutadoEn || item.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {errorEstado && <InlineMensaje tipo="warning">{errorEstado}</InlineMensaje>}
            <div className="acciones">
              <Boton type="button" variante="secundario" icono={<Icono nombre="recargar" />} cargando={cargandoEstado} onClick={() => refrescarEstado()}>
                {cargandoEstado ? 'Actualizando.' : 'Actualizar estado'}
              </Boton>
            </div>
          </div>
        </div>
      </div>
      <div className="sincronizacion-grid">
        <SeccionPublicar periodos={periodos} onPublicar={onPublicar} onCodigo={onCodigo} />
        <SeccionPaqueteSincronizacion
          periodos={periodos}
          docenteCorreo={docenteCorreo}
          onExportar={onExportarPaquete}
          onImportar={onImportarPaquete}
        />
        <SeccionSincronizacionEquipos onPushServidor={onPushServidor} onPullServidor={onPullServidor} />
      </div>
    </div>
  );
}



























