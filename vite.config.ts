import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@client': resolve(__dirname, 'src/client'),
      '@server': resolve(__dirname, 'src/server'),
    },
  },
  server: {
    host: '0.0.0.0', // 允许局域网访问
    port: 5173,
    allowedHosts: ['xx.xx.xx'],
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:8080',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
