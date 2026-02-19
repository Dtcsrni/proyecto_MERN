import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';

type Opcion = 'A' | 'B' | 'C' | 'D' | 'E';

type CapturaManifest = {
  captureId: string;
  imagePath: string;
  mapaOmrPath: string;
  folio: string;
  numeroPagina: number;
  templateVersion: 3;
  device?: string;
  quality?: 'alta' | 'media' | 'baja';
};

type ManifestDataset = {
  version: string;
  datasetType: 'real_tv3';
  hash: string;
  capturas: CapturaManifest[];
  thresholds?: {
    recall_marked?: number;
    precision_marked?: number;
    false_positive_marked?: number;
    auto_grade_wrong?: number;
  };
};

type GroundTruthRow = {
  captureId: string;
  numeroPregunta: number;
  opcionEsperada: Opcion | null;
};

type EvalArgs = {
  dataset: string;
  report: string;
};

type EvalCaptureResult = {
  captureId: string;
  estadoAnalisis: 'ok' | 'requiere_revision' | 'rechazado_calidad';
  totalPreguntasEsperadas: number;
  mismatches: number;
};

type GateThresholds = {
  recall_marked: number;
  precision_marked: number;
  false_positive_marked: number;
  auto_grade_wrong: number;
};

const DEFAULT_THRESHOLDS: GateThresholds = {
  recall_marked: 0.97,
  precision_marked: 0.98,
  false_positive_marked: 0.003,
  auto_grade_wrong: 0
};

function parseArgs(argv: string[]): EvalArgs {
  const out: EvalArgs = {
    dataset: '../../omr_samples_tv3',
    report: '../../reports/qa/latest/omr-tv3-gate.json'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === '--dataset' || arg === '-d') && next) {
      out.dataset = next;
      i += 1;
      continue;
    }
    if ((arg === '--report' || arg === '-r') && next) {
      out.report = next;
      i += 1;
    }
  }
  return out;
}

function toDataUrlFromPath(filePath: string, buffer: Buffer) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return `data:image/png;base64,${buffer.toString('base64')}`;
  if (ext === '.jpg' || ext === '.jpeg') return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function loadImageAsDataUrl(absPath: string) {
  const original = await fs.readFile(absPath);
  const ext = path.extname(absPath).toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    return toDataUrlFromPath(absPath, original);
  }
  const png = await sharp(original).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function readGroundTruthJsonl(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf8');
  const lines = raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  const out: GroundTruthRow[] = [];
  for (const line of lines) {
    const parsed = JSON.parse(line) as GroundTruthRow;
    out.push(parsed);
  }
  return out;
}

function normalizeOption(raw: unknown): Opcion | null {
  if (raw === null) return null;
  const text = String(raw ?? '').trim().toUpperCase();
  if (text === 'A' || text === 'B' || text === 'C' || text === 'D' || text === 'E') return text;
  return null;
}

function ensureValidManifest(manifest: ManifestDataset) {
  if (manifest.datasetType !== 'real_tv3') {
    throw new Error('Dataset inválido: datasetType debe ser "real_tv3".');
  }
  if (!Array.isArray(manifest.capturas)) {
    throw new Error('Dataset inválido: el campo capturas debe ser un arreglo.');
  }
  for (const captura of manifest.capturas) {
    if (captura.templateVersion !== 3) {
      throw new Error(`Captura inválida (${captura.captureId}): templateVersion debe ser 3.`);
    }
    if (!captura.captureId || !captura.imagePath || !captura.mapaOmrPath) {
      throw new Error(`Captura inválida: faltan campos obligatorios (captureId/imagePath/mapaOmrPath).`);
    }
  }
}

