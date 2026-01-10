import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/',
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
    headers: {
      // Security Headers for Development
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    },
  },
  build: {
    sourcemap: false, // Don't expose source maps in production
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
