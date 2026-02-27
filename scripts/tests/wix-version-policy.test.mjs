import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('build-msi exige WiX 6+ estable y docs no referencian v4', () => {
  const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');
  const wixReadme = fs.readFileSync(path.join(root, 'packaging', 'wix', 'README.md'), 'utf8');
  const deployDoc = fs.readFileSync(path.join(root, 'docs', 'DESPLIEGUE.md'), 'utf8');

  assert.match(buildScript, /WiX Toolset v6\+/i);
  assert.match(buildScript, /major.+6|6\+/i);

  assert.doesNotMatch(wixReadme, /WiX Toolset v4/i);
  assert.doesNotMatch(deployDoc, /WiX Toolset v4/i);
});

test('build-msi detecta wix.exe en rutas estandar de Windows sin depender del PATH', () => {
  const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');

  assert.match(buildScript, /ProgramFiles.*WiX Toolset v6\.0\\bin\\wix\.exe/i);
  assert.match(buildScript, /ProgramFiles\(x86\)/i);
  assert.match(buildScript, /Get-Command wix/i);
  assert.match(buildScript, /& \$wixExe @productArgs/i);
});

test('bundle usa sintaxis WixStdBA v6 y build-msi usa extension BAL de WiX 6', () => {
  const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-msi.ps1'), 'utf8');
  const bundleWxs = fs.readFileSync(path.join(root, 'packaging', 'wix', 'Bundle.wxs'), 'utf8');

  assert.match(buildScript, /Resolve-BalExtensionDll/i);
  assert.match(buildScript, /WixToolset\.Bal\.wixext/i);
  assert.match(buildScript, /WixToolset\.BootstrapperApplications\.wixext\.dll/i);

  assert.match(bundleWxs, /<BootstrapperApplication>/i);
  assert.match(bundleWxs, /<bal:WixStandardBootstrapperApplication/i);
  assert.doesNotMatch(bundleWxs, /<BootstrapperApplicationRef/i);
});
