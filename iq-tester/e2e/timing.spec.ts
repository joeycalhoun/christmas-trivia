import { expect, test } from '@playwright/test';
import { answerItem, startTest } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('the answer clock moves on when time runs out', async ({ page }) => {
  await startTest(page, 'Short form');
  await page.getByRole('button', { name: 'Begin subtest' }).click();
  await expect(page.locator('.run-count')).toContainText('Item 1 / 14');
  const limit = await page.evaluate(() => (window as any).__iqDebug.question.timeLimit as number);
  await expect(page.getByRole('timer')).toContainText(`0:${String(limit).padStart(2, '0')}`);
  await page.clock.runFor((limit - 5) * 1000);
  await expect(page.locator('.run-count')).toContainText('Item 1 / 14');
  await expect(page.locator('.clock')).toHaveClass(/clock-low/);
  await page.clock.runFor(6000);
  await expect(page.locator('.run-count')).toContainText('Item 2 / 14');
});

test('relaxed timing gives one and a half times as long', async ({ page }) => {
  await page.getByLabel(/Relaxed/).check();
  await startTest(page, 'Short form');
  await page.getByRole('button', { name: 'Begin subtest' }).click();
  const limit = await page.evaluate(() => (window as any).__iqDebug.question.timeLimit as number);
  const relaxed = Math.round(limit * 1.5);
  await expect(page.getByRole('timer')).toContainText(`${Math.floor(relaxed / 60)}:${String(relaxed % 60).padStart(2, '0')}`);
  await expect(page.locator('.form-code')).toContainText('relaxed timing');
});

test('memory items show the stimulus for a limited time, then hide it', async ({ page }) => {
  await startTest(page, 'Short form');
  // Skip ahead to the working-memory subtest, which comes last.
  for (;;) {
    const begin = page.getByRole('button', { name: 'Begin subtest' });
    if (await begin.isVisible()) {
      const isMemory = await page.locator('.intro-card h2').textContent();
      await begin.click();
      if (isMemory?.includes('Working Memory')) break;
      continue;
    }
    const before = await page.locator('.q-card').getAttribute('data-qid');
    await answerItem(page, 'skip');
    await expect(page.locator(`.q-card[data-qid="${before}"]`)).toHaveCount(0);
  }
  await expect(page.locator('.memorize')).toBeVisible();
  await expect(page.getByTestId('stimulus')).toBeVisible();
  const text = await page.getByTestId('stimulus').innerText();
  expect(text.length).toBeGreaterThan(3);
  await page.clock.runFor(2000);
  await expect(page.getByTestId('stimulus')).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(page.getByTestId('stimulus')).toHaveCount(0);
  await expect(page.locator('.q-card:not(.memorize)')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(text);
});
