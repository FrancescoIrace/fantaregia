import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // il motore originale gira dentro jsdom: il primo avvio non è istantaneo
    testTimeout: 60_000,
  },
})
