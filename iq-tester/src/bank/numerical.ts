import type { Difficulty, Question, Slot } from '../engine/types';
import { handSlot } from './hand';

/** A number-series rule: produces the first n terms and explains itself. */
interface SeriesSpec {
  terms: (n: number) => number[];
  rule: string;
}

const arith = (a: number, d: number): SeriesSpec => ({
  terms: (n) => Array.from({ length: n }, (_, i) => a + d * i),
  rule: d > 0 ? `Add ${d} each time.` : `Subtract ${-d} each time.`,
});

const geom = (a: number, r: number): SeriesSpec => ({
  terms: (n) => Array.from({ length: n }, (_, i) => a * r ** i),
  rule: `Multiply by ${r} each time.`,
});

/** t[i+1] = t[i] * m + c */
const affine = (a: number, m: number, c: number): SeriesSpec => ({
  terms: (n) => {
    const t = [a];
    while (t.length < n) t.push(t[t.length - 1] * m + c);
    return t;
  },
  rule: `Multiply by ${m}, then ${c >= 0 ? `add ${c}` : `subtract ${-c}`}.`,
});

/** Differences form their own arithmetic series: d, d+s, d+2s, ... */
const secondOrder = (a: number, d: number, s: number): SeriesSpec => ({
  terms: (n) => {
    const t = [a];
    for (let i = 0; t.length < n; i++) t.push(t[t.length - 1] + d + s * i);
    return t;
  },
  rule: `The gaps grow by ${s} each time (+${d}, +${d + s}, +${d + 2 * s}, …).`,
});

/** Differences double: d, 2d, 4d, ... */
const doublingGaps = (a: number, d: number): SeriesSpec => ({
  terms: (n) => {
    const t = [a];
    for (let g = d; t.length < n; g *= 2) t.push(t[t.length - 1] + g);
    return t;
  },
  rule: `The gaps double each time (+${d}, +${2 * d}, +${4 * d}, …).`,
});

/** Alternate between two operations. */
const alternating = (a: number, ops: [(x: number) => number, (x: number) => number], rule: string): SeriesSpec => ({
  terms: (n) => {
    const t = [a];
    for (let i = 0; t.length < n; i++) t.push(ops[i % 2](t[t.length - 1]));
    return t;
  },
  rule,
});

/** Two arithmetic series interleaved. */
const interleaved = (a: number, da: number, b: number, db: number): SeriesSpec => ({
  terms: (n) => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? a + da * (i / 2) : b + db * ((i - 1) / 2))),
  rule: `Two series are interleaved: one starts at ${a} and ${da >= 0 ? 'adds' : 'subtracts'} ${Math.abs(da)}, the other starts at ${b} and ${db >= 0 ? 'adds' : 'subtracts'} ${Math.abs(db)}.`,
});

const fibLike = (a: number, b: number): SeriesSpec => ({
  terms: (n) => {
    const t = [a, b];
    while (t.length < n) t.push(t[t.length - 1] + t[t.length - 2]);
    return t;
  },
  rule: 'Each number is the sum of the two before it.',
});

const poly = (f: (k: number) => number, start: number, rule: string): SeriesSpec => ({
  terms: (n) => Array.from({ length: n }, (_, i) => f(start + i)),
  rule,
});

function seriesSlot(id: string, difficulty: Difficulty, timeLimit: number, shown: number, specs: SeriesSpec[], quick = false): Slot {
  return {
    id,
    section: 'numerical',
    difficulty,
    variants: specs.length,
    quick,
    build(variant): Question {
      const spec = specs[variant];
      const all = spec.terms(shown + 1);
      const answer = all[shown];
      return {
        id: `${id}#${variant}`,
        slotId: id,
        variant,
        section: 'numerical',
        difficulty,
        title: 'Number series',
        prompt: `What number comes next?\n${all.slice(0, shown).join(',  ')},  ?`,
        timeLimit,
        answer: { kind: 'text', accept: [String(answer)], mode: 'number', placeholder: 'Next number' },
        explanation: `${spec.rule} The next number is ${answer}.`,
      };
    },
  };
}

export const seriesSpecs = {
  easy: [arith(3, 7), arith(50, -6), geom(2, 3), arith(11, 9), geom(3, 2), arith(100, -13)],
  medium: [
    secondOrder(2, 1, 1),
    poly((k) => k * k + 1, 1, 'Each number is a square plus one (1²+1, 2²+1, 3²+1, …).'),
    alternating(1, [(x) => x + 3, (x) => x * 2], 'Alternate: add 3, then multiply by 2.'),
    affine(1, 2, 1),
    secondOrder(3, 2, 2),
    interleaved(2, 2, 20, -3),
  ],
  hard: [
    fibLike(3, 4),
    poly((k) => k ** 3, 1, 'These are the cubes 1³, 2³, 3³, …'),
    doublingGaps(2, 1),
    affine(2, 3, -2),
    alternating(5, [(x) => x * 2, (x) => x - 3], 'Alternate: multiply by 2, then subtract 3.'),
    poly((k) => k * (k + 1), 1, 'Each number is n × (n + 1): 1×2, 2×3, 3×4, …'),
  ],
};

