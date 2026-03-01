import type { Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { Docente } from '../modulo_autenticacion/modeloDocente';
import { Periodo } from '../modulo_alumnos/modeloPeriodo';
import { ExamenPlantilla } from '../modulo_generacion_pdf/modeloExamenPlantilla';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { analizarOmr, leerQrDesdeImagen } from '../modulo_escaneo_omr/servicioOmr';
import { listarFamiliasOmrV1, recomendarFamiliaOmrV1, resolverFamiliaOmrV1 } from './familiasOmrV1';
import { OMR_RUNTIME_VERSION_V1, type AssessmentPreviewV1, type OmrExceptionV1, type OmrScanStatus } from './contratosOmrV1';
import { OmrSheetFamily } from './modeloOmrSheetFamily';
import { OmrSheetRevision } from './modeloOmrSheetRevision';
import { OmrScanJob } from './modeloOmrScanJob';
import { esquemaCrearOmrScanJob, esquemaCrearOmrSheetFamily, esquemaCrearOmrSheetRevision, esquemaResolverOmrException } from './validacionesOmrV1';
import { generarBundleAssessmentOmrV1, persistirArtifactsAssessmentOmrV1 } from './servicioRenderOmrV1';

type PreguntaBaseV1 = {
  id: string;
  enunciado: string;
  imagenUrl?: string;
  opciones: Array<{ texto: string; esCorrecta: boolean }>;
};

type MapaPaginaOmrV1 = Parameters<typeof analizarOmr>[1] & {
  qr?: { texto?: unknown };
};

function shuffleDeterminista<T>(items: T[], seedText: string) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i += 1) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

async function cargarPlantillaDocente(plantillaId: string, docenteId: string) {
  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();
  if (!plantilla) throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }
  return plantilla;
}

async function construirPreguntasPlantillaV1(plantilla: Record<string, unknown>, docenteId: string, seed: string) {
  const temas = Array.isArray(plantilla.temas) ? plantilla.temas.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
  const preguntasIds = Array.isArray(plantilla.preguntasIds) ? plantilla.preguntasIds : [];
  const baseFiltro: Record<string, unknown> = { docenteId, activo: true };
  if (plantilla.periodoId) baseFiltro.periodoId = plantilla.periodoId;
  const preguntasDb =
    temas.length > 0
      ? await BancoPregunta.find({ ...baseFiltro, tema: { $in: temas } }).lean()
      : await BancoPregunta.find({ ...baseFiltro, _id: { $in: preguntasIds } }).lean();
  if (!Array.isArray(preguntasDb) || preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas disponibles', 400);
  }
  const reactivosObjetivo = Math.max(1, Number(plantilla.reactivosObjetivo ?? preguntasDb.length));
  const ordered = shuffleDeterminista(preguntasDb, seed).slice(0, reactivosObjetivo);
  return ordered.map((pregunta) => {
    const version =
      pregunta.versiones.find((item: { numeroVersion: number }) => item.numeroVersion === pregunta.versionActual) ??
      pregunta.versiones[0];
    return {
      id: String(pregunta._id),
      enunciado: String(version?.enunciado ?? ''),
      imagenUrl: String(version?.imagenUrl ?? '').trim() || undefined,
      opciones: Array.isArray(version?.opciones)
        ? version.opciones.map((opcion: { texto?: unknown; esCorrecta?: unknown }) => ({
            texto: String(opcion.texto ?? ''),
            esCorrecta: Boolean(opcion.esCorrecta)
          }))
        : []
    } satisfies PreguntaBaseV1;
  });
}

