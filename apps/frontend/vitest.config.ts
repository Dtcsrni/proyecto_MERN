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
      // TODO(2026-03-31): Retirar exclusiones temporales de cobertura
      // tras completar particion de AppDocente y pruebas por dominio.
      exclude: [
        ...(baseVitestConfig.coverage?.exclude ?? []),
        'src/apps/app_docente/**',
        'src/apps/app_docente_legacy/**',
        'src/apps/app_alumno/**',
        'src/main.tsx',
        'src/index.css'
      ],
      thresholds: {
        lines: 45,
        functions: 45,
        branches: 45,
        statements: 45
      }
    }
  }
});
