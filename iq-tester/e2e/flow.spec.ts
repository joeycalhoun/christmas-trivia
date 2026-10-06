import { expect, test } from '@playwright/test';
import { runToResults, startTest } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('home page shows forms, sample item and subtests', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Six-Part IQ Test' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Full battery/ })).toContainText('35 items');
  await expect(page.getByRole('radio', { name: /Short form/ })).toContainText('14 items');
  await expect(page.getByRole('radio', { name: /Full battery/ })).toContainText('6 unseen forms left');
  await expect(page.locator('.sample .matrix-svg')).toBeVisible();
  await expect(page.locator('.subtests tbody tr')).toHaveCount(6);
});

test('a perfect short form scores at the top of the scale', async ({ page }) => {
  await startTest(page, 'Short form');
  const ids = await runToResults(page, 'perfect');
  expect(ids).toHaveLength(14);
  await expect(page.getByTestId('iq-score')).toHaveText('140');
  await expect(page.locator('.stats')).toContainText('14 / 14');
  await expect(page.locator('.review-status.st-good')).toHaveCount(14);
});

test('a perfect full battery scores at the top of the scale', async ({ page }) => {
  await startTest(page, 'Full battery');
  const ids = await runToResults(page, 'perfect');
  expect(ids).toHaveLength(35);
  await expect(page.getByTestId('iq-score')).toHaveText('140');
  await expect(page.locator('.stats')).toContainText('35 / 35');
});

test('skipping everything gives the floor score and is saved to history', async ({ page }) => {
  await startTest(page, 'Short form');
  await runToResults(page, 'skip');
  await expect(page.getByTestId('iq-score')).toHaveText('57');
  await expect(page.locator('.review-status', { hasText: 'Skipped' })).toHaveCount(14);
  await page.getByRole('button', { name: 'Back to start' }).click();
  await expect(page.locator('.history tbody tr')).toHaveCount(1);
  await expect(page.locator('.history tbody tr').first()).toContainText('57');
});

test('retakes use different items until the alternate forms run out', async ({ page }) => {
  const seen = new Set<string>();
  for (let take = 0; take < 3; take++) {
    await startTest(page, 'Short form');
    const ids = await runToResults(page, 'skip');
    for (const id of ids) {
      expect(seen.has(id), `item ${id} repeated on take ${take + 1}`).toBe(false);
      seen.add(id);
    }
    await page.getByRole('button', { name: 'Back to start' }).click();
  }
  await expect(page.getByRole('radio', { name: /Short form/ })).toContainText('3 unseen forms left');
  await expect(page.locator('.history tbody tr')).toHaveCount(3);
});

test('quitting needs confirmation and returns home', async ({ page }) => {
  await startTest(page, 'Short form');
  await page.getByRole('button', { name: 'Quit test' }).click();
  await page.getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByRole('button', { name: 'Begin subtest' })).toBeVisible();
  await page.getByRole('button', { name: 'Quit test' }).click();
  await page.getByRole('button', { name: 'Quit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Six-Part IQ Test' })).toBeVisible();
});