function warningsFromPreview(args: {
  targetPages: number;
  pagesEstimated: number;
  familyCapacity: number;
  questionCount: number;
  imageHeavy: number;
}) {
  const warnings: string[] = [];
  const blockingIssues: string[] = [];
  if (args.pagesEstimated > args.targetPages) warnings.push(`El cuadernillo requiere ${args.pagesEstimated} pagina(s) estimadas para ${args.targetPages} configuradas.`);
  if (args.familyCapacity < args.questionCount) blockingIssues.push(`La familia OMR solo soporta ${args.familyCapacity} reactivos y la plantilla usa ${args.questionCount}.`);
  if (args.imageHeavy > 0) warnings.push(`${args.imageHeavy} reactivo(s) tienen imagen; el cuadernillo se desacopla de la hoja OMR, pero conviene revisar densidad.`);
  return { warnings, blockingIssues };
}

function aScanStatus(estadoAnalisis?: string): OmrScanStatus {
  if (estadoAnalisis === 'ok') return 'accepted';
  if (estadoAnalisis === 'requiere_revision') return 'needs_review';
  return 'rejected';
}

function aExceptions(resultado: { advertencias?: string[]; motivosRevision?: string[]; qrTexto?: string; estadoAnalisis?: string }): OmrExceptionV1[] {
  const warnings = Array.isArray(resultado.advertencias) ? resultado.advertencias : [];
  const reasons = Array.isArray(resultado.motivosRevision) ? resultado.motivosRevision : [];
  const exceptions: OmrExceptionV1[] = [];
  if (!resultado.qrTexto) {
    exceptions.push({ code: 'qr_missing', severity: 'blocking', message: 'No se detectó QR en la hoja.', recommendedAction: 'Vuelve a capturar la hoja completa.' });
  }
  for (const warning of warnings) {
    const text = String(warning).toLowerCase();
    if (text.includes('no se detecto qr')) continue;
    exceptions.push({
      code: text.includes('coincide') ? 'qr_mismatch' : text.includes('calidad') ? 'low_contrast' : 'manual_review_required',
      severity: text.includes('coincide') ? 'blocking' : 'warning',
      message: String(warning),
      recommendedAction: 'Revisar la hoja en modo de corrección.'
    });
  }
  for (const reason of reasons) {
    exceptions.push({
      code: String(reason).toLowerCase().includes('alineacion') ? 'anchors_unstable' : 'manual_review_required',
      severity: 'warning',
      message: String(reason),
      recommendedAction: 'Corregir manualmente o volver a escanear.'
    });
  }
  return exceptions;
}

export async function listarFamiliasOmr(_req: SolicitudDocente, res: Response) {
  const families = await OmrSheetFamily.find({}).sort({ familyCode: 1 }).lean();
  res.json({ families: families.length > 0 ? families : listarFamiliasOmrV1() });
}

export async function obtenerFamiliaOmr(req: SolicitudDocente, res: Response) {
  const familyCode = String(req.params.id || '').trim().toUpperCase();
  const family = await OmrSheetFamily.findOne({ familyCode }).lean();
  if (!family) throw new ErrorAplicacion('OMR_FAMILY_NO_ENCONTRADA', 'Familia OMR no encontrada', 404);
  const revisions = await OmrSheetRevision.find({ familyId: family._id }).sort({ revision: 1 }).lean();
  res.json({ family, revisions });
}

export async function crearFamiliaOmr(req: SolicitudDocente, res: Response) {
  const payload = req.body as z.infer<typeof esquemaCrearOmrSheetFamily>;
  const family = await OmrSheetFamily.create(payload);
  res.status(201).json({ family });
}

export async function crearRevisionFamiliaOmr(req: SolicitudDocente, res: Response) {
  const familyCode = String(req.params.id || '').trim().toUpperCase();
  const family = await OmrSheetFamily.findOne({ familyCode });
  if (!family) throw new ErrorAplicacion('OMR_FAMILY_NO_ENCONTRADA', 'Familia OMR no encontrada', 404);
  const payload = req.body as z.infer<typeof esquemaCrearOmrSheetRevision>;
  const revision = await OmrSheetRevision.create({
    familyId: family._id,
    revision: payload.revision,
    geometry: payload.geometry,
    qualityThresholds: payload.qualityThresholds ?? {},
    renderTemplateVersion: 1,
    recognitionEngineVersion: 1,
    isActive: payload.isActive ?? true
  });
  res.status(201).json({ revision });
}

