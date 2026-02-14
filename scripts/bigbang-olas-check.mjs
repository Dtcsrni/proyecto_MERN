/**
 * bigbang-olas-check
 *
 * Valida de forma falsable el estado de olas Big-Bang:
 * - Olas previas (0 y 1) con criterios tecnicos concretos.
 * - Preparacion para la siguiente ola (2), sin afirmar completitud.
 *
 * Uso:
 *   node scripts/bigbang-olas-check.mjs
 *   node scripts/bigbang-olas-check.mjs --strict
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
    return [];
  }
  return [];
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
const ola2OmmrTarget = { filePath: 'apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrLegacy.ts', lines: lineCount('apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrLegacy.ts') };
const ola2PdfTargets = [
  'apps/backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts',
  'apps/backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts'
].map((filePath) => ({ filePath, lines: lineCount(filePath) }));
const ola2SyncTarget = { filePath: 'apps/backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts', lines: lineCount('apps/backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts') };

addCheck('ola2a.omr.monolith.pending', ola2OmmrTarget.lines > 800, `${ola2OmmrTarget.filePath}: ${ola2OmmrTarget.lines}`);
addCheck(
  'ola2b.pdf.monolith.pending',
  ola2PdfTargets.every((t) => t.lines > 800),
  ola2PdfTargets.map((t) => `${t.filePath}: ${t.lines}`)
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
const strictPassed = strict ? strictResults.every((r) => r.ok) : null;

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  strict,
  status: {
    ola0Passed,
    ola1Passed,
    ola2Ready,
    strictPassed,
    previousWavesGuaranteed: ola0Passed && ola1Passed && (strict ? strictPassed : true),
    nextWaveReadyToExecute: ola2Ready && ola0Passed && ola1Passed && (strict ? strictPassed : true)
  },
  checks,
  strictResults,
  ola2Targets: [ola2OmmrTarget, ...ola2PdfTargets, ola2SyncTarget]
};

const outDir = ensureReportDir();
const outPath = path.join(outDir, 'olas-bigbang.json');
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const icon = (ok) => (ok ? 'OK' : 'FAIL');
console.log(`[olas] ola0: ${icon(ola0Passed)}`);
console.log(`[olas] ola1: ${icon(ola1Passed)}`);
console.log(`[olas] ola2-ready: ${icon(ola2Ready)}`);
if (strict) console.log(`[olas] strict-gates: ${icon(Boolean(strictPassed))}`);
console.log(`[olas] reporte: ${path.relative(root, outPath).replaceAll('\\', '/')}`);

const finalOk = ola0Passed && ola1Passed && ola2Ready && (strict ? strictPassed : true);
process.exit(finalOk ? 0 : 1);
