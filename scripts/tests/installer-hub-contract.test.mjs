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
  assert.match(workflow, /Publicar release assets \(tags v\*\)/);
  assert.match(workflow, /dist\/installer\/EvaluaPro-Setup\.exe/);
});

test('installer hub incluye fase de configuracion operativa y blindaje de licencia configurable', () => {
  const hub = fs.readFileSync(path.join(root, 'scripts', 'installer-hub', 'InstallerHub.ps1'), 'utf8');
  assert.match(hub, /OperationalConfig\.psm1/);
  assert.match(hub, /configuracion_operativa/);
  assert.match(hub, /MONGODB_URI|MongoUri/);
  assert.match(hub, /NODE_ENV|NodeEnv/);
  assert.match(hub, /PUERTO_API|PuertoApi/);
  assert.match(hub, /PUERTO_PORTAL|PuertoPortal/);
  assert.match(hub, /PORTAL_ALUMNO_API_KEY|PortalAlumnoApiKey/);
  assert.match(hub, /GOOGLE_OAUTH_CLIENT_ID|GoogleOauthClientId/);
  assert.match(hub, /GOOGLE_CLASSROOM_CLIENT_ID|GoogleClassroomClientId/);
  assert.match(hub, /RequireLicenseActivation/);
  assert.match(hub, /LicenciaAccountEmail/);
  assert.match(hub, /UpdateChannel/);
  assert.match(hub, /UpdateOwner/);
  assert.match(hub, /UpdateRepo/);
  assert.match(hub, /UpdateAssetName/);
  assert.match(hub, /UpdateShaAssetName/);
  assert.match(hub, /UpdateFeedUrl/);
  assert.match(hub, /UpdateRequireSha256/);
});

test('script de release manifest incluye contrato extendido de build/deployment/artifacts', () => {
  const script = fs.readFileSync(path.join(root, 'scripts', 'generate-installer-release-manifest.ps1'), 'utf8');
  assert.match(script, /build\s*=\s*\[ordered\]@{/);
  assert.match(script, /commit\s*=\s*\$commit/);
  assert.match(script, /artifacts\s*=\s*\$artifacts/);
  assert.match(script, /deployment\s*=\s*\[ordered\]@{/);
  assert.match(script, /target\s*=\s*\$DeploymentTarget/);
});
