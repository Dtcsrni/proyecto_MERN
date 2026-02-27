/**
 * Smoke operativo para piloto hibrido (local + cloud).
 *
 * Uso:
 * node scripts/release/smoke-piloto-hibrido.mjs
 * node scripts/release/smoke-piloto-hibrido.mjs --backend-base=http://localhost:4000/api --portal-base=https://portal.example.com/api/portal
 */
import fs from 'node:fs/promises';
import path from 'node:path';

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const item = process.argv.find((v) => v.startsWith(prefix));
  if (!item) return fallback;
  return item.slice(prefix.length).trim();
}

async function checkJson(url, expectedStatus = 200) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { method: 'GET' });
    const elapsedMs = Date.now() - startedAt;
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const ok = response.status === expectedStatus;
    return { url, ok, status: response.status, expectedStatus, elapsedMs, body };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    return {
      url,
      ok: false,
      status: 0,
      expectedStatus,
      elapsedMs,
      error: error instanceof Error ? error.message : 'fetch_failed'
    };
  }
}

async function checkText(url, expectedStatus = 200, contains = '') {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { method: 'GET' });
    const elapsedMs = Date.now() - startedAt;
    const text = await response.text();
    const ok = response.status === expectedStatus && (!contains || text.includes(contains));
    return { url, ok, status: response.status, expectedStatus, elapsedMs, contains, matched: text.includes(contains) };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    return {
      url,
      ok: false,
      status: 0,
      expectedStatus,
      elapsedMs,
      contains,
      matched: false,
      error: error instanceof Error ? error.message : 'fetch_failed'
    };
  }
}

async function main() {
  const backendBase = arg('backend-base', process.env.SMOKE_BACKEND_BASE || 'http://localhost:4000/api');
  const portalBase = arg('portal-base', process.env.SMOKE_PORTAL_BASE || 'http://localhost:8080/api/portal');
  const output = arg('output', 'reports/ops/latest/smoke-piloto-hibrido.json');

  const checks = [];
  checks.push(await checkJson(`${backendBase}/salud/live`, 200));
  checks.push(await checkJson(`${backendBase}/salud/ready`, 200));
  checks.push(await checkText(`${backendBase}/metrics`, 200, 'evaluapro_http_requests_total'));
  checks.push(await checkJson(`${backendBase}/version`, 200));

  checks.push(await checkJson(`${portalBase}/salud/live`, 200));
  checks.push(await checkJson(`${portalBase}/salud/ready`, 200));
  checks.push(await checkText(`${portalBase}/metrics`, 200, 'evaluapro_portal_http_requests_total'));
  checks.push(await checkJson(`${portalBase}/version`, 200));

  const ok = checks.every((item) => item.ok);
  const payload = {
    generatedAt: new Date().toISOString(),
    backendBase,
    portalBase,
    status: ok ? 'ok' : 'fail',
    checks
  };

  const outputPath = path.resolve(process.cwd(), output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  if (!ok) {
    console.error(`[smoke-piloto-hibrido] FALLO. Ver reporte: ${outputPath}`);
    process.exit(1);
  }
  console.log(`[smoke-piloto-hibrido] OK. Reporte: ${outputPath}`);
}

main().catch((error) => {
  console.error(`[smoke-piloto-hibrido] ERROR: ${error instanceof Error ? error.message : 'unexpected'}`);
  process.exit(1);
});
