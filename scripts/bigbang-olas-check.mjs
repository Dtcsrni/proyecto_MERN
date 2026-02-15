/**
 * bigbang-olas-check
 *
 * Valida de forma falsable el estado de olas Big-Bang:
 * - Olas previas (0 y 1) con criterios tecnicos concretos.
 * - Readiness tecnico de olas activas (2 y 3), sin afirmar completitud funcional.
 *
 * Uso:
 *   node scripts/bigbang-olas-check.mjs
 *   node scripts/bigbang-olas-check.mjs --strict
 *   node scripts/bigbang-olas-check.mjs --completion
 *   node scripts/bigbang-olas-check.mjs --strict --completion
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const completion = args.has('--completion');

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function exists(filePath) {
  return fs.existsSync(path.join(root, filePath));
}

function lineCount(filePath) {
  const raw = read(filePath);
  return raw.split(/\r?\n/).length;
}

function json(filePath) {
  return JSON.parse(read(filePath));
}

function hasText(filePath, needle) {
  return read(filePath).includes(needle);
}

function run(command) {
  try {
    execSync(command, { cwd: root, stdio: 'inherit', encoding: 'utf8' });
    return { ok: true, command };
  } catch (error) {
    return {
      ok: false,
      command,
      error: error && error.message ? String(error.message) : 'command failed'
    };
  }
}

function grepRefs(patterns, targetDir) {
  const rgAvailable = spawnSync('rg', ['--version'], { cwd: root, encoding: 'utf8' }).status === 0;
  if (rgAvailable) {
    const cmd = ['rg', '-n', '-S', `"${patterns.join('|')}"`, targetDir].join(' ');
    const result = spawnSync(cmd, { cwd: root, encoding: 'utf8', shell: true });
    if (result.status === 0) return result.stdout.trim().split(/\r?\n/).filter(Boolean);
  }

  const collected = [];
  const baseDir = path.join(root, targetDir);
  if (!fs.existsSync(baseDir)) return collected;

  const stack = [baseDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }

    if (!stat.isFile()) continue;
    const ext = path.extname(current).toLowerCase();
    if (!['.ts', '.tsx', '.js', '.jsx', '.md', '.json'].includes(ext)) continue;

    const rel = path.relative(root, current).replaceAll('\\', '/');
    const content = fs.readFileSync(current, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (patterns.some((pattern) => line.includes(pattern))) {
        collected.push(`${rel}:${index + 1}:${line.trim()}`);
      }
    }
  }

  return collected;
}

function extractRefPath(refLine) {
  const match = String(refLine).match(/^([^:]+):\d+:/);
  if (!match) return String(refLine).replaceAll('\\', '/');
  return match[1].replaceAll('\\', '/');
}

function filterRuntimeRefLines(refLines, extension = '.ts') {
  return refLines.filter((line) => extractRefPath(line).endsWith(extension));
}

function filterImportLikeRefLines(refLines) {
  return refLines.filter((line) => {
    const normalized = String(line).toLowerCase();
    return normalized.includes('import ') || normalized.includes('require(');
  });
}

function evaluateAllowlist(refLines, allowlist, ignorelist = []) {
  const unexpected = refLines.filter((line) => {
    const refPath = extractRefPath(line);
    if (ignorelist.includes(refPath)) return false;
    return !allowlist.includes(refPath);
  });
  return {
    ok: unexpected.length === 0,
    unexpected
  };
}

function ensureReportDir() {
  const outDir = path.join(root, 'reports', 'qa', 'latest');
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

const checks = [];
function addCheck(id, ok, detail) {
  checks.push({ id, ok: Boolean(ok), detail });
}

// ---------------------------
// Ola 0 checks
// ---------------------------
addCheck('ola0.baseline.exists', exists('docs/perf/baseline.json'), 'docs/perf/baseline.json');
addCheck('ola0.perf.latest.exists', exists('reports/perf/latest.json'), 'reports/perf/latest.json');
addCheck(
  'ola0.contract.perf-check',
  hasText('ci/pipeline.contract.md', 'perf-check'),
  'ci/pipeline.contract.md contiene perf-check'
);
addCheck(
  'ola0.matrix.perf-check',
  read('ci/pipeline.matrix.json').includes('"name": "perf-check"'),
  'ci/pipeline.matrix.json contiene stage perf-check'
);
addCheck(
  'ola0.workflow.perf-check',
  hasText('.github/workflows/ci.yml', 'Etapa perf-check'),
  '.github/workflows/ci.yml contiene Etapa perf-check'
);

// ---------------------------
// Ola 1 checks
// ---------------------------
const frontendLimits = [
  'apps/frontend/src/apps/app_docente/AppDocente.tsx',
  'apps/frontend/src/apps/app_docente/SeccionPlantillas.tsx',
  'apps/frontend/src/apps/app_docente/SeccionBanco.tsx',
  'apps/frontend/src/apps/app_docente/SeccionEscaneo.tsx'
].map((filePath) => ({ filePath, lines: lineCount(filePath) }));

for (const file of frontendLimits) {
  addCheck(
    `ola1.size.${file.filePath}`,
    file.lines <= 800,
    `${file.filePath}: ${file.lines} lineas`
  );
}

addCheck(
  'ola1.legacy.folder.removed',
  !exists('apps/frontend/src/apps/app_docente_legacy'),
  'apps/frontend/src/apps/app_docente_legacy no existe'
);

const legacyRefs = grepRefs(['app_docente_legacy', 'docente_core'], 'apps/frontend/src');
addCheck(
  'ola1.legacy.refs.none',
  legacyRefs.length === 0,
  legacyRefs.length === 0 ? 'sin referencias legacy/docente_core' : legacyRefs
);

const vitestFrontend = read('apps/frontend/vitest.config.ts');
const excludesAppDocente = /app_docente_legacy|app_docente\/\*\*/.test(vitestFrontend);
addCheck(
  'ola1.coverage.no-docente-exclusion',
  !excludesAppDocente,
  'apps/frontend/vitest.config.ts sin exclusion de app_docente ni app_docente_legacy'
);

