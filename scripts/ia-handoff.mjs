/**
 * ia-handoff
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const modeArg = obtenerArg(args, '--mode') ?? 'quick';
const mode = modeArg === 'full' ? 'full' : 'quick';
const sessionArg = obtenerArg(args, '--session');
const now = new Date();
const fecha = now.toISOString().slice(0, 10);
const selloTiempo = now.toISOString().replaceAll(':', '-');
const sessionId = sessionArg ? limpiarId(sessionArg) : `sesion-${selloTiempo}`;

const templatePath = path.join(rootDir, 'docs', 'handoff', 'PLANTILLA_HANDOFF_IA.md');
const salidaDir = path.join(rootDir, 'docs', 'handoff', 'sesiones', fecha);
const salidaPath = path.join(salidaDir, `${sessionId}.md`);

const CHECKS = [
  { nombre: 'lint', comando: 'npm run lint', nivel: 'full' },
  { nombre: 'typecheck', comando: 'npm run typecheck', nivel: 'full' },
  { nombre: 'test_frontend_ci', comando: 'npm run test:frontend:ci', nivel: 'full' },
  { nombre: 'test_coverage_ci', comando: 'npm run test:coverage:ci', nivel: 'full' },
  { nombre: 'test_backend_ci', comando: 'npm run test:backend:ci', nivel: 'full' },
  { nombre: 'test_portal_ci', comando: 'npm run test:portal:ci', nivel: 'full' },
  { nombre: 'perf_check', comando: 'npm run perf:check', nivel: 'full' },
  { nombre: 'pipeline_contract_check', comando: 'npm run pipeline:contract:check', nivel: 'quick' },
  { nombre: 'docs_check', comando: 'npm run docs:check', nivel: 'quick' }
];

async function main() {
  await garantizarTemplate();
  await fs.mkdir(salidaDir, { recursive: true });

  const branch = await leerSalida('git rev-parse --abbrev-ref HEAD');
  const commit = await leerSalida('git rev-parse --short HEAD');
  const estado = await leerSalida('git status --short');
  const resumenArchivos = await inventarioCodigos();
  const topArchivos = await topArchivosGrandes();
  const resultados = await ejecutarChecks();

  const contenido = construirReporte({
    mode,
    branch,
    commit,
    estado,
    resumenArchivos,
    topArchivos,
    resultados
  });

  await fs.writeFile(salidaPath, contenido, 'utf8');
  console.log(`[ia-handoff] escrito: ${path.relative(rootDir, salidaPath).replace(/\\/g, '/')}`);
}

function obtenerArg(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function limpiarId(valor) {
  return String(valor).trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function garantizarTemplate() {
  try {
    await fs.access(templatePath);
  } catch {
    const contenido = [
      '# Handoff IA - Plantilla',
      '',
      '## 1) Objetivo de sesion',
      '-',
      '',
      '## 2) Cambios aplicados',
      '-',
      '',
      '## 3) Validacion ejecutada',
      '- comando:',
      '- resultado:',
      '',
      '## 4) Pendientes',
      '-',
      '',
      '## 5) Riesgos abiertos',
      '-',
      '',
      '## 6) Siguiente paso recomendado',
      '-'
    ].join('\n');
    await fs.mkdir(path.dirname(templatePath), { recursive: true });
    await fs.writeFile(templatePath, contenido, 'utf8');
  }
}

async function leerSalida(command) {
  try {
    const { stdout } = await exec(command, { cwd: rootDir, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    return (stdout || '').trim();
  } catch (error) {
    const stdout = (error?.stdout ?? '').trim();
    const stderr = (error?.stderr ?? '').trim();
    const mensaje = [stdout, stderr].filter(Boolean).join('\n');
    return mensaje || `ERROR: ${error.message}`;
  }
}

async function inventarioCodigos() {
  const { stdout } = await exec('git ls-files', { cwd: rootDir, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  const archivos = stdout
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .filter((ruta) => !ruta.startsWith('node_modules/'))
    .filter((ruta) => !ruta.includes('/node_modules/'))
    .filter((ruta) => /\.(ts|tsx|js|jsx|mjs|cjs|json|yml|yaml|sh|cmd|ps1)$/i.test(ruta));

  const contar = (prefix) => archivos.filter((ruta) => ruta.startsWith(prefix)).length;
  return {
    total: archivos.length,
    backend: contar('apps/backend/'),
    frontend: contar('apps/frontend/'),
    portal: contar('apps/portal_alumno_cloud/'),
    ci: archivos.filter((r) => r.startsWith('ci/') || r.startsWith('.github/workflows/')).length,
    scripts: contar('scripts/'),
    docs: contar('docs/'),
    ops: contar('ops/')
  };
}

async function topArchivosGrandes() {
  const { stdout } = await exec('git ls-files', { cwd: rootDir, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  const archivos = stdout
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .filter((ruta) => !ruta.startsWith('node_modules/'))
    .filter((ruta) => !ruta.includes('/node_modules/'))
    .filter((ruta) => ruta.startsWith('apps/'))
    .filter((ruta) => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(ruta));

  const lineas = [];
  for (const archivo of archivos) {
    const fullPath = path.join(rootDir, archivo);
    const contenido = await fs.readFile(fullPath, 'utf8');
    const totalLineas = contenido.split(/\r?\n/).length;
    lineas.push({ archivo, lineas: totalLineas });
  }
  return lineas.sort((a, b) => b.lineas - a.lineas).slice(0, 12);
}

async function ejecutarChecks() {
  const resultados = [];
  for (const check of CHECKS) {
    if (mode === 'quick' && check.nivel !== 'quick') {
      resultados.push({
        nombre: check.nombre,
        comando: check.comando,
        estado: 'omitido',
        codigo: null,
        duracionMs: 0,
        salida: 'omitido en modo quick'
      });
      continue;
    }
    const inicio = Date.now();
    try {
      const { stdout, stderr } = await exec(check.comando, {
        cwd: rootDir,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024
      });
      resultados.push({
        nombre: check.nombre,
        comando: check.comando,
        estado: 'ok',
        codigo: 0,
        duracionMs: Date.now() - inicio,
        salida: compactarSalida(stdout, stderr)
      });
    } catch (error) {
      resultados.push({
        nombre: check.nombre,
        comando: check.comando,
        estado: 'falla',
        codigo: Number(error.code ?? 1),
        duracionMs: Date.now() - inicio,
        salida: compactarSalida(error.stdout, error.stderr)
      });
    }
  }
  return resultados;
}

function compactarSalida(stdout, stderr) {
  const texto = `${stdout ?? ''}\n${stderr ?? ''}`.trim();
  const lineas = texto.split(/\r?\n/).filter(Boolean);
  if (lineas.length <= 18) return lineas.join('\n');
  return `${lineas.slice(0, 12).join('\n')}\n...\n${lineas.slice(-6).join('\n')}`;
}

function construirReporte({ mode, branch, commit, estado, resumenArchivos, topArchivos, resultados }) {
  const ahora = new Date().toISOString();
  const filasChecks = resultados
    .map((r) => `| ${r.nombre} | ${r.estado} | ${r.codigo ?? '-'} | ${r.duracionMs} |`)
    .join('\n');
  const detallesChecks = resultados
    .map(
      (r) =>
        `### ${r.nombre}\n- comando: \`${r.comando}\`\n- estado: ${r.estado}\n- codigo: ${r.codigo ?? '-'}\n- salida:\n\`\`\`txt\n${r.salida || '(sin salida)'}\n\`\`\`\n`
    )
    .join('\n');
  const top = topArchivos.map((it) => `- \`${it.archivo}\`: ${it.lineas} lineas`).join('\n');
  const estadoBloque = estado ? `\`\`\`txt\n${estado}\n\`\`\`` : '_arbol limpio_';

  return [
    '# Handoff IA - Sesion',
    '',
    `- generadoEn: ${ahora}`,
    `- modoChecklist: ${mode}`,
    `- rama: ${branch || '(desconocida)'}`,
    `- commit: ${commit || '(desconocido)'}`,
    '',
    '## 1) Objetivo de sesion',
    '- Completar por el agente al cerrar la sesion.',
    '',
    '## 2) Estado del arbol',
    estadoBloque,
    '',
    '## 3) Inventario resumido',
    `- total piezas codigo/config: ${resumenArchivos.total}`,
    `- backend: ${resumenArchivos.backend}`,
    `- frontend: ${resumenArchivos.frontend}`,
    `- portal: ${resumenArchivos.portal}`,
    `- ci/workflows: ${resumenArchivos.ci}`,
    `- scripts: ${resumenArchivos.scripts}`,
    `- docs: ${resumenArchivos.docs}`,
    `- ops: ${resumenArchivos.ops}`,
    '',
    '## 4) Top archivos grandes (apps)',
    top || '- (sin datos)',
    '',
    '## 5) Checklist ejecutable de sesion',
    '| check | estado | exitCode | duracionMs |',
    '| --- | --- | ---: | ---: |',
    filasChecks,
    '',
    '## 6) Evidencia de ejecucion',
    detallesChecks,
    '## 7) Pendientes',
    '- Completar por el agente al cerrar la sesion.',
    '',
    '## 8) Riesgos abiertos',
    '- Completar por el agente al cerrar la sesion.',
    '',
    '## 9) Siguiente paso recomendado',
    '- Completar por el agente al cerrar la sesion.',
    ''
  ].join('\n');
}

main().catch((error) => {
  console.error(`[ia-handoff] error: ${error.message}`);
  process.exit(1);
});
