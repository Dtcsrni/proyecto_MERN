import { describe, expect, it } from 'vitest';
import { SeccionBanco } from '../src/apps/app_docente/SeccionBanco';

describe('banco refactor smoke', () => {
  it('exporta componente SeccionBanco', () => {
    expect(typeof SeccionBanco).toBe('function');
  });
});
