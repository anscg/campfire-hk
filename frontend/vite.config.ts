import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ViteImageOptimizer({
      png: {
        effort: 10,
        compressionLevel: 9,
        progressive: true
      },
      ansiColors: true,
      logStats: true
    })
  ],
});
