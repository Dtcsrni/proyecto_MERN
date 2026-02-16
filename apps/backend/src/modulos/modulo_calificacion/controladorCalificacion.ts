/**
 * Controlador de calificaciones.
 *
 * Nota de seguridad:
 * - Todas estas rutas asumen que el request ya paso por `requerirDocente`.
 * - `obtenerDocenteId(req)` actua como guard (y contrato) para obtener el docente autenticado.
 * - La autorizacion por objeto se aplica verificando que el examen/plantilla pertenezca al docente.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenPlantilla } from '../modulo_generacion_pdf/modeloExamenPlantilla';
import { Calificacion } from './modeloCalificacion';
import { SolicitudRevisionAlumno } from './modeloSolicitudRevisionAlumno';
import { calcularCalificacion } from './servicioCalificacion';

type RespuestaDetectada = {
  numeroPregunta: number;
  opcion: string | null;
};

type AnalisisOmrCalificacion = {
  estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  calidadPagina: number;
  confianzaPromedioPagina?: number;
  ratioAmbiguas?: number;
  templateVersionDetectada?: 1 | 2;
  motivosRevision?: string[];
  revisionConfirmada?: boolean;
};

function obtenerLetraCorrecta(opciones: Array<{ esCorrecta: boolean }>, orden: number[]) {
  const indiceCorrecto = opciones.findIndex((opcion) => opcion.esCorrecta);
  if (indiceCorrecto < 0) return null;
  // Se traduce el indice real al orden mostrado en el examen.
  const posicion = orden.findIndex((idx) => idx === indiceCorrecto);
  if (posicion < 0) return null;
  return String.fromCharCode(65 + posicion);
}

/**
 * Califica un examen generado.
 *
 * Contrato de autorizacion por objeto:
 * - El `examenGeneradoId` debe pertenecer al `docenteId` autenticado.
 * - Se recalcula el numero de aciertos si se proporcionan `respuestasDetectadas`.
 * - El endpoint persiste la calificacion y marca el examen como `calificado`.
 */
