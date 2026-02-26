import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('tray incluye acción de buscar actualizaciones', () => {
  const trayPath = path.join(process.cwd(), 'scripts', 'launcher-tray.ps1');
  const content = fs.readFileSync(trayPath, 'utf8');
  assert.match(content, /Buscar actualizaciones/);
  assert.match(content, /\/api\/update\/check/);
});