async function construirPreview(plantillaId: string, docenteId: string) {
  const plantilla = await cargarPlantillaDocente(plantillaId, docenteId);
  const preguntas = await construirPreguntasPlantillaV1(plantilla as unknown as Record<string, unknown>, docenteId, `preview:${plantillaId}`);
  const family = resolverFamiliaOmrV1(String((plantilla as { omrConfig?: { sheetFamilyCode?: unknown } }).omrConfig?.sheetFamilyCode ?? ''));
  const bookletConfig = (plantilla as { bookletConfig?: { targetPages?: unknown } }).bookletConfig ?? {};
  const bundle = await generarBundleAssessmentOmrV1({
    plantilla,
    preguntas,
    family,
    folio: 'PREVIEW-V1',
    versionCount: Math.max(1, Number((plantilla as { defaultVersionCount?: unknown }).defaultVersionCount ?? 1))
  });
  const targetPages = Math.max(1, Number(bookletConfig.targetPages ?? (plantilla as { numeroPaginas?: unknown }).numeroPaginas ?? 1));
  const warningSummary = warningsFromPreview({
    targetPages,
    pagesEstimated: bundle.bookletDiagnostics.pagesEstimated,
    familyCapacity: family.questionCapacity,
    questionCount: preguntas.length,
    imageHeavy: bundle.bookletDiagnostics.imageHeavyQuestions.length
  });
  const preview: AssessmentPreviewV1 = {
    omrRuntimeVersion: OMR_RUNTIME_VERSION_V1,
    assessmentTemplateId: String(plantilla._id),
    questionCount: preguntas.length,
    recommendedSheetFamily: recomendarFamiliaOmrV1(preguntas.length).familyCode,
    bookletPreview: {
      pagesConfigured: targetPages,
      pagesEstimated: bundle.bookletDiagnostics.pagesEstimated,
      questionsPerPage: bundle.bookletDiagnostics.questionsPerPage,
      imageHeavyQuestions: bundle.bookletDiagnostics.imageHeavyQuestions,
      layoutWarnings: bundle.bookletDiagnostics.layoutWarnings,
      pdfUrl: `/assessments/templates/${String(plantilla._id)}/preview/booklet.pdf`
    },
    omrSheetPreview: {
      familyCode: family.familyCode,
      familyRevision: 1,
      questionCapacity: family.questionCapacity,
      questionsUsed: preguntas.length,
      unusedQuestionsIgnored: Math.max(0, family.questionCapacity - preguntas.length),
      studentIdDigits: family.studentIdDigits,
      versionBubbleCount: family.versionBubbleCount,
      identityMode: 'qr_plus_bubbled_id',
      pdfUrl: `/assessments/templates/${String(plantilla._id)}/preview/omr-sheet.pdf`
    },
    diagnostics: {
      bookletDensityScore: Number(Math.max(0, 1 - Math.max(0, bundle.bookletDiagnostics.pagesEstimated - targetPages) * 0.3).toFixed(4)),
      omrReadabilityScore: Number(Math.min(1, bundle.omrDiagnostics.bubbleSpacingScore * 0.55 + (1 - bundle.omrDiagnostics.anchorFootprintRatio) * 0.45).toFixed(4)),
      anchorFootprintRatio: bundle.omrDiagnostics.anchorFootprintRatio,
      qrFootprintRatio: bundle.omrDiagnostics.qrFootprintRatio,
      bubbleSpacingScore: bundle.omrDiagnostics.bubbleSpacingScore,
      pagesWithLowDensity: bundle.bookletDiagnostics.questionsPerPage.map((count, idx) => ({ count, idx })).filter((item) => item.count < 6).map((item) => item.idx + 1),
      hardLayoutWarnings: [...warningSummary.blockingIssues]
    },
    blockingIssues: warningSummary.blockingIssues,
    warnings: [...warningSummary.warnings, ...bundle.bookletDiagnostics.layoutWarnings]
  };
  return { preview, bundle };
}

