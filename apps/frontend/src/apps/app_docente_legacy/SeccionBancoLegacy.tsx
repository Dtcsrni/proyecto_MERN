import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from '../app_docente/AyudaFormulario';
import { estimarPaginasParaPreguntas, normalizarNombreTema, type TemaBanco } from '../app_docente/SeccionBanco.helpers';
import { clienteApi } from '../app_docente/clienteApiDocente';
import { registrarAccionDocente } from '../app_docente/telemetriaDocente';
import type { EnviarConPermiso, Periodo, PermisosUI, Pregunta } from '../app_docente/tipos';
import {
  esMensajeError,
  etiquetaMateria,
  idCortoMateria,
  mensajeDeError,
  obtenerVersionPregunta,
  preguntaTieneCodigo
} from '../app_docente/utilidades';
export function SeccionBanco({
  preguntas,
  periodos,
  permisos,
  enviarConPermiso,
  avisarSinPermiso,
  onRefrescar,
  onRefrescarPlantillas,
  paginasEstimadasBackendPorTema
}: {
  preguntas: Pregunta[];
  periodos: Periodo[];
  permisos: PermisosUI;
  enviarConPermiso: EnviarConPermiso;
  avisarSinPermiso: (mensaje: string) => void;
  onRefrescar: () => void;
  onRefrescarPlantillas: () => void;
  paginasEstimadasBackendPorTema: Map<string, number>;
}) {
  const [periodoId, setPeriodoId] = useState('');
  const [enunciado, setEnunciado] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [tema, setTema] = useState('');
  const [opciones, setOpciones] = useState([
    { texto: '', esCorrecta: true },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false }
  ]);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editEnunciado, setEditEnunciado] = useState('');
  const [editImagenUrl, setEditImagenUrl] = useState('');
  const [editTema, setEditTema] = useState('');
  const [editOpciones, setEditOpciones] = useState([
    { texto: '', esCorrecta: true },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false },
    { texto: '', esCorrecta: false }
  ]);
  const [editando, setEditando] = useState(false);
  const [archivandoPreguntaId, setArchivandoPreguntaId] = useState<string | null>(null);

  const [temasBanco, setTemasBanco] = useState<TemaBanco[]>([]);
  const [cargandoTemas, setCargandoTemas] = useState(false);
  const [temaNuevo, setTemaNuevo] = useState('');
  const [creandoTema, setCreandoTema] = useState(false);
  const [temaEditandoId, setTemaEditandoId] = useState<string | null>(null);
  const [temaEditandoNombre, setTemaEditandoNombre] = useState('');
  const [guardandoTema, setGuardandoTema] = useState(false);
  const [archivandoTemaId, setArchivandoTemaId] = useState<string | null>(null);
  const [temasAbierto, setTemasAbierto] = useState(true);
  const temasPrevLenRef = useRef(0);
  const puedeLeer = permisos.banco.leer;
  const puedeGestionar = permisos.banco.gestionar;
  const puedeArchivar = permisos.banco.archivar;
  const bloqueoEdicion = !puedeGestionar;

  const [ajusteTemaId, setAjusteTemaId] = useState<string | null>(null);
  const [ajustePaginasObjetivo, setAjustePaginasObjetivo] = useState<number>(1);
  const [ajusteAccion, setAjusteAccion] = useState<'mover' | 'quitar'>('mover');
  const [ajusteTemaDestinoId, setAjusteTemaDestinoId] = useState<string>('');
  const [ajusteSeleccion, setAjusteSeleccion] = useState<Set<string>>(new Set());
  const [moviendoTema, setMoviendoTema] = useState(false);

  const [sinTemaDestinoId, setSinTemaDestinoId] = useState<string>('');
  const [sinTemaSeleccion, setSinTemaSeleccion] = useState<Set<string>>(new Set());
  const [moviendoSinTema, setMoviendoSinTema] = useState(false);

  useEffect(() => {
    if (periodoId) return;
    if (!Array.isArray(periodos) || periodos.length === 0) return;
    setPeriodoId(periodos[0]._id);
  }, [periodoId, periodos]);

  useEffect(() => {
    setTema('');
  }, [periodoId, puedeLeer]);

  const refrescarTemas = useCallback(async () => {
    if (!periodoId) {
      setTemasBanco([]);
      return;
    }
    if (!puedeLeer) {
      setTemasBanco([]);
      return;
    }
    try {
      setCargandoTemas(true);
      const payload = await clienteApi.obtener<{ temas: TemaBanco[] }>(
        `/banco-preguntas/temas?periodoId=${encodeURIComponent(periodoId)}`
      );
      setTemasBanco(Array.isArray(payload.temas) ? payload.temas : []);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron cargar temas');
      setMensaje(msg);
    } finally {
      setCargandoTemas(false);
    }
  }, [periodoId, puedeLeer]);

  useEffect(() => {
    void refrescarTemas();
  }, [refrescarTemas]);

  // UX: cuando ya existe al menos 1 tema, colapsa la seccion automaticamente.
  useEffect(() => {
    const len = Array.isArray(temasBanco) ? temasBanco.length : 0;
    const prev = temasPrevLenRef.current;

    // Si la materia cambia o se queda sin temas, abre para guiar.
    if (len === 0) setTemasAbierto(true);
    // Si pasamos de 0 -> 1+ (primer tema creado), colapsa.
    if (prev === 0 && len > 0) setTemasAbierto(false);

    temasPrevLenRef.current = len;
  }, [temasBanco]);

  const preguntasMateria = useMemo(() => {
    const lista = Array.isArray(preguntas) ? preguntas : [];
    const filtradas = periodoId ? lista.filter((p) => p.periodoId === periodoId) : [];
    return [...filtradas].sort((a, b) => {
      const porFecha = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      if (porFecha !== 0) return porFecha;
      return String(b._id).localeCompare(String(a._id));
    });
  }, [preguntas, periodoId]);

  const preguntasTemaActual = useMemo(() => {
    const nombre = normalizarNombreTema(tema);
    if (!nombre) return [];
    return preguntasMateria.filter((p) => normalizarNombreTema(p.tema) === nombre);
  }, [preguntasMateria, tema]);

  const preguntasSinTema = useMemo(() => {
    const lista = Array.isArray(preguntasMateria) ? preguntasMateria : [];
    return lista.filter((p) => !normalizarNombreTema(p.tema));
  }, [preguntasMateria]);

  const conteoPorTema = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const pregunta of preguntasMateria) {
      const nombre = normalizarNombreTema(pregunta.tema);
      if (!nombre) continue;
      mapa.set(nombre, (mapa.get(nombre) ?? 0) + 1);
    }
    return mapa;
  }, [preguntasMateria]);

  const paginasPorTema = useMemo(() => {
    const grupos = new Map<string, Pregunta[]>();
    for (const pregunta of preguntasMateria) {
      const nombre = normalizarNombreTema(pregunta.tema);
      if (!nombre) continue;
      const key = nombre.toLowerCase();
      const arr = grupos.get(key);
      if (arr) {
        arr.push(pregunta);
      } else {
        grupos.set(key, [pregunta]);
      }
    }

    const mapa = new Map<string, number>();
    for (const [key, preguntasTema] of grupos.entries()) {
      const backend = paginasEstimadasBackendPorTema.get(key);
      if (typeof backend === 'number' && Number.isFinite(backend)) {
        mapa.set(key, backend);
      } else {
        mapa.set(key, estimarPaginasParaPreguntas(preguntasTema));
      }
    }
    return mapa;
  }, [preguntasMateria, paginasEstimadasBackendPorTema]);

  const paginasTemaActual = useMemo(() => {
    if (!tema.trim()) return 0;
    return preguntasTemaActual.length ? estimarPaginasParaPreguntas(preguntasTemaActual) : 0;
  }, [preguntasTemaActual, tema]);

  function estimarAltoPregunta(pregunta: Pregunta): number {
    const mmAPuntos = (mm: number) => mm * (72 / 25.4);
    const margen = mmAPuntos(10);
    const ANCHO_CARTA = 612;
    const GRID_STEP = 4;
    const snapToGrid = (y: number) => Math.floor(y / GRID_STEP) * GRID_STEP;

    const anchoColRespuesta = 42;
    const gutterRespuesta = 10;
    const xColRespuesta = ANCHO_CARTA - margen - anchoColRespuesta;
    const xDerechaTexto = xColRespuesta - gutterRespuesta;
    const xTextoPregunta = margen + 20;
    const anchoTextoPregunta = Math.max(60, xDerechaTexto - xTextoPregunta);

    const sizePregunta = 8.1;
    const sizeOpcion = 7.0;
    const sizeNota = 6.3;
    const lineaPregunta = 8.6;
    const lineaOpcion = 7.6;
    const separacionPregunta = 0;

    const omrPasoY = 8.4;
    const omrPadding = 2.2;
    const omrExtraTitulo = 9.5;
    const omrTotalLetras = 5;

    function estimarLineasPorAncho(texto: string, maxWidthPts: number, fontSize: number): number {
      const limpio = String(texto ?? '').trim().replace(/\s+/g, ' ');
      if (!limpio) return 1;
      const charWidth = fontSize * 0.58;
      const maxChars = Math.max(10, Math.floor(maxWidthPts / charWidth));
      const palabras = limpio.split(' ');

      let lineas = 1;
      let actual = '';
      for (const palabra of palabras) {
        const candidato = actual ? `${actual} ${palabra}` : palabra;
        if (candidato.length <= maxChars) {
          actual = candidato;
          continue;
        }
        if (!actual) {
          const trozos = Math.ceil(palabra.length / maxChars);
          lineas += Math.max(0, trozos - 1);
          actual = palabra.slice((trozos - 1) * maxChars);
        } else {
          lineas += 1;
          actual = palabra;
        }
      }
      return Math.max(1, Math.ceil(lineas * 1.08));
    }

    const version = obtenerVersionPregunta(pregunta);
    const tieneImagen = Boolean(String(version?.imagenUrl ?? '').trim());
    const lineasEnunciado = estimarLineasPorAncho(String(version?.enunciado ?? ''), anchoTextoPregunta, sizePregunta);
    let altoNecesario = lineasEnunciado * lineaPregunta;
    if (tieneImagen) altoNecesario += 43;

    const opcionesActuales = Array.isArray(version?.opciones) ? version!.opciones : [];
    const opciones = opcionesActuales.length === 5 ? opcionesActuales : [];
    const totalOpciones = opciones.length;
    const mitad = Math.ceil(totalOpciones / 2);
    const anchoOpcionesTotal = Math.max(80, xDerechaTexto - xTextoPregunta);
    const gutterCols = 8;
    const colWidth = totalOpciones > 1 ? (anchoOpcionesTotal - gutterCols) / 2 : anchoOpcionesTotal;
    const prefixWidth = sizeOpcion * 1.6;
    const maxTextWidth = Math.max(30, colWidth - prefixWidth);
    const alturasCols = [0, 0];

    opciones.slice(0, mitad).forEach((op) => {
      alturasCols[0] += estimarLineasPorAncho(String(op?.texto ?? ''), maxTextWidth, sizeOpcion) * lineaOpcion + 0.5;
    });
    opciones.slice(mitad).forEach((op) => {
      alturasCols[1] += estimarLineasPorAncho(String(op?.texto ?? ''), maxTextWidth, sizeOpcion) * lineaOpcion + 0.5;
    });
    const altoOpciones = Math.max(alturasCols[0], alturasCols[1]);
    const altoOmrMin = (omrTotalLetras - 1) * omrPasoY + (omrExtraTitulo + omrPadding);
    altoNecesario += Math.max(altoOpciones, altoOmrMin);
      altoNecesario += separacionPregunta + 2;
    altoNecesario = snapToGrid(altoNecesario);

    // Evitar alturas absurdamente chicas
    return Math.max(sizeNota + 10, altoNecesario);
  }

  const preguntasPorTemaId = useMemo(() => {
    const mapa = new Map<string, Pregunta[]>();
    const temas = Array.isArray(temasBanco) ? temasBanco : [];
    const porNombre = new Map<string, string>();
    for (const t of temas) porNombre.set(normalizarNombreTema(t.nombre).toLowerCase(), t._id);

    for (const pregunta of preguntasMateria) {
      const nombre = normalizarNombreTema(pregunta.tema);
      if (!nombre) continue;
      const id = porNombre.get(nombre.toLowerCase());
      if (!id) continue;
      const arr = mapa.get(id);
      if (arr) arr.push(pregunta);
      else mapa.set(id, [pregunta]);
    }

    return mapa;
  }, [preguntasMateria, temasBanco]);

  function sugerirPreguntasARecortar(preguntasTema: Pregunta[], paginasObjetivo: number): string[] {
    const objetivo = Math.max(1, Math.floor(Number(paginasObjetivo) || 1));
    const orden = [...(Array.isArray(preguntasTema) ? preguntasTema : [])];
    // La lista ya viene en orden reciente -> antiguo; recortamos de abajo (antiguas) para no tocar lo ultimo agregado.
    const seleccion: string[] = [];
    let paginas = estimarPaginasParaPreguntas(orden);
    while (orden.length > 0 && paginas > objetivo) {
      const quitada = orden.pop();
      if (!quitada) break;
      seleccion.push(quitada._id);
      paginas = estimarPaginasParaPreguntas(orden);
    }
    return seleccion;
  }

  function abrirAjusteTema(t: TemaBanco) {
    const id = t._id;
    const key = normalizarNombreTema(t.nombre).toLowerCase();
    const actuales = paginasPorTema.get(key) ?? 1;
    const hayDestinos = temasBanco.some((x) => x._id !== t._id);
    setAjusteTemaId(id);
    setAjustePaginasObjetivo(Math.max(1, Number(actuales || 1)));
    setAjusteSeleccion(new Set());
    setAjusteAccion(hayDestinos ? 'mover' : 'quitar');
    setAjusteTemaDestinoId('');
  }

  function cerrarAjusteTema() {
    setAjusteTemaId(null);
    setAjusteSeleccion(new Set());
    setAjusteAccion('mover');
    setAjusteTemaDestinoId('');
  }

  async function aplicarAjusteTema() {
    if (!periodoId) return;
    if (!ajusteTemaId) return;
    const ids = Array.from(ajusteSeleccion);
    if (ids.length === 0) return;

    if (ajusteAccion === 'mover' && !ajusteTemaDestinoId) return;
    if (!puedeGestionar) {
      avisarSinPermiso('No tienes permiso para gestionar el banco.');
      return;
    }
    try {
      setMoviendoTema(true);
      setMensaje('');

      if (ajusteAccion === 'mover') {
        await enviarConPermiso(
          'banco:gestionar',
          '/banco-preguntas/mover-tema',
          {
            periodoId,
            temaIdDestino: ajusteTemaDestinoId,
            preguntasIds: ids
          },
          'No tienes permiso para mover preguntas.'
        );
        emitToast({ level: 'ok', title: 'Banco', message: `Movidas ${ids.length} preguntas`, durationMs: 2200 });
      } else {
        await enviarConPermiso(
          'banco:gestionar',
          '/banco-preguntas/quitar-tema',
          {
            periodoId,
            preguntasIds: ids
          },
          'No tienes permiso para quitar tema.'
        );
        emitToast({ level: 'ok', title: 'Banco', message: `Quitado el tema a ${ids.length} preguntas`, durationMs: 2400 });
      }

      cerrarAjusteTema();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, ajusteAccion === 'mover' ? 'No se pudieron mover las preguntas' : 'No se pudo quitar el tema');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: ajusteAccion === 'mover' ? 'No se pudo mover' : 'No se pudo actualizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
    } finally {
      setMoviendoTema(false);
    }
  }

  async function asignarSinTemaATema() {
    if (!periodoId) return;
    if (!sinTemaDestinoId) return;
    const ids = Array.from(sinTemaSeleccion);
    if (ids.length === 0) return;
    if (!puedeGestionar) {
      avisarSinPermiso('No tienes permiso para gestionar el banco.');
      return;
    }
    try {
      setMoviendoSinTema(true);
      setMensaje('');
      await enviarConPermiso(
        'banco:gestionar',
        '/banco-preguntas/mover-tema',
        {
          periodoId,
          temaIdDestino: sinTemaDestinoId,
          preguntasIds: ids
        },
        'No tienes permiso para mover preguntas.'
      );
      emitToast({ level: 'ok', title: 'Banco', message: `Asignadas ${ids.length} preguntas`, durationMs: 2200 });
      setSinTemaSeleccion(new Set());
      await Promise.resolve().then(() => onRefrescar());
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudieron asignar las preguntas');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'No se pudo asignar', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setMoviendoSinTema(false);
    }
  }

  const temaPorDefecto = useMemo(() => {
    const lista = Array.isArray(temasBanco) ? temasBanco : [];
    if (lista.length === 0) return '';
    const masReciente = lista.reduce((acc, item) => {
      if (!acc) return item;
      const cmp = String(item.createdAt || '').localeCompare(String(acc.createdAt || ''));
      if (cmp > 0) return item;
      if (cmp < 0) return acc;
      return String(item._id).localeCompare(String(acc._id)) > 0 ? item : acc;
    }, null as TemaBanco | null);
    return masReciente?.nombre ?? '';
  }, [temasBanco]);

  useEffect(() => {
    if (!periodoId) return;
    if (tema.trim()) return;
    if (!temaPorDefecto.trim()) return;
    setTema(temaPorDefecto);
  }, [periodoId, tema, temaPorDefecto]);

  const puedeGuardar = Boolean(
    periodoId &&
      enunciado.trim() &&
      tema.trim() &&
      opciones.every((opcion) => opcion.texto.trim()) &&
      opciones.some((opcion) => opcion.esCorrecta)
  );

  const puedeGuardarEdicion = Boolean(
    editandoId && editEnunciado.trim() && editTema.trim() && editOpciones.every((o) => o.texto.trim())
  );

  function iniciarEdicion(pregunta: Pregunta) {
    const version = obtenerVersionPregunta(pregunta);
    setEditandoId(pregunta._id);
    setEditEnunciado(version?.enunciado ?? '');
    setEditImagenUrl(String(version?.imagenUrl ?? ''));
    setEditTema(String(pregunta.tema ?? '').trim());
    const opcionesActuales = Array.isArray(version?.opciones) ? version?.opciones : [];
    const base = opcionesActuales.length === 5 ? opcionesActuales : editOpciones;
    setEditOpciones(base.map((o) => ({ texto: String(o.texto ?? ''), esCorrecta: Boolean(o.esCorrecta) })));
  }

  function cargarImagenArchivo(file: File | null, setter: (value: string) => void) {
    if (!file) return;
    const maxBytes = 1024 * 1024 * 1.5;
    if (file.size > maxBytes) {
      emitToast({
        level: 'warn',
        title: 'Imagen grande',
        message: 'La imagen supera 1.5MB. Usa una mas ligera para evitar PDFs pesados.',
        durationMs: 4200
      });
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas');
        ctx.drawImage(img, 0, 0, w, h);

        const calidad = 0.8;
        let dataUrl = '';
        try {
          dataUrl = canvas.toDataURL('image/webp', calidad);
        } catch {
          dataUrl = '';
        }
        if (!dataUrl || dataUrl.startsWith('data:image/png')) {
          dataUrl = canvas.toDataURL('image/jpeg', calidad);
        }
        if (dataUrl) setter(dataUrl);
      } catch {
        emitToast({ level: 'error', title: 'Imagen', message: 'No se pudo comprimir la imagen.', durationMs: 3200 });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      emitToast({ level: 'error', title: 'Imagen', message: 'No se pudo leer la imagen.', durationMs: 3200 });
    };
    img.src = objectUrl;
  }

  async function crearTemaBanco() {
    if (!periodoId) return;
    const nombre = temaNuevo.trim();
    if (!nombre) return;
    if (!puedeGestionar) {
      avisarSinPermiso('No tienes permiso para gestionar temas.');
      return;
    }
    try {
      setCreandoTema(true);
      setMensaje('');
      await enviarConPermiso('banco:gestionar', '/banco-preguntas/temas', { periodoId, nombre }, 'No tienes permiso para crear temas.');
      setTemaNuevo('');
      await refrescarTemas();
      emitToast({ level: 'ok', title: 'Temas', message: 'Tema creado', durationMs: 1800 });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo crear el tema');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'No se pudo crear', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setCreandoTema(false);
    }
  }

  function iniciarEdicionTema(item: TemaBanco) {
    setTemaEditandoId(item._id);
    setTemaEditandoNombre(item.nombre);
  }

  function cancelarEdicionTema() {
    setTemaEditandoId(null);
    setTemaEditandoNombre('');
  }

  async function guardarEdicionTema() {
    if (!temaEditandoId) return;
    const nombre = temaEditandoNombre.trim();
    if (!nombre) return;
    if (!puedeGestionar) {
      avisarSinPermiso('No tienes permiso para editar temas.');
      return;
    }
    try {
      setGuardandoTema(true);
      setMensaje('');
      await enviarConPermiso(
        'banco:gestionar',
        `/banco-preguntas/temas/${temaEditandoId}/actualizar`,
        { nombre },
        'No tienes permiso para editar temas.'
      );
      cancelarEdicionTema();
      await Promise.all([refrescarTemas(), Promise.resolve().then(() => onRefrescar()), Promise.resolve().then(() => onRefrescarPlantillas())]);
      emitToast({ level: 'ok', title: 'Temas', message: 'Tema actualizado', durationMs: 1800 });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar el tema');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'No se pudo actualizar', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setGuardandoTema(false);
    }
  }

  async function archivarTemaBanco(item: TemaBanco) {
    if (!puedeArchivar) {
      avisarSinPermiso('No tienes permiso para archivar temas.');
      return;
    }
    const ok = globalThis.confirm(`¿Archivar el tema "${item.nombre}"? Se removerá de plantillas y preguntas.`);
    if (!ok) return;
    try {
      setArchivandoTemaId(item._id);
      setMensaje('');
      await enviarConPermiso(
        'banco:archivar',
        `/banco-preguntas/temas/${item._id}/archivar`,
        {},
        'No tienes permiso para archivar temas.'
      );
      if (tema.trim().toLowerCase() === item.nombre.trim().toLowerCase()) setTema('');
      if (editTema.trim().toLowerCase() === item.nombre.trim().toLowerCase()) setEditTema('');
      await Promise.all([refrescarTemas(), Promise.resolve().then(() => onRefrescar()), Promise.resolve().then(() => onRefrescarPlantillas())]);
      emitToast({ level: 'ok', title: 'Temas', message: 'Tema archivado', durationMs: 1800 });
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo archivar el tema');
      setMensaje(msg);
      emitToast({ level: 'error', title: 'No se pudo archivar', message: msg, durationMs: 5200, action: accionToastSesionParaError(error, 'docente') });
    } finally {
      setArchivandoTemaId(null);
    }
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setEditEnunciado('');
    setEditImagenUrl('');
    setEditTema('');
    setEditOpciones([
      { texto: '', esCorrecta: true },
      { texto: '', esCorrecta: false },
      { texto: '', esCorrecta: false },
      { texto: '', esCorrecta: false },
      { texto: '', esCorrecta: false }
    ]);
  }

  async function guardar() {
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para crear preguntas.');
        return;
      }
      setGuardando(true);
      setMensaje('');
      await enviarConPermiso(
        'banco:gestionar',
        '/banco-preguntas',
        {
          periodoId,
          enunciado: enunciado.trim(),
          imagenUrl: imagenUrl.trim() ? imagenUrl.trim() : undefined,
          tema: tema.trim(),
          opciones: opciones.map((item) => ({ ...item, texto: item.texto.trim() }))
        },
        'No tienes permiso para crear preguntas.'
      );
      setMensaje('Pregunta guardada');
      emitToast({ level: 'ok', title: 'Banco', message: 'Pregunta guardada', durationMs: 2200 });
      registrarAccionDocente('crear_pregunta', true, Date.now() - inicio);
      setEnunciado('');
      setImagenUrl('');
      setTema('');
      setOpciones([
        { texto: '', esCorrecta: true },
        { texto: '', esCorrecta: false },
        { texto: '', esCorrecta: false },
        { texto: '', esCorrecta: false },
        { texto: '', esCorrecta: false }
      ]);
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo guardar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo guardar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('crear_pregunta', false);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion() {
    if (!editandoId) return;
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para editar preguntas.');
        return;
      }
      setEditando(true);
      setMensaje('');
      await enviarConPermiso(
        'banco:gestionar',
        `/banco-preguntas/${editandoId}/actualizar`,
        {
          enunciado: editEnunciado.trim(),
          imagenUrl: editImagenUrl.trim() ? editImagenUrl.trim() : null,
          tema: editTema.trim(),
          opciones: editOpciones.map((o) => ({ ...o, texto: o.texto.trim() }))
        },
        'No tienes permiso para editar preguntas.'
      );
      setMensaje('Pregunta actualizada');
      emitToast({ level: 'ok', title: 'Banco', message: 'Pregunta actualizada', durationMs: 2200 });
      registrarAccionDocente('actualizar_pregunta', true, Date.now() - inicio);
      cancelarEdicion();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo actualizar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo actualizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('actualizar_pregunta', false);
    } finally {
      setEditando(false);
    }
  }

  async function archivarPregunta(preguntaId: string) {
    if (!puedeArchivar) {
      avisarSinPermiso('No tienes permiso para archivar preguntas.');
      return;
    }
    const ok = globalThis.confirm('¿¿Archivar esta pregunta? Se desactivara del banco.');
    if (!ok) return;
    try {
      const inicio = Date.now();
      setArchivandoPreguntaId(preguntaId);
      setMensaje('');
      await enviarConPermiso(
        'banco:archivar',
        `/banco-preguntas/${preguntaId}/archivar`,
        {},
        'No tienes permiso para archivar preguntas.'
      );
      setMensaje('Pregunta archivada');
      emitToast({ level: 'ok', title: 'Banco', message: 'Pregunta archivada', durationMs: 2200 });
      registrarAccionDocente('archivar_pregunta', true, Date.now() - inicio);
      if (editandoId === preguntaId) cancelarEdicion();
      onRefrescar();
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo archivar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo archivar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('archivar_pregunta', false);
    } finally {
      setArchivandoPreguntaId(null);
    }
  }

  return (
    <div className="panel">
      <h2>
        <Icono nombre="banco" /> Banco de preguntas
      </h2>
      <AyudaFormulario titulo="Para que sirve y como llenarlo">
        <p>
          <b>Proposito:</b> construir el banco de reactivos (preguntas) que despues se usan en plantillas y examenes.
        </p>
        <ul className="lista">
          <li>
            <b>Enunciado:</b> el texto completo de la pregunta.
          </li>
          <li>
            <b>Tema:</b> unidad/categoria (sirve para organizar).
          </li>
          <li>
            <b>Opciones A–E:</b> todas deben llevar texto.
          </li>
          <li>
            <b>Correcta:</b> marca exactamente una.
          </li>
        </ul>
        <p>
          Ejemplo:
        </p>
        <ul className="lista">
          <li>
            Enunciado: <code>¿Cuanto es 2 + 2?</code>
          </li>
          <li>
            Tema: <code>Aritmetica</code>
          </li>
          <li>
            Opciones: A=<code>4</code> (correcta), B=<code>3</code>, C=<code>5</code>, D=<code>22</code>, E=<code>0</code>
          </li>
        </ul>
      </AyudaFormulario>
      <div className="banco-resumen" aria-live="polite">
        <div className="banco-resumen__item" data-tooltip="Total de preguntas activas en la materia seleccionada.">
          <span>Preguntas</span>
          <b>{preguntasMateria.length}</b>
        </div>
        <div className="banco-resumen__item" data-tooltip="Cantidad de temas activos en la materia.">
          <span>Temas</span>
          <b>{temasBanco.length}</b>
        </div>
        <div className="banco-resumen__item" data-tooltip="Preguntas sin tema asignado.">
          <span>Sin tema</span>
          <b>{preguntasSinTema.length}</b>
        </div>
        <div className="banco-resumen__item" data-tooltip="Cantidad de preguntas que pertenecen al tema seleccionado.">
          <span>Tema actual</span>
          <b>{tema.trim() ? preguntasTemaActual.length : '-'}</b>
        </div>
        <div className="banco-resumen__item" data-tooltip="Estimacion de paginas segun el layout real del PDF.">
          <span>Paginas est.</span>
          <b>{tema.trim() ? paginasTemaActual : '-'}</b>
        </div>
      </div>
      <label className="campo">
        Materia
        <select value={periodoId} onChange={(event) => setPeriodoId(event.target.value)} disabled={bloqueoEdicion} data-tooltip="Materia sobre la que se gestionan preguntas y temas.">
          <option value="">Selecciona</option>
          {periodos.map((periodo) => (
            <option key={periodo._id} value={periodo._id} title={periodo._id}>
              {etiquetaMateria(periodo)}
            </option>
          ))}
        </select>
        {periodos.length === 0 && <span className="ayuda">Primero crea una materia para poder agregar preguntas.</span>}
      </label>
      <label className="campo">
        Enunciado
        <textarea
          value={enunciado}
          onChange={(event) => setEnunciado(event.target.value)}
          disabled={bloqueoEdicion}
          placeholder="Escribe el texto completo de la pregunta…"
          data-tooltip="Redacta el enunciado completo de la pregunta."
        />
      </label>
      <label className="campo">
        Imagen (opcional)
        <input
          type="file"
          accept="image/*"
          onChange={(event) => cargarImagenArchivo(event.currentTarget.files?.[0] ?? null, setImagenUrl)}
          disabled={bloqueoEdicion}
          data-tooltip="Sube una imagen para la pregunta (se guarda en la hoja del examen)."
        />
        {imagenUrl && (
          <div className="imagen-preview">
            <img className="preview" src={imagenUrl} alt="Imagen de la pregunta" />
            <Boton type="button" variante="secundario" onClick={() => setImagenUrl('')} data-tooltip="Quita la imagen.">
              Quitar imagen
            </Boton>
          </div>
        )}
      </label>
      <label className="campo">
        Tema
        <select value={tema} onChange={(event) => setTema(event.target.value)} disabled={bloqueoEdicion} data-tooltip="Tema al que se asignara la pregunta.">
          <option value="">Selecciona</option>
          {temasBanco.map((t) => (
            <option key={t._id} value={t.nombre}>
              {t.nombre}
            </option>
          ))}
        </select>
        {periodoId && !cargandoTemas && temasBanco.length === 0 && (
          <span className="ayuda">Primero crea un tema (seccion “Temas”) para poder asignarlo a preguntas.</span>
        )}
        {tema.trim() && (
          <span className="ayuda">
            En este tema: {preguntasTemaActual.length} pregunta(s) · {paginasTemaActual} pagina(s) estimada(s).
          </span>
        )}
      </label>

      <details
        className="colapsable"
        open={temasAbierto}
        onToggle={(event) => setTemasAbierto((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          <b>Temas</b>
          {periodoId ? ` (${temasBanco.length})` : ''}
        </summary>
        <div className="ayuda">Crea, renombra o elimina temas de esta materia. Luego asigna cada pregunta desde el selector de “Tema”.</div>
        <div className="campo-inline">
          <input
            value={temaNuevo}
            onChange={(event) => setTemaNuevo(event.target.value)}
            placeholder="Nuevo tema (ej. Funciones)"
            aria-label="Nuevo tema"
            disabled={bloqueoEdicion}
            data-tooltip="Escribe el nombre del tema y luego presiona Agregar."
          />
          <Boton
            type="button"
            variante="secundario"
            cargando={creandoTema}
            disabled={!periodoId || !temaNuevo.trim() || bloqueoEdicion}
            onClick={crearTemaBanco}
            data-tooltip="Crea el tema en la materia seleccionada."
          >
            Agregar
          </Boton>
        </div>
        {cargandoTemas && (
          <InlineMensaje tipo="info" leading={<Spinner />}>
            Cargando temas…
          </InlineMensaje>
        )}
        <ul className="lista lista-items">
          {periodoId && !cargandoTemas && temasBanco.length === 0 && <li>No hay temas. Crea el primero arriba.</li>}
          {temasBanco.map((t) => (
            <li key={t._id}>
              <div className="item-glass">
                <div className="item-row">
                  <div>
                    <div className="item-title">{t.nombre}</div>
                    <div className="item-meta">
                      <span>Preguntas: {conteoPorTema.get(t.nombre) ?? 0}</span>
                      <span>
                        Paginas (estimadas): {paginasPorTema.get(normalizarNombreTema(t.nombre).toLowerCase()) ?? 0}
                        {paginasEstimadasBackendPorTema.has(normalizarNombreTema(t.nombre).toLowerCase()) ? ' (preview)' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="item-actions">
                    {temaEditandoId === t._id ? (
                      <>
                        <input
                          value={temaEditandoNombre}
                          onChange={(event) => setTemaEditandoNombre(event.target.value)}
                          aria-label="Nombre del tema"
                        />
                        <Boton type="button" variante="secundario" cargando={guardandoTema} disabled={!temaEditandoNombre.trim()} onClick={guardarEdicionTema}>
                          Guardar
                        </Boton>
                        <Boton type="button" variante="secundario" onClick={cancelarEdicionTema}>
                          Cancelar
                        </Boton>
                      </>
                    ) : (
                      <>
                        <Boton
                          type="button"
                          variante="secundario"
                          onClick={() => abrirAjusteTema(t)}
                          disabled={!puedeGestionar}
                          data-tooltip="Ajusta el numero de paginas objetivo para este tema."
                        >
                          Ajustar paginas
                        </Boton>
                        <Boton
                          type="button"
                          variante="secundario"
                          onClick={() => iniciarEdicionTema(t)}
                          disabled={!puedeGestionar}
                          data-tooltip="Cambia el nombre del tema."
                        >
                          Renombrar
                        </Boton>
                        <Boton
                          type="button"
                          cargando={archivandoTemaId === t._id}
                          onClick={() => archivarTemaBanco(t)}
                          disabled={!puedeArchivar}
                          data-tooltip="Archiva el tema y deja sus preguntas sin tema."
                        >
                          Archivar
                        </Boton>
                      </>
                    )}
                  </div>
                </div>

                {ajusteTemaId === t._id && (
                  <div className="ajuste-tema">
                    <div className="ayuda">
                      Ajusta el tamano del tema segun <b>paginas estimadas</b>. Puedes <b>mover</b> preguntas a otro tema o <b>dejarlas sin tema</b>.
                    </div>
                    <div className="ajuste-controles">
                      <label className="campo ajuste-campo ajuste-campo--paginas">
                        Paginas objetivo
                        <input
                          type="number"
                          min={1}
                          value={String(ajustePaginasObjetivo)}
                          onChange={(event) => setAjustePaginasObjetivo(Math.max(1, Number(event.target.value || 1)))}
                          data-tooltip="Define cuantas paginas quieres que ocupe este tema."
                        />
                      </label>
                      <label className="campo ajuste-campo ajuste-campo--tema">
                        Accion
                        <select
                          value={ajusteAccion}
                          onChange={(event) => {
                            const next = event.target.value === 'quitar' ? 'quitar' : 'mover';
                            setAjusteAccion(next);
                            if (next === 'quitar') setAjusteTemaDestinoId('');
                          }}
                          data-tooltip="Elige mover preguntas a otro tema o dejarlas sin tema."
                        >
                          <option value="mover">Mover a otro tema</option>
                          <option value="quitar">Dejar sin tema</option>
                        </select>
                      </label>
                      <label className="campo ajuste-campo ajuste-campo--tema">
                        Tema destino
                        <select
                          value={ajusteTemaDestinoId}
                          onChange={(event) => setAjusteTemaDestinoId(event.target.value)}
                          data-tooltip="Tema al que se moveran las preguntas seleccionadas."
                        >
                          <option value="">Selecciona</option>
                          {temasBanco
                            .filter((x) => x._id !== t._id)
                            .map((x) => (
                              <option key={x._id} value={x._id}>
                                {x.nombre}
                              </option>
                            ))}
                        </select>
                        {ajusteAccion === 'quitar' && <span className="ayuda">No aplica si eliges “Dejar sin tema”.</span>}
                      </label>

                      <Boton
                        type="button"
                        variante="secundario"
                        disabled={!ajusteTemaId}
                        onClick={() => {
                          const preguntasTema = preguntasPorTemaId.get(t._id) ?? [];
                          const sugeridas = sugerirPreguntasARecortar(preguntasTema, ajustePaginasObjetivo);
                          setAjusteSeleccion(new Set(sugeridas));
                        }}
                        data-tooltip="Marca automaticamente preguntas antiguas para cumplir el objetivo."
                      >
                        Sugerir
                      </Boton>
                      <Boton type="button" variante="secundario" onClick={() => setAjusteSeleccion(new Set())} data-tooltip="Quita todas las selecciones.">
                        Limpiar
                      </Boton>
                      <Boton type="button" variante="secundario" onClick={cerrarAjusteTema} data-tooltip="Cerrar sin aplicar cambios.">
                        Cerrar
                      </Boton>
                    </div>

                    {(() => {
                      const preguntasTema = preguntasPorTemaId.get(t._id) ?? [];
                      const actuales = paginasPorTema.get(normalizarNombreTema(t.nombre).toLowerCase()) ?? 0;
                      const objetivo = Math.max(1, Math.floor(Number(ajustePaginasObjetivo) || 1));
                      const seleccion = ajusteSeleccion;
                      const seleccionadas = preguntasTema.filter((p) => seleccion.has(p._id));
                      const restantes = preguntasTema.filter((p) => !seleccion.has(p._id));
                      const paginasRestantes = restantes.length ? estimarPaginasParaPreguntas(restantes) : 0;
                      const altoSeleccion = seleccionadas.reduce((acc, p) => acc + estimarAltoPregunta(p), 0);
                      const paginasSeleccion = seleccionadas.length ? estimarPaginasParaPreguntas(seleccionadas) : 0;
                      const texto =
                        actuales && objetivo
                          ? `Actual: ${actuales} pag. | Objetivo: ${objetivo} pag. | Quedaria: ${paginasRestantes} pag.`
                          : '';

                      return (
                        <>
                          <div className="item-meta ajuste-meta">
                            <span>{texto}</span>
                            <span>
                              Seleccionadas: {seleccionadas.length} (peso aprox: {paginasSeleccion} pag, {Math.round(altoSeleccion)}pt)
                            </span>
                          </div>
                          <div className="ayuda ajuste-ayuda">
                            Tip: “Sugerir” marca preguntas antiguas (del final) hasta acercarse al objetivo. La estimacion depende del largo del texto.
                          </div>
                          <div className="ajuste-scroll">
                            <ul className="lista">
                              {preguntasTema.length === 0 && <li>No hay preguntas en este tema.</li>}
                              {preguntasTema.map((p) => {
                                const version = obtenerVersionPregunta(p);
                                const marcado = ajusteSeleccion.has(p._id);
                                const titulo = String(version?.enunciado ?? 'Pregunta').slice(0, 120);
                                return (
                                  <li key={p._id}>
                                    <label className="ajuste-check">
                                      <input
                                        type="checkbox"
                                        checked={marcado}
                                        onChange={() => {
                                          setAjusteSeleccion((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(p._id)) next.delete(p._id);
                                            else next.add(p._id);
                                            return next;
                                          });
                                        }}
                                      />
                                      <span>{titulo}</span>
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                          <div className="acciones ajuste-acciones">
                            <Boton
                              type="button"
                              icono={<Icono nombre="ok" />}
                              cargando={moviendoTema}
                              disabled={(ajusteAccion === 'mover' && !ajusteTemaDestinoId) || ajusteSeleccion.size === 0}
                              onClick={aplicarAjusteTema}
                            >
                              {moviendoTema
                                ? ajusteAccion === 'mover'
                                  ? 'Moviendo…'
                                  : 'Actualizando…'
                                : ajusteAccion === 'mover'
                                  ? 'Mover seleccionadas'
                                  : 'Quitar tema a seleccionadas'}
                            </Boton>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {periodoId && (
          <details className="colapsable mt-10" open={false}>
            <summary>
              <b>Sin tema</b>
              {` (${preguntasSinTema.length})`}
            </summary>
            <div className="ayuda">
              Preguntas que quedaron sin tema (por ejemplo, al recortar paginas). Puedes asignarlas a un tema aqui.
            </div>

            {preguntasSinTema.length === 0 ? (
              <div className="ayuda">No hay preguntas sin tema en esta materia.</div>
            ) : (
              <>
                <div className="ajuste-controles">
                  <label className="campo ajuste-campo ajuste-campo--tema">
                    Asignar a tema
                    <select
                      value={sinTemaDestinoId}
                      onChange={(event) => setSinTemaDestinoId(event.target.value)}
                      data-tooltip="Tema al que se asignaran las preguntas sin tema."
                    >
                      <option value="">Selecciona</option>
                      {temasBanco.map((x) => (
                        <option key={x._id} value={x._id}>
                          {x.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Boton
                    type="button"
                    variante="secundario"
                    onClick={() => setSinTemaSeleccion(new Set(preguntasSinTema.map((p) => p._id)))}
                    disabled={preguntasSinTema.length === 0}
                    data-tooltip="Marca todas las preguntas sin tema."
                  >
                    Seleccionar todo
                  </Boton>
                  <Boton type="button" variante="secundario" onClick={() => setSinTemaSeleccion(new Set())} data-tooltip="Limpia la seleccion actual.">
                    Limpiar
                  </Boton>
                  <Boton
                    type="button"
                    icono={<Icono nombre="ok" />}
                    cargando={moviendoSinTema}
                    disabled={!sinTemaDestinoId || sinTemaSeleccion.size === 0}
                    onClick={asignarSinTemaATema}
                    data-tooltip="Asigna las preguntas seleccionadas al tema elegido."
                  >
                    {moviendoSinTema ? 'Asignando…' : `Asignar (${sinTemaSeleccion.size})`}
                  </Boton>
                </div>

                <div className="ajuste-scroll">
                  <ul className="lista">
                    {preguntasSinTema.map((p) => {
                      const v = obtenerVersionPregunta(p);
                      const marcado = sinTemaSeleccion.has(p._id);
                      const titulo = String(v?.enunciado ?? 'Pregunta').slice(0, 120);
                      return (
                        <li key={p._id}>
                          <label className="ajuste-check">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => {
                                setSinTemaSeleccion((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(p._id)) next.delete(p._id);
                                  else next.add(p._id);
                                  return next;
                                });
                              }}
                            />
                            <span>{titulo}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </details>
        )}
      </details>

      <div className="campo">
        <div className="ayuda">Opciones (marca una sola como correcta)</div>
        <div className="opciones-grid" role="group" aria-label="Opciones de respuesta">
          <div className="opciones-header">Opcion</div>
          <div className="opciones-header">Texto</div>
          <div className="opciones-header">Correcta</div>
          {opciones.map((opcion, idx) => (
            <div key={idx} className="opcion-fila">
              <div className="opcion-letra">{String.fromCharCode(65 + idx)}</div>
              <input
                value={opcion.texto}
                onChange={(event) => {
                  const copia = [...opciones];
                  copia[idx] = { ...copia[idx], texto: event.target.value };
                  setOpciones(copia);
                }}
                aria-label={`Texto opcion ${String.fromCharCode(65 + idx)}`}
                disabled={bloqueoEdicion}
              />
              <label className="opcion-correcta">
                <input
                  type="radio"
                  name="correcta"
                  checked={opcion.esCorrecta}
                  onChange={() => {
                    setOpciones(opciones.map((item, index) => ({ ...item, esCorrecta: index === idx })));
                  }}
                  disabled={bloqueoEdicion}
                />
                <span>Correcta</span>
              </label>
            </div>
          ))}
        </div>
      </div>
      <Boton
        type="button"
        icono={<Icono nombre="ok" />}
        cargando={guardando}
        disabled={!puedeGuardar || bloqueoEdicion}
        onClick={guardar}
        data-tooltip="Guarda la pregunta en el banco."
      >
        {guardando ? 'Guardando…' : 'Guardar'}
      </Boton>
      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}

      {editandoId && (
        <div className="resultado">
          <h3>Editando pregunta</h3>
          <label className="campo">
            Enunciado
            <textarea value={editEnunciado} onChange={(event) => setEditEnunciado(event.target.value)} disabled={bloqueoEdicion} />
          </label>
          <label className="campo">
            Imagen (opcional)
            <input
              type="file"
              accept="image/*"
              onChange={(event) => cargarImagenArchivo(event.currentTarget.files?.[0] ?? null, setEditImagenUrl)}
              disabled={bloqueoEdicion}
              data-tooltip="Actualiza la imagen de la pregunta."
            />
            {editImagenUrl && (
              <div className="imagen-preview">
                <img className="preview" src={editImagenUrl} alt="Imagen de la pregunta" />
                <Boton type="button" variante="secundario" onClick={() => setEditImagenUrl('')} data-tooltip="Quitar imagen">
                  Quitar imagen
                </Boton>
              </div>
            )}
          </label>
          <label className="campo">
            Tema
            <select value={editTema} onChange={(event) => setEditTema(event.target.value)} disabled={bloqueoEdicion}>
              <option value="">Selecciona</option>
              {editTema.trim() && !temasBanco.some((t) => t.nombre.toLowerCase() === editTema.trim().toLowerCase()) && (
                <option value={editTema}>{editTema} (no existe)</option>
              )}
              {temasBanco.map((t) => (
                <option key={t._id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="campo">
            <div className="ayuda">Opciones (marca una sola como correcta)</div>
            <div className="opciones-grid" role="group" aria-label="Opciones de respuesta">
              <div className="opciones-header">Opcion</div>
              <div className="opciones-header">Texto</div>
              <div className="opciones-header">Correcta</div>
              {editOpciones.map((opcion, idx) => (
                <div key={idx} className="opcion-fila">
                  <div className="opcion-letra">{String.fromCharCode(65 + idx)}</div>
                  <input
                    value={opcion.texto}
                    onChange={(event) => {
                      const copia = [...editOpciones];
                      copia[idx] = { ...copia[idx], texto: event.target.value };
                      setEditOpciones(copia);
                    }}
                    aria-label={`Texto opcion ${String.fromCharCode(65 + idx)}`}
                    disabled={bloqueoEdicion}
                  />
                  <label className="opcion-correcta">
                    <input
                      type="radio"
                      name="correctaEdit"
                      checked={opcion.esCorrecta}
                      onChange={() => setEditOpciones(editOpciones.map((item, index) => ({ ...item, esCorrecta: index === idx })))}
                      disabled={bloqueoEdicion}
                    />
                    <span>Correcta</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="acciones">
            <Boton
              type="button"
              icono={<Icono nombre="ok" />}
              cargando={editando}
              disabled={!puedeGuardarEdicion || bloqueoEdicion}
              onClick={guardarEdicion}
              data-tooltip="Guarda los cambios de esta pregunta."
            >
              {editando ? 'Guardando…' : 'Guardar cambios'}
            </Boton>
            <Boton type="button" variante="secundario" onClick={cancelarEdicion} data-tooltip="Descarta los cambios.">
              Cancelar
            </Boton>
          </div>
        </div>
      )}
      <h3>Preguntas recientes{periodoId ? ` (${preguntasMateria.length})` : ''}</h3>
      <ul className="lista lista-items">
        {!periodoId && <li>Selecciona una materia para ver sus preguntas.</li>}
        {periodoId && preguntasMateria.length === 0 && <li>No hay preguntas en esta materia.</li>}
        {periodoId &&
          preguntasMateria.map((pregunta) => (
            <li key={pregunta._id}>
              {(() => {
                const version = obtenerVersionPregunta(pregunta);
                const opcionesActuales = Array.isArray(version?.opciones) ? version?.opciones : [];
                const tieneCodigo = preguntaTieneCodigo(pregunta);
                return (
                  <div className="item-glass">
                    <div className="item-row">
                      <div>
                        <div className="item-title">{version?.enunciado ?? 'Pregunta'}</div>
                        <div className="item-meta">
                          <span>ID: {idCortoMateria(pregunta._id)}</span>
                          <span>Tema: {pregunta.tema ? pregunta.tema : '-'}</span>
                          {tieneCodigo && (
                            <span className="badge" title="Se detecto codigo (inline/backticks, bloques o patrones tipicos)">
                              <span className="dot" /> Codigo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="item-actions revision-pills-wrap">
                        <Boton
                          variante="secundario"
                          type="button"
                          onClick={() => iniciarEdicion(pregunta)}
                          disabled={bloqueoEdicion}
                          data-tooltip="Editar esta pregunta."
                        >
                          Editar
                        </Boton>
                        <Boton
                          type="button"
                          cargando={archivandoPreguntaId === pregunta._id}
                          onClick={() => archivarPregunta(pregunta._id)}
                          disabled={!puedeArchivar}
                          data-tooltip="Archivar la pregunta (no se borra)."
                        >
                          Archivar
                        </Boton>
                      </div>
                    </div>
                    {opcionesActuales.length === 5 && (
                      <ul className="item-options">
                        {opcionesActuales.map((op, idx) => (
                          <li key={idx} className={`item-option${op.esCorrecta ? ' item-option--correcta' : ''}`}>
                            <span className="item-option__letra">{String.fromCharCode(65 + idx)}.</span> {op.texto}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}
            </li>
          ))}
      </ul>
    </div>
  );
}


