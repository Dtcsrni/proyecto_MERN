import fs from 'node:fs/promises';
import path from 'node:path';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';
import { evaluarAutoCalificableOmr } from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr';

type Opcion = 'A' | 'B' | 'C' | 'D' | 'E';
type MarkType = 'valid' | 'blank' | 'double' | 'smudge';
type EstadoAnalisisOmr = 'ok' | 'rechazado_calidad' | 'requiere_revision';

type EvalThresholds = {
  precisionMin: number;
  falsePositiveMax: number;
  invalidDetectionMin: number;
  pagePassMin: number;
  autoGradeTrustMin: number;
};

type CaptureManifest = {
  captureId: string;
  imagePath: string;
  mapaOmrPath: string;
  folio: string;
  numeroPagina: number;
  templateVersion: 3;
  scenario?: string;
};

type ManifestDataset = {
  version: string;
  datasetType: string;
  thresholds: {
    precisionMin: number;
    falsePositiveMax: number;
    invalidDetectionMin: number;
    pagePassMin: number;
    autoGradeTrustMin?: number;
  };
  groundTruthRef: string;
  capturas: CaptureManifest[];
};

type GroundTruthRow = {
  captureId: string;
  numeroPregunta: number;
  opcionEsperada: Opcion | null;
  markType: MarkType;
};

export type ValidateRealOptions = {
  datasetRoot: string;
  reportPath: string;
  failureReportPath?: string;
  thresholds?: Partial<EvalThresholds>;
};

type RealValidationPayload = {
  runId: string;
  timestamp: string;
  datasetRoot: string;
  datasetType: string;
  thresholds: EvalThresholds;
  metrics: {
    precision: number;
    falsePositiveRate: number;
    invalidDetectionRate: number;
    pagePassRate: number;
    autoGradeTrustRate: number;
    autoGradePrecision: number;
    autoCoverageRate: number;
    autoPages: number;
    totalPages: number;
    totalPreguntas: number;
  };
  checks: {
    precision: boolean;
    falsePositiveRate: boolean;
    invalidDetectionRate: boolean;
    pagePassRate: boolean;
    autoGradeTrustRate: boolean;
    autoCoverageRate: boolean;
  };
  ok: boolean;
  perCapture: Array<{
    captureId: string;
    estadoAnalisis: EstadoAnalisisOmr;
    calidadPagina: number;
    confianzaPromedioPagina: number;
    ratioAmbiguas: number;
    coberturaDeteccion: number;
    autoCalificable: boolean;
    mismatches: number;
    totalPreguntas: number;
    pagePass: boolean;
    scenario?: string;
  }>;
};

type FailurePayload = {
  runId: string;
  timestamp: string;
  datasetRoot: string;
  topCauses: Array<{ causa: string; total: number }>;
  byEstadoAnalisis: Record<EstadoAnalisisOmr, number>;
  byScenario: Record<string, number>;
  topCaptures: Array<{
    captureId: string;
    mismatches: number;
    totalPreguntas: number;
    estadoAnalisis: EstadoAnalisisOmr;
    scenario?: string;
  }>;
};

type Args = {
  dataset: string;
  report: string;
  failureReport: string;
  autoGradeTrustMin?: number;
  precisionMin?: number;
  falsePositiveMax?: number;
  invalidDetectionMin?: number;
  pagePassMin?: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv3_real',
    report: '../../reports/qa/latest/omr/tv3-real-validation.json',
    failureReport: '../../reports/qa/latest/omr/tv3-real-failure-analysis.json'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--dataset' || key === '-d') && value) {
      args.dataset = value;
      i += 1;
      continue;
    }
    if ((key === '--report' || key === '-r') && value) {
      args.report = value;
      i += 1;
      continue;
    }
    if (key === '--failure-report' && value) {
      args.failureReport = value;
      i += 1;
      continue;
    }
    if (key === '--autograde-trust-min' && value) {
      args.autoGradeTrustMin = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--precision-min' && value) {
      args.precisionMin = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--false-positive-max' && value) {
      args.falsePositiveMax = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--invalid-detection-min' && value) {
      args.invalidDetectionMin = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--page-pass-min' && value) {
      args.pagePassMin = Number.parseFloat(value);
      i += 1;
    }
  }
  return args;
}

async function readJsonFile<T>(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function readGroundTruth(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf8');
  return raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GroundTruthRow);
}

function buildTruthIndex(rows: GroundTruthRow[]) {
  const byCapture = new Map<string, Map<number, GroundTruthRow>>();
  for (const row of rows) {
    if (!byCapture.has(row.captureId)) byCapture.set(row.captureId, new Map<number, GroundTruthRow>());
    byCapture.get(row.captureId)?.set(row.numeroPregunta, row);
  }
  return byCapture;
}

function round6(value: number) {
  return Number(value.toFixed(6));
}

