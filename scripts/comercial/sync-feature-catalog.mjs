import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const rutasPath = path.join(repoRoot, 'apps', 'backend', 'src', 'rutas.ts');
const configPath = path.join(repoRoot, 'docs', 'comercial', 'feature-catalog.config.json');
const outMdPath = path.join(repoRoot, 'docs', 'comercial', 'FEATURE_CATALOG.md');
const outJsonPath = path.join(repoRoot, 'docs', 'comercial', 'feature-catalog.generated.json');
const rootReadmePath = path.join(repoRoot, 'README.md');

function nowIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseMountedPrefixes(rutasSource) {
  const matches = rutasSource.matchAll(/router\.use\('([^']+)'/g);
  const prefixes = new Set(['/metrics']);
  for (const m of matches) prefixes.add(m[1]);
  return prefixes;
}

function tierRank(tier) {
  if (tier === 'free') return 1;
  if (tier === 'pro') return 2;
  return 3;
}

function renderFeatureCatalog({ tiers, capabilities, mountedPrefixes }) {
  const generatedAt = nowIsoDate();
  const byCategory = new Map();
  for (const c of capabilities) {
    const status = mountedPrefixes.has(c.routePrefix) ? 'activa' : 'no-detectada';
    const enriched = { ...c, status };
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category).push(enriched);
  }

  const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b, 'es'));
  const lines = [];
  lines.push('# Catalogo de Capacidades');
  lines.push('');
  lines.push('> Documento auto-generado. No editar manualmente.');
  lines.push(`> Fecha de sincronizacion: **${generatedAt}**`);
  lines.push('');
  lines.push('## Matriz por tier');
  lines.push('');
  lines.push('| Capacidad | Categoria | Free (AGPL) | Commercial Pro | Commercial Enterprise | Estado tecnico | Evidencia |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');

  for (const c of capabilities) {
    const r = tierRank(c.tier);
    const free = r <= 1 ? 'Si' : 'No';
    const pro = r <= 2 ? 'Si' : 'No';
    const ent = r <= 3 ? 'Si' : 'No';
    const status = mountedPrefixes.has(c.routePrefix) ? 'Activa' : 'No detectada';
    lines.push(
      `| ${c.name} (\`${c.routePrefix}\`) | ${c.category} | ${free} | ${pro} | ${ent} | ${status} | \`${c.evidence}\` |`
    );
  }

  for (const category of categories) {
    lines.push('');
    lines.push(`## ${category}`);
    lines.push('');
    for (const c of byCategory.get(category).sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
      const tier = tiers.find((t) => t.id === c.tier)?.label ?? c.tier;
      lines.push(`- **${c.name}** (\`${c.routePrefix}\`)`);
      lines.push(`  Tier minimo: ${tier}. Estado: ${c.status}. Evidencia: \`${c.evidence}\`.`);
    }
  }

  return lines.join('\n') + '\n';
}

function updateRootReadmeFeatureBlock(capabilities) {
  const markerStart = '<!-- AUTO:FEATURES:START -->';
  const markerEnd = '<!-- AUTO:FEATURES:END -->';
  const content = fs.readFileSync(rootReadmePath, 'utf8');
  const summary = [
    markerStart,
    '## Funciones Confiables por Edicion',
    '',
    '_Lista auto-sincronizada desde rutas reales del backend + evidencia de pruebas._',
    '',
    '| Categoria | Free (AGPL) | Commercial Pro | Commercial Enterprise |',
    '| --- | --- | --- | --- |'
  ];

  const catMap = new Map();
  for (const c of capabilities) {
    if (!catMap.has(c.category)) catMap.set(c.category, { free: 0, pro: 0, enterprise: 0 });
    catMap.get(c.category)[c.tier] += 1;
  }
  for (const [category, counts] of [...catMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
    summary.push(`| ${category} | ${counts.free} | ${counts.pro} | ${counts.enterprise} |`);
  }
  summary.push('');
  summary.push('- Catalogo completo: [docs/comercial/FEATURE_CATALOG.md](docs/comercial/FEATURE_CATALOG.md)');
  summary.push(markerEnd);

  const replacement = summary.join('\n');
  let next = content;
  if (content.includes(markerStart) && content.includes(markerEnd)) {
    next = content.replace(new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`), replacement);
  } else {
    next = `${content.trim()}\n\n${replacement}\n`;
  }
  fs.writeFileSync(rootReadmePath, next, 'utf8');
}

function main() {
  const rutasSource = fs.readFileSync(rutasPath, 'utf8');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const mountedPrefixes = parseMountedPrefixes(rutasSource);
  const markdown = renderFeatureCatalog({
    tiers: config.tiers,
    capabilities: config.capabilities,
    mountedPrefixes
  });

  fs.writeFileSync(outMdPath, markdown, 'utf8');
  fs.writeFileSync(
    outJsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mountedPrefixes: [...mountedPrefixes].sort(),
        capabilities: config.capabilities.map((c) => ({
          ...c,
          status: mountedPrefixes.has(c.routePrefix) ? 'activa' : 'no-detectada'
        }))
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  updateRootReadmeFeatureBlock(config.capabilities);
  console.log(`[docs:features:sync] actualizado ${path.relative(repoRoot, outMdPath)} y README.md`);
}

main();
