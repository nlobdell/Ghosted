import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'app/casino/runtime',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/casino/main.ts'),
      formats: ['es'],
      fileName: () => 'game.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'game.css';
          }
          return '[name][extname]';
        },
      },
    },
  },
});
