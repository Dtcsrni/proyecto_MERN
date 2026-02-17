import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(process.cwd());
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

test('scripts mínimos definidos', () => {
  assert.equal(typeof packageJson.scripts?.dev, 'string');
  assert.equal(typeof packageJson.scripts?.build, 'string');
  assert.equal(typeof packageJson.scripts?.test, 'string');
});

test('entrypoint servidor existe', () => {
  assert.equal(fs.existsSync(path.join(projectRoot, 'src', 'servidor.ts')), true);
});
