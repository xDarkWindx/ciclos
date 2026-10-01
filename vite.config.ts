import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,wasm,webmanifest}'] },
      manifest: {
        name: 'Ciclos de Estudo',
        short_name: 'Ciclos',
        description: 'Controle seu ciclo de estudos para concursos',
        lang: 'pt-BR',
        theme_color: '#2f6fed',
        background_color: '#f5f6f8',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
