import type { Difficulty, Question, Slot } from '../engine/types';
import { type Rng, randInt, sample, seeded, shuffle } from '../engine/rng';
import { handSlot } from './hand';

const VARIANTS = 10;

/** Random digits with no immediate repeats and no runs of three consecutive digits. */
export function digitString(rng: Rng, n: number): string {
  const d: number[] = [];
  while (d.length < n) {
    const x = randInt(rng, 0, 9);
    const prev = d[d.length - 1];
    const prev2 = d[d.length - 2];
    if (x === prev) continue;
    if (prev !== undefined && prev2 !== undefined && Math.abs(x - prev) === 1 && x - prev === prev - prev2) continue;
    if (d.length === 0 && x === 0) continue;
    d.push(x);
  }
  return d.join('');
}

const spaced = (s: string) => s.split('').join(' ');

function generated(
  id: string,
  difficulty: Difficulty,
  quick: boolean,
  make: (rng: Rng) => Omit<Question, 'id' | 'slotId' | 'variant' | 'section' | 'difficulty'>,
): Slot {
  return {
    id,
    section: 'memory',
    difficulty,
    variants: VARIANTS,
    quick,
    build(variant) {
      return { id: `${id}#${variant}`, slotId: id, variant, section: 'memory', difficulty, ...make(seeded(id, variant)) };
    },
  };
}

export const WORD_POOL = [
  'apple', 'river', 'candle', 'mirror', 'tiger', 'button', 'rocket', 'garden', 'pencil', 'ladder',
  'castle', 'violin', 'anchor', 'blanket', 'cactus', 'dragon', 'engine', 'feather', 'glacier', 'hammer',
  'island', 'jacket', 'kettle', 'lemon', 'magnet', 'needle', 'orchid', 'parrot', 'saddle', 'tunnel',
  'umbrella', 'velvet', 'walnut', 'yogurt', 'zipper', 'bucket', 'canyon', 'dolphin', 'falcon', 'goblet',
  'harbor', 'jungle', 'lantern', 'meadow', 'napkin', 'oyster', 'pepper', 'rabbit', 'spider', 'trumpet',
  'valley', 'wagon', 'compass', 'marble', 'pillow', 'ribbon', 'statue', 'helmet', 'carpet', 'bottle',
];

const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXZ'; // no I, O, Q, Y: easily confused with digits or each other

