import type { LicenseVerdict } from './types';

const SLUG = 'vocab-confusion-log';
let storagePrefix = '';
const DAY = 24 * 60 * 60 * 1000;
export const BILLING_BASE = (import.meta.env.VITE_BILLING_BASE_URL || 'https://api.sociobot.in').replace(/\/$/, '');
export const CHECKOUT_URL = `${BILLING_BASE}/api/v1/products/${SLUG}/checkout`;
export const BILLING_AVAILABLE = import.meta.env.VITE_BILLING_AVAILABLE === 'true';

function tokenKey(): string {
  return `${storagePrefix}sb_license:${SLUG}`;
}

function verdictKey(): string {
  return `${tokenKey()}:verdict`;
}

export function setLicenseStoragePrefix(prefix: '' | 'demo:'): void {
  storagePrefix = prefix;
}

export function consumeReturnedLicense(): string | null {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('license');
  if (!token) return null;
  if (localStorage.getItem(tokenKey()) !== token) localStorage.removeItem(verdictKey());
  localStorage.setItem(tokenKey(), token);
  url.searchParams.delete('license');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return token;
}

export function storedToken(): string | null {
  return localStorage.getItem(tokenKey());
}

export function storeToken(token: string): void {
  const clean = token.trim();
  if (localStorage.getItem(tokenKey()) !== clean) localStorage.removeItem(verdictKey());
  localStorage.setItem(tokenKey(), clean);
}

export function cachedVerdict(): LicenseVerdict | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(verdictKey()) ?? 'null') as LicenseVerdict | null;
    return parsed && typeof parsed.valid === 'boolean' && typeof parsed.checkedAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export function verificationDue(verdict: LicenseVerdict | null, now = Date.now()): boolean {
  return !verdict || now - verdict.checkedAt >= DAY;
}

export async function verifyLicense(token: string): Promise<LicenseVerdict> {
  try {
    const response = await fetch(`${BILLING_BASE}/api/v1/products/${SLUG}/verify?license=${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Verification returned ${response.status}.`);
    const data = await response.json() as { valid?: boolean; reason?: LicenseVerdict['reason']; expires_at?: string | null };
    const verdict: LicenseVerdict = {
      valid: data.valid === true,
      reason: data.reason ?? (data.valid ? 'ok' : 'invalid'),
      expires_at: data.expires_at,
      checkedAt: Date.now()
    };
    localStorage.setItem(verdictKey(), JSON.stringify(verdict));
    return verdict;
  } catch {
    return { valid: cachedVerdict()?.valid ?? false, reason: 'unreachable', checkedAt: Date.now() };
  }
}
