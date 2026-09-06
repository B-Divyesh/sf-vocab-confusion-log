import { expect, test } from '@playwright/test';
import axeCore from 'axe-core';

async function addPair(page: import('@playwright/test').Page, wordA: string, wordB: string): Promise<void> {
  await page.getByRole('button', { name: /(?:Log a confusion|Add sample) pair/ }).first().click();
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
  await expect(page.getByRole('heading', { level: 1, name: 'Explore a sample confusion log' })).toBeVisible();
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
    '/demo/practice/': /Practice — Vocab Confusion Log/,
    '/demo/pairs/': /Pairs — Vocab Confusion Log/,
    '/demo/data/': /Data — Vocab Confusion Log/,
    '/log/': /Log — Vocab Confusion Log/,
    '/log/practice/': /Practice — Vocab Confusion Log/,
    '/log/pairs/': /Pairs — Vocab Confusion Log/,
    '/log/data/': /Data — Vocab Confusion Log/,
    '/privacy/': /Privacy — Vocab Confusion Log/,
    '/terms/': /Terms — Vocab Confusion Log/,
    '/404.html': /Page not found — Vocab Confusion Log/
  };
  for (const [path, title] of Object.entries(expectedTitles)) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://vocab-confusion-log.sociobot.in${path}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /^https:\/\/vocab-confusion-log\.sociobot\.in\//);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /vocab-confusion-log-social\.jpg$/);
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', /vocab-confusion-log-social\.jpg$/);
    await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute('content', /\S/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    expect(await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link').allTextContents()).toEqual(['Demo', 'My log', 'Privacy']);
    const descriptionLength = await page.locator('meta[name="description"]').getAttribute('content').then((value) => value?.length ?? 0);
    expect(descriptionLength).toBeLessThanOrEqual(155);
  }
  const routes = ['/', '/demo/', '/demo/practice/', '/demo/pairs/', '/demo/data/', '/log/', '/log/practice/', '/log/pairs/', '/log/data/', '/privacy/', '/terms/'];
  for (const path of [...routes, '/assets/vocab-confusion-log-social.jpg', '/icons/apple-touch-icon.png']) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const path of routes) expect(sitemap).toContain(`<loc>https://vocab-confusion-log.sociobot.in${path}</loc>`);
});

test('returns a designed 404 for an unknown path', async ({ page }) => {
  for (const path of ['/no-such-route', '/log/not-a-real-route', '/demo/not-a-real-route']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page).toHaveTitle('Page not found — Vocab Confusion Log');
    await expect(page.getByRole('heading', { level: 1, name: 'This page does not exist' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible();
  }
});

test('fits the phone viewport without hiding the first action', async ({ page }) => {
  await page.goto('/');
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  await expect(page.getByRole('link', { name: 'Try it with sample data' })).toBeInViewport();
  await page.goto('/demo/');
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeVisible();
  const samplePair = await page.getByText('affect', { exact: true }).boundingBox();
  expect(samplePair).not.toBeNull();
  expect(samplePair!.y + samplePair!.height).toBeLessThanOrEqual(page.viewportSize()!.height);

  for (const path of ['/', '/demo/', '/demo/data/', '/privacy/', '/terms/', '/404.html']) {
    await page.goto(path);
    const undersized = await page.locator('a[href], button, summary').evaluateAll((elements) => elements
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { label: element.textContent?.trim(), width: box.width, height: box.height };
      })
      .filter((box) => box.width < 44 || box.height < 44));
    expect(undersized, `${path} has undersized touch targets`).toEqual([]);
  }
});

test('handles invalid input, import errors, deletion cancel, and dialog focus', async ({ page }) => {
  await page.goto('/log/');
  const addButton = page.getByRole('button', { name: 'Log a confusion pair' }).first();
  await addButton.click();
  await expect(page.getByLabel('Word A *')).toBeFocused();
  await page.getByLabel('Word A *').fill('   ');
  await page.getByLabel('Word B *').fill('effect');
  await page.getByLabel('Contrast cue *').fill('   ');
  await page.getByRole('button', { name: 'Add to log' }).click();
  await expect(page.getByText('Enter Word A. Spaces alone do not count.')).toBeVisible();
  await expect(page.getByLabel('Word A *')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Word A *')).toBeFocused();
  await page.getByLabel('Word A *').fill('affect');
  await page.getByRole('button', { name: 'Add to log' }).click();
  await expect(page.getByText('Add a contrast cue. Spaces alone do not count.')).toBeVisible();
  await expect(page.getByLabel('Contrast cue *')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Contrast cue *')).toBeFocused();
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
