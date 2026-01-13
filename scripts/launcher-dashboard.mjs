import http from 'http';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const mode = getArgValue('--mode', 'none');
const portArg = getArgValue('--port', '');
const noOpen = args.includes('--no-open');
const verbose = args.includes('--verbose');

const logDir = path.join(root, 'logs');
const logFile = path.join(logDir, 'dashboard.log');

ensureDir(logDir);

const logLines = [];
const processes = new Map();

const dashboardPath = path.join(__dirname, 'dashboard.html');
const dashboardHtml = fs.readFileSync(dashboardPath, 'utf8');

function writeConsole(line) {
  if (!verbose) return;
  process.stdout.write(line + '\n');
}

function log(msg) {
  const line = `[${timestamp()}] ${msg}`;
  logLines.push(line);
  if (logLines.length > 500) logLines.shift();
  writeConsole(line);
  try {
    fs.appendFileSync(logFile, line + '\n');
  } catch {
    // ignore file write errors
  }
}

function timestamp() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {
    // ignore
  }
}

function getArgValue(flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx === -1) return fallback;
  const value = args[idx + 1];
  return value || fallback;
}

function safeExec(command, fallback) {
  try {
    const out = execSync(command, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
    return out.split(/\r?\n/)[0] || fallback;
  } catch {
    return fallback;
  }
}

function startTask(name, command) {
  const existing = processes.get(name);
  if (existing && existing.proc && existing.proc.exitCode === null) {
    log(`[${name}] ya esta en ejecucion`);
    return;
  }

  log(`[${name}] ${command}`);
  const proc = spawn('cmd.exe', ['/c', command], {
    cwd: root,
    windowsHide: true
  });

  processes.set(name, { name, command, proc, startedAt: Date.now() });
  log(`[${name}] PID ${proc.pid}`);

  proc.stdout.on('data', (data) => log(`[${name}] ${String(data).trimEnd()}`));
  proc.stderr.on('data', (data) => log(`[${name}] ${String(data).trimEnd()}`));
  proc.on('exit', (code) => {
    log(`[${name}] finalizo con codigo ${code}`);
    processes.delete(name);
  });
  proc.on('error', (err) => {
    log(`[${name}] error: ${err.message}`);
    processes.delete(name);
  });
}

function stopTask(name) {
  const entry = processes.get(name);
  if (!entry || !entry.proc || entry.proc.exitCode !== null) {
    log(`[${name}] no esta en ejecucion`);
    return;
  }
  log(`[${name}] deteniendo`);
  spawn('taskkill', ['/T', '/F', '/PID', String(entry.proc.pid)], { windowsHide: true });
}

function openBrowser(url) {
  spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true });
}

function runningTasks() {
  const names = [];
  for (const [name, entry] of processes.entries()) {
    if (entry.proc && entry.proc.exitCode === null) names.push(name);
  }
  return names;
}

const commands = {
  dev: 'npm run dev',
  prod: 'npm start',
  portal: 'npm run dev:portal',
  status: 'npm run status',
  'docker-ps': 'docker ps',
  'docker-down': 'docker compose down'
};

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, status, payload) {
  const data = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(dashboardHtml);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/status') {
    const payload = {
      root,
      mode,
      node: safeExec('node -v', 'No detectado'),
      npm: safeExec('npm -v', 'No detectado'),
      docker: safeExec('docker version --format "{{.Server.Version}}"', 'No disponible'),
      running: runningTasks(),
      logSize: logLines.length
    };
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/logs') {
    sendJson(res, 200, { lines: logLines.slice(-400) });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/logs/clear') {
    logLines.length = 0;
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/start') {
    const body = await readBody(req);
    const task = String(body.task || '').trim();
    const command = commands[task];
    if (!command) return sendJson(res, 400, { error: 'Tarea desconocida' });
    startTask(task, command);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && req.url === '/api/stop') {
    const body = await readBody(req);
    const task = String(body.task || '').trim();
    if (!task) return sendJson(res, 400, { error: 'Tarea requerida' });
    stopTask(task);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && req.url === '/api/run') {
    const body = await readBody(req);
    const task = String(body.task || '').trim();
    const command = commands[task];
    if (!command) return sendJson(res, 400, { error: 'Comando desconocido' });
    startTask(task, command);
    return sendJson(res, 200, { ok: true });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

(async () => {
  const basePort = portArg ? Number(portArg) : 4519;
  const port = Number.isFinite(basePort) ? await findPort(basePort) : await findPort(4519);
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    log(`Dashboard listo: ${url}`);
    if (!noOpen) openBrowser(url);
    if (mode === 'dev') startTask('dev', commands.dev);
    if (mode === 'prod') startTask('prod', commands.prod);
  });
})();

async function findPort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    const ok = await isPortFree(port);
    if (ok) return port;
  }
  return startPort;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
}
