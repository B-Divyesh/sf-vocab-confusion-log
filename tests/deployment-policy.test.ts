import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type StaticWebAppConfig = {
  globalHeaders: Record<string, string>;
  navigationFallback: { rewrite: string; exclude: string[] };
  routes: Array<{ route: string; headers: Record<string, string> }>;
};

const config = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../public/staticwebapp.config.json'), 'utf8')
) as StaticWebAppConfig;

const routeHeaders = (route: string) => config.routes.find((entry) => entry.route === route)?.headers;

describe('static deployment response policy', () => {
  it('ships an immutable one-year cache policy for fingerprinted build assets', () => {
    expect(routeHeaders('/assets/*')?.['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(config.navigationFallback.exclude).toContain('/assets/*');
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
});
