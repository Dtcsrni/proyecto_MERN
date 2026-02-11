/**
 * [BLOQUE DIDACTICO] client/vite.config.ts
 * Que es: Configuracion del servidor/bundler Vite.
 * Que hace: Define plugins y proxy para comunicar frontend con backend.
 * Como lo hace: Aplica plugin React y enruta /api al destino configurado.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
})
