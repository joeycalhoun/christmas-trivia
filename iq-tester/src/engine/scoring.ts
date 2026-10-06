import type { Difficulty, ItemResult, Question, Response, SectionId, TextMode } from './types';

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16',
  seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20', thirty: '30', forty: '40', fifty: '50',
};

export function normalizeText(value: string, mode: TextMode): string {
  const v = value.trim().toLowerCase();
  switch (mode) {
    case 'number': {
      const n = parseFloat(v.replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? String(n) : '';
    }
    case 'word':
      return v.replace(/[^a-z]/g, '');
    case 'sequence':
      return v.replace(/[^a-z0-9]/g, '');
    case 'phrase':
      return phraseWords(v).join(' ');
  }
}

function phraseWords(v: string): string[] {
  return v
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => NUMBER_WORDS[w] ?? w);
}

/** Longest common subsequence length, by word. */
function lcs(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

/** Credit for one response, from 0 to 1. */
export function scoreResponse(q: Question, r: Response): number {
  const a = q.answer;
  if (a.kind === 'choice' && r.kind === 'choice') return r.index === a.correct ? 1 : 0;
  if (a.kind === 'text' && r.kind === 'text') {
    const given = normalizeText(r.value, a.mode);
    if (!given) return 0;
    const ok = a.accept.map((x) => normalizeText(x, a.mode));
    if (ok.includes(given)) return 1;
    if (a.mode === 'phrase') {
      // One slip (a missing, extra or wrong word) earns half credit.
      const g = given.split(' ');
      const best = Math.max(...ok.map((x) => {
        const w = x.split(' ');
        return lcs(g, w) / Math.max(g.length, w.length);
      }));
      return best >= 0.85 ? 0.5 : 0;
    }
    return 0;
  }
  if ((a.kind === 'multi' && r.kind === 'multi') || (a.kind === 'grid' && r.kind === 'grid')) {
    const correct = new Set(a.kind === 'multi' ? a.correct : a.cells);
    const picked = new Set(r.kind === 'multi' ? r.indices : r.cells);
    let hits = 0;
    let falseAlarms = 0;
    picked.forEach((x) => (correct.has(x) ? hits++ : falseAlarms++));
    return Math.max(0, (hits - falseAlarms) / correct.size);
  }
  return 0;
}

export const WEIGHT: Record<Difficulty, number> = { 1: 1, 2: 1.5, 3: 2, 4: 2.5, 5: 3 };

/** Assumed population mean and spread of the weighted score fraction, used to place a score on the IQ scale. */
export const NORM = { mean: 0.52, sd: 0.18 };

export function weightedFraction(results: ItemResult[]): number {
  const total = results.reduce((s, r) => s + WEIGHT[r.difficulty], 0);
  if (total === 0) return 0;
  return results.reduce((s, r) => s + WEIGHT[r.difficulty] * r.credit, 0) / total;
}

export function toIQ(fraction: number): number {
  const iq = 100 + (15 * (fraction - NORM.mean)) / NORM.sd;
  return Math.round(Math.min(145, Math.max(55, iq)));
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function percentile(iq: number): number {
  return normalCdf((iq - 100) / 15) * 100;
}

export function classify(iq: number): string {
  if (iq >= 130) return 'Extremely high';
  if (iq >= 120) return 'Very high';
  if (iq >= 110) return 'High average';
  if (iq >= 90) return 'Average';
  if (iq >= 80) return 'Low average';
  if (iq >= 70) return 'Very low';
  return 'Extremely low';
}

export interface SectionScore {
  section: SectionId;
  items: number;
  credit: number;
  fraction: number;
}

export interface TestSummary {
  iq: number;
  low: number;
  high: number;
  percentile: number;
  band: string;
  fraction: number;
  correct: number;
  items: number;
  timedOut: number;
  seconds: number;
  sections: SectionScore[];
}

export function summarize(results: ItemResult[], order: SectionId[]): TestSummary {
  const fraction = weightedFraction(results);
  const iq = toIQ(fraction);
  // Fewer items, wider band: roughly ±6 on the full form, wider on the short one.
  const margin = Math.round(Math.min(15, 36 / Math.sqrt(Math.max(1, results.length))));
  const sections = order
    .map((section) => {
      const rs = results.filter((r) => r.section === section);
      const credit = rs.reduce((s, r) => s + r.credit, 0);
      return { section, items: rs.length, credit, fraction: rs.length ? weightedFraction(rs) : 0 };
    })
    .filter((s) => s.items > 0);
  return {
    iq,
    low: Math.max(55, iq - margin),
    high: Math.min(145, iq + margin),
    percentile: percentile(iq),
    band: classify(iq),
    fraction,
    correct: results.filter((r) => r.credit >= 1).length,
    items: results.length,
    timedOut: results.filter((r) => r.timedOut).length,
    seconds: results.reduce((s, r) => s + r.seconds, 0),
    sections,
  };
}