// ---------------------------
// Siguiente ola (2) readiness
// ---------------------------
const ola2OmrTargets = [
  { filePath: 'apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrLegacy.ts', lines: lineCount('apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrLegacy.ts') },
  { filePath: 'apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts', lines: lineCount('apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts') }
];
const ola2PdfTargets = [
  { filePath: 'apps/backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts', lines: lineCount('apps/backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts') },
  { filePath: 'apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdfLegacy.ts', lines: lineCount('apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdfLegacy.ts') },
  { filePath: 'apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts', lines: lineCount('apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts') }
];
const ola2SyncTarget = { filePath: 'apps/backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts', lines: lineCount('apps/backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts') };

// Ola 2A: OMR segmentado si fachada <100 lineas, legado preservado y pipeline v2 presente
const omrFachada = ola2OmrTargets.find((t) => t.filePath.endsWith('servicioOmr.ts'));
const omrLegado = ola2OmrTargets.find((t) => t.filePath.endsWith('servicioOmrLegacy.ts'));
const omrFachadaCompacta = omrFachada && omrFachada.lines < 100;
const omrLegadoPreservado = omrLegado && omrLegado.lines > 800;
const omrPipelinePresente = exists('apps/backend/src/modulos/modulo_escaneo_omr/omr/pipeline');

addCheck(
  'ola2a.omr.segmented',
  omrFachadaCompacta && omrLegadoPreservado && omrPipelinePresente,
  {
    fachada: omrFachada ? `${omrFachada.filePath}: ${omrFachada.lines}` : 'no encontrada',
    legado: omrLegado ? `${omrLegado.filePath}: ${omrLegado.lines}` : 'no encontrado',
    pipeline: `omr/pipeline exists: ${omrPipelinePresente}`
  }
);

