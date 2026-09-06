import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type StoredPair = {
  id: string;
  wordA: string;
  wordB: string;
  contrast: string;
  mnemonic: string;
  language: string;
  createdAt: number;
  updatedAt: number;
  dueAt: number;
  cleanStreak: number;
  resolvedAt?: number;
  lastMode?: 'text-audio' | 'audio-text';
};

async function demoPair(page: import('@playwright/test').Page, id = 'demo-affect-effect'): Promise<StoredPair> {
  return page.evaluate(async (pairId) => new Promise<StoredPair>((resolvePair, reject) => {
    const request = indexedDB.open('demo:vocab-confusion-log');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const pairRequest = request.result.transaction('pairs').objectStore('pairs').get(pairId);
      pairRequest.onerror = () => reject(pairRequest.error);
      pairRequest.onsuccess = () => resolvePair(pairRequest.result as StoredPair);
    };
  }), id);
}

async function makeDemoPairDue(page: import('@playwright/test').Page, id = 'demo-affect-effect'): Promise<void> {
  await page.evaluate(async (pairId) => new Promise<void>((resolveUpdate, reject) => {
    const request = indexedDB.open('demo:vocab-confusion-log');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('pairs', 'readwrite');
      const store = transaction.objectStore('pairs');
      const pairRequest = store.get(pairId);
      pairRequest.onsuccess = () => store.put({ ...pairRequest.result, dueAt: Date.now() - 1 });
      transaction.oncomplete = () => resolveUpdate();
      transaction.onerror = () => reject(transaction.error);
    };
  }), id);
}

async function addActiveFixtures(page: import('@playwright/test').Page, count: number): Promise<void> {
  await page.evaluate(async (fixtureCount) => new Promise<void>((resolveWrite, reject) => {
    const request = indexedDB.open('demo:vocab-confusion-log');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('pairs', 'readwrite');
      const store = transaction.objectStore('pairs');
      const now = Date.now();
      for (let index = 0; index < fixtureCount; index += 1) {
        store.put({
          id: `claim-pair-${index}`, wordA: `word${index}`, wordB: `term${index}`,
          contrast: `word${index} and term${index} have different uses.`, mnemonic: '', language: 'English',
          createdAt: now, updatedAt: now, dueAt: now + 86_400_000, cleanStreak: 0
        });
      }
      transaction.oncomplete = () => resolveWrite();
      transaction.onerror = () => reject(transaction.error);
    };
  }), count);
}

test('@claim:offline-reload works offline after the first demo visit', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/demo/');
    await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Practise the words you mix up' })).toBeVisible();
    await expect(page.getByText(/Offline — logging/)).toBeVisible();
    await expect(page.getByText('affect', { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('@claim:recordings-local stores a recorded reference inside the demo database', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Log a confusion pair' }).click();
  await page.getByLabel('Word A *').fill('ship');
  await page.getByLabel('Word B *').fill('sheep');
  await page.getByLabel('Contrast cue *').fill('Ship has a short vowel; sheep has a long vowel.');
  await page.getByRole('button', { name: 'Record', exact: true }).first().click();
  await expect(page.getByText('Recording now…')).toBeVisible();
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByText(/Recording saved locally/)).toBeVisible();
  await page.getByRole('button', { name: 'Add to log' }).click();
  const storedBytes = await page.evaluate(async () => new Promise<number>((resolveBytes, reject) => {
    const request = indexedDB.open('demo:vocab-confusion-log');
    request.onsuccess = () => {
      const all = request.result.transaction('pairs').objectStore('pairs').getAll();
      all.onsuccess = () => resolveBytes((all.result.find((pair) => pair.wordA === 'ship')?.audioA as Blob | undefined)?.size ?? 0);
      all.onerror = () => reject(all.error);
    };
    request.onerror = () => reject(request.error);
  }));
  expect(storedBytes).toBeGreaterThan(0);
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:ordinary-use-local sends no demo data to another origin', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo/');
  await page.getByRole('link', { name: /Practice/ }).click();
  await page.getByLabel('Write the word').fill('effect');
  await page.getByRole('button', { name: 'Check spelling' }).click();
  await expect(page.getByText(/recording was effect/i)).toBeVisible();
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:no-analytics creates no tracking request or cookie during the demo', async ({ page }) => {
  const outgoing: string[] = [];
  await page.addInitScript(() => {
    const sent: string[] = [];
    Object.defineProperty(window, '__sentBeacons', { value: sent });
    navigator.sendBeacon = ((url: string | URL) => { sent.push(String(url)); return true; }) as typeof navigator.sendBeacon;
  });
  page.on('request', (request) => outgoing.push(request.url()));
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('link', { name: 'Pairs', exact: true }).click();
  const evidence = await page.evaluate(() => ({ cookies: document.cookie, beacons: (window as typeof window & { __sentBeacons: string[] }).__sentBeacons }));
  expect(evidence.cookies).toBe('');
  expect(evidence.beacons).toEqual([]);
  expect(outgoing.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:alternating-practice switches from audio-to-text to text-to-audio', async ({ page }) => {
  await page.goto('/demo/practice/');
  await expect(page.getByRole('heading', { level: 1, name: 'Listen, then write' })).toBeVisible();
  await page.getByLabel('Write the word').fill('effect');
  await page.getByRole('button', { name: 'Check spelling' }).click();
  await expect(page.getByText(/recording was effect/i)).toBeVisible();
  await makeDemoPairDue(page);
  await page.goto('/demo/practice/');
  await expect(page.getByRole('heading', { level: 1, name: 'Read, then say' })).toBeVisible();
});

test('@claim:three-delayed-attempts resolves only after three scheduled correct attempts', async ({ page }) => {
  await page.goto('/demo/practice/');
  await page.getByLabel('Write the word').fill('effect');
  await page.getByRole('button', { name: 'Check spelling' }).click();
  expect((await demoPair(page)).cleanStreak).toBe(1);
  expect((await demoPair(page)).dueAt).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);

  await makeDemoPairDue(page);
  await page.goto('/demo/practice/');
  await page.getByRole('button', { name: 'Reveal reference' }).click();
  await page.getByRole('button', { name: 'It came back clean' }).click();
  expect((await demoPair(page)).cleanStreak).toBe(2);
  expect((await demoPair(page)).dueAt).toBeGreaterThan(Date.now() + 71 * 60 * 60 * 1000);

  await makeDemoPairDue(page);
  await page.goto('/demo/practice/');
  await page.getByLabel('Write the word').fill('effect');
  await page.getByRole('button', { name: 'Check spelling' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'This pair is resolved' })).toBeVisible();
  expect((await demoPair(page)).resolvedAt).toBeTruthy();
});

