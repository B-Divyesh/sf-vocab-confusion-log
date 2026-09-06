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
        log: resolve(import.meta.dirname, 'log/index.html'),
        demo: resolve(import.meta.dirname, 'demo/index.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
        privacy: resolve(import.meta.dirname, 'privacy/index.html'),
        terms: resolve(import.meta.dirname, 'terms/index.html')
      }
    }
  },
  plugins: [{
    name: 'preview-product-routes',
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const appRoute = pathname.match(/^\/(log|demo)\/(practice|pairs|data)\/?$/);
        if (appRoute) {
          request.url = `/${appRoute[1]}/index.html`;
          next();
          return;
        }
        const knownDocuments = new Set(['/', '/index.html', '/log', '/log/', '/demo', '/demo/', '/privacy', '/privacy/', '/terms', '/terms/', '/404.html']);
        const acceptsHtml = request.headers.accept?.includes('text/html');
        if (acceptsHtml && !knownDocuments.has(pathname) && !pathname.includes('.')) {
          response.statusCode = 404;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(readFileSync(resolve(import.meta.dirname, 'dist/404.html')));
          return;
        }
        next();
      });
    }
  }, {
    name: 'versioned-service-worker',
    generateBundle(_options, bundle) {
      const generated: string[] = [];
      const buildVersion = createHash('sha256').update(Object.keys(bundle).sort().join('|')).digest('hex').slice(0, 12);
      const shell = [
        '/', '/index.html', '/log/', '/demo/', '/privacy/', '/terms/', '/404.html', '/offline.html', '/offline.css',
        '/manifest.webmanifest', '/assets/repair-collage.webp',
        '/assets/sample-affect.wav', '/assets/sample-effect.wav',
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