export async function calificarExamen(req: SolicitudDocente, res: Response) {
  const {
    examenGeneradoId,
    alumnoId,
    aciertos,
    totalReactivos,
    bonoSolicitado,
    evaluacionContinua,
    proyecto,
    retroalimentacion,
    respuestasDetectadas,
    omrAnalisis,
    soloPreview
  } = req.body;
  const docenteId = obtenerDocenteId(req);

  const examen = await ExamenGenerado.findById(examenGeneradoId).lean();
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  if (String(examen.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a este examen', 403);
  }

  const plantilla = await ExamenPlantilla.findById(examen.plantillaId).lean();
  if (!plantilla) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  }

  const alumnoFinal = alumnoId ?? examen.alumnoId;
  if (!alumnoFinal && !soloPreview) {
    throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'Alumno no vinculado al examen', 400);
  }

  const ordenPreguntas: string[] = examen.mapaVariante?.ordenPreguntas ?? [];
  const preguntasDb = await BancoPregunta.find({ _id: { $in: ordenPreguntas } }).lean();
  const mapaPreguntas = new Map(preguntasDb.map((pregunta) => [String(pregunta._id), pregunta]));

  const respuestas = Array.isArray(respuestasDetectadas) ? (respuestasDetectadas as RespuestaDetectada[]) : [];
  const respuestasPorNumero = new Map(
    respuestas.map((item) => [item.numeroPregunta, item.opcion ? item.opcion.toUpperCase() : null])
  );

  const analisisOmr = omrAnalisis as AnalisisOmrCalificacion | undefined;
  const revisionConfirmada = Boolean(analisisOmr?.revisionConfirmada);
  const calidadPagina = Number(analisisOmr?.calidadPagina ?? 1);
  const confianzaPromedioPagina = Number(analisisOmr?.confianzaPromedioPagina ?? 1);
  const ratioAmbiguas = Number(analisisOmr?.ratioAmbiguas ?? 0);
  const totalPreguntasEsperadas = Array.isArray(ordenPreguntas) ? ordenPreguntas.length : 0;
  const coberturaDeteccion = totalPreguntasEsperadas > 0 ? respuestas.length / totalPreguntasEsperadas : 0;
  const rescateAltaPrecision =
    calidadPagina >= 0.58 && confianzaPromedioPagina >= 0.84 && ratioAmbiguas <= 0.04;
  const autoCalificableOmr =
    analisisOmr?.estadoAnalisis === 'ok' &&
    ((calidadPagina >= 0.82 && confianzaPromedioPagina >= 0.82 && ratioAmbiguas <= 0.06 && coberturaDeteccion >= 0.85) || rescateAltaPrecision);

  if (!soloPreview && analisisOmr && !revisionConfirmada && !autoCalificableOmr) {
    throw new ErrorAplicacion(
      'OMR_REQUIERE_REVISION',
      'El analisis OMR requiere revision manual antes de guardar calificacion',
      409,
      {
        estadoAnalisis: analisisOmr.estadoAnalisis,
        calidadPagina,
        confianzaPromedioPagina,
        ratioAmbiguas
      }
    );
  }

  let aciertosCalculados = 0;
  let contestadasTotal = 0;
  let contestadasCorrectas = 0;
  const total = ordenPreguntas.length || totalReactivos || 0;

  ordenPreguntas.forEach((idPregunta, idx) => {
    const pregunta = mapaPreguntas.get(idPregunta);
    if (!pregunta) return;

    const version =
      pregunta.versiones.find((item: { numeroVersion: number }) => item.numeroVersion === pregunta.versionActual) ??
      pregunta.versiones[0];
    const ordenOpciones = examen.mapaVariante?.ordenOpcionesPorPregunta?.[idPregunta] ?? [0, 1, 2, 3, 4];
    const letraCorrecta = obtenerLetraCorrecta(version.opciones, ordenOpciones);
    const respuesta = respuestasPorNumero.get(idx + 1);
    const estaContestada = Boolean(respuesta);
    if (estaContestada) contestadasTotal += 1;

    if (letraCorrecta && respuesta && letraCorrecta === respuesta.toUpperCase()) {
      aciertosCalculados += 1;
      contestadasCorrectas += 1;
    }
  });

  const usarAciertosDetectados = respuestas.length > 0;
  const aciertosFinal = usarAciertosDetectados ? aciertosCalculados : typeof aciertos === 'number' ? aciertos : aciertosCalculados;
  const totalFinal = total || totalReactivos || aciertosFinal || 1;
  const aciertosAjustados = Math.min(aciertosFinal, totalFinal);

  const resultado = calcularCalificacion(
    aciertosAjustados,
    totalFinal,
    bonoSolicitado ?? 0,
    evaluacionContinua ?? 0,
    proyecto ?? 0,
    plantilla.tipo as 'parcial' | 'global'
  );

  if (soloPreview) {
    res.status(200).json({
      preview: {
        aciertos: aciertosAjustados,
        totalReactivos: totalFinal,
        fraccion: {
          numerador: resultado.numerador,
          denominador: resultado.denominador
        },
        calificacionExamenTexto: resultado.calificacionTexto,
        bonoTexto: resultado.bonoTexto,
        calificacionExamenFinalTexto: resultado.calificacionFinalTexto,
        evaluacionContinuaTexto: resultado.evaluacionContinuaTexto,
        proyectoTexto: resultado.proyectoTexto,
        calificacionParcialTexto: resultado.calificacionParcialTexto,
        calificacionGlobalTexto: resultado.calificacionGlobalTexto
      }
    });
    return;
  }

  const calificacion = await Calificacion.create({
    docenteId,
    periodoId: examen.periodoId,
    examenGeneradoId,
    alumnoId: alumnoFinal,
    tipoExamen: plantilla.tipo,
    totalReactivos: totalFinal,
    aciertos: aciertosAjustados,
    fraccion: {
      numerador: resultado.numerador,
      denominador: resultado.denominador
    },
    calificacionExamenTexto: resultado.calificacionTexto,
    bonoTexto: resultado.bonoTexto,
    calificacionExamenFinalTexto: resultado.calificacionFinalTexto,
    evaluacionContinuaTexto: resultado.evaluacionContinuaTexto,
    proyectoTexto: resultado.proyectoTexto,
    calificacionParcialTexto: resultado.calificacionParcialTexto,
    calificacionGlobalTexto: resultado.calificacionGlobalTexto,
    retroalimentacion,
    respuestasDetectadas,
    omrAuditoria: analisisOmr
      ? {
          estadoAnalisis: analisisOmr.estadoAnalisis,
          calidadPagina,
          confianzaPromedioPagina,
          ratioAmbiguas,
          templateVersionDetectada: analisisOmr.templateVersionDetectada ?? null,
          revisionConfirmada,
          autoCalificableOmr,
          contestadasTotal,
          contestadasCorrectas,
          precisionSobreContestadas: contestadasTotal > 0 ? contestadasCorrectas / contestadasTotal : null
        }
      : undefined
  });

  await ExamenGenerado.updateOne({ _id: examenGeneradoId }, { estado: 'calificado' });
  // Cierra solicitudes pendientes relacionadas cuando se recalifica el examen.
  await SolicitudRevisionAlumno.updateMany(
    { docenteId, examenGeneradoId, estado: 'pendiente' },
    {
      $set: {
        estado: 'atendida',
        atendidoEn: new Date(),
        respuestaDocente: 'Solicitud atendida durante recalificacion'
      }
    }
  ).catch(() => {
    // Best-effort: una falla de sincronizacion de solicitudes no debe romper la calificacion.
  });

  res.status(201).json({ calificacion });
}