export const numericalSlots: Slot[] = [
  seriesSlot('numerical.series-1', 2, 40, 5, seriesSpecs.easy, true),
  seriesSlot('numerical.series-2', 3, 50, 5, seriesSpecs.medium, true),
  seriesSlot('numerical.series-3', 4, 60, 6, seriesSpecs.hard),
  handSlot({
    id: 'numerical.word-1',
    section: 'numerical',
    difficulty: 2,
    title: 'Word problem',
    timeLimit: 60,
    quick: true,
    mode: 'number',
    placeholder: 'Answer',
    items: [
      { prompt: 'A shirt costs $40 and is on sale for 25% off. What is the sale price, in dollars?', accept: ['30'], explanation: '25% of $40 is $10, so the sale price is $30.' },
      { prompt: 'A train travels 180 miles in 3 hours. At the same speed, how many miles does it travel in 5 hours?', accept: ['300'], explanation: 'The speed is 60 mph, and 60 × 5 = 300 miles.' },
      { prompt: 'Sam has 3 times as many marbles as Ana. Together they have 48. How many marbles does Sam have?', accept: ['36'], explanation: 'Ana has x and Sam 3x, so 4x = 48, x = 12 and Sam has 36.' },
      { prompt: 'A recipe uses 3 eggs for every 2 cups of flour. How many eggs are needed for 8 cups of flour?', accept: ['12'], explanation: '8 cups is 4 batches of 2 cups, and 4 × 3 = 12 eggs.' },
      { prompt: 'If 5 notebooks cost $12.50, how many dollars do 8 notebooks cost?', accept: ['20'], explanation: 'One notebook costs $2.50, and 8 × $2.50 = $20.' },
      { prompt: 'A rectangle is 12 cm long and has a perimeter of 40 cm. What is its width, in cm?', accept: ['8'], explanation: 'Two lengths make 24 cm, leaving 16 cm for two widths, so each width is 8 cm.' },
    ],
  }),
  handSlot({
    id: 'numerical.word-2',
    section: 'numerical',
    difficulty: 3,
    title: 'Word problem',
    timeLimit: 75,
    mode: 'number',
    placeholder: 'Answer',
    items: [
      { prompt: 'A price rises by 20% and then falls by 20%. The final price is $96. What was the original price, in dollars?', accept: ['100'], explanation: '×1.2 then ×0.8 is ×0.96 overall, and 96 ÷ 0.96 = 100.' },
      { prompt: 'The average of five numbers is 18. Four of them are 12, 15, 20 and 25. What is the fifth number?', accept: ['18'], explanation: 'The five numbers sum to 5 × 18 = 90. The four given sum to 72, so the fifth is 18.' },
      { prompt: 'Pipe A fills a tank in 6 hours. Pipe B fills it in 3 hours. How many hours do both pipes together take?', accept: ['2'], explanation: 'Together they fill 1/6 + 1/3 = 1/2 of the tank per hour, so it takes 2 hours.' },
      { prompt: 'A class of 40 students has boys and girls in the ratio 3 : 5. How many more girls than boys are there?', accept: ['10'], explanation: 'There are 15 boys and 25 girls, a difference of 10.' },
      { prompt: 'A car uses 8 litres of fuel per 100 km. How many litres does it use on a 350 km trip?', accept: ['28'], explanation: '3.5 × 8 = 28 litres.' },
      { prompt: 'A worker earns $15 an hour for the first 40 hours of a week and 1.5 times that rate for every hour after. How many dollars do they earn for a 46-hour week?', accept: ['735'], explanation: '40 × $15 = $600, plus 6 overtime hours × $22.50 = $135, for $735.' },
    ],
  }),
  handSlot({
    id: 'numerical.word-3',
    section: 'numerical',
    difficulty: 4,
    title: 'Word problem',
    timeLimit: 90,
    mode: 'number',
    placeholder: 'Answer',
    items: [
      { prompt: 'Anna is twice as old as Ben. In 10 years, Anna will be 1.5 times as old as Ben. How old is Ben now?', accept: ['10'], explanation: 'With A = 2B: 2B + 10 = 1.5(B + 10), so 0.5B = 5 and B = 10.' },
      { prompt: '3 workers build 3 walls in 3 days. Working at the same rate, how many days do 6 workers need to build 6 walls?', accept: ['3'], explanation: 'Each worker builds one wall in 3 days, so 6 workers build 6 walls in 3 days.' },
      { prompt: 'Two trains start 300 km apart and travel toward each other at 70 km/h and 80 km/h. After how many hours do they meet?', accept: ['2'], explanation: 'They close the gap at 150 km/h, and 300 ÷ 150 = 2 hours.' },
      { prompt: 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How many cents does the ball cost?', accept: ['5'], explanation: 'Ball = x, bat = x + 100 cents, so 2x + 100 = 110 and x = 5 cents.' },
      { prompt: 'In a group of 30 people, 18 like tea, 15 like coffee, and 5 like neither. How many like both?', accept: ['8'], explanation: '25 people like at least one drink. 18 + 15 − 25 = 8 like both.' },
      { prompt: 'A snail at the bottom of a 10 m well climbs 3 m each day and slips back 2 m each night. On which day does it reach the top?', accept: ['8'], explanation: 'After 7 days and nights it is at 7 m. On day 8 it climbs 3 m and reaches 10 m.' },
    ],
  }),
];