test('@claim:json-backup-restore exports and restores every sample pair and recording', async ({ page }) => {
  await page.goto('/demo/data/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up everything (JSON)' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const backupText = await readFile(downloadPath!, 'utf8');
  const backup = JSON.parse(backupText) as { pairs: Array<{ id: string; audioA?: string }>; attempts: unknown[] };
  expect(backup.pairs).toHaveLength(3);
  expect(backup.attempts).toHaveLength(4);
  expect(backup.pairs.find((pair) => pair.id === 'demo-affect-effect')?.audioA).toMatch(/^data:audio\/(?:x-)?wav;base64,/);

  await page.goto('/demo/pairs/');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-pair-card="demo-affect-effect"]').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('affect', { exact: true })).toHaveCount(0);
  await page.goto('/demo/data/');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-import]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await expect(page.getByText('Backup restored into this device.')).toBeVisible();
  await page.getByRole('link', { name: 'Pairs', exact: true }).click();
  await expect(page.getByText('affect', { exact: true })).toBeVisible();
});

test('@claim:resolved-csv exports one row for each resolved sample pair', async ({ page }) => {
  await page.goto('/demo/data/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export resolved pairs (CSV)' }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, 'utf8');
  const rows = csv.trim().split(/\r?\n/);
  expect(rows[0]).toBe('word_a,word_b,language,contrast_cue,mnemonic,resolved_at,clean_attempts,total_attempts');
  expect(rows).toHaveLength(2);
  expect(rows[1]).toContain('embarazada,embarrassed');
});

test('@claim:pwa-install-update installs the demo and activates a changed service worker', async ({ browser }) => {
  const swPath = resolve(process.cwd(), 'dist/sw.js');
  const original = await readFile(swPath, 'utf8');
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/demo/');
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const manifest = await page.evaluate(async () => fetch('/manifest.webmanifest').then((response) => response.json()) as Promise<{ display: string; icons: unknown[] }>);
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toHaveLength(3);

    await writeFile(swPath, `${original}\n// claim update ${Date.now()}\n`);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect(page.getByText('A fresh version is ready.')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Update now' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  } finally {
    await writeFile(swPath, original);
    await context.close();
  }
});

test('@claim:free-eight-pairs blocks a ninth active pair', async ({ page }) => {
  await page.goto('/demo/');
  await addActiveFixtures(page, 6);
  await page.reload();
  await expect(page.getByText('8', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Unlock more pairs' }).click();
  await expect(page).toHaveURL(/\/demo\/data\/$/);
  await expect(page.getByText('The free plan holds 8 active pairs. Resolve one or activate Pro.')).toBeVisible();
});

test('@claim:pro-unlimited accepts a valid license and allows more than eight active pairs', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/vocab-confusion-log/verify?license=claim-valid', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null })
  }));
  await page.goto('/demo/?license=claim-valid');
  await addActiveFixtures(page, 7);
  await page.reload();
  await page.getByRole('link', { name: /Data · Pro/ }).click();
  await expect(page.getByText('US$9', { exact: true })).toBeVisible();
  await expect(page.getByText(/Pro is active\. You have 9 active pairs with no cap/)).toBeVisible();
  await page.getByRole('link', { name: 'Log', exact: true }).click();
  await page.getByRole('button', { name: 'Log a confusion pair' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
