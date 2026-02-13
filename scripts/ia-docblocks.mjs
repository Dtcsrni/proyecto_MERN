import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function construirDocblock(relPath) {
  const base = path.basename(relPath);
  const nombre = base.replace(/\.(ts|tsx|js|jsx|mjs|cjs|d\.ts)$/, '');
  const secciones = [];

  let responsabilidad = 'Modulo interno del sistema.';
  let limites = 'Mantener contrato y comportamiento observable del modulo.';

  if (relPath.includes('/modulo_') && base.startsWith('rutas')) {
    responsabilidad = 'Registro de rutas HTTP del dominio y aplicacion de middleware de seguridad/validacion.';
    limites = 'No cambiar orden o permisos de rutas sin validar impacto en contratos y tests.';
  } else if (relPath.includes('/modulo_') && base.startsWith('controlador')) {
    responsabilidad = 'Adaptador HTTP del dominio (parseo de entrada, invocacion de servicios y respuesta).';
    limites = 'Evitar mover logica de negocio profunda a controlador.';
  } else if (relPath.includes('/modulo_') && base.startsWith('servicio')) {
    responsabilidad = 'Servicio de dominio/aplicacion con reglas de negocio reutilizables.';
    limites = 'Mantener invariantes del dominio y errores controlados.';
  } else if (relPath.includes('/modulo_') && base.startsWith('modelo')) {
    responsabilidad = 'Definicion de modelo de persistencia (Mongoose) para el dominio.';
    limites = 'Cambios de esquema requieren considerar migracion/compatibilidad de datos.';
  } else if (relPath.includes('/modulo_') && base.startsWith('validaciones')) {
    responsabilidad = 'Contrato de validaciones de entrada/salida del dominio.';
    limites = 'No relajar reglas sin actualizar tests y contratos de API.';
  } else if (relPath.includes('/compartido/errores/')) {
    responsabilidad = 'Infraestructura comun de errores y envelope consistente.';
    limites = 'Cambios impactan trazabilidad y contratos de error globales.';
  } else if (relPath.includes('/compartido/observabilidad/')) {
    responsabilidad = 'Punto comun de metricas/logs/correlacion para operacion.';
    limites = 'Evitar romper nombres de metricas o formato de log en produccion.';
  } else if (relPath.includes('/infraestructura/logging/')) {
    responsabilidad = 'Configuracion de logging estructurado para el servicio.';
    limites = 'No exponer secretos en logs ni degradar trazabilidad por requestId.';
  } else if (relPath.includes('/app_docente/features/') && relPath.includes('/components/')) {
    responsabilidad = 'Componente de UI del dominio docente (presentacion y eventos de vista).';
    limites = 'Evitar acoplar IO directo; preferir hooks/services del feature.';
  } else if (relPath.includes('/app_docente/features/') && relPath.includes('/hooks/')) {
    responsabilidad = 'Hook de orquestacion de estado/efectos para el feature docente.';
    limites = 'Mantener dependencia unidireccional: hooks -> services -> clienteApi.';
  } else if (relPath.includes('/app_docente/services/')) {
    responsabilidad = 'Capa de acceso IO/API del dominio docente.';
    limites = 'No mezclar logica de render ni estado de UI.';
  } else if (relPath.includes('/app_docente/') && base.startsWith('Seccion')) {
    responsabilidad = 'Seccion funcional del shell docente.';
    limites = 'Conservar UX y permisos; extraer logica compleja a hooks/components.';
  } else if (relPath.includes('/app_docente/') && base.startsWith('use')) {
    responsabilidad = 'Hook transversal del shell docente.';
    limites = 'Mantener estado derivado predecible y efectos idempotentes.';
  } else if (relPath.includes('/ui/')) {
    responsabilidad = 'Componente/utilidad de UI reutilizable.';
    limites = 'Preservar accesibilidad y contratos de props existentes.';
  } else if (relPath.includes('/servicios_api/')) {
    responsabilidad = 'Cliente compartido de comunicacion HTTP y normalizacion de errores.';
    limites = 'Cambios pueden afectar todo el frontend.';
  } else if (relPath.includes('/portal_alumno_cloud/src/rutas')) {
    responsabilidad = 'Superficie HTTP del portal alumno (read-model + sync protegido).';
    limites = 'No romper separacion entre endpoints internos (api-key) y alumno (sesion).';
  } else if (base === 'app' || base === 'index') {
    responsabilidad = 'Punto de arranque/configuracion del servicio.';
    limites = 'Mantener seguridad por defecto y orden de middleware/boot.';
  }

  secciones.push('/**');
  secciones.push(` * ${nombre}`);
  secciones.push(' *');
  secciones.push(` * Responsabilidad: ${responsabilidad}`);
  secciones.push(` * Limites: ${limites}`);
  secciones.push(' */');
  return secciones.join('\n');
}

async function main() {
  const { stdout } = await exec('git ls-files', { cwd: rootDir, windowsHide: true, maxBuffer: 12 * 1024 * 1024 });
  const archivos = stdout
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((r) => r.startsWith('apps/'))
    .filter((r) => r.includes('/src/'))
    .filter((r) => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(r))
    .filter((r) => !r.includes('/node_modules/'));

  let actualizados = 0;
  for (const rel of archivos) {
    const full = path.join(rootDir, rel);
    const contenido = await fs.readFile(full, 'utf8');
    const inicio = contenido.slice(0, 400);
    if (/^\s*\/\*\*/.test(inicio)) continue;
    const doc = construirDocblock(rel);
    const nuevo = `${doc}\n${contenido}`;
    await fs.writeFile(full, nuevo, 'utf8');
    actualizados += 1;
  }

  console.log(`[ia-docblocks] archivos analizados: ${archivos.length}`);
  console.log(`[ia-docblocks] docblocks agregados: ${actualizados}`);
}

main().catch((error) => {
  console.error(`[ia-docblocks] error: ${error.message}`);
  process.exit(1);
});
