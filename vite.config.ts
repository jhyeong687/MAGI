import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  root: mode === 'demo' ? resolve('demo') : undefined,
  publicDir: resolve('public'),
  base: mode === 'demo' ? '/MAGI/' : '/',
  build: { outDir: mode === 'demo' ? resolve('dist-demo') : resolve('dist'), emptyOutDir: true },
  server: { host: '127.0.0.1' },
}));
