import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  decidirVersionCanary,
  definirObjetivoCanary,
  evaluarDecisionConservadora,
  evaluarYAplicarCanaryConservador,
  reiniciarRolloutCanaryParaPruebas,
  obtenerEstadoRolloutCanary
} from '../src/compartido/observabilidad/rolloutCanary';

describe('rollout canary conservador', () => {
  beforeEach(() => {
    reiniciarRolloutCanaryParaPruebas();
  });

  afterEach(() => {
    reiniciarRolloutCanaryParaPruebas();
  });

  it('mantiene objetivo cuando hay muestra insuficiente', () => {
    const decision = evaluarDecisionConservadora({
      modulo: 'omr',
      objetivoActual: 0.05,
      adopcionV2: 4,
      errorRate: 0,
      totalSolicitudes: 30
    });

    expect(decision.accion).toBe('mantener');
    expect(decision.siguienteObjetivo).toBe(0.05);
  });

  it('hace rollback cuando el error rate supera 3%', () => {
    const decision = evaluarDecisionConservadora({
      modulo: 'pdf',
      objetivoActual: 0.25,
      adopcionV2: 24,
      errorRate: 0.05,
      totalSolicitudes: 400
    });

    expect(decision.accion).toBe('rollback');
    expect(decision.siguienteObjetivo).toBe(0.05);
  });

  it('escala al siguiente escalón con salud estable', () => {
    const decision = evaluarDecisionConservadora({
      modulo: 'omr',
      objetivoActual: 0.01,
      adopcionV2: 1.2,
      errorRate: 0.002,
      totalSolicitudes: 150
    });

    expect(decision.accion).toBe('escalar');
    expect(decision.siguienteObjetivo).toBe(0.05);
  });

  it('enruta todo a v1 con objetivo 0', () => {
    definirObjetivoCanary('omr', 0, 'manual', 'test');

    const version = decidirVersionCanary('omr', 'seed-fija');
    expect(version).toBe('v1');
  });

  it('enruta todo a v2 con objetivo 1', () => {
    definirObjetivoCanary('pdf', 1, 'manual', 'test');

    const version = decidirVersionCanary('pdf', 'seed-fija');
    expect(version).toBe('v2');
  });

  it('expone estado de módulos canary', () => {
    const estado = obtenerEstadoRolloutCanary();

    expect(estado.omr.modulo).toBe('omr');
    expect(estado.pdf.modulo).toBe('pdf');
    expect(estado.omr.objetivoV2).toBeGreaterThanOrEqual(0);
    expect(estado.pdf.objetivoV2).toBeLessThanOrEqual(1);
  });

  it('aplica escalado automático cuando está sano', () => {
    definirObjetivoCanary('omr', 0.01, 'manual', 'base test');

    const resultado = evaluarYAplicarCanaryConservador({
      modulo: 'omr',
      objetivoActual: 0.01,
      adopcionV2: 1.5,
      errorRate: 0.005,
      totalSolicitudes: 150
    });

    expect(resultado.aplicado).toBe(true);
    expect(resultado.decision.accion).toBe('escalar');
    expect(resultado.estado.objetivoV2).toBe(0.05);
  });

  it('bloquea escalado durante cooldown anti-flapping', () => {
    definirObjetivoCanary('pdf', 0.01, 'manual', 'base test');

    const primerCambio = evaluarYAplicarCanaryConservador({
      modulo: 'pdf',
      objetivoActual: 0.01,
      adopcionV2: 2,
      errorRate: 0.001,
      totalSolicitudes: 220
    });
    expect(primerCambio.aplicado).toBe(true);
    expect(primerCambio.estado.objetivoV2).toBe(0.05);

    const segundoCambio = evaluarYAplicarCanaryConservador({
      modulo: 'pdf',
      objetivoActual: 0.05,
      adopcionV2: 6,
      errorRate: 0.001,
      totalSolicitudes: 220
    });

    expect(segundoCambio.aplicado).toBe(false);
    expect(segundoCambio.decision.accion).toBe('mantener');
    expect(segundoCambio.estado.objetivoV2).toBe(0.05);
  });
});