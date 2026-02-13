import { describe, expect, it } from 'vitest';
import { SeccionPlantillas } from '../src/apps/app_docente/SeccionPlantillas';

describe('plantillas refactor smoke', () => {
  it('exporta componente SeccionPlantillas', () => {
    expect(typeof SeccionPlantillas).toBe('function');
  });
});