export async function listarSolicitudesRevision(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const estado = String(req.query.estado ?? '').trim().toLowerCase();
  const limite = Math.min(200, Math.max(1, Number(req.query.limite ?? 60) || 60));
  const filtro: Record<string, unknown> = { docenteId };
  if (estado) filtro.estado = estado;

  const solicitudes = await SolicitudRevisionAlumno.find(filtro)
    .sort({ solicitadoEn: -1, createdAt: -1 })
    .limit(limite)
    .lean();
  res.json({ solicitudes });
}

export async function sincronizarSolicitudesRevision(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  if (!configuracion.portalAlumnoUrl || !configuracion.portalApiKey) {
    throw new ErrorAplicacion('SYNC_SERVIDOR_NO_CONFIG', 'El servidor de sincronizacion no esta configurado', 503);
  }

  const desde = String((req.body as { desde?: unknown })?.desde ?? '').trim();
  const limite = Math.min(200, Math.max(1, Number((req.body as { limite?: unknown })?.limite ?? 80) || 80));
  const body: Record<string, unknown> = { docenteId, limite };
  if (desde) body.desde = desde;

  const respuesta = await fetch(`${configuracion.portalAlumnoUrl}/api/portal/sincronizacion-docente/solicitudes-revision/pull`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': configuracion.portalApiKey
    },
    body: JSON.stringify(body)
  });

  const payload = (await respuesta.json().catch(() => ({}))) as {
    solicitudes?: Array<{
      externoId?: string;
      docenteId?: string;
      periodoId?: string;
      alumnoId?: string;
      examenGeneradoId?: string;
      folio?: string;
      numeroPregunta?: number;
      comentario?: string;
      estado?: string;
      solicitadoEn?: string;
      atendidoEn?: string | null;
      respuestaDocente?: string;
      firmaDocente?: string;
      firmadoEn?: string | null;
      cerradoEn?: string | null;
      conformidadAlumno?: boolean;
      conformidadActualizadaEn?: string | null;
    }>;
    error?: { mensaje?: string };
  };

  if (!respuesta.ok) {
    throw new ErrorAplicacion('SYNC_PULL_FALLIDO', payload?.error?.mensaje || 'No se pudieron sincronizar solicitudes', 502);
  }

  const solicitudes = Array.isArray(payload.solicitudes) ? payload.solicitudes : [];
  let aplicadas = 0;
  for (const item of solicitudes) {
    const externoId = String(item?.externoId ?? '').trim();
    const folio = String(item?.folio ?? '').trim();
    const numeroPregunta = Number(item?.numeroPregunta ?? 0);
    if (!externoId || !folio || !Number.isInteger(numeroPregunta) || numeroPregunta <= 0) continue;
    const comentario = String(item?.comentario ?? '').trim();
    if (comentario.length < 12) continue;
    await SolicitudRevisionAlumno.updateOne(
      { externoId },
      {
        $set: {
          docenteId,
          periodoId: item?.periodoId || null,
          alumnoId: item?.alumnoId || null,
          examenGeneradoId: item?.examenGeneradoId || null,
          folio,
          numeroPregunta,
          comentario,
          estado: String(item?.estado ?? 'pendiente').trim().toLowerCase() || 'pendiente',
          solicitadoEn: item?.solicitadoEn ? new Date(item.solicitadoEn) : new Date(),
          atendidoEn: item?.atendidoEn ? new Date(item.atendidoEn) : null,
          respuestaDocente: String(item?.respuestaDocente ?? '').trim() || null,
          firmaDocente: String((item as { firmaDocente?: unknown })?.firmaDocente ?? '').trim() || null,
          firmadoEn: (item as { firmadoEn?: string | null })?.firmadoEn ? new Date(String((item as { firmadoEn?: unknown }).firmadoEn)) : null,
          cerradoEn: (item as { cerradoEn?: string | null })?.cerradoEn ? new Date(String((item as { cerradoEn?: unknown }).cerradoEn)) : null,
          conformidadAlumno: Boolean(item?.conformidadAlumno),
          conformidadActualizadaEn: item?.conformidadActualizadaEn ? new Date(item.conformidadActualizadaEn) : null,
          origen: 'portal'
        }
      },
      { upsert: true }
    );
    aplicadas += 1;
  }

  res.json({ mensaje: 'Solicitudes sincronizadas', recibidas: solicitudes.length, aplicadas });
}