// Ola 2B: PDF segmentado si fachada <100 lineas, legado preservado y estructura de capas presente
const pdfFachada = ola2PdfTargets.find((t) => t.filePath.endsWith('servicioGeneracionPdf.ts'));
const pdfLegado = ola2PdfTargets.find((t) => t.filePath.endsWith('servicioGeneracionPdfLegacy.ts'));
const fachadaCompacta = pdfFachada && pdfFachada.lines < 100;
const legadoPreservado = pdfLegado && pdfLegado.lines > 800;
const capasPdfPresentes = ['application/usecases', 'domain', 'infra', 'shared'].every((dir) =>
  exists(`apps/backend/src/modulos/modulo_generacion_pdf/${dir}`)
);

addCheck(
  'ola2b.pdf.segmented',
  fachadaCompacta && legadoPreservado && capasPdfPresentes,
  {
    fachada: pdfFachada ? `${pdfFachada.filePath}: ${pdfFachada.lines}` : 'no encontrada',
    legado: pdfLegado ? `${pdfLegado.filePath}: ${pdfLegado.lines}` : 'no encontrado',
    controller: `${ola2PdfTargets[0].filePath}: ${ola2PdfTargets[0].lines}`,
    capas: ['application/usecases', 'domain', 'infra', 'shared'].map((dir) => ({
      dir,
      exists: exists(`apps/backend/src/modulos/modulo_generacion_pdf/${dir}`)
    }))
  }
);

addCheck(
  'ola2c.sync.segmented',
  ola2SyncTarget.lines <= 450 &&
    ['application', 'domain', 'infra', 'shared'].every((dir) =>
      exists(`apps/backend/src/modulos/modulo_sincronizacion_nube/${dir}`)
    ),
  {
    controlador: `${ola2SyncTarget.filePath}: ${ola2SyncTarget.lines}`,
    capas: ['application', 'domain', 'infra', 'shared'].map((dir) => ({
      dir,
      exists: exists(`apps/backend/src/modulos/modulo_sincronizacion_nube/${dir}`)
    }))
  }
);

addCheck(
  'ola2.readiness.gates.available',
  [
    'lint',
    'typecheck',
    'test:backend:ci',
    'test:portal:ci',
    'test:frontend:ci',
    'test:coverage:ci',
    'perf:check',
    'pipeline:contract:check'
  ].every((s) => read('package.json').includes(`"${s}"`)),
  'scripts de gates requeridos para ola 2 estan definidos'
);

// ---------------------------
// Ola 2 completion checks (retiro/encapsulado)
// ---------------------------
const omrLegacyRefLines = filterImportLikeRefLines(
  filterRuntimeRefLines(grepRefs(['servicioOmrLegacy'], 'apps/backend/src/modulos/modulo_escaneo_omr'))
);
const omrAllowedLegacyRefs = [
  'apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts',
  'apps/backend/src/modulos/modulo_escaneo_omr/omr/pipeline/ejecutorPipelineOmr.ts',
  'apps/backend/src/modulos/modulo_escaneo_omr/omr/qr/etapaQr.ts',
  'apps/backend/src/modulos/modulo_escaneo_omr/omr/scoring/etapaScoring.ts',
  'apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrLegacy.ts'
];
const omrLegacyEncapsulation = evaluateAllowlist(omrLegacyRefLines, omrAllowedLegacyRefs, [
  'apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrLegacy.ts'
]);

addCheck('ola2a.completion.legacy.encapsulated', omrLegacyEncapsulation.ok, {
  criterio: 'referencias a servicioOmrLegacy solo en fachada/adaptadores permitidos',
  refsEncontradas: omrLegacyRefLines,
  refsFueraDeAllowlist: omrLegacyEncapsulation.unexpected
});

