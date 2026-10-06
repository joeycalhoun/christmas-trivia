import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Two builds:
//  - default: a normal static site in dist/ (React bundled), deployable anywhere.
//  - artifact: one IIFE + one CSS file in dist-artifact/, with React loaded from
//    cdnjs as globals; scripts/make-artifact.mjs stitches them into a single page.
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
    plugins: [react({ jsxRuntime: 'classic' })],
    base: './',
    define: artifact ? { 'process.env.NODE_ENV': '"production"' } : {},
    build: artifact
      ? {
          outDir: 'dist-artifact',
          cssCodeSplit: false,
          lib: { entry: 'src/main.tsx', formats: ['iife'], name: 'IQTester', fileName: () => 'app.js' },
          rollupOptions: {
            external: ['react', 'react-dom', 'react-dom/client'],
            output: {
              globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
              assetFileNames: 'app.[ext]',
            },
          },
        }
      : { outDir: 'dist' },
    test: { include: ['tests/**/*.test.ts'] },
  };
});
