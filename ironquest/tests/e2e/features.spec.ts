import { test, expect } from '@playwright/test';
import { simulate } from '../unit/sim';
import { addDays, todayKey } from '../../src/lib/dates';

test.beforeEach(async ({ context }) => {
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
});

test('polish features on a seasoned save', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addLocatorHandler(page.getByTestId('levelup'), async () => {
    await page.getByRole('button', { name: 'Onward!' }).click();
  });

  // ~3 weeks of realistic history, created 20 days ago; give it some packs to open.
  const today = todayKey();
  const { s } = simulate(20, addDays(today, -20));
  const sealed = { ...s.sealed };
  delete sealed[addDays(today, -1)]; // forgot to seal yesterday
  const seeded = { ...s, sealed, packs: ['bronze', 'bronze', 'silver'], updatedAt: Date.now() };
  const put = await page.request.put('/api/state', { data: seeded });
  expect(put.ok()).toBe(true);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Yesterday was logged but not sealed → nudge on the dashboard
  await expect(page.getByTestId('seal-yesterday')).toBeVisible();
  await page.getByTestId('seal-yesterday').click();
  await expect(page.getByTestId('seal-yesterday')).toHaveCount(0);
  await expect(page.getByTestId('welcome')).toBeVisible();
  await page.getByRole('link', { name: 'Read the guide' }).click();
  await expect(page.getByRole('heading', { name: /How to Play/ })).toBeVisible();
  await page.goto('/');
  await expect(page.getByTestId('welcome')).toHaveCount(0);

  // Open all packs at once
  await page.goto('/store');
  await page.getByTestId('open-all').click();
  await expect(page.getByTestId('pack-reveal')).toContainText('3 packs opened');
  await page.getByTestId('reveal-all').click();
  await page.getByTestId('reveal-done').click();

  // Auto squad fills 5 slots
  await page.goto('/cards');
  await page.getByTestId('auto-squad').click();
  await expect(page.locator('.squad .tcg')).toHaveCount(5);

  // Food: log, edit servings, save meal, undo delete
  await page.goto('/food');
  await page.getByTestId('food-search').fill('egg whites');
  await page.getByTestId('result-Egg whites').click();
  await page.getByTestId('add-picked').click();
  await page.getByTestId('food-search').fill('oatmeal');
  await page.getByTestId('result-Oatmeal, dry oats').click();
  await page.getByTestId('add-picked').click();
  await expect(page.getByTestId('food-entry')).toHaveCount(2);
  await page.getByTestId('food-entry').first().locator('.nm').click();
  await page.getByTestId('edit-servings').fill('2');
  await expect(page.getByTestId('edit-cal')).toHaveValue('250');
  await page.getByTestId('edit-save').click();
  await expect(page.getByTestId('cal-total')).toHaveText('400');
  const slot = await page.locator('[data-testid^="save-meal-"]').first().getAttribute('data-testid');
  await page.locator(`[data-testid="${slot}"]`).click();
  await page.getByTestId('save-meal-name').fill('Power breakfast');
  await page.getByTestId('save-meal-confirm').click();
  await page.getByTestId('food-search').fill('power');
  await expect(page.getByTestId('result-Power breakfast')).toBeVisible();
  await page.getByTestId('food-search').fill('');
  await page.getByRole('button', { name: /Remove Oatmeal/ }).click();
  await expect(page.getByTestId('food-entry')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('food-entry')).toHaveCount(2);

  // Training: custom exercise + rest timer + waist
  await page.goto('/train');
  await page.getByTestId('exercise-pick').selectOption('__custom');
  await page.getByTestId('custom-name').fill('Landmine Press');
  await page.getByTestId('custom-create').click();
  await expect(page.getByTestId('exercise').filter({ hasText: 'Landmine Press' })).toBeVisible();
  await page.getByTestId('start-rest').first().click();
  await expect(page.getByTestId('rest-timer')).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByTestId('waist-input').fill('38.5');
  await page.getByTestId('steps-input').click();

  // Progress: calendar + body log
  await page.goto('/progress');
  await expect(page.locator('.cal-cell').first()).toBeVisible();
  await expect(page.getByTestId('body-log-row').first()).toContainText('38.5 in');

  // Quests: weekly recap of last week
  await page.goto('/quests');
  await page.getByRole('button', { name: 'Weekly' }).click();
  await expect(page.getByTestId('weekly-recap')).toBeVisible();

  // Hero: waist achievement track exists
  await page.goto('/hero');
  await expect(page.getByText('Belt Notches')).toBeVisible();

  // Server archived the previous (different) hero when we seeded
  const saved = await (await page.request.get('/api/state')).json();
  expect(saved.customExercises[0].name).toBe('Landmine Press');
  expect(saved.measurements.some((m: { waist: number }) => m.waist === 38.5)).toBe(true);
  expect(errors).toEqual([]);
});
