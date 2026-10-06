import type { Question, Slot } from '../engine/types';
import { handSlot } from './hand';

const A = 'A'.charCodeAt(0);
const letter = (i: number) => String.fromCharCode(A + (((i % 26) + 26) % 26));
const idx = (c: string) => c.charCodeAt(0) - A;

interface LetterSeriesSpec {
  terms: string[];
  next: string;
  rule: string;
}

function gapSeries(start: string, gaps: number[], rule: string): LetterSeriesSpec {
  const t = [idx(start)];
  for (const g of gaps) t.push(t[t.length - 1] + g);
  const letters = t.map(letter);
  return { terms: letters.slice(0, -1), next: letters[letters.length - 1], rule };
}

export const letterSeriesSpecs: LetterSeriesSpec[] = [
  gapSeries('A', [1, 2, 3, 4, 5], 'The gaps grow by one letter each time: +1, +2, +3, +4, +5.'),
  gapSeries('C', [3, 3, 3, 3, 3], 'Each letter is three places after the one before.'),
  gapSeries('Z', [-2, -2, -2, -2, -2], 'The series moves backward through the alphabet two letters at a time.'),
  { terms: ['A', 'Z', 'B', 'Y', 'C', 'X'], next: 'D', rule: 'Two series alternate: A, B, C, … from the front and Z, Y, X, … from the back.' },
  {
    terms: ['AC', 'BD', 'CE', 'DF'],
    next: 'EG',
    rule: 'Each pair is a letter and the letter two after it, and both letters advance by one each step.',
  },
  gapSeries('B', [4, 4, 4, 4, 4], 'Each letter is four places after the one before.'),
];

function letterSeriesSlot(): Slot {
  const id = 'logical.letter-series';
  return {
    id,
    section: 'logical',
    difficulty: 3,
    variants: letterSeriesSpecs.length,
    quick: true,
    build(variant): Question {
      const s = letterSeriesSpecs[variant];
      return {
        id: `${id}#${variant}`,
        slotId: id,
        variant,
        section: 'logical',
        difficulty: 3,
        title: 'Letter series',
        prompt: `What comes next?\n${s.terms.join(',  ')},  ?`,
        timeLimit: 45,
        answer: { kind: 'text', accept: [s.next.toLowerCase()], mode: 'word', placeholder: 'Next letter(s)' },
        explanation: `${s.rule} The answer is ${s.next}.`,
      };
    },
  };
}

interface CodeSpec {
  encode: (word: string) => string;
  example: string;
  target: string;
  rule: string;
}

const shiftCode = (k: number): CodeSpec['encode'] => (w) => [...w].map((c) => letter(idx(c) + k)).join('');
const reverse: CodeSpec['encode'] = (w) => [...w].reverse().join('');

export const codeSpecs: CodeSpec[] = [
  { encode: shiftCode(1), example: 'COLD', target: 'WARM', rule: 'Each letter moves one place forward in the alphabet.' },
  { encode: shiftCode(2), example: 'BOOK', target: 'LAMP', rule: 'Each letter moves two places forward in the alphabet.' },
  { encode: shiftCode(-1), example: 'FISH', target: 'BIRD', rule: 'Each letter moves one place back in the alphabet.' },
  { encode: reverse, example: 'STOP', target: 'MILK', rule: 'The word is written backward.' },
  {
    encode: (w) => shiftCode(1)(reverse(w)),
    example: 'CAT',
    target: 'DOG',
    rule: 'The word is written backward, then each letter moves one place forward.',
  },
  {
    encode: (w) => [...w].map((c, i) => letter(idx(c) + i + 1)).join(''),
    example: 'SALT',
    target: 'MINE',
    rule: 'The 1st letter moves forward 1 place, the 2nd moves 2, the 3rd moves 3, and so on.',
  },
];

function codingSlot(): Slot {
  const id = 'logical.coding';
  return {
    id,
    section: 'logical',
    difficulty: 3,
    variants: codeSpecs.length,
    build(variant): Question {
      const s = codeSpecs[variant];
      const answer = s.encode(s.target);
      return {
        id: `${id}#${variant}`,
        slotId: id,
        variant,
        section: 'logical',
        difficulty: 3,
        title: 'Code',
        prompt: `In a code, ${s.example} is written as ${s.encode(s.example)}.\nHow is ${s.target} written in the same code?`,
        timeLimit: 60,
        answer: { kind: 'text', accept: [answer.toLowerCase()], mode: 'word', placeholder: 'Coded word' },
        explanation: `${s.rule} ${s.target} becomes ${answer}.`,
      };
    },
  };
}

