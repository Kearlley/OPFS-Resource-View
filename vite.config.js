import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

function patchSqliteWorkerForCsp(workerPath) {
  if (!existsSync(workerPath)) return;

  const source = readFileSync(workerPath, 'utf-8');
  const oldSnippet = "return (WebAssembly.instantiateStreaming ? async () => WebAssembly.instantiateStreaming(wfetch(), imports).then(finalThen) : async () => wfetch().then((response) => response.arrayBuffer()).then((bytes) => WebAssembly.instantiate(bytes, imports)).then(finalThen))();";
  const newSnippet = "return (async () => wfetch().then((response) => response.arrayBuffer()).then((bytes) => WebAssembly.instantiate(bytes, imports)).then(finalThen))();";

  if (!source.includes(oldSnippet)) return;

  writeFileSync(workerPath, source.replace(oldSnippet, newSnippet), 'utf-8');
}

function copySqliteWasmAssets(distDir) {
  const targetDir = resolve(distDir, 'lib/sqlite-wasm');
  mkdirSync(targetDir, { recursive: true });

  const pkgDist = resolve(__dirname, 'node_modules/@sqlite.org/sqlite-wasm/dist');
  const localLib = resolve(__dirname, 'lib/sqlite-wasm');

  const copyOne = (srcDir, fileName) => {
    const src = resolve(srcDir, fileName);
    if (existsSync(src)) {
      cpSync(src, resolve(targetDir, fileName));
      return true;
    }
    return false;
  };

  const preferPkg = existsSync(pkgDist);
  const srcPrimary = preferPkg ? pkgDist : localLib;
  const srcFallback = preferPkg ? localLib : pkgDist;

  ['sqlite3-worker1.mjs', 'sqlite3-opfs-async-proxy.js', 'sqlite3.wasm'].forEach((fileName) => {
    if (!copyOne(srcPrimary, fileName)) copyOne(srcFallback, fileName);
  });

  patchSqliteWorkerForCsp(resolve(targetDir, 'sqlite3-worker1.mjs'));
}

function copyExtensionAssets() {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const manifestSrc = resolve(__dirname, 'manifest.json');
      const backgroundSrc = resolve(__dirname, 'background.js');

      mkdirSync(distDir, { recursive: true });

      if (existsSync(manifestSrc)) cpSync(manifestSrc, resolve(distDir, 'manifest.json'));
      if (existsSync(backgroundSrc)) cpSync(backgroundSrc, resolve(distDir, 'background.js'));

      copySqliteWasmAssets(distDir);
    }
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, 'devtools.html'),
        panel: resolve(__dirname, 'panel.html'),
        contentScript: resolve(__dirname, 'contentScript.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
});
