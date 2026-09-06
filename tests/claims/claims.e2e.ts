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

async function makeDemoPairDue(page: import('@playwright/test').Page, id = 'demo-affect-effect', cleanStreak?: number): Promise<void> {
  await page.evaluate(async ({ pairId, streak }) => new Promise<void>((resolveUpdate, reject) => {
    const request = indexedDB.open('demo:vocab-confusion-log');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('pairs', 'readwrite');
      const store = transaction.objectStore('pairs');
      const pairRequest = store.get(pairId);
      pairRequest.onsuccess = () => store.put({
        ...pairRequest.result,
        dueAt: Date.now() - 1,
        ...(typeof streak === 'number' ? { cleanStreak: streak } : {})
      });
      transaction.oncomplete = () => resolveUpdate();
      transaction.onerror = () => reject(transaction.error);
    };
  }), { pairId: id, streak: cleanStreak });
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

async function activeWorkerVersion(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => new Promise<string>((resolveVersion, reject) => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      reject(new Error('No active service-worker controller.'));
      return;
    }
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => reject(new Error('The service worker did not report its version.')), 5_000);
    channel.port1.onmessage = (event: MessageEvent<{ version?: string }>) => {
      window.clearTimeout(timeout);
      resolveVersion(event.data.version ?? '');
    };
    controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  }));
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
    await expect(page.getByRole('heading', { level: 1, name: 'Explore a sample confusion log' })).toBeVisible();
    await expect(page.getByText(/Offline — logging/)).toBeVisible();
    await expect(page.getByText('affect', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Practice', exact: false }).click();
    await page.getByLabel('Write the word').fill('effect');
    await page.getByRole('button', { name: 'Check spelling' }).click();
    await expect(page.getByText(/recording was effect/i)).toBeVisible();
    expect((await demoPair(page)).cleanStreak).toBe(1);
    await page.goto(`/never-cached-${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'This page is not cached' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open the demo' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('@claim:recordings-local stores a recorded reference inside the demo database', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Add sample pair' }).click();
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
  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
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
  const origin = new URL(page.url()).origin;
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
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
  const origin = new URL(page.url()).origin;
  expect(outgoing.every((url) => new URL(url).origin === origin)).toBe(true);
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
  const firstResult = await demoPair(page);
  expect(firstResult.cleanStreak).toBe(1);
  expect(firstResult.dueAt).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
  expect(firstResult.dueAt).toBeLessThan(Date.now() + 25 * 60 * 60 * 1000);

  await makeDemoPairDue(page);
  await page.goto('/demo/practice/');
  await page.getByRole('button', { name: 'Reveal reference' }).click();
  await page.getByRole('button', { name: 'It came back clean' }).click();
  const secondResult = await demoPair(page);
  expect(secondResult.cleanStreak).toBe(2);
  expect(secondResult.dueAt).toBeGreaterThan(Date.now() + 71 * 60 * 60 * 1000);
  expect(secondResult.dueAt).toBeLessThan(Date.now() + 73 * 60 * 60 * 1000);

  await makeDemoPairDue(page);
  await page.goto('/demo/practice/');
  await page.getByLabel('Write the word').fill('effect');
  await page.getByRole('button', { name: 'Check spelling' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'This pair is resolved' })).toBeVisible();
  expect((await demoPair(page)).resolvedAt).toBeTruthy();
});

test('@claim:miss-ten-minutes resets the count and returns the pair in ten minutes', async ({ page }) => {
  await page.goto('/demo/');
  await expect(page.getByText('affect', { exact: true })).toBeVisible();
  await makeDemoPairDue(page, 'demo-affect-effect', 2);
  await page.goto('/demo/practice/');
  await page.getByLabel('Write the word').fill('wrong');
  await page.getByRole('button', { name: 'Check spelling' }).click();
  const result = await demoPair(page, 'demo-affect-effect');
  expect(result.cleanStreak).toBe(0);
  expect(result.dueAt).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
  expect(result.dueAt).toBeLessThan(Date.now() + 11 * 60 * 1000);
});

test('@claim:json-backup-restore exports and restores every sample pair and recording', async ({ page }) => {
  await page.goto('/demo/data/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up everything (JSON)' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const backupText = await readFile(downloadPath!, 'utf8');
  const backup = JSON.parse(backupText) as { pairs: Array<{ id: string; audioA?: string; audioB?: string }>; attempts: unknown[] };
  expect(backup.pairs).toHaveLength(3);
  expect(backup.attempts).toHaveLength(4);
  expect(backup.pairs.find((pair) => pair.id === 'demo-affect-effect')?.audioA).toMatch(/^data:audio\/(?:x-)?wav;base64,/);
  expect(backup.pairs.find((pair) => pair.id === 'demo-affect-effect')?.audioB).toMatch(/^data:audio\/(?:x-)?wav;base64,/);

  await page.evaluate(async () => new Promise<void>((resolveClear, reject) => {
    const request = indexedDB.open('demo:vocab-confusion-log');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction(['pairs', 'attempts'], 'readwrite');
      transaction.objectStore('pairs').clear();
      transaction.objectStore('attempts').clear();
      transaction.oncomplete = () => resolveClear();
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-import]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await expect(page.getByText('Backup restored into this device.')).toBeVisible();
  const restored = await page.evaluate(async () => new Promise<{ pairCount: number; attemptCount: number; audioA: number; audioB: number }>((resolveRestored, reject) => {
    const request = indexedDB.open('demo:vocab-confusion-log');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction(['pairs', 'attempts']);
      const pairsRequest = transaction.objectStore('pairs').getAll();
      const attemptsRequest = transaction.objectStore('attempts').getAll();
      transaction.oncomplete = () => {
        const affect = pairsRequest.result.find((pair) => pair.id === 'demo-affect-effect');
        resolveRestored({
          pairCount: pairsRequest.result.length,
          attemptCount: attemptsRequest.result.length,
          audioA: affect?.audioA?.size ?? 0,
          audioB: affect?.audioB?.size ?? 0
        });
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  expect(restored).toEqual({ pairCount: 3, attemptCount: 4, audioA: expect.any(Number), audioB: expect.any(Number) });
  expect(restored.audioA).toBeGreaterThan(0);
  expect(restored.audioB).toBeGreaterThan(0);
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
    const previousVersion = await activeWorkerVersion(page);
    const manifest = await page.evaluate(async () => fetch('/manifest.webmanifest').then((response) => response.json()) as Promise<{
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      theme_color: string;
      background_color: string;
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    }>);
    expect(manifest.name).toBe('Vocab Confusion Log');
    expect(manifest.short_name).toBe('Confusion Log');
    expect(manifest.start_url).toMatch(/^\/log\/\?.*v=\d+/);
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#F3E8CF');
    expect(manifest.background_color).toBe('#F3E8CF');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' })
    ]));
    for (const icon of manifest.icons) {
      expect((await page.request.get(icon.src)).status()).toBe(200);
    }

    const changedVersion = `${previousVersion}-claim-${Date.now()}`;
    await writeFile(swPath, original.replace(/const CACHE = '[^']+';/, `const CACHE = '${changedVersion}';`));
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect(page.getByText('A fresh version is ready.')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Update now' }).click();
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.state === 'activated' && !registration.waiting && !registration.installing;
    });
    await page.waitForLoadState('domcontentloaded');
    expect(await activeWorkerVersion(page)).toBe(changedVersion);
    await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  } finally {
    await writeFile(swPath, original);
    await context.close();
  }
});

test('@claim:free-eight-pairs blocks a ninth active pair', async ({ page }) => {
  await page.goto('/demo/');
  await addActiveFixtures(page, 5);
  await page.reload();
  await expect(page.getByText('7', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add sample pair' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Log a confusion pair' })).toBeVisible();
  await page.keyboard.press('Escape');
  await addActiveFixtures(page, 6);
  await page.reload();
  await expect(page.getByText('8', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Unlock more pairs' }).click();
  await expect(page).toHaveURL(/\/demo\/data\/$/);
  await expect(page.getByText('The free plan holds 8 active pairs. Resolve one or activate Pro.')).toBeVisible();

  const extraPair = {
    id: 'imported-ninth', wordA: 'accept', wordB: 'except',
    contrast: 'Accept means receive; except means exclude.', mnemonic: '', language: 'English',
    createdAt: Date.now(), updatedAt: Date.now(), dueAt: Date.now(), cleanStreak: 0
  };
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-import]').setInputFiles({
    name: 'over-limit.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'vocab-confusion-log', version: 1, exportedAt: new Date().toISOString(), pairs: [extraPair], attempts: [] }))
  });
  await expect(page.getByText('This restore would leave 9 active pairs. Free allows 8. Resolve or delete a pair, or restore Pro.')).toBeVisible();
  const imported = await page.evaluate(async () => new Promise<boolean>((resolveImported, reject) => {
    const request = indexedDB.open('demo:vocab-confusion-log');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const record = request.result.transaction('pairs').objectStore('pairs').get('imported-ninth');
      record.onerror = () => reject(record.error);
      record.onsuccess = () => resolveImported(Boolean(record.result));
    };
  }));
  expect(imported).toBe(false);
});

test('@claim:pro-unlimited accepts a valid license and allows more than eight active pairs', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/vocab-confusion-log/verify?license=claim-valid', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null })
  }));
  await page.goto('/demo/?license=claim-valid');
  await expect(page.getByText('affect', { exact: true })).toBeVisible();
  await addActiveFixtures(page, 7);
  await page.reload();
  await page.getByRole('link', { name: /Data · Pro/ }).click();
  await expect(page.getByText('US$9', { exact: true })).toBeVisible();
  await expect(page.getByText('one time', { exact: true })).toBeVisible();
  await expect(page.getByText(/Pro is active\. You have 9 active pairs with no cap/)).toBeVisible();
  const extraPair = {
    id: 'pro-imported-tenth', wordA: 'council', wordB: 'counsel',
    contrast: 'A council is a group; counsel is advice.', mnemonic: '', language: 'English',
    createdAt: Date.now(), updatedAt: Date.now(), dueAt: Date.now(), cleanStreak: 0
  };
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-import]').setInputFiles({
    name: 'pro-over-eight.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'vocab-confusion-log', version: 1, exportedAt: new Date().toISOString(), pairs: [extraPair], attempts: [] }))
  });
  await expect(page.getByText('Backup restored into this device.')).toBeVisible();
  await page.getByRole('link', { name: 'Log', exact: true }).click();
  await expect(page.getByText('10', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add sample pair' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('link', { name: 'Data', exact: true }).click();
  await expect(page.getByText('Free plan', { exact: true })).toBeVisible();
});