export const logicalSlots: Slot[] = [
  handSlot({
    id: 'logical.syllogism',
    section: 'logical',
    difficulty: 2,
    title: 'Deduction',
    timeLimit: 45,
    quick: true,
    items: [
      {
        prompt: 'All bloops are razzies.\nAll razzies are lazzies.\nWhich conclusion must be true?',
        choices: ['All bloops are lazzies.', 'All lazzies are bloops.', 'Some razzies are not bloops.', 'No lazzies are bloops.', 'All razzies are bloops.'],
        explanation: 'Every bloop is a razzie and every razzie is a lazzie, so every bloop is a lazzie. Nothing is said about lazzies in general.',
      },
      {
        prompt: 'No cats are dogs.\nAll puppies are dogs.\nWhich conclusion must be true?',
        choices: ['No puppies are cats.', 'Some cats are puppies.', 'All dogs are puppies.', 'Some puppies are not dogs.', 'No dogs are puppies.'],
        explanation: 'Every puppy is a dog and no dog is a cat, so no puppy is a cat.',
      },
      {
        prompt: 'All pilots are trained.\nSome trained people are nervous.\nWhich conclusion must be true?',
        choices: ['Some nervous people are trained.', 'Some pilots are nervous.', 'All nervous people are pilots.', 'No pilots are nervous.', 'All trained people are pilots.'],
        explanation: '"Some trained people are nervous" means some nervous people are trained. The nervous trained people need not be pilots.',
      },
      {
        prompt: 'Every member of the chess club is a student.\nMaria is not a student.\nWhich conclusion must be true?',
        choices: ['Maria is not in the chess club.', 'Maria is in the chess club.', 'Some students are not in the chess club.', 'Maria plays chess.', 'No students play chess.'],
        explanation: 'If Maria were in the club she would be a student. She is not a student, so she is not in the club.',
      },
      {
        prompt: 'If it rains, the match is cancelled.\nThe match was not cancelled.\nWhich conclusion must be true?',
        choices: ['It did not rain.', 'It rained.', 'The match was played indoors.', 'It may have rained.', 'The match was postponed.'],
        explanation: 'Rain would have cancelled the match. It was not cancelled, so it did not rain.',
      },
      {
        prompt: 'Some artists are musicians.\nAll musicians can read music.\nWhich conclusion must be true?',
        choices: ['Some artists can read music.', 'All artists can read music.', 'Everyone who reads music is a musician.', 'No artists can read music.', 'Some musicians are not artists.'],
        explanation: 'The artists who are musicians can read music, so at least some artists can.',
      },
    ],
  }),
  handSlot({
    id: 'logical.ordering',
    section: 'logical',
    difficulty: 3,
    title: 'Ordering',
    timeLimit: 60,
    quick: true,
    items: [
      {
        prompt: 'Ann is taller than Bea. Cal is shorter than Bea. Dee is taller than Ann.\nWho is the shortest?',
        choices: ['Cal', 'Bea', 'Ann', 'Dee'],
        explanation: 'From tallest: Dee, Ann, Bea, Cal.',
      },
      {
        prompt: 'In a race, Pat finished ahead of Quinn but behind Ray. Sue finished behind Quinn. Tom finished ahead of Ray.\nWho finished third?',
        choices: ['Pat', 'Ray', 'Quinn', 'Tom', 'Sue'],
        explanation: 'The finishing order is Tom, Ray, Pat, Quinn, Sue.',
      },
      {
        prompt: 'Five books stand in a row. The white book is at the far left. The red book is immediately right of the white book. The blue book is somewhere right of the green book. The green book is not next to the red book.\nWhich book is in the middle?',
        choices: ['Yellow', 'Green', 'Blue', 'Red', 'White'],
        explanation: 'White and red take places 1 and 2. Green cannot be in place 3 (next to red) and must be left of blue, so green is 4, blue is 5 and yellow is 3.',
      },
      {
        prompt: 'Five meetings, A to E, are held one per day from Monday to Friday. D is on Friday. E is the day before D. B is the day after A. C is not on Monday.\nOn which day is B?',
        choices: ['Tuesday', 'Monday', 'Wednesday', 'Thursday', 'Friday'],
        explanation: 'D is Friday and E is Thursday. A, B and C fill Monday to Wednesday with B right after A and C not on Monday, so A is Monday, B Tuesday and C Wednesday.',
      },
      {
        prompt: 'Jo earns more than Kim. Lee earns less than Kim. Max earns more than Jo.\nWho earns the second most?',
        choices: ['Jo', 'Max', 'Kim', 'Lee'],
        explanation: 'From highest: Max, Jo, Kim, Lee.',
      },
      {
        prompt: 'Town P is north of Q. R is south of Q. S is north of P. T lies between Q and R.\nWhich town is farthest south?',
        choices: ['R', 'T', 'Q', 'P', 'S'],
        explanation: 'From north to south: S, P, Q, T, R.',
      },
    ],
  }),
  letterSeriesSlot(),
  codingSlot(),
  handSlot({
    id: 'logical.conditional',
    section: 'logical',
    difficulty: 4,
    title: 'Logic puzzle',
    timeLimit: 75,
    items: [
      {
        prompt: 'On an island, knights always tell the truth and knaves always lie. A says: "We are both knaves."\nWhat are A and B?',
        choices: ['A is a knave, B is a knight', 'Both are knights', 'Both are knaves', 'A is a knight, B is a knave', 'It cannot be determined'],
        explanation: 'A knight could never say he is a knave, so A is a knave and the statement is false. They are not both knaves, so B is a knight.',
      },
      {
        prompt: 'Knights always tell the truth and knaves always lie. A says: "B is a knave." B says: "A and I are the same type."\nWhat are A and B?',
        choices: ['A is a knight, B is a knave', 'A is a knave, B is a knight', 'Both are knights', 'Both are knaves', 'It cannot be determined'],
        explanation: 'If A were a knave, B would be a knight, but then B\'s claim that they are the same type would be a lie. So A is a knight and B is a knave, whose claim is indeed false.',
      },
      {
        prompt: 'Each card has a letter on one side and a number on the other. Rule: "If a card has a vowel on one side, it has an even number on the other."\nThe cards show E, K, 4 and 7. Which cards must you turn over to test the rule?',
        choices: ['E and 7', 'E and 4', 'E only', 'E, 4 and 7', 'K and 7'],
        explanation: 'E could have an odd number behind it, and 7 could have a vowel behind it. K and 4 cannot break the rule.',
      },
      {
        prompt: 'If the alarm sounds, everyone leaves the building. If everyone leaves, the doors are locked. The doors are not locked.\nWhich statement must be true?',
        choices: ['The alarm did not sound.', 'Everyone left the building.', 'The alarm sounded.', 'Someone locked the doors.', 'Nobody was inside.'],
        explanation: 'The doors are not locked, so not everyone left, so the alarm did not sound.',
      },
      {
        prompt: 'Three boxes are labelled "Apples", "Oranges" and "Mixed". Every label is wrong. You may take one fruit from one box without looking inside.\nWhich box should you take it from to relabel all three correctly?',
        choices: ['The box labelled "Mixed"', 'The box labelled "Apples"', 'The box labelled "Oranges"', 'Any box works', 'It cannot be done with one fruit'],
        explanation: 'The "Mixed" box holds only one kind of fruit, so one fruit identifies it. The other two labels then follow, because each is wrong.',
      },
      {
        prompt: 'Knights always tell the truth and knaves always lie. A says: "At least one of us is a knave."\nWhat are A and B?',
        choices: ['A is a knight, B is a knave', 'A is a knave, B is a knight', 'Both are knights', 'Both are knaves', 'It cannot be determined'],
        explanation: 'If A were a knave the statement would be true, which a knave cannot say. So A is a knight, the statement is true, and B must be the knave.',
      },
    ],
  }),
  handSlot({
    id: 'logical.relations',
    section: 'logical',
    difficulty: 4,
    title: 'Relationships',
    timeLimit: 60,
    items: [
      {
        prompt: 'Pointing to a man, Lisa says: "His mother is the only daughter of my mother."\nHow is Lisa related to the man?',
        choices: ['She is his mother', 'She is his sister', 'She is his aunt', 'She is his grandmother', 'She is his daughter'],
        explanation: 'The only daughter of Lisa\'s mother is Lisa herself, so Lisa is the man\'s mother.',
      },
      {
        prompt: 'Tom\'s father is the only son of Carl\'s father.\nHow is Carl related to Tom?',
        choices: ['Father', 'Grandfather', 'Uncle', 'Brother', 'Cousin'],
        explanation: 'The only son of Carl\'s father is Carl, so Carl is Tom\'s father.',
      },
      {
        prompt: 'A is B\'s sister. C is B\'s mother. D is C\'s father. E is D\'s mother.\nHow is A related to D?',
        choices: ['Granddaughter', 'Daughter', 'Great-granddaughter', 'Niece', 'Sister'],
        explanation: 'A is C\'s daughter and D is C\'s father, so A is D\'s granddaughter.',
      },
      {
        prompt: 'Six people sit evenly spaced around a round table. A sits opposite B. C sits immediately to A\'s left. D sits opposite C. E sits immediately to B\'s right. F takes the last seat.\nWho sits opposite E?',
        choices: ['F', 'C', 'D', 'A', 'B'],
        explanation: 'Number the seats 0–5 with A at 0 and B at 3. C is at 1, D opposite at 4, E at 2 and F at 5, which is opposite E.',
      },
      {
        prompt: 'Mary\'s son is the brother of Jack\'s daughter. Mary and Jack are not siblings.\nHow is Mary most likely related to Jack?',
        choices: ['Wife', 'Sister', 'Mother', 'Daughter', 'Cousin'],
        explanation: 'Mary\'s son and Jack\'s daughter are siblings, so Mary and Jack are their parents: Mary is Jack\'s wife.',
      },
      {
        prompt: 'Looking at a photo, a man says: "I have no brothers or sisters, but that man\'s father is my father\'s son."\nWho is in the photo?',
        choices: ['His son', 'Himself', 'His father', 'His nephew', 'His grandson'],
        explanation: 'With no siblings, "my father\'s son" is the speaker himself. So the man in the photo has the speaker as his father: he is the speaker\'s son.',
      },
    ],
  }),
];
