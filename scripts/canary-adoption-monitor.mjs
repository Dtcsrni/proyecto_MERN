#!/usr/bin/env node
/**
 * canary-adoption-monitor
 *
 * Responsabilidad: Dashboard de monitoreo de adopción v1->v2 en canary rollout
 * Uso: node scripts/canary-adoption-monitor.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const apiBase = process.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const metricsUrl = `${apiBase}/metrics`;
const canaryEvalUrl = `${apiBase}/canary-rollout/evaluar`;
const tokenDoc = process.env.TOKEN_DOCENTE || '';
const modoAuto = process.argv.includes('--auto');

const ESCALONES = [0, 0.01, 0.05, 0.25, 0.5, 0.9, 1];

function normalizarObjetivo(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Number(n.toFixed(4));
}

function siguienteEscalon(objetivoActual) {
  const objetivo = normalizarObjetivo(objetivoActual);
  let indice = 0;
  for (let i = 0; i < ESCALONES.length; i += 1) {
    if (objetivo >= ESCALONES[i]) indice = i;
  }
  return ESCALONES[Math.min(indice + 1, ESCALONES.length - 1)];
}

function escalonAnterior(objetivoActual) {
  const objetivo = normalizarObjetivo(objetivoActual);
  let indice = 0;
  for (let i = 0; i < ESCALONES.length; i += 1) {
    if (objetivo >= ESCALONES[i]) indice = i;
  }
  return ESCALONES[Math.max(indice - 1, 0)];
}

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

function extraerObjetivoCanary(metricas) {
  const resultado = {};
  const lines = String(metricas).split('\n');
  for (const line of lines) {
    if (!line.startsWith('evaluapro_canary_objetivo_v2_ratio')) continue;
    const match = line.match(/modulo="([^"]+)"\}\s+([\d.]+)/);
    if (!match) continue;
    const [, modulo, valor] = match;
    resultado[modulo] = parseFloat(valor);
  }
  return resultado;
}

function calcularErrorRateGlobal(metricas) {
  const totalRaw = extraerMetrica(metricas, 'evaluapro_http_requests_total');
  const errorsRaw = extraerMetrica(metricas, 'evaluapro_http_errors_total');
  const total = Number(totalRaw || 0);
  const errors = Number(errorsRaw || 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(errors) || errors < 0) return 0;
  return Math.max(0, Math.min(1, errors / total));
}

function decidirConservador({ objetivoActual, adopcionV2, errorRate, totalSolicitudes }) {
  if (totalSolicitudes < 100) {
    return { accion: 'mantener', siguienteObjetivo: objetivoActual, motivo: 'Muestra insuficiente (<100)' };
  }
  if (errorRate >= 0.03) {
    const siguiente = escalonAnterior(objetivoActual);
    return {
      accion: siguiente < objetivoActual ? 'rollback' : 'mantener',
      siguienteObjetivo: siguiente,
      motivo: `Error rate alto (${formatearPorcentaje(errorRate * 100)})`
    };
  }
  if (errorRate <= 0.01 && adopcionV2 >= objetivoActual * 100) {
    const siguiente = siguienteEscalon(objetivoActual);
    return {
      accion: siguiente > objetivoActual ? 'escalar' : 'mantener',
      siguienteObjetivo: siguiente,
      motivo: 'Salud estable y adopción alineada'
    };
  }
  return { accion: 'mantener', siguienteObjetivo: objetivoActual, motivo: 'Ventana en observación' };
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
    const objetivos = extraerObjetivoCanary(metricas);
    const errorRateGlobal = calcularErrorRateGlobal(metricas);
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
    const decisiones = [];

    for (const modulo of modulos) {
      const v2Porcentaje = adopcion[modulo].v2Porcentaje ?? 0;
      const totalSolicitudes = (adopcion[modulo].v1Total || 0) + (adopcion[modulo].v2Total || 0);
      const objetivoActual = normalizarObjetivo(objetivos[modulo] ?? 0);
      let decision = decidirConservador({
        objetivoActual,
        adopcionV2: v2Porcentaje,
        errorRate: errorRateGlobal,
        totalSolicitudes
      });

      let aplicado = false;
      if (modoAuto && tokenDoc) {
        try {
          const evalResp = await fetch(canaryEvalUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenDoc}`
            },
            body: JSON.stringify({
              modulo,
              objetivoActual,
              adopcionV2: v2Porcentaje,
              errorRate: errorRateGlobal,
              totalSolicitudes,
              aplicar: true
            })
          });

          if (evalResp.ok) {
            const payload = await evalResp.json();
            const data = payload?.data;
            if (data?.decision) {
              decision = data.decision;
              aplicado = Boolean(data.aplicado);
            }
          }
        } catch {
          // Si no se pudo aplicar automáticamente, mantenemos recomendación local.
        }
      }

      decisiones.push({
        modulo,
        objetivoActual,
        adopcionV2: v2Porcentaje,
        totalSolicitudes,
        errorRateGlobal,
        aplicado,
        ...decision
      });

      recomendaciones.push(
        `  • ${modulo}: ${decision.accion.toUpperCase()} -> objetivo ${(decision.siguienteObjetivo * 100).toFixed(0)}% (${decision.motivo})${aplicado ? ' [APLICADO]' : ''}`
      );
    }

    if (recomendaciones.length > 0) {
      for (const rec of recomendaciones) {
        console.log(rec);
      }
    } else {
      console.log('  ✅ Todo está balanceado, continúa monitoreando');
    }

    console.log('');
    console.log(`📉 Error rate global: ${formatearPorcentaje(errorRateGlobal * 100)}`);
    console.log('');

    if (modoAuto) {
      const evidencia = {
        timestamp: new Date().toISOString(),
        apiBase,
        politica: 'conservadora',
        errorRateGlobal,
        decisiones
      };

      const outputDir = path.resolve(process.cwd(), 'reports', 'qa', 'latest');
      fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, 'canary-rollout.json');
      fs.writeFileSync(outputPath, JSON.stringify(evidencia, null, 2), 'utf8');
      console.log(`🧾 Evidencia de decisión guardada en: ${outputPath}`);
      console.log('');
    }

    console.log('═════════════════════════════════════════════════════════════════');
    console.log(`Actualizado: ${new Date().toLocaleString('es-MX')}`);
    console.log('Ejecutar con: npm run canary:monitor');
    console.log('Modo automático: npm run canary:monitor:auto');
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
