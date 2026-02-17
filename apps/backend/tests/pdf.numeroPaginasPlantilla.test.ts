import { describe, expect, it } from 'vitest';
import { resolverNumeroPaginasPlantilla } from '../src/modulos/modulo_generacion_pdf/domain/resolverNumeroPaginasPlantilla';

describe('resolverNumeroPaginasPlantilla', () => {
  it('usa numeroPaginas cuando es válido', () => {
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 3, tipo: 'parcial' })).toBe(3);
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 2.9, tipo: 'global' })).toBe(2);
  });

  it('aplica fallback legacy por tipo cuando numeroPaginas no es válido', () => {
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 0, totalReactivos: 40, tipo: 'parcial' })).toBe(2);
    expect(resolverNumeroPaginasPlantilla({ totalReactivos: 80, tipo: 'global' })).toBe(4);
  });

  it('retorna 1 cuando no hay datos válidos', () => {
    expect(resolverNumeroPaginasPlantilla({})).toBe(1);
    expect(resolverNumeroPaginasPlantilla({ numeroPaginas: 'x', totalReactivos: 0, tipo: 'parcial' })).toBe(1);
  });
});