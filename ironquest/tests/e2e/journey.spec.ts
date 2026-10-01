import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { emptyState } from '../../src/game/types';

const SHOTS = process.env.SHOTS_DIR;
test.beforeEach(async ({ context }) => {
  // Keep tests hermetic: no external font requests.
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
});

async function shot(page: Page, name: string) {
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  }
}

test('full journey: onboarding → log → claim → packs → squad → persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  let levelUps = 0;
  await page.addLocatorHandler(page.getByTestId('levelup'), async () => {
    levelUps++;
    await page.getByRole('button', { name: 'Onward!' }).click();
  });

  // Start from a blank save regardless of what other specs left on the server.
  await page.request.put('/api/state', { data: emptyState() });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('hero-name').fill('Joey');
  await shot(page, '01-onboarding');
  await page.getByTestId('next').click();
  await page.getByTestId('age').fill('32');
  await page.getByTestId('ft').fill('5');
  await page.getByTestId('in').fill('11');
  await page.getByTestId('weight').fill('225');
  await page.getByTestId('goal').fill('190');
  await page.getByTestId('next').click();
  await expect(page.getByTestId('target-cal')).toContainText('–');
  await page.getByTestId('begin').click();

  // Dashboard
  await expect(page.getByTestId('char-level')).toContainText('Lv 1');
  await expect(page.getByTestId('coins')).toContainText('300');
  await shot(page, '02-dashboard-new');

  // Open starter packs
  await page.getByTestId('go-open-packs').click();
  await page.getByTestId('open-silver').click();
  await expect(page.getByTestId('pack-reveal')).toBeVisible();
  await page.getByTestId('flip-0').click();
  await page.getByTestId('reveal-all').click();
  await shot(page, '03-pack-reveal');
  await page.getByTestId('reveal-done').click();
  await page.getByTestId('open-bronze').click();
  await page.getByTestId('reveal-all').click();
  await page.getByTestId('reveal-done').click();

  // Log food via search
  await page.locator('a[href="/food"]').first().click();
  await page.getByTestId('food-search').fill('chicken breast');
  await page.getByTestId('result-Chicken breast, cooked').click();
  await page.getByTestId('servings').fill('2');
  await page.getByTestId('add-picked').click();
  await expect(page.getByTestId('protein-total')).toHaveText('106');
  // Quick add with save to My Foods
  await page.getByTestId('qa-name').fill('Protein shake');
  await page.getByTestId('qa-cal').fill('160');
  await page.getByTestId('qa-protein').fill('30');
  await page.getByTestId('qa-add').click();
  await page.getByTestId('food-search').fill('greek');
  await page.getByTestId('result-Greek yogurt, nonfat plain').click();
  await page.getByTestId('servings').fill('2');
  await page.getByTestId('add-picked').click();
  await expect(page.getByTestId('food-entry')).toHaveCount(3);
  // Eating too little shouldn't count — we're under the healthy minimum right now
  await page.getByTestId('qa-name').fill('Steak dinner');
  await page.getByTestId('qa-cal').fill('1100');
  await page.getByTestId('qa-protein').fill('60');
  await page.getByTestId('qa-add').click();
  await expect(page.getByTestId('food-entry')).toHaveCount(4);
  const protein = Number(await page.getByTestId('protein-total').textContent());
  expect(protein).toBeGreaterThanOrEqual(182);
  await shot(page, '04-food');

  // Training: add bench with 3 sets
  await page.locator('a[href="/train"]').first().click();
  await page.getByTestId('exercise-pick').selectOption('bench');
  await page.getByTestId('add-exercise').click();
  await page.getByTestId('set-weight').first().fill('135');
  await page.getByTestId('set-reps').first().fill('10');
  await page.getByTestId('add-set').click();
  await page.getByTestId('add-set').click();
  await expect(page.getByTestId('set-reps')).toHaveCount(3);
  await page.getByTestId('cardio-min').fill('25');
  await page.getByTestId('add-cardio').click();
  await page.getByTestId('weigh-input').fill('224');
  await page.getByTestId('steps-input').click();
  await shot(page, '05-train');

  // Dashboard: protein quest done, active quest done → claim all
  await page.locator('a[href="/"]').first().click();
  await expect(page.locator('[data-testid$=":protein"]').first()).toHaveClass(/done/);
  await shot(page, '06-dashboard-progress');
  await page.getByTestId('claim-all').first().click();
  const coins = Number((await page.getByTestId('coins').textContent())!.replace(/[^0-9]/g, ''));
  expect(coins).toBeGreaterThan(300);
  await expect(page.getByTestId('char-level')).not.toHaveText('Lv 1');
  expect(levelUps).toBeGreaterThan(0);

  // Seal the day — calorie quest should then be claimable
  await page.getByTestId('seal-day').click();
  await expect(page.locator('[data-testid$=":calories"]').first()).toHaveClass(/done/);

  // Squad: put a card in slot 0
  await page.locator('a[href="/cards"]').first().click();
  await page.getByTestId('slot-0').click();
  await page.locator('.modal .tcg').first().click();
  await expect(page.locator('.squad .tcg')).toHaveCount(1);
  await shot(page, '07-cards');

  // Visit remaining pages for render errors
  for (const path of ['/quests', '/rewards', '/store', '/hero', '/progress', '/settings']) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await shot(page, `08-${path.slice(1)}`);
  }
  await page.goto('/quests');
  await page.getByTestId('raid-tab').click();
  await expect(page.getByTestId('boss')).toBeVisible();

  // Persistence: wait for server save, wipe local storage, reload
  await page.waitForTimeout(800);
  const res = await page.request.get('/api/state');
  expect(res.ok()).toBe(true);
  const saved = await res.json();
  expect(saved.profile.heroName).toBe('Joey');
  expect(saved.foods.length).toBe(4);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/food');
  await expect(page.getByTestId('food-entry')).toHaveCount(4);

  expect(errors).toEqual([]);
});

test('mobile layout renders without horizontal scroll', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('/');
  for (const path of ['/', '/food', '/train', '/cards', '/hero']) {
    await page.goto(path);
    await expect(page.locator('h1, h2').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    await shot(page, `m-${path === '/' ? 'home' : path.slice(1)}`);
  }
  await ctx.close();
});
