import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // In production: hardened output, disable client sourcemaps to prevent source exposure.
      // In development: reasonable debugging enabled.
      sourcemap: isProd ? false : true,
    },
    server: {
      // HMR is disabled in AI Studio environment to prevent WebSocket disconnection errors.
      hmr: false,
      watch: null,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    },
  };
});