addCheck(
  'ola2a.completion.no.v1.fallback',
  !hasText('apps/backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts', "version === 'v1'"),
  'servicioOmr.ts sin branch explicito de fallback v1'
);

const pdfLegacyRefLines = filterImportLikeRefLines(
  filterRuntimeRefLines(grepRefs(['servicioGeneracionPdfLegacy'], 'apps/backend/src/modulos/modulo_generacion_pdf'))
);
const pdfAllowedLegacyRefs = [
  'apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts',
  'apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generarExamenIndividual.ts',
  'apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdfLegacy.ts'
];
const pdfLegacyEncapsulation = evaluateAllowlist(pdfLegacyRefLines, pdfAllowedLegacyRefs, [
  'apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdfLegacy.ts'
]);

addCheck('ola2b.completion.legacy.encapsulated', pdfLegacyEncapsulation.ok, {
  criterio: 'referencias a servicioGeneracionPdfLegacy solo en fachada/use case puente',
  refsEncontradas: pdfLegacyRefLines,
  refsFueraDeAllowlist: pdfLegacyEncapsulation.unexpected
});

addCheck(
  'ola2b.completion.no.v1.fallback',
  !hasText('apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts', 'return generarPdfExamenLegacy'),
  'servicioGeneracionPdf.ts sin fallback explicito al motor legado'
);

addCheck(
  'ola2b.completion.bridge.no.legacy.delegation',
  !hasText(
    'apps/backend/src/modulos/modulo_generacion_pdf/application/usecases/generarExamenIndividual.ts',
    'generarPdfExamenLegacy'
  ),
  'use case puente PDF sin delegacion directa a servicio legado'
);

addCheck(
  'ola2b.completion.renderer.stub.removed',
  !hasText('apps/backend/src/modulos/modulo_generacion_pdf/infra/pdfKitRenderer.ts', 'TODO'),
  'infra/pdfKitRenderer.ts sin marcador TODO de stub'
);

addCheck(
  'ola2c.completion.controller.thin',
  ola2SyncTarget.lines <= 120,
  `${ola2SyncTarget.filePath}: ${ola2SyncTarget.lines} lineas`
);

addCheck(
  'ola2c.completion.usecases.present',
  [
    'listarSincronizaciones.ts',
    'generarCodigoAcceso.ts',
    'publicarResultados.ts',
    'exportarPaquete.ts',
    'importarPaquete.ts',
    'enviarPaqueteServidor.ts',
    'traerPaquetesServidor.ts'
  ].every((fileName) =>
    exists(`apps/backend/src/modulos/modulo_sincronizacion_nube/application/usecases/${fileName}`)
  ),
  'use cases de sincronizacion presentes y orquestados por capa application'
);

addCheck(
  'ola2c.completion.contract.test.present',
  exists('apps/backend/tests/sincronizacion.contrato.test.ts'),
  'apps/backend/tests/sincronizacion.contrato.test.ts'
);

// ---------------------------
// Ola 3 readiness
// ---------------------------
addCheck(
  'ola3.foundation.rollout.module.exists',
  exists('apps/backend/src/compartido/observabilidad/rolloutCanary.ts'),
  'apps/backend/src/compartido/observabilidad/rolloutCanary.ts'
);

addCheck(
  'ola3.foundation.rollout.routes.exists',
  exists('apps/backend/src/compartido/observabilidad/rutasCanaryRollout.ts'),
  'apps/backend/src/compartido/observabilidad/rutasCanaryRollout.ts'
);

addCheck(
  'ola3.foundation.route.mounted',
  hasText('apps/backend/src/rutas.ts', "router.use('/canary-rollout', rutasCanaryRollout)"),
  "apps/backend/src/rutas.ts monta /canary-rollout"
);

addCheck(
  'ola3.foundation.metrics.canary-target',
  hasText(
    'apps/backend/src/compartido/observabilidad/rolloutCanary.ts',
    'evaluapro_canary_objetivo_v2_ratio'
  ),
  'rolloutCanary.ts define evaluapro_canary_objetivo_v2_ratio'
);

