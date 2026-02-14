#!/usr/bin/env node
/**
 * canary-adoption-monitor
 *
 * Responsabilidad: Dashboard de monitoreo de adopción v1->v2 en canary rollout
 * Uso: node scripts/canary-adoption-monitor.mjs
 */

import fetch from 'node-fetch';
import fs from 'node:fs';
import path from 'node:path';

const apiBase = process.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const metricsUrl = `${apiBase}/metrics`;
const tokenDoc = process.env.TOKEN_DOCENTE || '';

function formatearPorcentaje(valor, decimales = 2) {
  return (typeof valor === 'number' ? valor : 0).toFixed(decimales) + '%';
}

function formatearNumero(valor) {
  return new Intl.NumberFormat('es-MX').format(Number(valor || 0));
}

function extraerMetrica(metricas, nombre) {
  const regex = new RegExp(`^${nombre}\\s+(.+)$`, 'm');
  const match = String(metricas).match(regex);
  return match ? match[1] : null;
}

function extraerMetricasAdopcion(metricas) {
  const resultado = {};
  const lines = String(metricas).split('\n');

  for (const line of lines) {
    if (line.startsWith('evaluapro_adopcion_v2_porcentaje')) {
      // evaluapro_adopcion_v2_porcentaje{modulo="omr"} 0
      const match = line.match(/modulo="([^"]+)"\}\s+([\d.]+)/);
      if (match) {
        const [, modulo, valor] = match;
        if (!resultado[modulo]) resultado[modulo] = {};
        resultado[modulo].v2Porcentaje = parseFloat(valor);
      }
    }

    if (line.startsWith('evaluapro_adopcion_v1_total')) {
      const match = line.match(/modulo="([^"]+)"\}\s+(\d+)/);
      if (match) {
        const [, modulo, valor] = match;
        if (!resultado[modulo]) resultado[modulo] = {};
        resultado[modulo].v1Total = parseInt(valor, 10);
      }
    }

    if (line.startsWith('evaluapro_adopcion_v2_total')) {
      const match = line.match(/modulo="([^"]+)"\}\s+(\d+)/);
      if (match) {
        const [, modulo, valor] = match;
        if (!resultado[modulo]) resultado[modulo] = {};
        resultado[modulo].v2Total = parseInt(valor, 10);
      }
    }
  }

  return resultado;
}

function determinarEstado(porcentaje) {
  if (porcentaje === 0) return '⚪ INICIANDO';
  if (porcentaje < 5) return '🟡 CANARIO (< 5%)';
  if (porcentaje < 50) return '🟠 MADURANDO (5-50%)';
  if (porcentaje < 95) return '🟣 ESCALANDO (50-95%)';
  return '🟢 COMPLETADO (>= 95%)';
}

async function main() {
  console.clear();
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  📊 MONITOR DE CANARY ROLLOUT - Adopción v2');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (tokenDoc) {
      headers['Authorization'] = `Bearer ${tokenDoc}`;
    }

    const response = await fetch(metricsUrl, {
      headers,
      timeout: 5000
    });

    if (!response.ok) {
      console.error(`❌ Error al obtener métricas: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const metricas = await response.text();

    // Extraer métricas de adopción
    const adopcion = extraerMetricasAdopcion(metricas);
    const modulos = Object.keys(adopcion).sort();

    if (modulos.length === 0) {
      console.log('⚠️  No hay datos de adopción disponibles aún.');
      console.log('');
      console.log('Asegúrate de que:');
      console.log('  1. El servidor está corriendo en', apiBase);
      console.log('  2. Hay tráfico de solicitudes a /api/examenes y /api/omr');
      console.log('  3. Las rutas v2 están siendo accedidas');
      process.exit(0);
    }

    // Mostrar estado por módulo
    console.log('📈 ESTADO POR MÓDULO:');
    console.log('');

    for (const modulo of modulos) {
      const stats = adopcion[modulo];
      const v1Total = stats.v1Total || 0;
      const v2Total = stats.v2Total || 0;
      const total = v1Total + v2Total;
      const v2Porcentaje = stats.v2Porcentaje ?? 0;

      const estado = determinarEstado(v2Porcentaje);

      console.log(`  ${modulo.toUpperCase()}`);
      console.log(`    ${estado}`);
      console.log(
        `    V1: ${formatearNumero(v1Total).padEnd(10)} | V2: ${formatearNumero(v2Total).padEnd(10)} | Total: ${formatearNumero(total)}`
      );
      console.log(`    Adopción v2: ${formatearPorcentaje(v2Porcentaje)}`);
      console.log('');
    }

    // Cálculo de adopción global
    let totalV1Global = 0;
    let totalV2Global = 0;

    for (const modulo of modulos) {
      totalV1Global += adopcion[modulo].v1Total || 0;
      totalV2Global += adopcion[modulo].v2Total || 0;
    }

    const totalGlobal = totalV1Global + totalV2Global;
    const porcentajeGlobal = totalGlobal === 0 ? 0 : (totalV2Global / totalGlobal) * 100;

    console.log('─────────────────────────────────────────────────────────────────');
    console.log('📊 ADOPCIÓN GLOBAL:');
    console.log(`  ${determinarEstado(porcentajeGlobal)}`);
    console.log(`  V1 Total: ${formatearNumero(totalV1Global).padStart(12)}`);
    console.log(`  V2 Total: ${formatearNumero(totalV2Global).padStart(12)}`);
    console.log(`  Adopción: ${formatearPorcentaje(porcentajeGlobal).padStart(12)}`);
    console.log('');

    // Recomendaciones
    console.log('💡 RECOMENDACIONES:');
    const recomendaciones = [];

    for (const modulo of modulos) {
      const v2Porcentaje = adopcion[modulo].v2Porcentaje ?? 0;
      if (v2Porcentaje === 0) {
        recomendaciones.push(`  • ${modulo}: Activar canario (FEATURE_${modulo.toUpperCase()}_PIPELINE_V2=0.01)`);
      } else if (v2Porcentaje < 5 && v2Porcentaje > 0) {
        recomendaciones.push(`  • ${modulo}: Escalar canario a 10% (FEATURE_${modulo.toUpperCase()}_PIPELINE_V2=0.1)`);
      } else if (v2Porcentaje >= 5 && v2Porcentaje < 50) {
        recomendaciones.push(`  • ${modulo}: Escalar a 50% para validar (FEATURE_${modulo.toUpperCase()}_PIPELINE_V2=0.5)`);
      } else if (v2Porcentaje >= 90) {
        recomendaciones.push(`  • ${modulo}: ✅ Listo para GA (general availability)`);
      }
    }

    if (recomendaciones.length > 0) {
      for (const rec of recomendaciones) {
        console.log(rec);
      }
    } else {
      console.log('  ✅ Todo está balanceado, continúa monitoreando');
    }

    console.log('');
    console.log('═════════════════════════════════════════════════════════════════');
    console.log(`Actualizado: ${new Date().toLocaleString('es-MX')}`);
    console.log('Ejecutar con: npm run canary:monitor');
    console.log('═════════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    console.log('');
    console.log('Verifica que:');
    console.log('  1. El servidor API está corriendo');
    console.log('  2. VITE_API_BASE_URL está configurado correctamente');
    console.log('  3. El token docente es válido (si es requerido)');
    process.exit(1);
  }
}

main();
