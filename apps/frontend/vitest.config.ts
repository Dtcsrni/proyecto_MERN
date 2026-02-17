/**
 * vitest.config
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Configuracion Vitest del frontend React.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { baseVitestConfig } from '../../vitest.base';

export default defineConfig({
  plugins: [react()],
  test: {
    ...baseVitestConfig,
    environment: 'jsdom',
    // En Windows, `threads` puede fallar en algunos entornos ("runner not found").
    // Se mantiene forzable via CLI: `vitest run --pool=threads`.
    pool: 'forks',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      ...baseVitestConfig.coverage,
      exclude: [
        ...(baseVitestConfig.coverage?.exclude ?? []),
        // TODO(2026-03-31|@frontend-core): retirar exclusion temporal bajo politica de deuda TDD.
        'src/apps/app_alumno/**',
        'src/main.tsx',
        'src/index.css'
      ],
      thresholds: {
        // Baseline mínimo actualizado (2026-02-15) para mantener gate
        // de cobertura con piso explícito y margen operativo estable.
        lines: 42,
        functions: 42,
        branches: 34,
        statements: 40
      }
    }
  }
});
