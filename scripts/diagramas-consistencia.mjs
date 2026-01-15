import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const shouldCheck = args.has('--check');

if (!shouldCheck) {
  console.error('Uso: node scripts/diagramas-consistencia.mjs --check');
  process.exit(2);
}

function normalizarSaltosLinea(texto) {
  return texto.replace(/\r\n/g, '\n');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function rutaRel(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.DS_Store')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)));
      continue;
    }
    files.push(full);
  }
  return files;
}

function extraerRutasRouter(rutasTsContent) {
  const re = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]\s*,/g;
  const rutas = [];
  for (const m of rutasTsContent.matchAll(re)) {
    rutas.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return rutas;
}

function extraerMontajesBackend(rutasTsContent) {
  const re = /router\.use\(\s*['"]([^'"]+)['"]\s*,/g;
  const montajes = [];
  for (const m of rutasTsContent.matchAll(re)) {
    montajes.push(m[1]);
  }
  return montajes;
}

function extraerImportsDefault(tsContent) {
  const re = /import\s+([A-Za-z0-9_$]+)\s+from\s+['"]([^'"]+)['"]/g;
  const imports = [];
  for (const m of tsContent.matchAll(re)) {
    imports.push({ ident: m[1], specifier: m[2] });
  }
  return imports;
}

function extraerMontajesConIdent(tsContent) {
  // router.use('/mount', algunRouter)
  const re = /router\.use\(\s*(['"])([^'"]+)\1\s*,\s*([A-Za-z0-9_$]+)\s*\)/g;
  const montajes = [];
  for (const m of tsContent.matchAll(re)) {
    montajes.push({ mountPath: m[2], ident: m[3] });
  }
  return montajes;
}

function normalizarApiPath(rawPath) {
  let p = (rawPath ?? '').trim();
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\\/g, '/');
  p = p.replace(/\/+/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/g, '');
  return p;
}

function normalizarPathDiagrama(rawPath) {
  // Quita paréntesis de anotaciones (Bearer), querystring, y trailing chars.
  let p = rawPath.trim();
  p = p.replace(/\)\s*$/, ')');
  p = p.replace(/\s*\(.*?\)\s*$/g, '');
  p = p.split('?')[0];
  p = p.replace(/[),.;]+$/g, '');
  return normalizarApiPath(p);
}

function extraerReferenciasHttpDesdeMermaid(content) {
  // Busca patrones comunes en diagrams: "POST /api/..." o "GET /api/...".
  // No intenta parsear Mermaid formalmente; es un lint pragmático.
  const re = /\b(GET|POST|PUT|PATCH|DELETE)\s+((?:\/api)(?:\/[^\s<)]*)?)/g;
  const refs = [];
  for (const m of content.matchAll(re)) {
    const method = m[1].toUpperCase();
    const pathRaw = m[2];
    const normalized = normalizarPathDiagrama(pathRaw);
    if (!normalized.startsWith('/api')) continue;
    refs.push({ method, path: normalized });
  }
  return refs;
}

function setFromRoutes(routes, prefix) {
  const set = new Set();
  for (const r of routes) {
    const full = `${prefix}${r.path.startsWith('/') ? '' : '/'}${r.path}`;
    set.add(`${r.method} ${normalizarApiPath(full)}`);
  }
  return set;
}

async function resolveImportFile(fromFilePath, specifier) {
  if (!specifier.startsWith('.')) return null;
  const baseDir = path.dirname(fromFilePath);
  const resolved = path.resolve(baseDir, specifier);

  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    path.join(resolved, 'index.ts'),
    path.join(resolved, 'index.js')
  ];

  for (const c of candidates) {
    if (await fileExists(c)) return c;
  }
  return null;
}

async function construirImportMap(filePath, tsContent) {
  const imports = extraerImportsDefault(tsContent);
  const map = new Map();
  for (const imp of imports) {
    const resolved = await resolveImportFile(filePath, imp.specifier);
    if (resolved) map.set(imp.ident, resolved);
  }
  return map;
}

function joinPaths(basePath, subPath) {
  const b = normalizarApiPath(basePath);
  const s = normalizarApiPath(subPath);
  if (s === '/') return b;
  if (b === '/') return s;
  return normalizarApiPath(`${b}${s.startsWith('/') ? '' : '/'}${s}`);
}

async function extraerEndpointsDesdeRouterFile({ filePath, basePath, visited }) {
  if (visited.has(filePath)) return { endpoints: [], ok: true };
  visited.add(filePath);

  const content = normalizarSaltosLinea(await fs.readFile(filePath, 'utf8'));
  const importMap = await construirImportMap(filePath, content);

  const endpoints = [];

  // Endpoints directos: router.get('/x', ...)
  for (const r of extraerRutasRouter(content)) {
    const fullPath = joinPaths(basePath, r.path);
    endpoints.push({ method: r.method, path: fullPath });
  }

  // Montajes internos: router.use('/sub', otroRouter)
  const montajes = extraerMontajesConIdent(content);
  for (const m of montajes) {
    const childFile = importMap.get(m.ident);
    if (!childFile) continue;
    const childBase = joinPaths(basePath, m.mountPath);
    const child = await extraerEndpointsDesdeRouterFile({ filePath: childFile, basePath: childBase, visited });
    endpoints.push(...child.endpoints);
  }

  return { endpoints, ok: true };
}

