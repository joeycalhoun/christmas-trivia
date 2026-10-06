import { expect, type Page } from '@playwright/test';
import type { Question } from '../src/engine/types';

export type Strategy = 'perfect' | 'skip';

const answerCard = (page: Page) => page.locator('.q-card:not(.memorize)');

async function currentQuestion(page: Page): Promise<Question> {
  const qid = await answerCard(page).getAttribute('data-qid');
  await page.waitForFunction((id) => (window as any).__iqDebug?.question?.id === id, qid);
  return page.evaluate(() => (window as any).__iqDebug.question as Question);
}

/** Answer the item on screen, either correctly or by skipping. Returns its id. */
export async function answerItem(page: Page, strategy: Strategy): Promise<string> {
  const q = await currentQuestion(page);
  if (strategy === 'skip') {
    await answerCard(page).getByRole('button', { name: 'Skip' }).click();
    return q.id;
  }
  const a = q.answer;
  if (a.kind === 'choice') await page.locator('.choice').nth(a.correct).click();
  if (a.kind === 'text') await page.locator('#answer-text').fill(a.accept[0]);
  if (a.kind === 'multi') for (const i of a.correct) await page.locator('.word-chip').nth(i).click();
  if (a.kind === 'grid') for (const i of a.cells) await page.locator('.grid-board .grid-sq').nth(i).click();
  await page.getByRole('button', { name: 'Submit answer' }).click();
  return q.id;
}

/** Drive the test from the current screen to the results page. Returns item ids in order. */
export async function runToResults(page: Page, strategy: Strategy): Promise<string[]> {
  const ids: string[] = [];
  let last = '';
  for (let guard = 0; guard < 200; guard++) {
    const state = await Promise.race([
      page.getByRole('heading', { name: 'Your results' }).waitFor().then(() => 'results'),
      page.getByRole('button', { name: 'Begin subtest' }).waitFor().then(() => 'intro'),
      page.locator('.memorize').waitFor().then(() => 'memorize'),
      page.locator(`.q-card:not(.memorize):not([data-qid="${last}"])`).waitFor().then(() => 'answer'),
    ]);
    if (state === 'results') return ids;
    if (state === 'intro') await page.getByRole('button', { name: 'Begin subtest' }).click();
    else if (state === 'memorize') {
      await expect(page.getByTestId('stimulus')).toBeVisible();
      await page.getByRole('button', { name: "I'm ready, hide it" }).click();
    } else {
      last = await answerItem(page, strategy);
      ids.push(last);
    }
  }
  throw new Error('Test did not finish');
}

export async function startTest(page: Page, form: 'Full battery' | 'Short form') {
  await page.getByRole('radio', { name: new RegExp(form) }).click();
  await page.getByRole('button', { name: /^Start / }).click();
}