export const memorySlots: Slot[] = [
  generated('memory.digits-forward', 2, true, (rng) => {
    const digits = digitString(rng, 7);
    return {
      title: 'Digit span',
      prompt: 'Type the digits you saw, in the same order.',
      memorize: { stimulus: { kind: 'text', text: spaced(digits), style: 'digits' }, seconds: 5, instruction: 'Memorize these digits in order.' },
      timeLimit: 20,
      answer: { kind: 'text', accept: [digits], mode: 'sequence', placeholder: 'Digits' },
      explanation: `The digits were ${spaced(digits)}.`,
    };
  }),
  generated('memory.digits-backward', 4, false, (rng) => {
    const digits = digitString(rng, 6);
    const back = digits.split('').reverse().join('');
    return {
      title: 'Reverse digit span',
      prompt: 'Type the digits you saw in REVERSE order, last digit first.',
      memorize: { stimulus: { kind: 'text', text: spaced(digits), style: 'digits' }, seconds: 5, instruction: 'Memorize these digits. You will type them backward.' },
      timeLimit: 25,
      answer: { kind: 'text', accept: [back], mode: 'sequence', placeholder: 'Digits, reversed' },
      explanation: `The digits were ${spaced(digits)}, so the reverse is ${spaced(back)}.`,
    };
  }),
  generated('memory.word-list', 3, true, (rng) => {
    const pool = sample(rng, WORD_POOL, 16);
    const shown = pool.slice(0, 8);
    const options = shuffle(rng, pool);
    return {
      title: 'Word recall',
      prompt: 'Select every word that was on the list. Leave the others unselected.',
      memorize: { stimulus: { kind: 'words', words: shown }, seconds: 12, instruction: 'Memorize these 8 words.' },
      timeLimit: 40,
      answer: { kind: 'multi', options, correct: shown.map((w) => options.indexOf(w)) },
      explanation: `The list was: ${shown.join(', ')}.`,
    };
  }),
  generated('memory.grid', 3, false, (rng) => {
    const cells = sample(rng, Array.from({ length: 25 }, (_, i) => i), 7).sort((a, b) => a - b);
    return {
      title: 'Spatial memory',
      prompt: 'Tap the squares that were lit, then submit.',
      memorize: { stimulus: { kind: 'grid', size: 5, cells }, seconds: 4, instruction: 'Memorize which squares are lit.' },
      timeLimit: 25,
      answer: { kind: 'grid', size: 5, cells },
      explanation: 'The lit squares are highlighted in the answer grid.',
    };
  }),
  generated('memory.letter-number', 4, false, (rng) => {
    const nums = sample(rng, '123456789'.split(''), 3);
    const lets = sample(rng, LETTERS.split(''), 3);
    // Interleave so the display never groups all digits or all letters together.
    const mixed = rng() < 0.5 ? [nums[0], lets[0], nums[1], lets[1], nums[2], lets[2]] : [lets[0], nums[0], lets[1], nums[1], lets[2], nums[2]];
    const answer = [...nums].sort().join('') + [...lets].sort().join('');
    return {
      title: 'Letter–number sequencing',
      prompt: 'Type the numbers in ascending order, then the letters in alphabetical order. Example: 3 B 1 A → 13AB',
      memorize: { stimulus: { kind: 'text', text: mixed.join(' '), style: 'letters' }, seconds: 6, instruction: 'Memorize these numbers and letters.' },
      timeLimit: 30,
      answer: { kind: 'text', accept: [answer.toLowerCase()], mode: 'sequence', placeholder: 'Numbers, then letters' },
      explanation: `You saw ${mixed.join(' ')}. Sorted, that is ${answer}.`,
    };
  }),
  handSlot({
    id: 'memory.passage',
    section: 'memory',
    difficulty: 3,
    title: 'Detail recall',
    timeLimit: 20,
    memorizeSeconds: 10,
    memorizeStyle: 'passage',
    memorizeInstruction: 'Read this carefully. It will disappear.',
    items: [
      {
        memorize: 'The 7:45 train to Bristol left from platform 9 carrying 212 passengers and a black dog named Pepper.',
        prompt: 'Which platform did the train leave from?',
        choices: ['9', '7', '2', '12', '5'],
        explanation: 'The train left from platform 9.',
      },
      {
        memorize: 'Dr. Alvarez planted 36 lemon trees on the east hill in April, then fenced them with green wire.',
        prompt: 'What kind of trees were planted?',
        choices: ['Lemon', 'Lime', 'Orange', 'Olive', 'Apple'],
        explanation: 'Dr. Alvarez planted lemon trees.',
      },
      {
        memorize: 'On Tuesday, Hana bought four blue notebooks, two red pens and a ruler for $13.60.',
        prompt: 'How much did Hana spend?',
        choices: ['$13.60', '$16.30', '$13.06', '$31.60', '$12.60'],
        explanation: 'She spent $13.60.',
      },
      {
        memorize: 'The museum\'s north wing reopens on 14 March with 58 paintings by the Dutch artist Hendrik Vos.',
        prompt: 'What nationality was the artist?',
        choices: ['Dutch', 'Danish', 'German', 'Belgian', 'Swedish'],
        explanation: 'Hendrik Vos was Dutch.',
      },
      {
        memorize: 'Captain Reyes steered the ship Marigold through the storm with a crew of 19 and six lifeboats.',
        prompt: 'What was the name of the ship?',
        choices: ['Marigold', 'Magnolia', 'Margaret', 'Mariner', 'Meridian'],
        explanation: 'The ship was the Marigold.',
      },
      {
        memorize: 'The bakery on Elm Street sells 120 rye loaves every Saturday but closes at 2 p.m. on Sundays.',
        prompt: 'What time does the bakery close on Sundays?',
        choices: ['2 p.m.', '12 p.m.', '3 p.m.', '1 p.m.', '4 p.m.'],
        explanation: 'It closes at 2 p.m. on Sundays.',
      },
    ],
  }),
  handSlot({
    id: 'memory.phrase',
    section: 'memory',
    difficulty: 3,
    title: 'Phrase recall',
    timeLimit: 40,
    mode: 'phrase',
    placeholder: 'Type the phrase',
    memorizeSeconds: 6,
    memorizeStyle: 'phrase',
    memorizeInstruction: 'Memorize this phrase word for word.',
    items: [
      { memorize: 'Seven purple owls guard the silver gate at dawn.', prompt: 'Type the phrase exactly as you saw it.', accept: ['Seven purple owls guard the silver gate at dawn'], explanation: 'The phrase was: "Seven purple owls guard the silver gate at dawn."' },
      { memorize: 'The quiet baker sold nine loaves before the rain.', prompt: 'Type the phrase exactly as you saw it.', accept: ['The quiet baker sold nine loaves before the rain'], explanation: 'The phrase was: "The quiet baker sold nine loaves before the rain."' },
      { memorize: 'A tired giraffe painted orange stripes on the fence.', prompt: 'Type the phrase exactly as you saw it.', accept: ['A tired giraffe painted orange stripes on the fence'], explanation: 'The phrase was: "A tired giraffe painted orange stripes on the fence."' },
      { memorize: 'My uncle juggles eleven lemons every Thursday afternoon.', prompt: 'Type the phrase exactly as you saw it.', accept: ['My uncle juggles eleven lemons every Thursday afternoon'], explanation: 'The phrase was: "My uncle juggles eleven lemons every Thursday afternoon."' },
      { memorize: 'Under the old bridge a green violin plays slow songs.', prompt: 'Type the phrase exactly as you saw it.', accept: ['Under the old bridge a green violin plays slow songs'], explanation: 'The phrase was: "Under the old bridge a green violin plays slow songs."' },
      { memorize: 'Two clever foxes counted forty stars above the barn.', prompt: 'Type the phrase exactly as you saw it.', accept: ['Two clever foxes counted forty stars above the barn'], explanation: 'The phrase was: "Two clever foxes counted forty stars above the barn."' },
    ],
  }),
];
