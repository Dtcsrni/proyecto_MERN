#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const outDir = path.join(root, 'reports', 'qa', 'latest');
const outPath = path.join(outDir, 'canary-rollout-check.json');

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  return {
    command: [command, ...args].join(' '),
    ok: result.status === 0,
    code: result.status ?? 1,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim()
  };
}

const checks = [];

const requiredFiles = [
  'apps/backend/src/compartido/observabilidad/rolloutCanary.ts',
  'apps/backend/src/compartido/observabilidad/rutasCanaryRollout.ts',
  'apps/backend/tests/canaryRollout.policy.test.ts',
  'scripts/canary-adoption-monitor.mjs'
];

for (const file of requiredFiles) {
  checks.push({
    id: `exists:${file}`,
    ok: exists(file),
    detail: file
  });
}

let packageJsonOk = false;
try {
  const pkg = readJson('package.json');
  const scripts = pkg?.scripts ?? {};
  const hasCanaryMonitor = typeof scripts['canary:monitor'] === 'string';
  const hasCanaryMonitorAuto = typeof scripts['canary:monitor:auto'] === 'string';

  checks.push({
    id: 'script:canary:monitor',
    ok: hasCanaryMonitor,
    detail: hasCanaryMonitor ? scripts['canary:monitor'] : 'missing'
  });
  checks.push({
    id: 'script:canary:monitor:auto',
    ok: hasCanaryMonitorAuto,
    detail: hasCanaryMonitorAuto ? scripts['canary:monitor:auto'] : 'missing'
  });

  packageJsonOk = true;
} catch (error) {
  checks.push({
    id: 'package.json:parse',
    ok: false,
    detail: error instanceof Error ? error.message : String(error)
  });
}

const commands = [];
if (packageJsonOk) {
  commands.push(run('node', ['--check', 'scripts/canary-adoption-monitor.mjs']));
  commands.push(run('npm', ['-C', 'apps/backend', 'run', 'test', '--', 'tests/canaryRollout.policy.test.ts']));
}

const ok = checks.every((check) => check.ok) && commands.every((command) => command.ok);

const report = {
  generatedAt: new Date().toISOString(),
  checks,
  commands,
  ok
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const shortPath = path.relative(root, outPath).replaceAll('\\', '/');
console.log(`[canary-rollout] ${ok ? 'OK' : 'FAIL'} -> ${shortPath}`);

process.exit(ok ? 0 : 1);
