/**
 * [BLOQUE DIDACTICO] client/eslint.config.js
 * Que es: Configuracion de calidad estatica del frontend.
 * Que hace: Define reglas de lint para prevenir errores y mantener consistencia.
 * Como lo hace: Combina presets y reglas especificas para TS/React en ESLint.
 */

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
