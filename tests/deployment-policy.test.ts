import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type StaticWebAppConfig = {
  globalHeaders: Record<string, string>;
  responseOverrides: Record<string, { rewrite: string; statusCode: number }>;
  routes: Array<{ route: string; rewrite?: string; headers?: Record<string, string> }>;
};

const config = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../public/staticwebapp.config.json'), 'utf8')
) as StaticWebAppConfig;

const route = (path: string) => config.routes.find((entry) => entry.route === path);
const routeHeaders = (path: string) => route(path)?.headers;

describe('static deployment response policy', () => {
  it('ships an immutable one-year cache policy for fingerprinted build assets', () => {
    expect(routeHeaders('/assets/*')?.['Cache-Control']).toBe('public, max-age=31536000, immutable');
    for (const base of ['log', 'demo']) {
      for (const view of ['practice', 'pairs', 'data']) {
        expect(route(`/${base}/${view}/`)?.rewrite).toBe(`/${base}/index.html`);
      }
      expect(route(`/${base}/*`)).toBeUndefined();
    }
  });

  it('keeps update entry points revalidatable', () => {
    expect(routeHeaders('/sw.js')?.['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    expect(routeHeaders('/index.html')?.['Cache-Control']).toBe('no-cache, must-revalidate');
  });

  it('limits browser capabilities and external connections to the product contract', () => {
    expect(config.globalHeaders['Content-Security-Policy']).toContain("connect-src 'self' https://api.sociobot.in");
    expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(config.globalHeaders['Permissions-Policy']).toBe('microphone=(self)');
    expect(config.globalHeaders['X-Frame-Options']).toBe('DENY');
  });

  it('serves unknown paths as a designed HTTP 404', () => {
    expect(config.responseOverrides['404']).toEqual({ rewrite: '/404.html', statusCode: 404 });
    expect(config.routes.some((entry) => entry.route === '/log/*' || entry.route === '/demo/*')).toBe(false);
  });

  it('uses a preload-compatible HSTS duration', () => {
    expect(config.globalHeaders['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains; preload');
  });
});
