import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Carimbo de versão gerado no momento do build (muda a cada deploy).
// Usado para auto-limpeza de cache no cliente (ver src/main.jsx).
const BUILD_ID = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_ID),
  },
  plugins: [react()],
})
