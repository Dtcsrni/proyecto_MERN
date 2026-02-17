type ModuloCanary = 'omr' | 'pdf';

type EscalonCanary = 0 | 0.01 | 0.05 | 0.25 | 0.5 | 0.9 | 1;

export interface EstadoModuloCanary {
  modulo: ModuloCanary;
  objetivoV2: number;
  escalon: EscalonCanary;
  actualizadoEn: string;
  origen: 'env' | 'auto' | 'manual';
  motivo: string;
  ultimoCambioAccion?: 'escalar' | 'rollback' | 'manual';
}

export interface EntradaDecisionCanary {
  modulo: ModuloCanary;
  objetivoActual: number;
  adopcionV2: number;
  errorRate: number;
  totalSolicitudes: number;
}

export interface DecisionCanary {
  accion: 'mantener' | 'escalar' | 'rollback';
  siguienteObjetivo: number;
  motivo: string;
}

export interface ResultadoAplicacionCanary {
  modulo: ModuloCanary;
  aplicado: boolean;
  decision: DecisionCanary;
  estado: EstadoModuloCanary;
}

const ESCALONES_CONSERVADORES: EscalonCanary[] = [0, 0.01, 0.05, 0.25, 0.5, 0.9, 1];
const COOLDOWN_MS = Math.max(30_000, Number(process.env.CANARY_ROLLOUT_COOLDOWN_MS ?? 300_000));

const estadoCanary = new Map<ModuloCanary, EstadoModuloCanary>();
const ultimoCambioAutomaticoMs = new Map<ModuloCanary, number>();

function normalizarObjetivo(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  if (valor < 0) return 0;
  if (valor > 1) return 1;
  return Number(valor.toFixed(4));
}

function parsearFlagPorcentaje(valorEnv: string | undefined): number {
  const texto = String(valorEnv ?? '').trim().toLowerCase();
  if (!texto) return 0;
  if (/^(1|true|si|yes)$/.test(texto)) return 1;
  if (/^(0|false|no)$/.test(texto)) return 0;

  const n = Number(texto);
  if (!Number.isFinite(n)) return 0;
  if (n > 1 && n <= 100) return normalizarObjetivo(n / 100);
  return normalizarObjetivo(n);
}

function calcularEscalon(objetivo: number): EscalonCanary {
  const objetivoNormalizado = normalizarObjetivo(objetivo);
  let escalon: EscalonCanary = 0;
  for (const candidato of ESCALONES_CONSERVADORES) {
    if (objetivoNormalizado >= candidato) escalon = candidato;
  }
  return escalon;
}

