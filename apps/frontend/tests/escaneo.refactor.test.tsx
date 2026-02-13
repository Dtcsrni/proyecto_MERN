import { describe, expect, it } from 'vitest';
import { QrAccesoMovil, SeccionEscaneo } from '../src/apps/app_docente/SeccionEscaneo';

describe('escaneo refactor smoke', () => {
  it('exporta componentes de escaneo', () => {
    expect(typeof SeccionEscaneo).toBe('function');
    expect(typeof QrAccesoMovil).toBe('function');
  });
});
