import { describe, expect, it } from 'vitest';
import {
  calcularMargen,
  emitirTokenLicencia,
  mapearEstadoCobranzaDesdeMercadoPago,
  generarCodigoActivacion,
  validarMargenMinimo,
  verificarTokenLicencia
} from '../src/modulos/modulo_comercial_core/servicioComercialCore';

describe('comercial core', () => {
  it('calcula margen bruto correctamente', () => {
    expect(calcularMargen(100, 30)).toBeCloseTo(0.7, 4);
  });

  it('rechaza margen por debajo de 60%', () => {
    expect(() => validarMargenMinimo(100, 50, 0.6)).toThrowError();
  });

  it('firma y verifica token de licencia', () => {
    const token = emitirTokenLicencia({
      licenciaId: 'lic_1',
      tenantId: 'tenant_demo',
      tipo: 'onprem',
      canalRelease: 'stable'
    });
    const payload = verificarTokenLicencia(token);
    expect(payload.licenciaId).toBe('lic_1');
    expect(payload.tenantId).toBe('tenant_demo');
  });

  it('mapea estados de Mercado Pago a cobranza interna', () => {
    expect(mapearEstadoCobranzaDesdeMercadoPago('approved')).toBe('aprobado');
    expect(mapearEstadoCobranzaDesdeMercadoPago('rejected')).toBe('rechazado');
    expect(mapearEstadoCobranzaDesdeMercadoPago('cancelled')).toBe('cancelado');
    expect(mapearEstadoCobranzaDesdeMercadoPago('in_process')).toBe('pendiente');
  });

  it('genera codigo de activacion con prefijo esperado', () => {
    const codigo = generarCodigoActivacion();
    expect(codigo.startsWith('EVAL-')).toBe(true);
    expect(codigo.length).toBeGreaterThan(10);
  });
});
