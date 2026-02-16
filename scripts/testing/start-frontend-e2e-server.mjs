#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const frontendDir = path.join(rootDir, 'apps', 'frontend');

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const port = String(getArg('--port', '4173')).trim() || '4173';
const destino = String(getArg('--destino', 'docente')).trim() || 'docente';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(`${npmCmd} -C "${frontendDir}" run dev -- --host 127.0.0.1 --port ${port}`, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_APP_DESTINO: destino
  }
});

const terminate = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => terminate('SIGINT'));
process.on('SIGTERM', () => terminate('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});
