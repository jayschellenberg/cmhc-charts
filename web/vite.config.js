import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Split heavy libs into their own lazy-loadable chunks so the
          // eager vendor bundle stays small. ExcelJS in particular is only
          // referenced via dynamic import() from the three Download buttons,
          // so it should only land on the wire when the user clicks one.
          if (id.includes('exceljs') || id.includes('archiver') || id.includes('saxes') || id.includes('xmlbuilder')) return 'exceljs';
          if (id.includes('html-to-image')) return 'html-to-image';
          if (id.includes('@observablehq/plot')) return 'plot';
          if (id.includes('d3-')) return 'd3';
          return 'vendor';
        },
      },
    },
  },
});