function hashDeterministico(valor: string): number {
  let hash = 2166136261;
  for (let i = 0; i < valor.length; i += 1) {
    hash ^= valor.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function siguienteEscalonActual(objetivoActual: number): EscalonCanary {
  const actual = calcularEscalon(objetivoActual);
  const indice = ESCALONES_CONSERVADORES.indexOf(actual);
  const siguiente = ESCALONES_CONSERVADORES[Math.min(indice + 1, ESCALONES_CONSERVADORES.length - 1)];
  return siguiente;
}

function escalonAnterior(objetivoActual: number): EscalonCanary {
  const actual = calcularEscalon(objetivoActual);
  const indice = ESCALONES_CONSERVADORES.indexOf(actual);
  const previo = ESCALONES_CONSERVADORES[Math.max(indice - 1, 0)];
  return previo;
}

function inicializarDesdeEnv() {
  if (estadoCanary.size > 0) return;

  const objetivoOmr = parsearFlagPorcentaje(process.env.FEATURE_OMR_PIPELINE_V2);
  const objetivoPdf = parsearFlagPorcentaje(process.env.FEATURE_PDF_BUILDER_V2);

  const ahora = new Date().toISOString();
  estadoCanary.set('omr', {
    modulo: 'omr',
    objetivoV2: objetivoOmr,
    escalon: calcularEscalon(objetivoOmr),
    actualizadoEn: ahora,
    origen: 'env',
    motivo: 'Inicializado desde FEATURE_OMR_PIPELINE_V2',
    ultimoCambioAccion: 'manual'
  });
  estadoCanary.set('pdf', {
    modulo: 'pdf',
    objetivoV2: objetivoPdf,
    escalon: calcularEscalon(objetivoPdf),
    actualizadoEn: ahora,
    origen: 'env',
    motivo: 'Inicializado desde FEATURE_PDF_BUILDER_V2',
    ultimoCambioAccion: 'manual'
  });
}

export function obtenerEstadoRolloutCanary(): Record<ModuloCanary, EstadoModuloCanary> {
  inicializarDesdeEnv();
  return {
    omr: { ...(estadoCanary.get('omr') as EstadoModuloCanary) },
    pdf: { ...(estadoCanary.get('pdf') as EstadoModuloCanary) }
  };
}

export function definirObjetivoCanary(
  modulo: ModuloCanary,
  objetivoV2: number,
  origen: 'auto' | 'manual',
  motivo: string
): EstadoModuloCanary {
  inicializarDesdeEnv();
  const objetivo = normalizarObjetivo(objetivoV2);
  const actualizado: EstadoModuloCanary = {
    modulo,
    objetivoV2: objetivo,
    escalon: calcularEscalon(objetivo),
    actualizadoEn: new Date().toISOString(),
    origen,
    motivo,
    ultimoCambioAccion: origen === 'manual' ? 'manual' : objetivo > (estadoCanary.get(modulo)?.objetivoV2 ?? 0) ? 'escalar' : 'rollback'
  };
  estadoCanary.set(modulo, actualizado);
  if (origen === 'auto') {
    ultimoCambioAutomaticoMs.set(modulo, Date.now());
  }
  return { ...actualizado };
}

export function decidirVersionCanary(modulo: ModuloCanary, semilla: string): 'v1' | 'v2' {
  inicializarDesdeEnv();
  const objetivo = estadoCanary.get(modulo)?.objetivoV2 ?? 0;
  if (objetivo <= 0) return 'v1';
  if (objetivo >= 1) return 'v2';

  const valorHash = hashDeterministico(`${modulo}:${semilla}`) % 10000;
  const percentil = valorHash / 10000;
  return percentil < objetivo ? 'v2' : 'v1';
}

export function evaluarDecisionConservadora(entrada: EntradaDecisionCanary): DecisionCanary {
  if (entrada.totalSolicitudes < 100) {
    return {
      accion: 'mantener',
      siguienteObjetivo: entrada.objetivoActual,
      motivo: 'Muestra insuficiente (<100 solicitudes)'
    };
  }

  if (entrada.errorRate >= 0.03) {
    const rollback = escalonAnterior(entrada.objetivoActual);
    return {
      accion: rollback < entrada.objetivoActual ? 'rollback' : 'mantener',
      siguienteObjetivo: rollback,
      motivo: `Error rate alto (${(entrada.errorRate * 100).toFixed(2)}%)`
    };
  }

  if (entrada.errorRate <= 0.01 && entrada.adopcionV2 >= entrada.objetivoActual * 100) {
    const siguiente = siguienteEscalonActual(entrada.objetivoActual);
    return {
      accion: siguiente > entrada.objetivoActual ? 'escalar' : 'mantener',
      siguienteObjetivo: siguiente,
      motivo: 'Salud estable y adopción alineada al objetivo'
    };
  }

  return {
    accion: 'mantener',
    siguienteObjetivo: entrada.objetivoActual,
    motivo: 'Esperando ventana más estable'
  };
}

export function exportarMetricasObjetivoCanary(): string {
  const estado = obtenerEstadoRolloutCanary();
  const lineas: string[] = [];
  lineas.push('# HELP evaluapro_canary_objetivo_v2_ratio Objetivo de tráfico v2 por módulo (0..1)');
  lineas.push('# TYPE evaluapro_canary_objetivo_v2_ratio gauge');
  lineas.push(`evaluapro_canary_objetivo_v2_ratio{modulo="omr"} ${estado.omr.objetivoV2}`);
  lineas.push(`evaluapro_canary_objetivo_v2_ratio{modulo="pdf"} ${estado.pdf.objetivoV2}`);

  lineas.push('');
  lineas.push('# HELP evaluapro_canary_cooldown_seconds Cooldown configurado para cambios automáticos de canary');
  lineas.push('# TYPE evaluapro_canary_cooldown_seconds gauge');
  lineas.push(`evaluapro_canary_cooldown_seconds ${Math.round(COOLDOWN_MS / 1000)}`);
  return lineas.join('\n');
}

export function reiniciarRolloutCanaryParaPruebas() {
  estadoCanary.clear();
  ultimoCambioAutomaticoMs.clear();
}

function enCooldown(modulo: ModuloCanary): boolean {
  const ultimoCambio = ultimoCambioAutomaticoMs.get(modulo);
  if (!ultimoCambio) return false;
  return Date.now() - ultimoCambio < COOLDOWN_MS;
}

export function evaluarYAplicarCanaryConservador(entrada: EntradaDecisionCanary): ResultadoAplicacionCanary {
  inicializarDesdeEnv();
  const decision = evaluarDecisionConservadora(entrada);
  const estadoActual = estadoCanary.get(entrada.modulo) as EstadoModuloCanary;

  const esCambio = decision.siguienteObjetivo !== estadoActual.objetivoV2;
  if (!esCambio) {
    return {
      modulo: entrada.modulo,
      aplicado: false,
      decision,
      estado: { ...estadoActual }
    };
  }

  if (decision.accion === 'escalar' && enCooldown(entrada.modulo)) {
    return {
      modulo: entrada.modulo,
      aplicado: false,
      decision: {
        accion: 'mantener',
        siguienteObjetivo: estadoActual.objetivoV2,
        motivo: `Cooldown activo (${Math.ceil(COOLDOWN_MS / 1000)}s)`
      },
      estado: { ...estadoActual }
    };
  }

  const actualizado = definirObjetivoCanary(entrada.modulo, decision.siguienteObjetivo, 'auto', decision.motivo);
  return {
    modulo: entrada.modulo,
    aplicado: true,
    decision,
    estado: actualizado
  };
}