addCheck(
  'ola3.foundation.scripts.present',
  ['canary:monitor:auto', 'canary:rollout:check'].every((s) => read('package.json').includes(`"${s}"`)),
  'scripts canary:monitor:auto y canary:rollout:check presentes'
);

addCheck(
  'ola3.readiness.gates.available',
  ['canary:monitor', 'canary:monitor:auto', 'canary:rollout:check'].every((s) =>
    read('package.json').includes(`"${s}"`)
  ),
  'scripts de gates requeridos para ola 3 estan definidos'
);

// ---------------------------
// Strict gate execution
// ---------------------------
const strictCommands = [
  'npm run lint',
  'npm run typecheck',
  'npm run test:backend:ci',
  'npm run test:portal:ci',
  'npm run test:frontend:ci',
  'npm run test:coverage:ci',
  'npm run perf:check',
  'npm run canary:rollout:check',
  'npm run pipeline:contract:check'
];

const strictResults = [];
if (strict) {
  for (const command of strictCommands) {
    strictResults.push(run(command));
  }
}

const ola0Passed = checks.filter((c) => c.id.startsWith('ola0.')).every((c) => c.ok);
const ola1Passed = checks.filter((c) => c.id.startsWith('ola1.')).every((c) => c.ok);
const ola2Ready = checks.filter((c) => c.id.startsWith('ola2.')).every((c) => c.ok);
const ola3Ready = checks.filter((c) => c.id.startsWith('ola3.')).every((c) => c.ok);
const ola2CompletionChecks = checks.filter((c) => c.id.startsWith('ola2a.completion.') || c.id.startsWith('ola2b.completion.') || c.id.startsWith('ola2c.completion.'));
const ola2Completed = ola2CompletionChecks.length > 0 && ola2CompletionChecks.every((c) => c.ok);
const strictPassed = strict ? strictResults.every((r) => r.ok) : null;

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  strict,
  completion,
  model: {
    readinessVsCompletion: 'Este reporte valida readiness tecnico; completitud funcional requiere retiro/encapsulado final de legado.',
    canaryPolicy: 'canary-rollout-check es evidencia de transicion en beta y bloqueo formal en gate de estable.'
  },
  status: {
    ola0Passed,
    ola1Passed,
    ola2Ready,
    ola2Completed,
    ola3Ready,
    strictPassed,
    previousWavesGuaranteed: ola0Passed && ola1Passed && (strict ? strictPassed : true),
    nextWaveReadyToExecute:
      ola2Ready && ola3Ready && ola0Passed && ola1Passed && (strict ? strictPassed : true)
  },
  checks,
  strictResults,
  ola2Targets: [...ola2OmrTargets, ...ola2PdfTargets, ola2SyncTarget]
};

const outDir = ensureReportDir();
const outPath = path.join(outDir, 'olas-bigbang.json');
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const icon = (ok) => (ok ? 'OK' : 'FAIL');
console.log(`[olas] ola0: ${icon(ola0Passed)}`);
console.log(`[olas] ola1: ${icon(ola1Passed)}`);
console.log(`[olas] ola2-ready: ${icon(ola2Ready)}`);
if (completion) console.log(`[olas] ola2-completed: ${icon(ola2Completed)}`);
console.log(`[olas] ola3-ready: ${icon(ola3Ready)}`);
if (strict) console.log(`[olas] strict-gates: ${icon(Boolean(strictPassed))}`);
console.log(`[olas] reporte: ${path.relative(root, outPath).replaceAll('\\', '/')}`);

const finalOk =
  ola0Passed &&
  ola1Passed &&
  ola2Ready &&
  ola3Ready &&
  (completion ? ola2Completed : true) &&
  (strict ? strictPassed : true);
process.exit(finalOk ? 0 : 1);
