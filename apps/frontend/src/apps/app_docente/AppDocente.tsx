/**
 * Shell principal del dominio docente.
 *
 * Responsabilidad:
 * - Orquestar sesion, permisos, carga base de datos y navegacion por vistas.
 * - Delegar UI/flujo especifico a secciones por dominio.
 *
 * Limites:
 * - Evitar logica de negocio profunda en este archivo.
 * - Nuevos flujos deben extraerse a hooks/services/features.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guardarTokenDocente, limpiarTokenDocente } from '../../servicios_api/clienteApi';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import { ShellDocente } from './ShellDocente';
import { SeccionAutenticacion } from './SeccionAutenticacion';
import { SeccionAlumnos } from './SeccionAlumnos';
import { SeccionBanco } from './SeccionBanco';
import { SeccionCuenta } from './SeccionCuenta';
import { SeccionPlantillas } from './SeccionPlantillas';
import { SeccionPeriodos, SeccionPeriodosArchivados } from './SeccionPeriodos';
import { SeccionEntrega } from './SeccionEntregaInterna';
import { SeccionCalificaciones } from './SeccionCalificaciones';
import { SeccionSincronizacion } from './SeccionSincronizacion';
import { usePermisosDocente } from './hooks/usePermisosDocente';
import { useSesionDocente } from './hooks/useSesionDocente';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  Docente,
  ExamenGeneradoClave,
  Periodo,
  Plantilla,
  Pregunta,
  PreviewCalificacion,
  PreviewPlantilla,
  RespuestaSyncPull,
  RespuestaSyncPush,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RevisionExamenOmr,
  RevisionPaginaOmr
} from './tipos';
import {
  combinarRespuestasOmrPaginas,
  construirClaveCorrectaExamen,
  consolidarResultadoOmrExamen,
  normalizarResultadoOmr,
  obtenerVistaInicial,
} from './utilidades';


export function AppDocente() {
  const [docente, setDocente] = useState<Docente | null>(null);
  const [vista, setVista] = useState(obtenerVistaInicial());
  const {
    puede,
    permisosUI,
    itemsVista,
    esAdmin,
    esDev,
    puedeEliminarPlantillaDev,
    puedeEliminarMateriaDev,
    puedeEliminarAlumnoDev
  } = usePermisosDocente(docente);
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

  useSesionDocente({ setDocente, onCerrarSesion: cerrarSesion, montadoRef });

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

  return <ShellDocente docente={docente} onCerrarSesion={cerrarSesion}>{contenido}</ShellDocente>;
}
