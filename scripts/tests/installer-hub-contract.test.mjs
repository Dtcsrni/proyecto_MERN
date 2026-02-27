import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('installer prereq manifest incluye contrato minimo', () => {
  const manifestPath = path.join(root, 'config', 'installer-prereqs.manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  assert.equal(typeof manifest.version, 'string');
  assert.equal(Array.isArray(manifest.prerequisites), true);
  assert.equal(manifest.prerequisites.length >= 2, true);

  for (const item of manifest.prerequisites) {
    assert.equal(typeof item.name, 'string');
    assert.equal(typeof item.version, 'string');
    assert.equal(typeof item.downloadUrl, 'string');
    assert.equal(typeof item.sha256, 'string');
    assert.equal(typeof item.silentArgs, 'string');
    assert.equal(typeof item.detectRule, 'object');
    assert.equal(typeof item.detectRule.type, 'string');
  }
});

test('canal update por defecto es stable en config y scripts', () => {
  const updateConfig = JSON.parse(fs.readFileSync(path.join(root, 'config', 'update-config.json'), 'utf8'));
  assert.equal(updateConfig.channel, 'stable');

  const updateManager = fs.readFileSync(path.join(root, 'scripts', 'update-manager.mjs'), 'utf8');
  assert.match(updateManager, /channel:\s*'stable'/);

  const launcherDashboard = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');
  assert.match(launcherDashboard, /channel:\s*'stable'/);
});

test('workflow de installer publica contratos nuevos de release', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci-installer-windows.yml'), 'utf8');

  assert.match(workflow, /build-installer-hub\.ps1/);
  assert.match(workflow, /generate-installer-hashes\.ps1/);
  assert.match(workflow, /sign-installer-artifacts\.ps1/);
  assert.match(workflow, /EvaluaPro\.msi\.sha256/);
  assert.match(workflow, /EvaluaPro-InstallerHub\.exe/);
  assert.match(workflow, /EvaluaPro-release-manifest\.json/);
});
