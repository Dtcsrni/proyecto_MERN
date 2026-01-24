import http from 'node:http';
import https from 'node:https';

const base = String(process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000').trim();
const path = String(process.env.API_HEALTHCHECK_PATH || '/api/salud').trim() || '/api/salud';
const timeoutMs = Number(process.env.API_HEALTHCHECK_TIMEOUT_MS || 15_000);
const intervalMs = Number(process.env.API_HEALTHCHECK_INTERVAL_MS || 500);

function crearUrl() {
  try {
    return new URL(path, base).toString();
  } catch {
    return 'http://localhost:4000/api/salud';
  }
}

const url = crearUrl();

function ping(urlDestino) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(urlDestino);
    } catch {
      resolve(false);
      return;
    }

    const esHttps = parsed.protocol === 'https:';
    const lib = esHttps ? https : http;
    const agent = new lib.Agent({ keepAlive: false });
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (esHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers: { Connection: 'close' },
        timeout: 4_000,
        agent
      },
      (res) => {
        res.resume();
        resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 300));
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function esperarApi() {
  const limite = Date.now() + timeoutMs;
  console.log(`[wait-api] Esperando backend en ${url}...`);
  while (Date.now() < limite) {
    if (await ping(url)) {
      console.log(`[wait-api] OK ${url}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  console.error(`[wait-api] Timeout esperando ${url}`);
  process.exitCode = 1;
}

await esperarApi();