async function extraerBackendEndpointsDesdeRouterCentral({ backendPrefijo, backendRutasFilePath }) {
  const backendRutas = normalizarSaltosLinea(await fs.readFile(backendRutasFilePath, 'utf8'));
  const importMap = await construirImportMap(backendRutasFilePath, backendRutas);
  const mounts = extraerMontajesConIdent(backendRutas);

  const backendSet = new Set();
  const montajesConEndpoints = new Set();
  const montajesSinResolver = new Set();

  for (const m of mounts) {
    const childFile = importMap.get(m.ident);
    if (!childFile) {
      montajesSinResolver.add(m.mountPath);
      continue;
    }
    const basePath = joinPaths(backendPrefijo, m.mountPath);
    const visited = new Set();
    const child = await extraerEndpointsDesdeRouterFile({ filePath: childFile, basePath, visited });
    for (const ep of child.endpoints) {
      backendSet.add(`${ep.method} ${normalizarApiPath(ep.path)}`);
    }
    montajesConEndpoints.add(m.mountPath);
  }

  return { backendSet, montajesConEndpoints, montajesSinResolver };
}

async function cargarModelo() {
  const portalApp = normalizarSaltosLinea(await fs.readFile(path.join(rootDir, 'apps/portal_alumno_cloud/src/app.ts'), 'utf8'));
  const portalRutas = normalizarSaltosLinea(await fs.readFile(path.join(rootDir, 'apps/portal_alumno_cloud/src/rutas.ts'), 'utf8'));
  const backendApp = normalizarSaltosLinea(await fs.readFile(path.join(rootDir, 'apps/backend/src/app.ts'), 'utf8'));
  const backendRutasFilePath = path.join(rootDir, 'apps/backend/src/rutas.ts');
  const backendRutas = normalizarSaltosLinea(await fs.readFile(backendRutasFilePath, 'utf8'));

  const reAppUse = /app\.use\(\s*['"]([^'"]+)['"]\s*,/;
  const portalPrefijo = reAppUse.exec(portalApp)?.[1] ?? '/api/portal';
  const backendPrefijo = reAppUse.exec(backendApp)?.[1] ?? '/api';

  const portalRoutes = extraerRutasRouter(portalRutas);
  const portalSet = setFromRoutes(portalRoutes, portalPrefijo);

  const backendMontajes = extraerMontajesBackend(backendRutas);
  const backendMontajesSet = new Set(backendMontajes);

  const { backendSet, montajesConEndpoints, montajesSinResolver } = await extraerBackendEndpointsDesdeRouterCentral({
    backendPrefijo,
    backendRutasFilePath
  });

  return {
    portalPrefijo,
    backendPrefijo,
    portalSet,
    backendMontajesSet,
    backendSet,
    backendMontajesConEndpointsSet: montajesConEndpoints,
    backendMontajesSinResolverSet: montajesSinResolver
  };
}

function mountDesdeApiPath(apiPath) {
  // /api/<mount>/...
  const parts = apiPath.split('/').filter(Boolean);
  // parts[0] === 'api'
  if (parts.length < 2) return null;
  return `/${parts[1]}`;
}

const {
  portalPrefijo,
  portalSet,
  backendMontajesSet,
  backendSet,
  backendMontajesConEndpointsSet,
  backendMontajesSinResolverSet
} = await cargarModelo();

const secDir = path.join(rootDir, 'docs', 'diagramas', 'src', 'secuencias');
const files = (await walkFiles(secDir)).filter((f) => f.toLowerCase().endsWith('.mmd'));

if (files.length === 0) {
  console.error('[diagramas:consistencia] no hay .mmd en docs/diagramas/src/secuencias');
  process.exit(2);
}

let ok = true;
for (const filePath of files) {
  const content = normalizarSaltosLinea(await fs.readFile(filePath, 'utf8'));
  const refs = extraerReferenciasHttpDesdeMermaid(content);
  if (refs.length === 0) continue;

  for (const ref of refs) {
    const key = `${ref.method} ${ref.path}`;

    // Portal: validación exacta método+path.
    if (ref.path.startsWith(portalPrefijo)) {
      if (!portalSet.has(key)) {
        console.error(`[diagramas:consistencia] ruta portal no existe: ${key}`);
        console.error(`  en: ${rutaRel(filePath)}`);
        ok = false;
      }
      continue;
    }

    // Backend: si pudimos extraer endpoints del módulo, valida método + path exacto.
    const mount = mountDesdeApiPath(ref.path);
    if (!mount || !backendMontajesSet.has(mount)) {
      console.error(`[diagramas:consistencia] ruta backend con montaje desconocido: ${key}`);
      console.error(`  en: ${rutaRel(filePath)}`);
      console.error(`  esperado montaje en: ${[...backendMontajesSet].sort((a, b) => a.localeCompare(b, 'es')).join(', ')}`);
      ok = false;
      continue;
    }

    if (backendMontajesConEndpointsSet.has(mount)) {
      if (!backendSet.has(key)) {
        const sugerencias = [...backendSet]
          .filter((k) => k.includes(` /api${mount}`))
          .sort((a, b) => a.localeCompare(b, 'es'))
          .slice(0, 12);

        console.error(`[diagramas:consistencia] ruta backend no existe: ${key}`);
        console.error(`  en: ${rutaRel(filePath)}`);
        if (sugerencias.length > 0) {
          console.error(`  ejemplos cercanos: ${sugerencias.join(' | ')}`);
        }
        ok = false;
      }
      continue;
    }

    // Fallback: si no se pudo resolver el router del módulo, valida solo montaje.
    if (backendMontajesSinResolverSet.has(mount)) {
      continue;
    }
  }
}

if (!ok) {
  process.exitCode = 1;
} else {
  console.log('[diagramas:consistencia] ok');
}