function imageToDataUrl(imagePath: string, fileBuffer: Buffer) {
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fileBuffer.toString('base64')}`;
}

function bump(counter: Map<string, number>, key: string) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

export async function runTv3RealValidation(options: ValidateRealOptions): Promise<{
  report: RealValidationPayload;
  failures: FailurePayload;
}> {
  const datasetRoot = path.resolve(process.cwd(), options.datasetRoot);
  const reportPath = path.resolve(process.cwd(), options.reportPath);
  const failureReportPath = options.failureReportPath
    ? path.resolve(process.cwd(), options.failureReportPath)
    : undefined;

  const manifest = await readJsonFile<ManifestDataset>(path.join(datasetRoot, 'manifest.json'));
  const groundTruthRows = await readGroundTruth(path.join(datasetRoot, manifest.groundTruthRef));
  const truthByCapture = buildTruthIndex(groundTruthRows);
  const thresholds: EvalThresholds = {
    precisionMin: options.thresholds?.precisionMin ?? manifest.thresholds.precisionMin,
    falsePositiveMax: options.thresholds?.falsePositiveMax ?? manifest.thresholds.falsePositiveMax,
    invalidDetectionMin: options.thresholds?.invalidDetectionMin ?? manifest.thresholds.invalidDetectionMin,
    pagePassMin: options.thresholds?.pagePassMin ?? manifest.thresholds.pagePassMin,
    autoGradeTrustMin: options.thresholds?.autoGradeTrustMin ?? manifest.thresholds.autoGradeTrustMin ?? 0.95
  };

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let total = 0;
  let invalidTotal = 0;
  let invalidDetected = 0;
  let pagePassCount = 0;

  let autoPages = 0;
  let autoPagesPassing = 0;
  let autoTp = 0;
  let autoFp = 0;

  const causeCounts = new Map<string, number>();
  const scenarioCounts = new Map<string, number>();
  const estadoCounts: Record<EstadoAnalisisOmr, number> = {
    ok: 0,
    requiere_revision: 0,
    rechazado_calidad: 0
  };

  const perCapture: RealValidationPayload['perCapture'] = [];

  for (const capture of manifest.capturas) {
    const imageAbsolute = path.join(datasetRoot, capture.imagePath);
    const mapAbsolute = path.join(datasetRoot, capture.mapaOmrPath);
    const imageBuffer = await fs.readFile(imageAbsolute);
    const imageDataUrl = imageToDataUrl(imageAbsolute, imageBuffer);
    const mapaPagina = await readJsonFile<unknown>(mapAbsolute);

    const qrEsperado = [
      capture.folio,
      `EXAMEN:${capture.folio}:P${capture.numeroPagina}`,
      `EXAMEN:${capture.folio}:P${capture.numeroPagina}:TV3`
    ];
    const resultado = await analizarOmr(
      imageDataUrl,
      mapaPagina as Parameters<typeof analizarOmr>[1],
      qrEsperado,
      10,
      { numeroPagina: capture.numeroPagina },
      `tv3-real-${capture.captureId}`
    );

    const expected = truthByCapture.get(capture.captureId);
    if (!expected) throw new Error(`No hay ground truth para ${capture.captureId}`);

    const detectedMap = new Map<number, Opcion | null>();
    for (const respuesta of resultado.respuestasDetectadas) {
      detectedMap.set(respuesta.numeroPregunta, (respuesta.opcion as Opcion | null) ?? null);
      for (const flag of respuesta.flags) bump(causeCounts, flag);
    }
    for (const motivo of resultado.motivosRevision) {
      if (String(motivo || '').trim()) bump(causeCounts, `motivo:${String(motivo).trim()}`);
    }

    let mismatches = 0;
    for (const [numeroPregunta, row] of expected.entries()) {
      total += 1;
      const exp = row.opcionEsperada;
      const det = detectedMap.get(numeroPregunta) ?? null;

      if (row.markType === 'double' || row.markType === 'smudge') {
        invalidTotal += 1;
        if (det === null) invalidDetected += 1;
      }

      if (exp !== null && det === exp) {
        tp += 1;
      } else if (exp === null && det !== null) {
        fp += 1;
        mismatches += 1;
        bump(causeCounts, 'mismatch:false_mark');
      } else if (exp !== null && det === null) {
        fn += 1;
        mismatches += 1;
        bump(causeCounts, 'mismatch:missed_mark');
      } else if (exp !== null && det !== null && exp !== det) {
        fp += 1;
        fn += 1;
        mismatches += 1;
        bump(causeCounts, 'mismatch:wrong_option');
      }
    }

    const totalPreguntas = expected.size;
    const deteccionPositivas = resultado.respuestasDetectadas.filter((item) => item.opcion !== null).length;
    const coberturaDeteccion = totalPreguntas > 0 ? deteccionPositivas / totalPreguntas : 0;
    const evaluacionAuto = evaluarAutoCalificableOmr({
      estadoAnalisis: resultado.estadoAnalisis,
      calidadPagina: resultado.calidadPagina,
      confianzaPromedioPagina: resultado.confianzaPromedioPagina,
      ratioAmbiguas: resultado.ratioAmbiguas,
      coberturaDeteccion
    });
    const allowedMismatches = totalPreguntas > 0 ? Math.max(1, Math.floor(totalPreguntas * 0.35)) : 0;
    const pagePass = totalPreguntas > 0 ? mismatches <= allowedMismatches : true;
    if (pagePass) pagePassCount += 1;

    if (evaluacionAuto.autoCalificableOmr) {
      autoPages += 1;
      if (pagePass) autoPagesPassing += 1;
      for (const [numeroPregunta, row] of expected.entries()) {
        const exp = row.opcionEsperada;
        const det = detectedMap.get(numeroPregunta) ?? null;
        if (exp !== null && det === exp) autoTp += 1;
        else if (det !== null && exp !== det) autoFp += 1;
      }
    }

    const scenario = String(capture.scenario || 'default');
    bump(scenarioCounts, scenario);
    estadoCounts[resultado.estadoAnalisis] += 1;

    perCapture.push({
      captureId: capture.captureId,
      estadoAnalisis: resultado.estadoAnalisis,
      calidadPagina: round6(resultado.calidadPagina),
      confianzaPromedioPagina: round6(resultado.confianzaPromedioPagina),
      ratioAmbiguas: round6(resultado.ratioAmbiguas),
      coberturaDeteccion: round6(coberturaDeteccion),
      autoCalificable: evaluacionAuto.autoCalificableOmr,
      mismatches,
      totalPreguntas,
      pagePass,
      scenario: capture.scenario
    });
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const falsePositiveRate = total > 0 ? fp / total : 0;
  const invalidDetectionRate = invalidTotal > 0 ? invalidDetected / invalidTotal : 1;
  const pagePassRate = manifest.capturas.length > 0 ? pagePassCount / manifest.capturas.length : 0;
  const autoGradeTrustRate = autoPages > 0 ? autoPagesPassing / autoPages : 0;
  const autoGradePrecision = autoTp + autoFp > 0 ? autoTp / (autoTp + autoFp) : 1;
  const autoCoverageRate = manifest.capturas.length > 0 ? autoPages / manifest.capturas.length : 1;

  const checks: RealValidationPayload['checks'] = {
    precision: precision >= thresholds.precisionMin,
    falsePositiveRate: falsePositiveRate <= thresholds.falsePositiveMax,
    invalidDetectionRate: invalidDetectionRate >= thresholds.invalidDetectionMin,
    pagePassRate: pagePassRate >= thresholds.pagePassMin,
    autoGradeTrustRate: autoGradeTrustRate >= thresholds.autoGradeTrustMin,
    autoCoverageRate: autoCoverageRate >= 1
  };

  const runId = `omr-tv3-real-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const report: RealValidationPayload = {
    runId,
    timestamp: nowIso,
    datasetRoot,
    datasetType: manifest.datasetType,
    thresholds,
    metrics: {
      precision: round6(precision),
      falsePositiveRate: round6(falsePositiveRate),
      invalidDetectionRate: round6(invalidDetectionRate),
      pagePassRate: round6(pagePassRate),
      autoGradeTrustRate: round6(autoGradeTrustRate),
      autoGradePrecision: round6(autoGradePrecision),
      autoCoverageRate: round6(autoCoverageRate),
      autoPages,
      totalPages: manifest.capturas.length,
      totalPreguntas: total
    },
    checks,
    ok: Object.values(checks).every(Boolean),
    perCapture
  };

  const failures: FailurePayload = {
    runId,
    timestamp: nowIso,
    datasetRoot,
    topCauses: Array.from(causeCounts.entries())
      .map(([causa, totalCausa]) => ({ causa, total: totalCausa }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 40),
    byEstadoAnalisis: estadoCounts,
    byScenario: Object.fromEntries(
      Array.from(scenarioCounts.entries()).sort((a, b) => b[1] - a[1])
    ) as Record<string, number>,
    topCaptures: [...perCapture]
      .sort((a, b) => b.mismatches - a.mismatches)
      .slice(0, 30)
      .map((item) => ({
        captureId: item.captureId,
        mismatches: item.mismatches,
        totalPreguntas: item.totalPreguntas,
        estadoAnalisis: item.estadoAnalisis,
        scenario: item.scenario
      }))
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (failureReportPath) {
    await fs.mkdir(path.dirname(failureReportPath), { recursive: true });
    await fs.writeFile(failureReportPath, `${JSON.stringify(failures, null, 2)}\n`, 'utf8');
  }

  return { report, failures };
}

async function main() {
  const args = parseArgs(process.argv);
  const { report } = await runTv3RealValidation({
    datasetRoot: args.dataset,
    reportPath: args.report,
    failureReportPath: args.failureReport,
    thresholds: {
      autoGradeTrustMin: args.autoGradeTrustMin,
      precisionMin: args.precisionMin,
      falsePositiveMax: args.falsePositiveMax,
      invalidDetectionMin: args.invalidDetectionMin,
      pagePassMin: args.pagePassMin
    }
  });
  process.stdout.write(`${JSON.stringify({ ok: report.ok, metrics: report.metrics, checks: report.checks })}\n`);
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