function createGroundTruthIndex(rows: GroundTruthRow[]) {
  const byCapture = new Map<string, Map<number, Opcion | null>>();
  for (const row of rows) {
    const captureId = String(row.captureId ?? '').trim();
    const numeroPregunta = Number(row.numeroPregunta ?? 0);
    if (!captureId || !Number.isInteger(numeroPregunta) || numeroPregunta <= 0) continue;
    if (!byCapture.has(captureId)) byCapture.set(captureId, new Map<number, Opcion | null>());
    byCapture.get(captureId)?.set(numeroPregunta, normalizeOption(row.opcionEsperada));
  }
  return byCapture;
}

async function main() {
  const args = parseArgs(process.argv);
  const datasetRoot = path.resolve(process.cwd(), args.dataset);
  const reportPath = path.resolve(process.cwd(), args.report);
  const startedAt = new Date();

  const manifestPath = path.join(datasetRoot, 'manifest.json');
  const truthPath = path.join(datasetRoot, 'ground_truth.jsonl');
  const qualityTagsPath = path.join(datasetRoot, 'quality_tags.json');

  const manifest = await readJson<ManifestDataset>(manifestPath);
  ensureValidManifest(manifest);
  if (manifest.capturas.length === 0) {
    const finishedAt = new Date();
    const report = {
      version: '1',
      gate: 'omr-tv3-extended',
      datasetRoot,
      datasetType: manifest.datasetType,
      datasetHash: manifest.hash,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      ok: true,
      skipped: true,
      reason: 'dataset_empty_tv3'
    };
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`[omr-tv3-gate] SKIP: dataset TV3 vacío (${reportPath})\n`);
    return;
  }
  await readJson<Record<string, unknown>>(qualityTagsPath);
  const groundTruthRows = await readGroundTruthJsonl(truthPath);
  const expectedByCapture = createGroundTruthIndex(groundTruthRows);

  const thresholds: GateThresholds = {
    recall_marked: Number(manifest.thresholds?.recall_marked ?? DEFAULT_THRESHOLDS.recall_marked),
    precision_marked: Number(manifest.thresholds?.precision_marked ?? DEFAULT_THRESHOLDS.precision_marked),
    false_positive_marked: Number(
      manifest.thresholds?.false_positive_marked ?? DEFAULT_THRESHOLDS.false_positive_marked
    ),
    auto_grade_wrong: Number(manifest.thresholds?.auto_grade_wrong ?? DEFAULT_THRESHOLDS.auto_grade_wrong)
  };

  let tpMarked = 0;
  let fpMarked = 0;
  let fnMarked = 0;
  let totalPreguntas = 0;
  let autoGradeWrong = 0;
  let reviewCount = 0;
  const perCapture: EvalCaptureResult[] = [];

  for (const captura of manifest.capturas) {
    const imageAbs = path.resolve(datasetRoot, captura.imagePath);
    const mapaAbs = path.resolve(datasetRoot, captura.mapaOmrPath);
    const dataUrl = await loadImageAsDataUrl(imageAbs);
    const mapaPagina = await readJson<unknown>(mapaAbs);
    const qrEsperado = `EXAMEN:${captura.folio}:P${captura.numeroPagina}:TV3`;

    const resultado = await analizarOmr(
      dataUrl,
      mapaPagina as never,
      qrEsperado,
      10,
      {
        folio: captura.folio,
        numeroPagina: captura.numeroPagina,
        templateVersionDetectada: 3
      }
    );

    const respuestasDetectadas = Array.isArray(resultado.respuestasDetectadas) ? resultado.respuestasDetectadas : [];
    const detectadasByPregunta = new Map<number, Opcion | null>();
    for (const respuesta of respuestasDetectadas) {
      const numeroPregunta = Number((respuesta as { numeroPregunta?: unknown }).numeroPregunta ?? 0);
      if (!Number.isInteger(numeroPregunta) || numeroPregunta <= 0) continue;
      detectadasByPregunta.set(numeroPregunta, normalizeOption((respuesta as { opcion?: unknown }).opcion));
    }

    const esperadas = expectedByCapture.get(captura.captureId);
    if (!esperadas || esperadas.size === 0) {
      throw new Error(`Ground truth faltante para captura ${captura.captureId}`);
    }

    let mismatches = 0;
    for (const [numeroPregunta, opcionEsperada] of esperadas.entries()) {
      totalPreguntas += 1;
      const opcionDetectada = detectadasByPregunta.get(numeroPregunta) ?? null;
      const esperadaMarcada = opcionEsperada !== null;
      const detectadaMarcada = opcionDetectada !== null;

      if (esperadaMarcada && detectadaMarcada && opcionEsperada === opcionDetectada) {
        tpMarked += 1;
      } else if (!esperadaMarcada && detectadaMarcada) {
        fpMarked += 1;
        mismatches += 1;
      } else if (esperadaMarcada && !detectadaMarcada) {
        fnMarked += 1;
        mismatches += 1;
      } else if (esperadaMarcada && detectadaMarcada && opcionEsperada !== opcionDetectada) {
        fpMarked += 1;
        fnMarked += 1;
        mismatches += 1;
      }
    }

    if (resultado.estadoAnalisis !== 'ok') reviewCount += 1;
    if (resultado.estadoAnalisis === 'ok' && mismatches > 0) autoGradeWrong += 1;

    perCapture.push({
      captureId: captura.captureId,
      estadoAnalisis: resultado.estadoAnalisis,
      totalPreguntasEsperadas: esperadas.size,
      mismatches
    });
  }

  const precisionMarked = tpMarked + fpMarked > 0 ? tpMarked / (tpMarked + fpMarked) : 1;
  const recallMarked = tpMarked + fnMarked > 0 ? tpMarked / (tpMarked + fnMarked) : 1;
  const falsePositiveMarked = totalPreguntas > 0 ? fpMarked / totalPreguntas : 0;
  const reviewRate = manifest.capturas.length > 0 ? reviewCount / manifest.capturas.length : 0;

  const checks = {
    recall_marked: recallMarked >= thresholds.recall_marked,
    precision_marked: precisionMarked >= thresholds.precision_marked,
    false_positive_marked: falsePositiveMarked <= thresholds.false_positive_marked,
    auto_grade_wrong: autoGradeWrong <= thresholds.auto_grade_wrong
  };
  const gatePassed = Object.values(checks).every(Boolean);
  const finishedAt = new Date();

  const report = {
    version: '1',
    gate: 'omr-tv3-extended',
    datasetRoot,
    datasetType: manifest.datasetType,
    datasetHash: manifest.hash,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    thresholds,
    metrics: {
      totalCapturas: manifest.capturas.length,
      totalPreguntas,
      tpMarked,
      fpMarked,
      fnMarked,
      precision_marked: Number(precisionMarked.toFixed(6)),
      recall_marked: Number(recallMarked.toFixed(6)),
      false_positive_marked: Number(falsePositiveMarked.toFixed(6)),
      auto_grade_wrong: autoGradeWrong,
      review_rate: Number(reviewRate.toFixed(6))
    },
    checks,
    ok: gatePassed,
    perCapture
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`[omr-tv3-gate] Reporte escrito: ${reportPath}\n`);

  if (!gatePassed) {
    process.stderr.write('[omr-tv3-gate] FAIL: métricas por debajo de umbral\n');
    process.exit(1);
  }
}

main().catch((error) => {
  const args = parseArgs(process.argv);
  const reportPath = path.resolve(process.cwd(), args.report);
  const errorMessage = String(error instanceof Error ? error.message : error);
  const payload = {
    version: '1',
    gate: 'omr-tv3-extended',
    ok: false,
    error: errorMessage,
    generatedAt: new Date().toISOString()
  };
  fs.mkdir(path.dirname(reportPath), { recursive: true })
    .then(() => fs.writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'))
    .finally(() => {
      process.stderr.write(`[omr-tv3-gate] ERROR: ${errorMessage}\n`);
      process.exit(1);
    });
});