export async function previsualizarAssessment(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { preview } = await construirPreview(String(req.params.id || ''), docenteId);
  res.json(preview);
}

export async function previsualizarAssessmentBookletPdf(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { bundle } = await construirPreview(String(req.params.id || ''), docenteId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="assessment-booklet-v1.pdf"');
  res.send(bundle.bookletPdfBytes);
}

export async function previsualizarAssessmentOmrSheetPdf(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { bundle } = await construirPreview(String(req.params.id || ''), docenteId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="assessment-omr-sheet-v1.pdf"');
  res.send(bundle.omrSheetPdfBytes);
}

export async function generarAssessment(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const plantilla = await cargarPlantillaDocente(String(req.params.id || ''), docenteId);
  const preguntas = await construirPreguntasPlantillaV1(plantilla as unknown as Record<string, unknown>, docenteId, `generate:${req.params.id}:${Date.now()}`);
  const family = resolverFamiliaOmrV1(String((plantilla as { omrConfig?: { sheetFamilyCode?: unknown } }).omrConfig?.sheetFamilyCode ?? ''));
  if (family.questionCapacity < preguntas.length) {
    throw new ErrorAplicacion('OMR_FAMILY_CAPACIDAD_INSUFICIENTE', 'La familia OMR no cubre el total de reactivos de la evaluación.', 409);
  }
  const [docente, periodo] = await Promise.all([
    Docente.findById(docenteId).lean(),
    plantilla.periodoId ? Periodo.findById(plantilla.periodoId).lean() : Promise.resolve(null)
  ]);
  const folio = randomUUID().split('-')[0].toUpperCase();
  const bundle = await generarBundleAssessmentOmrV1({
    plantilla,
    preguntas,
    family,
    folio,
    versionCount: Math.max(1, Number((plantilla as { defaultVersionCount?: unknown }).defaultVersionCount ?? 1))
  });
  const artifacts = await persistirArtifactsAssessmentOmrV1({
    folio,
    bookletPdfBytes: bundle.bookletPdfBytes,
    omrSheetPdfBytes: bundle.omrSheetPdfBytes
  });
  const answerKeySet = preguntas.map((pregunta, idx) => ({
    numeroPregunta: idx + 1,
    idPregunta: pregunta.id,
    correcta: String.fromCharCode(65 + Math.max(0, pregunta.opciones.findIndex((opcion: { esCorrecta: boolean }) => opcion.esCorrecta)))
  }));
  const paginas = bundle.bookletDiagnostics.questionsPerPage.map((count, idx, arr) => {
    const start = arr.slice(0, idx).reduce((sum, current) => sum + current, 0) + 1;
    const end = start + count - 1;
    return { numero: idx + 1, qrTexto: `BOOKLET:${folio}:P${idx + 1}`, preguntasDel: start, preguntasAl: end };
  });
  const examenGenerado = await ExamenGenerado.create({
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id,
    folio,
    loteId: randomUUID().split('-')[0].toUpperCase(),
    estado: 'generado',
    preguntasIds: preguntas.map((pregunta) => pregunta.id),
    mapaVariante: { ordenPreguntas: preguntas.map((pregunta) => pregunta.id), ordenOpcionesPorPregunta: Object.fromEntries(preguntas.map((pregunta) => [pregunta.id, [0, 1, 2, 3, 4]])) },
    paginas,
    rutaPdf: artifacts.bookletPath,
    bookletArtifact: { path: artifacts.bookletPath, docente: String((docente as { nombreCompleto?: unknown } | null)?.nombreCompleto ?? '') },
    omrSheetArtifact: { path: artifacts.omrSheetPath },
    questionMap: { totalPreguntas: preguntas.length, materia: String((periodo as { nombre?: unknown } | null)?.nombre ?? '') },
    answerKeySet,
    sheetInstances: bundle.sheetInstances,
    omrRuntimeVersion: OMR_RUNTIME_VERSION_V1,
    mapaOmr: {
      margenMm: 10,
      templateVersion: 1,
      paginas: bundle.mapaOmrV1.paginas,
      omrRuntimeVersion: OMR_RUNTIME_VERSION_V1,
      sheetFamilyCode: family.familyCode,
      sheetFamilyRevision: 1
    }
  });
  res.status(201).json({
    examenGenerado,
    generatedAssessment: {
      _id: String(examenGenerado._id),
      folio,
      bookletPdfUrl: `/assessments/generated/${String(examenGenerado._id)}/booklet.pdf`,
      omrSheetPdfUrl: `/assessments/generated/${String(examenGenerado._id)}/omr-sheet.pdf`
    }
  });
}

async function cargarGeneratedAssessment(id: string, docenteId: string) {
  const generado = await ExamenGenerado.findById(id).lean();
  if (!generado) throw new ErrorAplicacion('ASSESSMENT_NO_ENCONTRADO', 'Assessment generado no encontrado', 404);
  if (String(generado.docenteId) !== String(docenteId)) throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a esta evaluación', 403);
  return generado;
}

export async function descargarGeneratedBooklet(req: SolicitudDocente, res: Response) {
  const generado = await cargarGeneratedAssessment(String(req.params.id || ''), obtenerDocenteId(req));
  const ruta = String((generado as { bookletArtifact?: { path?: unknown } }).bookletArtifact?.path ?? generado.rutaPdf ?? '');
  if (!ruta) throw new ErrorAplicacion('PDF_NO_DISPONIBLE', 'No existe cuadernillo para esta evaluación', 404);
  const fs = await import('node:fs/promises');
  res.setHeader('Content-Type', 'application/pdf');
  res.send(await fs.readFile(ruta));
}

export async function descargarGeneratedOmrSheet(req: SolicitudDocente, res: Response) {
  const generado = await cargarGeneratedAssessment(String(req.params.id || ''), obtenerDocenteId(req));
  const ruta = String((generado as { omrSheetArtifact?: { path?: unknown } }).omrSheetArtifact?.path ?? '');
  if (!ruta) throw new ErrorAplicacion('PDF_NO_DISPONIBLE', 'No existe hoja OMR para esta evaluación', 404);
  const fs = await import('node:fs/promises');
  res.setHeader('Content-Type', 'application/pdf');
  res.send(await fs.readFile(ruta));
}

export async function crearOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { generatedAssessmentId, sourceType, capturas } = req.body as z.infer<typeof esquemaCrearOmrScanJob>;
  const assessment = await cargarGeneratedAssessment(generatedAssessmentId, docenteId);
  const pages = Array.isArray((assessment as { mapaOmr?: { paginas?: unknown[] } }).mapaOmr?.paginas)
    ? (((assessment as { mapaOmr?: { paginas?: unknown[] } }).mapaOmr?.paginas ?? []) as Array<MapaPaginaOmrV1>)
    : [];
  const jobId = randomUUID();
  const resultados = [];
  let pagesProcessed = 0;
  let accepted = 0;
  let review = 0;
  let rejected = 0;

  for (let idx = 0; idx < capturas.length; idx += 1) {
    const captura = capturas[idx]!;
    const qrTexto = await leerQrDesdeImagen(captura.imagenBase64).catch(() => undefined);
    const pageMap =
      pages.find((page) => String((page.qr as { texto?: unknown })?.texto ?? '') === String(qrTexto ?? '').trim()) ??
      pages[idx] ??
      pages[0];
    const numeroPagina = Number((pageMap as { numeroPagina?: unknown })?.numeroPagina ?? idx + 1);
    const qrEsperado = String((pageMap as { qr?: { texto?: unknown } }).qr?.texto ?? qrTexto ?? '');
    const resultadoOmr = await analizarOmr(
      captura.imagenBase64,
      pageMap,
      qrEsperado,
      Number((assessment as { mapaOmr?: { margenMm?: unknown } }).mapaOmr?.margenMm ?? 10),
      { folio: String(assessment.folio ?? ''), numeroPagina, templateVersionDetectada: 1 }
    ).catch(() => ({
      respuestasDetectadas: [],
      advertencias: ['No se pudo analizar la captura OMR V1.'],
      qrTexto,
      calidadPagina: 0,
      estadoAnalisis: 'rechazado_calidad',
      motivosRevision: ['Fallo del motor OMR V1'],
      templateVersionDetectada: 1,
      confianzaPromedioPagina: 0,
      ratioAmbiguas: 1,
      engineVersion: 'omr-v1-cv',
      geomQuality: 0,
      photoQuality: 0,
      decisionPolicy: 'conservadora_v1'
    }));
    const scanStatus = aScanStatus(resultadoOmr.estadoAnalisis);
    if (scanStatus === 'accepted') accepted += 1;
    else if (scanStatus === 'needs_review') review += 1;
    else rejected += 1;
    pagesProcessed += 1;
    resultados.push({
      sheetSerial: String(qrTexto || `UNKNOWN-${idx + 1}`),
      pageIndex: numeroPagina,
      sourceFingerprint: createHash('sha1').update(String(captura.imagenBase64).slice(0, 5000)).digest('hex'),
      qualityMetrics: {
        calidadPagina: resultadoOmr.calidadPagina,
        confianzaPromedioPagina: resultadoOmr.confianzaPromedioPagina,
        ratioAmbiguas: resultadoOmr.ratioAmbiguas
      },
      qrResult: { qrTexto: resultadoOmr.qrTexto ?? null },
      anchorResult: { geomQuality: (resultadoOmr as { geomQuality?: unknown }).geomQuality ?? null },
      identityResult: {
        source: (assessment as { alumnoId?: unknown }).alumnoId ? 'bound_sheet' : 'qr_only',
        studentId: (assessment as { alumnoId?: unknown }).alumnoId ? String((assessment as { alumnoId?: unknown }).alumnoId) : null
      },
      versionResult: { versionCode: 'A' },
      responses: resultadoOmr.respuestasDetectadas,
      scanStatus,
      exceptions: aExceptions(resultadoOmr),
      confidence: Number(resultadoOmr.confianzaPromedioPagina ?? 0),
      canonicalImageArtifact: null,
      debugArtifacts: []
    });
  }

  const job = await OmrScanJob.create({
    jobId,
    sourceType,
    generatedAssessmentId,
    submittedBy: docenteId,
    status: 'completed',
    pagesTotal: capturas.length,
    pagesProcessed,
    summary: { accepted, needsReview: review, rejected },
    pages: resultados
  });
  res.status(201).json({ jobId: job.jobId, job });
}

export async function obtenerOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await OmrScanJob.findOne({ jobId: String(req.params.id || '') }).lean();
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  const assessment = await cargarGeneratedAssessment(String(job.generatedAssessmentId), docenteId);
  if (!assessment) throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso al job OMR', 403);
  res.json({ job });
}

