import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
export default defineConfig({
  root: fileURLToPath(new URL('./preview', import.meta.url)),
  base: './',
  plugins: [{ name: 'unchanged-2d-reference', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'reference-2d.html', source: readFileSync(new URL('./preview/reference-2d.html', import.meta.url), 'utf8') });
  } }],
  server: { port: 8773, fs: { allow: [fileURLToPath(new URL('../../..', import.meta.url))] } },
  build: { outDir: '../dist', emptyOutDir: true, assetsInlineLimit: 0 }
});
