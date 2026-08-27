import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy/index.html'),
        terms: resolve(import.meta.dirname, 'terms/index.html')
      }
    }
  },
  plugins: [{
    name: 'versioned-service-worker',
    generateBundle(_options, bundle) {
      const generated: string[] = [];
      const buildVersion = createHash('sha256').update(Object.keys(bundle).sort().join('|')).digest('hex').slice(0, 12);
      const shell = [
        '/', '/index.html', '/privacy/', '/terms/', '/offline.html',
        '/manifest.webmanifest', '/assets/repair-collage.webp',
        '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png',
        ...generated
      ];
      const template = readFileSync(resolve(import.meta.dirname, 'src/sw-template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__BUILD_VERSION__', buildVersion)
          .replace('__PRECACHE_MANIFEST__', JSON.stringify(shell))
      });
    }
  }]
});
