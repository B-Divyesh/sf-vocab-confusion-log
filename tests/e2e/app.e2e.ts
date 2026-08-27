import { expect, test } from '@playwright/test';
import axeCore from 'axe-core';

test('logs a confusion and completes the first production route', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Vocab Confusion Log' })).toBeVisible();
  await page.getByRole('button', { name: 'Log a confusion' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Word A *').fill('affect');
  await page.getByLabel('Word B *').fill('effect');
  await page.getByLabel('Contrast cue *').fill('Affect is usually an action; effect is usually a result.');
  await page.getByLabel('Your mnemonic Optional').fill('A for action.');
  await page.getByRole('button', { name: 'Add to repair desk' }).click();

  await expect(page.getByText('affect', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Practice/ }).click();
  await expect(page.getByRole('heading', { name: 'Read, then say.' })).toBeVisible();
  await expect(page.getByText('effect', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal reference' }).click();
  await page.getByRole('button', { name: 'It came back clean' }).click();
  await expect(page.getByRole('heading', { name: '1 of 3 clean.' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish this round' }).click();
  await expect(page.getByText('Due in 1 day')).toBeVisible();
});

test('has no serious accessibility violations on the empty desk', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.addScriptTag({ content: axeCore.source });
  const results = await page.evaluate(async () => {
    const axe = (window as typeof window & { axe: { run: () => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe;
    return axe.run();
  });
  const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious).toEqual([]);
});

test('reloads the installed shell while offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Vocab Confusion Log' })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.waitForFunction(async () => {
    const names = await caches.keys();
    const entries = await Promise.all(names.map(async (name) => (await caches.open(name)).keys()));
    return entries.flat().some((request) => /\/assets\/app-.*\.js$/.test(new URL(request.url).pathname));
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Vocab Confusion Log' })).toBeVisible();
  await expect(page.getByText(/Offline — logging/)).toBeVisible();
});

test('fits the 390px mobile viewport and keeps the add flow operable', async ({ page }) => {
  await page.goto('/');
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  await page.getByRole('button', { name: 'Log a confusion' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to repair desk' })).toBeVisible();
});

test('serves direct privacy and terms pages', async ({ page }) => {
  await page.goto('/privacy/');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy, kept local.' })).toBeVisible();
  await page.goto('/terms/');
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use.' })).toBeVisible();
});
