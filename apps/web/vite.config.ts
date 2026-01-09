import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/make_now/',
  plugins: [react()],
  resolve: {
    alias: {
      '@make-now/core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  server: {
    fs: {
      allow: [
        path.resolve(__dirname, '..', '..'), // workspace root
        path.resolve(__dirname, '../../spec'),
      ],
    },
  },
});
