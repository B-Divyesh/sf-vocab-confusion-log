import { expect, test } from '@playwright/test';
import axeCore from 'axe-core';

async function addPair(page: import('@playwright/test').Page, wordA: string, wordB: string): Promise<void> {
  await page.getByRole('button', { name: 'Log a confusion pair' }).first().click();
  await page.getByLabel('Word A *').fill(wordA);
  await page.getByLabel('Word B *').fill(wordB);
  await page.getByLabel('Contrast cue *').fill(`${wordA} and ${wordB} are used in different contexts.`);
  await page.getByRole('button', { name: 'Add to log' }).click();
}

async function expectNoSeriousAxe(page: import('@playwright/test').Page): Promise<void> {
  await page.addScriptTag({ content: axeCore.source });
  const results = await page.evaluate(async () => {
    const axe = (window as typeof window & { axe: { run: () => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe;
    return axe.run();
  });
  expect(results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
}

test('states the job, audience, sample action, and facts before scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Vocab Confusion Log — practise confusing words');
  await expect(page.getByRole('heading', { level: 1, name: 'Practise the words you mix up' })).toBeVisible();
  await expect(page.getByText(/For language learners/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try it with sample data' })).toBeVisible();
  await expect(page.getByText('It works offline after your first visit.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('opens a populated demo in one click and resets it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await expect(page).toHaveURL(/\/demo\/$/);
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.getByText('affect', { exact: true })).toBeVisible();
  await expect(page.getByText('resolved', { exact: true })).toBeVisible();
  await addPair(page, 'principal', 'principle');
  await expect(page.getByText('principal', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('Sample data reset.')).toBeVisible();
  await expect(page.getByText('principal', { exact: true })).toHaveCount(0);
  await expect(page.getByText('affect', { exact: true })).toBeVisible();
});

test('keeps demo changes separate from real data and discards them on exit', async ({ page }) => {
  await page.goto('/log/');
  await addPair(page, 'stationary', 'stationery');
  await expect(page.getByText('stationary', { exact: true })).toBeVisible();

  await page.goto('/demo/');
  await expect(page.getByText('stationary', { exact: true })).toHaveCount(0);
  await addPair(page, 'principal', 'principle');
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page).toHaveURL(/\/log\/$/);
  await expect(page.getByText('stationary', { exact: true })).toBeVisible();
  await expect(page.getByText('principal', { exact: true })).toHaveCount(0);

  await page.goto('/demo/');
  await expect(page.getByText('principal', { exact: true })).toHaveCount(0);
  await expect(page.getByText('affect', { exact: true })).toBeVisible();
});

test('logs a pair and completes the first real practice', async ({ page }) => {
  await page.goto('/log/');
  await addPair(page, 'affect', 'effect');
  await page.getByRole('link', { name: /Practice/ }).click();
  await expect(page).toHaveURL(/\/log\/practice\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Read, then say' })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal reference' }).click();
  await page.getByRole('button', { name: 'It came back clean' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '1 of 3 correct' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish this round' }).click();
  await expect(page.getByText('Due in 1 day')).toBeVisible();
});

test('supports keyboard navigation, focus changes, and reduced motion', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.goto('/log/');
  await page.getByRole('link', { name: 'Pairs', exact: true }).click();
  await expect(page).toHaveURL(/\/log\/pairs\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Review your confusion pairs' })).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/log\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Practise the words you mix up' })).toBeFocused();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await page.getByRole('button', { name: 'Log a confusion pair' }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(['0.01ms', '1e-05s']).toContain(duration);
});

test('has no serious accessibility violations on public and product screens', async ({ page }) => {
  for (const path of ['/', '/demo/', '/demo/data/', '/privacy/', '/terms/', '/404.html']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expectNoSeriousAxe(page);
  }
});

test('serves route metadata and crawlable internal links', async ({ page, request }) => {
  const expectedTitles: Record<string, RegExp> = {
    '/': /Vocab Confusion Log — practise/,
    '/demo/': /Demo — Vocab Confusion Log/,
    '/log/': /Log — Vocab Confusion Log/,
    '/privacy/': /Privacy — Vocab Confusion Log/,
    '/terms/': /Terms — Vocab Confusion Log/
  };
  for (const [path, title] of Object.entries(expectedTitles)) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /vocab-confusion-log-social\.jpg$/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  }
  for (const path of ['/demo/', '/log/', '/privacy/', '/terms/', '/assets/vocab-confusion-log-social.jpg', '/icons/apple-touch-icon.png']) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});

test('returns a designed 404 for an unknown path', async ({ page }) => {
  const response = await page.goto('/no-such-route');
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle('Page not found — Vocab Confusion Log');
  await expect(page.getByRole('heading', { level: 1, name: 'This page does not exist' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible();
});

test('fits the phone viewport without hiding the first action', async ({ page }) => {
  await page.goto('/');
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  await expect(page.getByRole('link', { name: 'Try it with sample data' })).toBeInViewport();
  await page.goto('/demo/');
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeVisible();
});

test('handles invalid input, import errors, deletion cancel, and dialog focus', async ({ page }) => {
  await page.goto('/log/');
  const addButton = page.getByRole('button', { name: 'Log a confusion pair' }).first();
  await addButton.click();
  await expect(page.getByLabel('Word A *')).toBeFocused();
  await page.getByLabel('Word A *').fill('affect');
  await page.getByLabel('Word B *').fill('AFFECT');
  await page.getByLabel('Contrast cue *').fill('These entries are equal after case normalization.');
  await page.getByRole('button', { name: 'Add to log' }).click();
  await expect(page.getByText('The two words need to be different. Check the spelling and try again.')).toBeVisible();
  await expect(page.getByLabel('Word B *')).toBeFocused();
  await page.getByLabel('Word B *').fill('effect');
  await page.getByRole('button', { name: 'Add to log' }).click();

  await page.getByRole('button', { name: 'Log a confusion pair' }).click();
  await page.getByLabel('Word A *').fill('effect');
  await page.getByLabel('Word B *').fill('affect');
  await page.getByLabel('Contrast cue *').fill('This reversed pair already exists.');
  await page.getByRole('button', { name: 'Add to log' }).click();
  await expect(page.getByText(/already in your log/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Log a confusion pair' }).first()).toBeFocused();

  await page.getByRole('link', { name: 'Pairs', exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('affect', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Data', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-import]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"wrong":true}') });
  await expect(page.getByText('This is not a supported Vocab Confusion Log backup.')).toBeVisible();
});
