import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Entropia Analytics se sirve dentro de la oficina, en /analytics/. Con
// VITE_BASE=/ vuelve a funcionar en la raíz por separado.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/analytics/',
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
})