export async function obtenerPaginasOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await OmrScanJob.findOne({ jobId: String(req.params.id || '') }).lean();
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  await cargarGeneratedAssessment(String(job.generatedAssessmentId), docenteId);
  res.json({ pages: Array.isArray(job.pages) ? job.pages : [] });
}

export async function obtenerExcepcionesOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await OmrScanJob.findOne({ jobId: String(req.params.id || '') }).lean();
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  await cargarGeneratedAssessment(String(job.generatedAssessmentId), docenteId);
  const exceptions = (Array.isArray(job.pages) ? job.pages : []).flatMap((page: { exceptions?: unknown[]; sheetSerial?: unknown; pageIndex?: unknown }) =>
    (Array.isArray(page.exceptions) ? page.exceptions : []).map((item: unknown) => ({
      ...(item as Record<string, unknown>),
      sheetSerial: page.sheetSerial,
      pageIndex: page.pageIndex
    }))
  );
  res.json({ exceptions });
}

export async function resolverExcepcionOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const jobId = String(req.params.id || '');
  const sheetSerial = String(req.params.sheetSerial || '');
  const payload = req.body as z.infer<typeof esquemaResolverOmrException>;
  const job = await OmrScanJob.findOne({ jobId }).lean();
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  await cargarGeneratedAssessment(String(job.generatedAssessmentId), docenteId);
  const updated = await OmrScanJob.findOneAndUpdate(
    { jobId },
    {
      $push: {
        reviewResolutions: {
          sheetSerial,
          resolvedBy: docenteId,
          resolvedAt: new Date(),
          overrides: payload.overrides ?? {},
          finalResponses: payload.finalResponses ?? [],
          finalIdentity: payload.finalIdentity ?? {},
          resolutionReason: payload.resolutionReason
        }
      },
      $set: { 'pages.$[page].scanStatus': 'accepted' }
    },
    {
      arrayFilters: [{ 'page.sheetSerial': sheetSerial }],
      new: true
    }
  ).lean();
  res.json({ job: updated });
}