export async function resolverSolicitudRevision(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const id = String(req.params.id ?? '').trim();
  const estado = String((req.body as { estado?: unknown })?.estado ?? '').trim().toLowerCase();
  const respuestaDocente = String((req.body as { respuestaDocente?: unknown })?.respuestaDocente ?? '').trim();

  if (!id) {
    throw new ErrorAplicacion('SOLICITUD_ID_INVALIDO', 'Identificador de solicitud invalido', 400);
  }
  if (estado !== 'atendida' && estado !== 'rechazada') {
    throw new ErrorAplicacion('SOLICITUD_ESTADO_INVALIDO', 'Estado de solicitud invalido', 400);
  }
  if (respuestaDocente.length < 8) {
    throw new ErrorAplicacion(
      'RESPUESTA_DOCENTE_OBLIGATORIA',
      'La respuesta docente es obligatoria (minimo 8 caracteres)',
      400
    );
  }

  const actualizada = await SolicitudRevisionAlumno.findOneAndUpdate(
    { _id: id, docenteId },
    {
      $set: {
        estado,
        atendidoEn: new Date(),
        respuestaDocente,
        firmaDocente: `docente:${docenteId}`,
        firmadoEn: estado === 'atendida' ? new Date() : null,
        cerradoEn: estado === 'rechazada' ? new Date() : null
      }
    },
    { new: true }
  ).lean();

  if (!actualizada) {
    throw new ErrorAplicacion('SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada', 404);
  }

  if (configuracion.portalAlumnoUrl && configuracion.portalApiKey) {
    await fetch(`${configuracion.portalAlumnoUrl}/api/portal/sincronizacion-docente/solicitudes-revision/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': configuracion.portalApiKey
      },
      body: JSON.stringify({
        externoId: actualizada.externoId,
        estado,
        respuestaDocente: actualizada.respuestaDocente,
        firmaDocente: actualizada.firmaDocente,
        firmadoEn: actualizada.firmadoEn,
        cerradoEn: actualizada.cerradoEn
      })
    }).catch(() => {
      // Best-effort: no bloquear resolucion local si el portal no responde.
    });
  }

  res.json({ solicitud: actualizada });
}
