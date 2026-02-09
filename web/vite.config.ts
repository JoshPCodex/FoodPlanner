import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/export': {
        target: 'http://exporter:8787',
        changeOrigin: true,
        rewrite: () => '/export'
      },
      '/api/health': {
        target: 'http://exporter:8787',
        changeOrigin: true,
        rewrite: () => '/health'
      }
    },
    watch: {
      usePolling: true
    }
  }
});