export async function finalizarOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const jobId = String(req.params.id || '');
  const job = await OmrScanJob.findOne({ jobId }).lean();
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  await cargarGeneratedAssessment(String(job.generatedAssessmentId), docenteId);
  const updated = await OmrScanJob.findOneAndUpdate({ jobId }, { $set: { status: 'finalized' } }, { new: true }).lean();
  res.json({ job: updated, finalized: true });
}

export const middlewaresOmrV1 = {
  listarFamilias: [requerirPermiso('plantillas:previsualizar'), listarFamiliasOmr],
  obtenerFamilia: [requerirPermiso('plantillas:previsualizar'), obtenerFamiliaOmr],
  crearFamilia: [requerirPermiso('plantillas:gestionar'), validarCuerpo(esquemaCrearOmrSheetFamily, { strict: true }), crearFamiliaOmr],
  crearRevisionFamilia: [requerirPermiso('plantillas:gestionar'), validarCuerpo(esquemaCrearOmrSheetRevision, { strict: true }), crearRevisionFamiliaOmr],
  preview: [requerirPermiso('plantillas:previsualizar'), previsualizarAssessment],
  previewBookletPdf: [requerirPermiso('plantillas:previsualizar'), previsualizarAssessmentBookletPdf],
  previewOmrPdf: [requerirPermiso('plantillas:previsualizar'), previsualizarAssessmentOmrSheetPdf],
  generate: [requerirPermiso('examenes:generar'), generarAssessment],
  createJob: [requerirPermiso('omr:analizar'), validarCuerpo(esquemaCrearOmrScanJob, { strict: true }), crearOmrScanJob],
  getJob: [requerirPermiso('omr:analizar'), obtenerOmrScanJob],
  getPages: [requerirPermiso('omr:analizar'), obtenerPaginasOmrScanJob],
  getExceptions: [requerirPermiso('omr:analizar'), obtenerExcepcionesOmrScanJob],
  resolveException: [requerirPermiso('omr:analizar'), validarCuerpo(esquemaResolverOmrException, { strict: true }), resolverExcepcionOmrScanJob],
  finalizeJob: [requerirPermiso('omr:analizar'), finalizarOmrScanJob],
  downloadBooklet: [requerirPermiso('examenes:descargar'), descargarGeneratedBooklet],
  downloadOmrSheet: [requerirPermiso('examenes:descargar'), descargarGeneratedOmrSheet]
};
