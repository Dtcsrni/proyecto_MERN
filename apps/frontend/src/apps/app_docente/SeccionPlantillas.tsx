import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorRemoto, accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from './AyudaFormulario';
import { clienteApi } from './clienteApiDocente';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  EnviarConPermiso,
  Periodo,
  PermisosUI,
  Plantilla,
  Pregunta,
  PreviewPlantilla
} from './tipos';
import { esMensajeError, etiquetaMateria, idCortoMateria, mensajeDeError } from './utilidades';
export function SeccionPlantillas({
  plantillas,
  periodos,
  preguntas,
  alumnos,
  permisos,
  puedeEliminarPlantillaDev,
  enviarConPermiso,
  avisarSinPermiso,
  previewPorPlantillaId,
  setPreviewPorPlantillaId,
  cargandoPreviewPlantillaId,
  setCargandoPreviewPlantillaId,
  plantillaPreviewId,
  setPlantillaPreviewId,
  previewPdfUrlPorPlantillaId,
  setPreviewPdfUrlPorPlantillaId,
  cargandoPreviewPdfPlantillaId,
  setCargandoPreviewPdfPlantillaId,
  onRefrescar
}: {
  plantillas: Plantilla[];
  periodos: Periodo[];
  preguntas: Pregunta[];
  alumnos: Alumno[];
  permisos: PermisosUI;
  puedeEliminarPlantillaDev: boolean;
  enviarConPermiso: EnviarConPermiso;
  avisarSinPermiso: (mensaje: string) => void;
  previewPorPlantillaId: Record<string, PreviewPlantilla>;
  setPreviewPorPlantillaId: Dispatch<SetStateAction<Record<string, PreviewPlantilla>>>;
  cargandoPreviewPlantillaId: string | null;
  setCargandoPreviewPlantillaId: Dispatch<SetStateAction<string | null>>;
  plantillaPreviewId: string | null;
  setPlantillaPreviewId: Dispatch<SetStateAction<string | null>>;
  previewPdfUrlPorPlantillaId: Record<string, string>;
  setPreviewPdfUrlPorPlantillaId: Dispatch<SetStateAction<Record<string, string>>>;
  cargandoPreviewPdfPlantillaId: string | null;
  setCargandoPreviewPdfPlantillaId: Dispatch<SetStateAction<string | null>>;
  onRefrescar: () => void;
}) {
  const INSTRUCCIONES_DEFAULT =
    'Por favor conteste las siguientes preguntas referentes al parcial. ' +
    'Rellene el círculo de la respuesta más adecuada, evitando salirse del mismo. ' +
    'Cada pregunta vale 10 puntos si está completa y es correcta.';

  type ExamenGeneradoResumen = {
    _id: string;
    folio: string;
    plantillaId: string;
    alumnoId?: string | null;
    estado?: string;
    generadoEn?: string;
    descargadoEn?: string;
    paginas?: Array<{ numero: number; qrTexto?: string; preguntasDel?: number; preguntasAl?: number }>;
  };

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'parcial' | 'global'>('parcial');
  const [periodoId, setPeriodoId] = useState('');
  const [numeroPaginas, setNumeroPaginas] = useState(2);
  const [temasSeleccionados, setTemasSeleccionados] = useState<string[]>([]);
  const [instrucciones, setInstrucciones] = useState(INSTRUCCIONES_DEFAULT);
  const [mensaje, setMensaje] = useState('');
  const [plantillaId, setPlantillaId] = useState('');
  const [alumnoId, setAlumnoId] = useState('');
  const [mensajeGeneracion, setMensajeGeneracion] = useState('');
  const [lotePdfUrl, setLotePdfUrl] = useState<string | null>(null);
  const [ultimoGenerado, setUltimoGenerado] = useState<ExamenGeneradoResumen | null>(null);
  const [examenesGenerados, setExamenesGenerados] = useState<ExamenGeneradoResumen[]>([]);
  const [cargandoExamenesGenerados, setCargandoExamenesGenerados] = useState(false);
  const [descargandoExamenId, setDescargandoExamenId] = useState<string | null>(null);
  const [regenerandoExamenId, setRegenerandoExamenId] = useState<string | null>(null);
  const [archivandoExamenId, setArchivandoExamenId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [generandoLote, setGenerandoLote] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [plantillaEditandoId, setPlantillaEditandoId] = useState<string | null>(null);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [archivandoPlantillaId, setArchivandoPlantillaId] = useState<string | null>(null);
  const [eliminandoPlantillaId, setEliminandoPlantillaId] = useState<string | null>(null);
  const [filtroPlantillas, setFiltroPlantillas] = useState('');
  const [refrescandoPlantillas, setRefrescandoPlantillas] = useState(false);
  const puedeLeerExamenes = permisos.examenes.leer;
  const puedeGenerarExamenes = permisos.examenes.generar;
  const puedeArchivarExamenes = permisos.examenes.archivar;
  const puedeRegenerarExamenes = permisos.examenes.regenerar;
  const puedeDescargarExamenes = permisos.examenes.descargar;
  const puedeGestionarPlantillas = permisos.plantillas.gestionar;
  const puedeArchivarPlantillas = permisos.plantillas.archivar;
  const puedePrevisualizarPlantillas = permisos.plantillas.previsualizar;
  const bloqueoEdicion = !puedeGestionarPlantillas;

  const [pdfFullscreenUrl, setPdfFullscreenUrl] = useState<string | null>(null);

  const abrirPdfFullscreen = useCallback((url: string) => {
    const u = String(url || '').trim();
    if (!u) return;
    setPdfFullscreenUrl(u);
  }, []);

  const cerrarPdfFullscreen = useCallback(() => {
    setPdfFullscreenUrl(null);
  }, []);

  const plantillaSeleccionada = useMemo(() => {
    return (Array.isArray(plantillas) ? plantillas : []).find((p) => p._id === plantillaId) ?? null;
  }, [plantillas, plantillaId]);

  const plantillaEditando = useMemo(() => {
    if (!plantillaEditandoId) return null;
    return (Array.isArray(plantillas) ? plantillas : []).find((p) => p._id === plantillaEditandoId) ?? null;
  }, [plantillas, plantillaEditandoId]);

  const alumnosPorId = useMemo(() => {
    const mapa = new Map<string, Alumno>();
    for (const a of Array.isArray(alumnos) ? alumnos : []) {
      mapa.set(a._id, a);
    }
    return mapa;
  }, [alumnos]);

  const formatearFechaHora = useCallback((valor?: string) => {
    const v = String(valor || '').trim();
    if (!v) return '-';
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return v;
    return d.toLocaleString();
  }, []);

  const cargarExamenesGenerados = useCallback(async () => {
    if (!plantillaId) {
      setExamenesGenerados([]);
      return;
    }
    if (!puedeLeerExamenes) {
      setExamenesGenerados([]);
      return;
    }
    try {
      setCargandoExamenesGenerados(true);
      const payload = await clienteApi.obtener<{ examenes: ExamenGeneradoResumen[] }>(
        `/examenes/generados?plantillaId=${encodeURIComponent(plantillaId)}&limite=50`
      );
      setExamenesGenerados(Array.isArray(payload.examenes) ? payload.examenes : []);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo cargar el listado de examenes generados');
      setMensajeGeneracion(msg);
    } finally {
      setCargandoExamenesGenerados(false);
    }
  }, [plantillaId, puedeLeerExamenes]);

  useEffect(() => {
    setUltimoGenerado(null);
    setLotePdfUrl(null);
    void cargarExamenesGenerados();
  }, [plantillaId, cargarExamenesGenerados]);

  const descargarPdfExamen = useCallback(
    async (examen: ExamenGeneradoResumen) => {
      if (descargandoExamenId === examen._id) return;
      if (!puedeDescargarExamenes) {
        avisarSinPermiso('No tienes permiso para descargar examenes.');
        return;
      }
      const token = obtenerTokenDocente();
      if (!token) {
        setMensajeGeneracion('Sesion no valida. Vuelve a iniciar sesion.');
        return;
      }

      const intentar = async (t: string) =>
        fetch(`${clienteApi.baseApi}/examenes/generados/${encodeURIComponent(examen._id)}/pdf`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${t}` }
        });

      try {
        setDescargandoExamenId(examen._id);
        setMensajeGeneracion('');

        let resp = await intentar(token);
        if (resp.status === 401) {
          const nuevo = await clienteApi.intentarRefrescarToken();
          if (nuevo) resp = await intentar(nuevo);
        }

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const blob = await resp.blob();
        const cd = resp.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i);
        const nombreDesdeHeader = match
          ? decodeURIComponent(String(match[1] || match[2] || match[3] || '').trim().replace(/^"|"$/g, ''))
          : '';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreDesdeHeader || `examen_${String(examen.folio || 'examen')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        emitToast({ level: 'ok', title: 'PDF', message: 'Descarga iniciada', durationMs: 1800 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo descargar el PDF');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'No se pudo descargar',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setDescargandoExamenId(null);
      }
    },
    [avisarSinPermiso, cargarExamenesGenerados, descargandoExamenId, puedeDescargarExamenes]
  );

  const descargarPdfLote = useCallback(async () => {
    if (!lotePdfUrl) return;
    if (!puedeDescargarExamenes) {
      avisarSinPermiso('No tienes permiso para descargar examenes.');
      return;
    }
    const token = obtenerTokenDocente();
    if (!token) {
      setMensajeGeneracion('Sesion no valida. Vuelve a iniciar sesion.');
      return;
    }
    try {
      const resp = await fetch(`${clienteApi.baseApi}${lotePdfUrl}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `examenes_lote_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo descargar el PDF de lote');
      setMensajeGeneracion(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo descargar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
    }
  }, [avisarSinPermiso, lotePdfUrl, puedeDescargarExamenes]);

  const regenerarPdfExamen = useCallback(
    async (examen: ExamenGeneradoResumen) => {
      if (regenerandoExamenId === examen._id) return;
      if (!puedeRegenerarExamenes) {
        avisarSinPermiso('No tienes permiso para regenerar examenes.');
        return;
      }
      try {
        setMensajeGeneracion('');
        setRegenerandoExamenId(examen._id);

        const yaDescargado = Boolean(String(examen.descargadoEn || '').trim());

        let forzar = false;
        if (yaDescargado) {
          const ok = globalThis.confirm(
            'Este examen ya fue descargado. Regenerarlo puede cambiar el PDF (y tu copia descargada).\n\n¿Deseas continuar?'
          );
          if (!ok) return;
          forzar = true;
        }

        await enviarConPermiso(
          'examenes:regenerar',
          `/examenes/generados/${encodeURIComponent(examen._id)}/regenerar`,
          { ...(forzar ? { forzar: true } : {}) },
          'No tienes permiso para regenerar examenes.'
        );

        emitToast({ level: 'ok', title: 'Examen', message: 'PDF regenerado', durationMs: 2000 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo regenerar el PDF');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'No se pudo regenerar',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setRegenerandoExamenId(null);
      }
    },
    [avisarSinPermiso, cargarExamenesGenerados, enviarConPermiso, puedeRegenerarExamenes, regenerandoExamenId]
  );

  const archivarExamenGenerado = useCallback(
    async (examen: ExamenGeneradoResumen) => {
      if (archivandoExamenId === examen._id) return;
      if (!puedeArchivarExamenes) {
        avisarSinPermiso('No tienes permiso para archivar examenes.');
        return;
      }
      try {
        setMensajeGeneracion('');
        setArchivandoExamenId(examen._id);

        const ok = globalThis.confirm(
          `¿Archivar el examen generado (folio: ${String(examen.folio || '').trim() || 'sin folio'})?\n\nSe ocultará del listado activo, pero no se borrarán sus datos.`
        );
        if (!ok) return;

        await enviarConPermiso(
          'examenes:archivar',
          `/examenes/generados/${encodeURIComponent(examen._id)}/archivar`,
          {},
          'No tienes permiso para archivar examenes.'
        );

        emitToast({ level: 'ok', title: 'Examen', message: 'Examen archivado', durationMs: 2000 });
        await cargarExamenesGenerados();
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo archivar el examen');
        setMensajeGeneracion(msg);
        emitToast({
          level: 'error',
          title: 'No se pudo archivar',
          message: msg,
          durationMs: 5200,
          action: accionToastSesionParaError(error, 'docente')
        });
      } finally {
        setArchivandoExamenId(null);
      }
    },
    [avisarSinPermiso, cargarExamenesGenerados, enviarConPermiso, puedeArchivarExamenes, archivandoExamenId]
  );

  const preguntasDisponibles = useMemo(() => {
    if (!periodoId) return [];
    const lista = Array.isArray(preguntas) ? preguntas : [];
    return lista.filter((p) => p.periodoId === periodoId);
  }, [preguntas, periodoId]);

  const temasDisponibles = useMemo(() => {
    const mapa = new Map<string, { tema: string; total: number }>();
    for (const pregunta of preguntasDisponibles) {
      const tema = String(pregunta.tema ?? '').trim().replace(/\s+/g, ' ');
      if (!tema) continue;
      const key = tema.toLowerCase();
      const actual = mapa.get(key);
      if (actual) {
        actual.total += 1;
      } else {
        mapa.set(key, { tema, total: 1 });
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.tema.localeCompare(b.tema));
  }, [preguntasDisponibles]);

  const totalDisponiblePorTemas = useMemo(() => {
    if (temasSeleccionados.length === 0) return 0;
    const seleccion = new Set(temasSeleccionados.map((t) => t.toLowerCase()));
    return temasDisponibles
      .filter((t) => seleccion.has(t.tema.toLowerCase()))
      .reduce((acc, item) => acc + item.total, 0);
  }, [temasDisponibles, temasSeleccionados]);

  useEffect(() => {
    setTemasSeleccionados([]);
  }, [periodoId]);

  useEffect(() => {
    // Defaults para creacion.
    if (!modoEdicion) {
      setInstrucciones(INSTRUCCIONES_DEFAULT);
    }
  }, [modoEdicion, INSTRUCCIONES_DEFAULT]);

  const puedeCrear = Boolean(
    titulo.trim() &&
      periodoId &&
      temasSeleccionados.length > 0 &&
      numeroPaginas > 0
  );
  const puedeGenerar = Boolean(plantillaId) && puedeGenerarExamenes;

  const plantillasFiltradas = useMemo(() => {
    const q = String(filtroPlantillas || '').trim().toLowerCase();
    const lista = Array.isArray(plantillas) ? plantillas : [];
    const base = q
      ? lista.filter((p) => {
          const t = String(p.titulo || '').toLowerCase();
          const id = String(p._id || '').toLowerCase();
          const temas = (Array.isArray(p.temas) ? p.temas : []).join(' ').toLowerCase();
          return t.includes(q) || id.includes(q) || temas.includes(q);
        })
      : lista;
    return base;
  }, [plantillas, filtroPlantillas]);

  const totalPlantillas = plantillasFiltradas.length;
  const totalPlantillasTodas = Array.isArray(plantillas) ? plantillas.length : 0;

  async function refrescarPlantillas() {
    if (refrescandoPlantillas) return;
    try {
      setRefrescandoPlantillas(true);
      await Promise.resolve(onRefrescar());
    } finally {
      setRefrescandoPlantillas(false);
    }
  }

  function limpiarFiltroPlantillas() {
    setFiltroPlantillas('');
  }

  function iniciarEdicion(plantilla: Plantilla) {
    setModoEdicion(true);
    setPlantillaEditandoId(plantilla._id);
    setTitulo(String(plantilla.titulo || ''));
    setTipo(plantilla.tipo);
    setPeriodoId(String(plantilla.periodoId || ''));
    setNumeroPaginas(Number((plantilla as unknown as { numeroPaginas?: unknown })?.numeroPaginas ?? 1));
    setTemasSeleccionados(Array.isArray(plantilla.temas) ? plantilla.temas : []);
    setInstrucciones(String(plantilla.instrucciones || ''));
    setMensaje('');
  }

  function cancelarEdicion() {
    setModoEdicion(false);
    setPlantillaEditandoId(null);
    setTitulo('');
    setTipo('parcial');
    setPeriodoId('');
    setNumeroPaginas(2);
    setTemasSeleccionados([]);
    setInstrucciones(INSTRUCCIONES_DEFAULT);
    setMensaje('');
  }

  async function guardarEdicion() {
    if (!plantillaEditandoId || guardandoPlantilla) return;
    try {
      const inicio = Date.now();
      if (!puedeGestionarPlantillas) {
        avisarSinPermiso('No tienes permiso para editar plantillas.');
        return;
      }
      setGuardandoPlantilla(true);
      setMensaje('');

      const payload: Record<string, unknown> = {
        titulo: titulo.trim(),
        tipo,
        numeroPaginas: Math.max(1, Math.floor(numeroPaginas)),
        instrucciones: String(instrucciones || '').trim() || undefined
      };
      if (periodoId) payload.periodoId = periodoId;

      // Solo enviar temas si hay seleccion o si la plantilla ya estaba en modo temas.
      const temasPrevios =
        plantillaEditando && Array.isArray(plantillaEditando.temas) ? plantillaEditando.temas : [];
      const estabaEnTemas = temasPrevios.length > 0;
      if (temasSeleccionados.length > 0 || estabaEnTemas) {
        payload.temas = temasSeleccionados;
      }

      await enviarConPermiso(
        'plantillas:gestionar',
        `/examenes/plantillas/${encodeURIComponent(plantillaEditandoId)}`,
        payload,
        'No tienes permiso para editar plantillas.'
      );
      emitToast({ level: 'ok', title: 'Plantillas', message: 'Plantilla actualizada', durationMs: 2200 });
      registrarAccionDocente('actualizar_plantilla', true, Date.now() - inicio);
      cancelarEdicion();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar la plantilla');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo actualizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('actualizar_plantilla', false);
    } finally {
      setGuardandoPlantilla(false);
    }
  }

  async function archivarPlantilla(plantilla: Plantilla) {
    if (archivandoPlantillaId === plantilla._id) return;
    if (!puedeArchivarPlantillas) {
      avisarSinPermiso('No tienes permiso para archivar plantillas.');
      return;
    }
    const ok = globalThis.confirm(
      `¿Archivar la plantilla "${String(plantilla.titulo || '').trim()}"?\n\nSe ocultará del listado activo, pero no se borrarán sus datos.`
    );
    if (!ok) return;
    try {
      const inicio = Date.now();
      setArchivandoPlantillaId(plantilla._id);
      setMensaje('');
      await enviarConPermiso(
        'plantillas:archivar',
        `/examenes/plantillas/${encodeURIComponent(plantilla._id)}/archivar`,
        {},
        'No tienes permiso para archivar plantillas.'
      );
      emitToast({ level: 'ok', title: 'Plantillas', message: 'Plantilla archivada', durationMs: 2200 });
      registrarAccionDocente('archivar_plantilla', true, Date.now() - inicio);
      if (plantillaId === plantilla._id) setPlantillaId('');
      if (plantillaEditandoId === plantilla._id) cancelarEdicion();
      if (plantillaPreviewId === plantilla._id) setPlantillaPreviewId(null);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo archivar la plantilla');
      setMensaje(msg);

      // Caso especial: plantilla con exámenes generados (409). Ofrecemos atajo a la lista.
      if (error instanceof ErrorRemoto) {
        const codigo = String(error.detalle?.codigo || '').toUpperCase();
        if (codigo.includes('PLANTILLA_CON_EXAMENES')) {
          const detalles = error.detalle?.detalles as { totalGenerados?: unknown } | undefined;
          const total = Number(detalles?.totalGenerados ?? NaN);
          const totalOk = Number.isFinite(total) && total > 0;
          const msgDetallado = totalOk
            ? `No se puede archivar: hay ${total} examenes generados con esta plantilla. Archivarlos primero.`
            : msg;

          emitToast({
            level: 'warn',
            title: 'Plantilla con examenes',
            message: msgDetallado,
            durationMs: 6500,
            action: {
              label: 'Ver generados',
              onClick: () => {
                setPlantillaId(plantilla._id);
                // Esperar un tick para que renderice la sección.
                window.setTimeout(() => {
                  document.getElementById('examenes-generados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 200);
              }
            }
          });

          registrarAccionDocente('archivar_plantilla', false);
          return;
        }
      }

      emitToast({
        level: 'error',
        title: 'No se pudo archivar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('archivar_plantilla', false);
    } finally {
      setArchivandoPlantillaId(null);
    }
  }

  async function eliminarPlantillaDev(plantilla: Plantilla) {
    if (!puedeEliminarPlantillaDev) {
      avisarSinPermiso('No tienes permiso para eliminar plantillas en desarrollo.');
      return;
    }
    if (eliminandoPlantillaId === plantilla._id) return;
    const ok = globalThis.confirm(
      `¿Eliminar definitivamente la plantilla "${String(plantilla.titulo || '').trim()}"?\n\nEsta acción es solo para desarrollo y no se puede deshacer.`
    );
    if (!ok) return;
    try {
      const inicio = Date.now();
      setEliminandoPlantillaId(plantilla._id);
      setMensaje('');
      await enviarConPermiso(
        'plantillas:eliminar_dev',
        `/examenes/plantillas/${encodeURIComponent(plantilla._id)}/eliminar`,
        {},
        'No tienes permiso para eliminar plantillas en desarrollo.'
      );
      emitToast({ level: 'ok', title: 'Plantillas', message: 'Plantilla eliminada', durationMs: 2200 });
      registrarAccionDocente('eliminar_plantilla', true, Date.now() - inicio);
      if (plantillaId === plantilla._id) setPlantillaId('');
      if (plantillaEditandoId === plantilla._id) cancelarEdicion();
      if (plantillaPreviewId === plantilla._id) setPlantillaPreviewId(null);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo eliminar la plantilla');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'Plantillas',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('eliminar_plantilla', false);
    } finally {
      setEliminandoPlantillaId(null);
    }
  }

  async function cargarPreviewPlantilla(id: string) {
    if (cargandoPreviewPlantillaId === id) return;
    if (!puedePrevisualizarPlantillas) {
      avisarSinPermiso('No tienes permiso para previsualizar plantillas.');
      return;
    }
    try {
      setCargandoPreviewPlantillaId(id);
      const payload = await clienteApi.obtener<PreviewPlantilla>(
        `/examenes/plantillas/${encodeURIComponent(id)}/previsualizar`
      );
      setPreviewPorPlantillaId((prev) => ({ ...prev, [id]: payload }));
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo generar la previsualizacion de la plantilla');
      emitToast({
        level: 'error',
        title: 'Previsualizacion',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
    } finally {
      setCargandoPreviewPlantillaId(null);
    }
  }

  async function togglePreviewPlantilla(id: string) {
    if (cargandoPreviewPlantillaId === id) return;
    setPlantillaPreviewId((prev) => (prev === id ? null : id));
    if (!previewPorPlantillaId[id]) {
      await cargarPreviewPlantilla(id);
    }
  }

  async function cargarPreviewPdfPlantilla(id: string) {
    if (cargandoPreviewPdfPlantillaId === id) return;
    if (!puedePrevisualizarPlantillas) {
      avisarSinPermiso('No tienes permiso para previsualizar plantillas.');
      return;
    }
    const token = obtenerTokenDocente();
    if (!token) {
      emitToast({ level: 'error', title: 'Sesion no valida', message: 'Vuelve a iniciar sesion.', durationMs: 4200 });
      return;
    }

    const intentar = async (t: string) =>
      fetch(`${clienteApi.baseApi}/examenes/plantillas/${encodeURIComponent(id)}/previsualizar/pdf`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${t}` }
      });

    try {
      setCargandoPreviewPdfPlantillaId(id);
      let resp = await intentar(token);
      if (resp.status === 401) {
        const nuevo = await clienteApi.intentarRefrescarToken();
        if (nuevo) resp = await intentar(nuevo);
      }
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrlPorPlantillaId((prev) => {
        const anterior = prev[id];
        if (anterior) URL.revokeObjectURL(anterior);
        return { ...prev, [id]: url };
      });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo generar el PDF de previsualizacion');
      emitToast({
        level: 'error',
        title: 'Previsualizacion PDF',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
    } finally {
      setCargandoPreviewPdfPlantillaId(null);
    }
  }

  function cerrarPreviewPdfPlantilla(id: string) {
    setPreviewPdfUrlPorPlantillaId((prev) => {
      const actual = prev[id];
      if (actual) URL.revokeObjectURL(actual);
      const copia = { ...prev };
      delete copia[id];
      return copia;
    });
  }

  async function crear() {
    if (creando) return;
    try {
      const inicio = Date.now();
      if (!puedeGestionarPlantillas) {
        avisarSinPermiso('No tienes permiso para crear plantillas.');
        return;
      }
      setCreando(true);
      setMensaje('');

      const payload: Record<string, unknown> = {
        tipo,
        titulo: titulo.trim(),
        instrucciones: String(instrucciones || '').trim() || undefined,
        numeroPaginas: Math.max(1, Math.floor(numeroPaginas))
      };
      const periodoIdNorm = String(periodoId || '').trim();
      if (periodoIdNorm) payload.periodoId = periodoIdNorm;
      if (temasSeleccionados.length > 0) payload.temas = temasSeleccionados;

      await enviarConPermiso(
        'plantillas:gestionar',
        '/examenes/plantillas',
        payload,
        'No tienes permiso para crear plantillas.'
      );
      setMensaje('Plantilla creada');
      emitToast({ level: 'ok', title: 'Plantillas', message: 'Plantilla creada', durationMs: 2200 });
      registrarAccionDocente('crear_plantilla', true, Date.now() - inicio);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo crear');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo crear',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('crear_plantilla', false);
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="panel">
      <div className="plantillas-header">
        <h2>
          <Icono nombre="plantillas" /> Plantillas
        </h2>
        <div className="plantillas-actions">
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="recargar" />}
            cargando={refrescandoPlantillas}
            onClick={() => void refrescarPlantillas()}
            data-tooltip="Recarga la lista de plantillas desde el servidor."
          >
            {refrescandoPlantillas ? 'Actualizando…' : 'Actualizar'}
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            disabled={!filtroPlantillas.trim()}
            onClick={limpiarFiltroPlantillas}
            data-tooltip="Quita el filtro de busqueda y muestra todas las plantillas."
          >
            Limpiar filtro
          </Boton>
        </div>
      </div>
      <div className="plantillas-grid">
        <div className="subpanel plantillas-panel plantillas-panel--form">
      <AyudaFormulario titulo="Para que sirve y como llenarlo">
        <p>
          <b>Proposito:</b> crear una plantilla de examen (estructura + reactivos) para generar examenes en PDF.
        </p>
        <ul className="lista">
          <li>
            <b>Titulo:</b> nombre descriptivo (ej. <code>Parcial 1 - Algebra</code>).
          </li>
          <li>
            <b>Tipo:</b> <code>parcial</code> o <code>global</code> (afecta campos de calificacion).
          </li>
          <li>
            <b>Materia:</b> la materia a la que pertenece.
          </li>
          <li>
            <b>Numero de paginas:</b> cuantas paginas debe tener el examen (entero mayor o igual a 1).
          </li>
          <li>
            <b>Temas:</b> selecciona uno o mas; el examen toma preguntas al azar de esos temas.
          </li>
        </ul>
        <p>
          Ejemplo: titulo <code>Parcial 1 - Programacion</code>, tipo <code>parcial</code>, paginas <code>2</code>, temas: <code>Arreglos</code> + <code>Funciones</code>.
        </p>
      </AyudaFormulario>
      <div className="ayuda">
        {modoEdicion && plantillaEditando ? (
          <>
            Editando: <b>{plantillaEditando.titulo}</b> (ID: {idCortoMateria(plantillaEditando._id)})
          </>
        ) : (
          'Crea plantillas por temas, o edita una existente.'
        )}
      </div>
      <div className="plantillas-form">
        <label className="campo">
          Titulo
          <input
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            disabled={bloqueoEdicion}
            data-tooltip="Nombre visible de la plantilla."
          />
        </label>
        <label className="campo">
          Tipo
          <select
            value={tipo}
            onChange={(event) => setTipo(event.target.value as 'parcial' | 'global')}
            disabled={bloqueoEdicion}
            data-tooltip="Define si es parcial o global."
          >
            <option value="parcial">Parcial</option>
            <option value="global">Global</option>
          </select>
        </label>
        <label className="campo">
          Materia
          <select
            value={periodoId}
            onChange={(event) => setPeriodoId(event.target.value)}
            disabled={bloqueoEdicion}
            data-tooltip="Materia a la que pertenece la plantilla."
          >
            <option value="">Selecciona</option>
            {periodos.map((periodo) => (
              <option key={periodo._id} value={periodo._id} title={periodo._id}>
                {etiquetaMateria(periodo)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Numero de paginas
          <input
            type="number"
            min={1}
            step={1}
            value={numeroPaginas}
            onChange={(event) => setNumeroPaginas(Number(event.target.value))}
            disabled={bloqueoEdicion}
            data-tooltip="Cantidad total de paginas del examen."
          />
        </label>

        <label className="campo plantillas-form__full">
          Instrucciones (opcional)
          <textarea
            value={instrucciones}
            onChange={(event) => setInstrucciones(event.target.value)}
            rows={3}
            disabled={bloqueoEdicion}
            data-tooltip="Texto opcional que aparece en el examen."
          />
        </label>

        <label className="campo plantillas-form__full" data-tooltip="Selecciona los temas que alimentan la plantilla.">
          Temas
          {periodoId && temasDisponibles.length === 0 && (
            <span className="ayuda">No hay temas para esta materia. Ve a &quot;Banco&quot; y crea preguntas con tema.</span>
          )}
          {temasDisponibles.length > 0 && (
            <ul className="lista lista-items">
              {temasDisponibles.map((item) => {
                const checked = temasSeleccionados.some((t) => t.toLowerCase() === item.tema.toLowerCase());
                return (
                  <li key={item.tema}>
                    <div className="item-glass">
                      <div className="item-row">
                        <div>
                          <div className="item-title">{item.tema}</div>
                          <div className="item-sub">Preguntas disponibles: {item.total}</div>
                        </div>
                        <div className="item-actions">
                          <label className="campo campo-inline">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setTemasSeleccionados((prev) =>
                                  checked
                                    ? prev.filter((t) => t.toLowerCase() !== item.tema.toLowerCase())
                                    : [...prev, item.tema]
                                );
                              }}
                              disabled={bloqueoEdicion}
                              data-tooltip="Incluye este tema en la plantilla."
                            />
                            Usar
                          </label>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {temasSeleccionados.length > 0 && (
            <span className="ayuda">
              Total disponible en temas seleccionados: {totalDisponiblePorTemas}. Paginas solicitadas: {Math.max(1, Math.floor(numeroPaginas))}.
              {' '}Si faltan preguntas, el sistema avisara; solo bloqueara si la ultima pagina queda mas de la mitad vacia.
            </span>
          )}
        </label>
      </div>
      <div className="acciones acciones--mt">
        {!modoEdicion && (
          <Boton
            type="button"
            icono={<Icono nombre="nuevo" />}
            cargando={creando}
            disabled={!puedeCrear || bloqueoEdicion}
            onClick={crear}
            data-tooltip="Crea una nueva plantilla con los datos actuales."
          >
            {creando ? 'Creando…' : 'Crear plantilla'}
          </Boton>
        )}
        {modoEdicion && (
          <>
            <Boton
              type="button"
              cargando={guardandoPlantilla}
              disabled={!titulo.trim() || guardandoPlantilla || bloqueoEdicion}
              onClick={() => void guardarEdicion()}
              data-tooltip="Guarda los cambios en la plantilla."
            >
              {guardandoPlantilla ? 'Guardando…' : 'Guardar cambios'}
            </Boton>
            <Boton type="button" variante="secundario" onClick={cancelarEdicion} data-tooltip="Cancela la edicion actual.">
              Cancelar
            </Boton>
          </>
        )}
      </div>
      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
        </div>
        <div className="subpanel plantillas-panel plantillas-panel--lista">
          <h3>Plantillas existentes</h3>
          <div className="plantillas-panel__meta">
            <span>Total: {totalPlantillasTodas}</span>
            <span>Mostradas: {totalPlantillas}</span>
          </div>
      <div className="plantillas-filtro">
        <label className="campo plantillas-filtro__campo">
          Buscar
          <input
            value={filtroPlantillas}
            onChange={(e) => setFiltroPlantillas(e.target.value)}
            placeholder="Titulo, tema o ID…"
            data-tooltip="Filtra por titulo, tema o ID."
          />
        </label>
        <div className="plantillas-filtro__resultado">
          {filtroPlantillas.trim() ? `Filtro: "${filtroPlantillas.trim()}"` : 'Sin filtros aplicados'}
        </div>
      </div>
      {plantillasFiltradas.length === 0 ? (
        <InlineMensaje tipo="info">No hay plantillas con ese filtro. Ajusta la busqueda o crea una nueva.</InlineMensaje>
      ) : (
        <ul className="lista lista-items plantillas-lista">
          {plantillasFiltradas.map((plantilla) => {
            const materia = periodos.find((p) => p._id === plantilla.periodoId);
            const temas = Array.isArray(plantilla.temas) ? plantilla.temas : [];
            const modo = temas.length > 0 ? `Temas: ${temas.join(', ')}` : 'Modo legacy: preguntasIds';
            const preview = previewPorPlantillaId[plantilla._id];
            const previewAbierta = plantillaPreviewId === plantilla._id;
            const pdfUrl = previewPdfUrlPorPlantillaId[plantilla._id];
            return (
              <li key={plantilla._id}>
                <div className="item-glass">
                  <div className="item-row">
                    <div>
                      <div className="item-title">{plantilla.titulo}</div>
                      <div className="item-meta">
                        <span>ID: {idCortoMateria(plantilla._id)}</span>
                        <span>Tipo: {plantilla.tipo}</span>
                        <span>Paginas: {Number((plantilla as unknown as { numeroPaginas?: unknown })?.numeroPaginas ?? 0) || '-'}</span>
                        <span>Creada: {formatearFechaHora(plantilla.createdAt)}</span>
                        <span>Materia: {materia ? etiquetaMateria(materia) : '-'}</span>
                      </div>
                      <div className="item-sub">{modo}</div>
                      {previewAbierta && (
                        <div className="resultado plantillas-preview">
                          <h4 className="plantillas-preview__titulo">Previsualizacion (boceto por pagina)</h4>
                          {!preview && (
                            <div className="ayuda">
                              Esta previsualizacion usa una seleccion determinista de preguntas (para que no cambie cada vez) y bosqueja el contenido por pagina.
                            </div>
                          )}
                            {!preview && (
                              <Boton
                                type="button"
                                variante="secundario"
                                cargando={cargandoPreviewPlantillaId === plantilla._id}
                                onClick={() => void cargarPreviewPlantilla(plantilla._id)}
                                disabled={!puedePrevisualizarPlantillas}
                                data-tooltip="Genera el boceto de preguntas por pagina."
                              >
                                {cargandoPreviewPlantillaId === plantilla._id ? 'Generando…' : 'Generar previsualizacion'}
                              </Boton>
                            )}
                          {preview && (
                            <>
                              {Array.isArray(preview.advertencias) && preview.advertencias.length > 0 && (
                                <InlineMensaje tipo="info">{preview.advertencias.join(' ')}</InlineMensaje>
                              )}

                              {Array.isArray(preview.conteoPorTema) && preview.conteoPorTema.length > 0 && (
                                <div className="resultado plantillas-preview__bloque">
                                  <h4 className="plantillas-preview__subtitulo">Disponibles por tema</h4>
                                  <ul className="lista">
                                    {preview.conteoPorTema.map((t) => (
                                      <li key={t.tema}>
                                        <b>{t.tema}:</b> {t.disponibles}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {Array.isArray(preview.temasDisponiblesEnMateria) && preview.temasDisponiblesEnMateria.length > 0 && (
                                <div className="resultado plantillas-preview__bloque">
                                  <h4 className="plantillas-preview__subtitulo">Temas con preguntas en la materia (top)</h4>
                                  <div className="ayuda">Sirve para detectar temas mal escritos o con 0 reactivos.</div>
                                  <ul className="lista">
                                    {preview.temasDisponiblesEnMateria.map((t) => (
                                      <li key={`${t.tema}-${t.disponibles}`}>
                                        <b>{t.tema}:</b> {t.disponibles}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <div className="acciones acciones--mt">
                                {!pdfUrl ? (
                                  <Boton
                                    type="button"
                                    variante="secundario"
                                    cargando={cargandoPreviewPdfPlantillaId === plantilla._id}
                                    onClick={() => void cargarPreviewPdfPlantilla(plantilla._id)}
                                    disabled={!puedePrevisualizarPlantillas}
                                    data-tooltip="Genera el PDF final para revisarlo."
                                  >
                                    {cargandoPreviewPdfPlantillaId === plantilla._id ? 'Generando PDF…' : 'Ver PDF exacto'}
                                  </Boton>
                                ) : (
                                  <>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => cerrarPreviewPdfPlantilla(plantilla._id)}
                                      data-tooltip="Oculta el PDF incrustado."
                                    >
                                      Ocultar PDF
                                    </Boton>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => abrirPdfFullscreen(pdfUrl)}
                                      data-tooltip="Abre el PDF en pantalla completa."
                                    >
                                      Ver grande
                                    </Boton>
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={() => {
                                        const u = String(pdfUrl || '').trim();
                                        if (!u) return;
                                        window.open(u, '_blank', 'noopener,noreferrer');
                                      }}
                                      data-tooltip="Abre el PDF en una pestaña nueva."
                                    >
                                      Abrir en pestaña
                                    </Boton>
                                  </>
                                )}
                              </div>

                              {pdfUrl && (
                                <div className="plantillas-preview__pdfWrap">
                                  <iframe className="plantillas-preview__pdf" title="Previsualizacion PDF" src={pdfUrl} />
                                </div>
                              )}

                              {pdfFullscreenUrl && (
                                <div className="pdf-overlay" role="dialog" aria-modal="true">
                                  <div className="pdf-overlay__bar">
                                    <Boton
                                      type="button"
                                      variante="secundario"
                                      onClick={cerrarPdfFullscreen}
                                      data-tooltip="Cierra la vista de PDF a pantalla completa."
                                    >
                                      Cerrar
                                    </Boton>
                                  </div>
                                  <iframe className="pdf-overlay__frame" title="PDF (pantalla completa)" src={pdfFullscreenUrl} />
                                </div>
                              )}
                            <ul className="lista lista-items plantillas-preview__lista">
                              {preview.paginas.map((p) => (
                                <li key={p.numero}>
                                  <div className="item-glass">
                                    <div className="item-row">
                                      <div>
                                        <div className="item-title">Pagina {p.numero}</div>
                                        <div className="item-meta">
                                          <span>
                                            Preguntas: {p.preguntasDel && p.preguntasAl ? `${p.preguntasDel}–${p.preguntasAl}` : '—'}
                                          </span>
                                          <span>Elementos: {Array.isArray(p.elementos) ? p.elementos.length : 0}</span>
                                        </div>
                                        {Array.isArray(p.elementos) && p.elementos.length > 0 && (
                                          <div className="item-sub">{p.elementos.join(' · ')}</div>
                                        )}
                                        {Array.isArray(p.preguntas) && p.preguntas.length > 0 ? (
                                          <ul className="lista plantillas-preview__preguntas">
                                            {p.preguntas.map((q) => (
                                              <li key={q.numero}>
                                                <span>
                                                  <b>{q.numero}.</b> {q.enunciadoCorto}{' '}
                                                  {q.tieneImagen ? (
                                                    <span className="badge plantillas-preview__badgeImagen">Imagen</span>
                                                  ) : null}
                                                </span>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <div className="ayuda">Sin preguntas (pagina extra o rangos no disponibles).</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="item-actions">
                      <Boton
                        type="button"
                        variante="secundario"
                        cargando={cargandoPreviewPlantillaId === plantilla._id}
                        onClick={() => void togglePreviewPlantilla(plantilla._id)}
                        disabled={!puedePrevisualizarPlantillas}
                        data-tooltip="Muestra u oculta la previsualizacion."
                      >
                        {previewAbierta ? 'Ocultar previsualizacion' : 'Previsualizar'}
                      </Boton>
                      <Boton
                        type="button"
                        variante="secundario"
                        onClick={() => iniciarEdicion(plantilla)}
                        disabled={!puedeGestionarPlantillas}
                        data-tooltip="Edita esta plantilla."
                      >
                        Editar
                      </Boton>
                      {puedeEliminarPlantillaDev && (
                        <Boton
                          type="button"
                          variante="secundario"
                          cargando={eliminandoPlantillaId === plantilla._id}
                          onClick={() => void eliminarPlantillaDev(plantilla)}
                          disabled={!puedeEliminarPlantillaDev}
                          data-tooltip="Elimina la plantilla (solo modo dev)."
                        >
                          Eliminar (DEV)
                        </Boton>
                      )}
                      <Boton
                        type="button"
                        variante="secundario"
                        cargando={archivandoPlantillaId === plantilla._id}
                        onClick={() => void archivarPlantilla(plantilla)}
                        disabled={!puedeArchivarPlantillas}
                        data-tooltip="Archiva la plantilla para ocultarla."
                      >
                        Archivar
                      </Boton>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
        </div>
      </div>

      <div className="plantillas-grid plantillas-grid--generacion">
        <div className="subpanel plantillas-panel plantillas-panel--generar">
          <h3>Generar examen</h3>
      <AyudaFormulario titulo="Generar examen (PDF)">
        <p>
          <b>Proposito:</b> crear un examen en PDF con <b>folio</b> y <b>QR por pagina</b>. Ese folio se usa para entrega y calificacion.
        </p>
        <ul className="lista">
          <li>
            <b>Plantilla:</b> obligatoria.
          </li>
          <li>
            <b>Alumno:</b> opcional; si lo eliges, el examen queda asociado desde el inicio.
          </li>
        </ul>
        <p>
          Ejemplo: plantilla <code>Parcial 1 - Algebra</code>, alumno <code>2024-001 - Ana Maria Gomez Ruiz</code>.
        </p>
      </AyudaFormulario>
      <div className="plantillas-form">
        <label className="campo">
          Plantilla
          <select value={plantillaId} onChange={(event) => setPlantillaId(event.target.value)} data-tooltip="Selecciona la plantilla a generar.">
            <option value="">Selecciona</option>
            {plantillas.map((plantilla) => (
              <option key={plantilla._id} value={plantilla._id}>
                {plantilla.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Alumno (opcional)
          <select value={alumnoId} onChange={(event) => setAlumnoId(event.target.value)} data-tooltip="Asocia el examen a un alumno (opcional).">
            <option value="">Sin alumno</option>
            {alumnos.map((alumno) => (
              <option key={alumno._id} value={alumno._id}>
                {alumno.matricula} - {alumno.nombreCompleto}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="acciones acciones--mt">
        <Boton
          className="boton"
          type="button"
          icono={<Icono nombre="pdf" />}
          cargando={generando}
          disabled={!puedeGenerar}
          data-tooltip="Genera el examen PDF usando la plantilla seleccionada."
          onClick={async () => {
            try {
              const inicio = Date.now();
              if (!puedeGenerarExamenes) {
                avisarSinPermiso('No tienes permiso para generar examenes.');
                return;
              }
              setGenerando(true);
              setMensajeGeneracion('');
              const payload = await enviarConPermiso<{ examenGenerado: ExamenGeneradoResumen; advertencias?: string[] }>(
                'examenes:generar',
                '/examenes/generados',
                {
                  plantillaId,
                  alumnoId: alumnoId || undefined
                },
                'No tienes permiso para generar examenes.'
              );
              const ex = payload?.examenGenerado ?? null;
              const adv = Array.isArray(payload?.advertencias) ? payload.advertencias : [];
              setUltimoGenerado(ex);
              setMensajeGeneracion(ex ? `Examen generado. Folio: ${ex.folio} (ID: ${idCortoMateria(ex._id)})` : 'Examen generado');
              emitToast({
                level: adv.length > 0 ? 'warn' : 'ok',
                title: 'Examen',
                message: adv.length > 0 ? `Examen generado. ${adv.join(' ')}` : 'Examen generado',
                durationMs: adv.length > 0 ? 6000 : 2200
              });
              registrarAccionDocente('generar_examen', true, Date.now() - inicio);
              await cargarExamenesGenerados();
            } catch (error) {
              const msg = mensajeDeError(error, 'No se pudo generar');
              setMensajeGeneracion(msg);
              emitToast({
                level: 'error',
                title: 'No se pudo generar',
                message: msg,
                durationMs: 5200,
                action: accionToastSesionParaError(error, 'docente')
              });
              registrarAccionDocente('generar_examen', false);
            } finally {
              setGenerando(false);
            }
          }}
        >
          {generando ? 'Generando…' : 'Generar'}
        </Boton>

        <Boton
          type="button"
          variante="secundario"
          icono={<Icono nombre="pdf" />}
          cargando={generandoLote}
          disabled={!plantillaId || !plantillaSeleccionada?.periodoId || !puedeGenerarExamenes}
          data-tooltip="Genera examenes para todos los alumnos activos de la materia."
          onClick={async () => {
            const ok = globalThis.confirm(
              '¿Generar examenes para TODOS los alumnos activos de la materia de esta plantilla? Esto puede tardar.'
            );
            if (!ok) return;
            try {
              const inicio = Date.now();
              if (!puedeGenerarExamenes) {
                avisarSinPermiso('No tienes permiso para generar examenes.');
                return;
              }
              setGenerandoLote(true);
              setMensajeGeneracion('');
              const payload = await enviarConPermiso<{
                totalAlumnos: number;
                examenesGenerados: Array<{ folio: string }>;
                loteId?: string;
                lotePdfUrl?: string;
              }>(
                'examenes:generar',
                '/examenes/generados/lote',
                { plantillaId, confirmarMasivo: true },
                'No tienes permiso para generar examenes.',
                { timeoutMs: 120_000 }
              );
              const total = Number(payload?.totalAlumnos ?? 0);
              const generados = Array.isArray(payload?.examenesGenerados) ? payload.examenesGenerados.length : 0;
              setMensajeGeneracion(`Generacion masiva lista. Alumnos: ${total}. Examenes creados: ${generados}.`);
              const loteUrl =
                payload?.lotePdfUrl ||
                (payload?.loteId ? `/examenes/generados/lote/${encodeURIComponent(payload.loteId)}/pdf` : null);
              setLotePdfUrl(loteUrl);
              if (loteUrl) {
                const token = obtenerTokenDocente();
                if (token) {
                  const resp = await fetch(`${clienteApi.baseApi}${loteUrl}`, {
                    credentials: 'include',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (resp.ok) {
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `examenes_lote_${Date.now()}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  }
                }
              }
              emitToast({ level: 'ok', title: 'Examenes', message: 'Generacion masiva completada', durationMs: 2200 });
              registrarAccionDocente('generar_examenes_lote', true, Date.now() - inicio);
              await cargarExamenesGenerados();
            } catch (error) {
              const msg = mensajeDeError(error, 'No se pudo generar en lote');
              setMensajeGeneracion(msg);
              emitToast({
                level: 'error',
                title: 'No se pudo generar en lote',
                message: msg,
                durationMs: 5200,
                action: accionToastSesionParaError(error, 'docente')
              });
              registrarAccionDocente('generar_examenes_lote', false);
            } finally {
              setGenerandoLote(false);
            }
          }}
        >
          {generandoLote ? 'Generando para todos…' : 'Generar para todos los alumnos'}
        </Boton>
      </div>

      {plantillaId && !plantillaSeleccionada?.periodoId && (
        <div className="ayuda error">Esta plantilla no tiene materia (periodoId). No se puede generar en lote.</div>
      )}
      {mensajeGeneracion && (
        <p className={esMensajeError(mensajeGeneracion) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensajeGeneracion}
        </p>
      )}
      {lotePdfUrl && (
        <div className="acciones acciones--mt">
          <Boton
            type="button"
            variante="secundario"
            icono={<Icono nombre="pdf" />}
            onClick={() => void descargarPdfLote()}
            data-tooltip="Descarga el PDF con todos los examenes del lote."
          >
            Descargar PDF completo
          </Boton>
          <span className="ayuda">PDF del lote: {lotePdfUrl}</span>
        </div>
      )}
        </div>
        <div className="subpanel plantillas-panel plantillas-panel--generados" id="examenes-generados">
          <h3>Examenes generados</h3>
          {!plantillaSeleccionada && (
            <InlineMensaje tipo="info">Selecciona una plantilla para ver los examenes generados y su historial.</InlineMensaje>
          )}
          {lotePdfUrl && (
            <InlineMensaje tipo="ok">
              <div className="acciones acciones--mt">
                <Boton
                  type="button"
                  variante="secundario"
                  icono={<Icono nombre="pdf" />}
                  onClick={() => void descargarPdfLote()}
                  data-tooltip="Descarga el PDF con todos los examenes del lote."
                >
                  Descargar PDF completo
                </Boton>
                <span className="ayuda">PDF del lote: {lotePdfUrl}</span>
              </div>
            </InlineMensaje>
          )}
          {ultimoGenerado && (
            <div className="resultado" aria-label="Detalle del ultimo examen generado">
              <h4>Ultimo examen generado</h4>
          <div className="item-meta">
            <span>Folio: {ultimoGenerado.folio}</span>
            <span>ID: {idCortoMateria(ultimoGenerado._id)}</span>
            <span>Generado: {formatearFechaHora(ultimoGenerado.generadoEn)}</span>
          </div>
          {(() => {
            const paginas = Array.isArray(ultimoGenerado.paginas) ? ultimoGenerado.paginas : [];
            if (paginas.length === 0) return null;
            return (
            <details>
              <summary>Previsualizacion por pagina ({paginas.length})</summary>
              {(() => {
                const tieneRangos = paginas.some(
                  (p) => Number(p.preguntasDel ?? 0) > 0 && Number(p.preguntasAl ?? 0) > 0
                );
                return (
                  !tieneRangos && (
                    <div className="ayuda">
                      Rango por pagina no disponible en este examen (probablemente fue generado con una version anterior). Regenera para recalcular.
                    </div>
                  )
                );
              })()}
              <ul className="lista">
                {paginas.map((p) => {
                  const del = Number(p.preguntasDel ?? 0);
                  const al = Number(p.preguntasAl ?? 0);
                  const tieneRangos = paginas.some(
                    (x) => Number(x.preguntasDel ?? 0) > 0 && Number(x.preguntasAl ?? 0) > 0
                  );
                  const rango = del && al ? `Preguntas ${del}–${al}` : tieneRangos ? 'Sin preguntas (pagina extra)' : 'Rango no disponible';
                  return (
                    <li key={p.numero}>
                      Pagina {p.numero}: {rango}
                    </li>
                  );
                })}
              </ul>
            </details>
            );
          })()}
        </div>
      )}

      {plantillaSeleccionada && (
        <div className="resultado">
          <h3>Examenes generados (plantilla seleccionada)</h3>
          <div className="ayuda">
            Mostrando hasta 50, del mas reciente al mas antiguo. Al descargar se marca como descargado.
          </div>
          {cargandoExamenesGenerados && (
            <InlineMensaje tipo="info" leading={<Spinner />}>
              Cargando examenes generados…
            </InlineMensaje>
          )}
          <ul className="lista lista-items">
            {!cargandoExamenesGenerados && examenesGenerados.length === 0 && <li>No hay examenes generados para esta plantilla.</li>}
            {examenesGenerados.map((examen) => {
              const alumno = examen.alumnoId ? alumnosPorId.get(String(examen.alumnoId)) : null;
              const descargado = Boolean(String(examen.descargadoEn || '').trim());
              const regenerable = !examen.estado || String(examen.estado) === 'generado';
              return (
                <li key={examen._id}>
                  <div className="item-glass">
                    <div className="item-row">
                      <div>
                        <div className="item-title">Folio: {examen.folio}</div>
                        <div className="item-meta">
                          <span>ID: {idCortoMateria(examen._id)}</span>
                          <span>Generado: {formatearFechaHora(examen.generadoEn)}</span>
                          <span>
                            Descargado: {descargado ? formatearFechaHora(examen.descargadoEn) : 'No'}
                          </span>
                        </div>
                        <div className="item-sub">
                          Alumno: {alumno ? `${alumno.matricula} - ${alumno.nombreCompleto}` : examen.alumnoId ? `ID ${idCortoMateria(String(examen.alumnoId))}` : 'Sin alumno'}
                        </div>
                        {(() => {
                          const paginas = Array.isArray(examen.paginas) ? examen.paginas : [];
                          if (paginas.length === 0) return null;
                          return (
                          <details>
                            <summary>Previsualizacion por pagina ({paginas.length})</summary>
                            {(() => {
                              const tieneRangos = paginas.some(
                                (p) => Number(p.preguntasDel ?? 0) > 0 && Number(p.preguntasAl ?? 0) > 0
                              );
                              return (
                                !tieneRangos && (
                                  <div className="ayuda">
                                    Rango por pagina no disponible en este examen. Regenera si necesitas la previsualizacion.
                                  </div>
                                )
                              );
                            })()}
                            <ul className="lista">
                              {paginas.map((p) => {
                                const del = Number(p.preguntasDel ?? 0);
                                const al = Number(p.preguntasAl ?? 0);
                                const tieneRangos = paginas.some(
                                  (x) => Number(x.preguntasDel ?? 0) > 0 && Number(x.preguntasAl ?? 0) > 0
                                );
                                const rango = del && al ? `Preguntas ${del}–${al}` : tieneRangos ? 'Sin preguntas (pagina extra)' : 'Rango no disponible';
                                return (
                                  <li key={p.numero}>
                                    Pagina {p.numero}: {rango}
                                  </li>
                                );
                              })}
                            </ul>
                          </details>
                          );
                        })()}
                      </div>
                      <div className="item-actions">
                        {regenerable && (
                          <Boton
                            type="button"
                            variante="secundario"
                            icono={<Icono nombre="recargar" />}
                            cargando={regenerandoExamenId === examen._id}
                            disabled={!puedeRegenerarExamenes || descargandoExamenId === examen._id || archivandoExamenId === examen._id}
                            onClick={() => void regenerarPdfExamen(examen)}
                          >
                            Regenerar
                          </Boton>
                        )}
                        <Boton
                          type="button"
                          variante="secundario"
                          icono={<Icono nombre="pdf" />}
                          cargando={descargandoExamenId === examen._id}
                          disabled={!puedeDescargarExamenes || regenerandoExamenId === examen._id || archivandoExamenId === examen._id}
                          onClick={() => void descargarPdfExamen(examen)}
                        >
                          Descargar
                        </Boton>
                        {regenerable && (
                          <Boton
                            type="button"
                            variante="secundario"
                            className="peligro"
                            icono={<Icono nombre="alerta" />}
                            cargando={archivandoExamenId === examen._id}
                            disabled={!puedeArchivarExamenes || descargandoExamenId === examen._id || regenerandoExamenId === examen._id}
                            onClick={() => void archivarExamenGenerado(examen)}
                          >
                            Archivar
                          </Boton>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

