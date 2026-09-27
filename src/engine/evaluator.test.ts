import { describe, expect, it } from 'vitest';
import { cardToString, parseCardIndices, parseCards } from './cards';
import { CATEGORY_NAMES, HandCategory, compareHands, evaluateHand, evaluateIndices } from './evaluator';

const ev = (text: string) => evaluateHand(parseCards(text));
const cat = (text: string) => ev(text).category;
const best = (text: string) => ev(text).best.map(cardToString).join(' ');
/** Ranks of the best five, most significant first (suit choice among equal ranks is arbitrary). */
const bestRanks = (text: string) => ev(text).best.map((c) => c.rank).join('');
const cmp = (a: string, b: string) => compareHands(parseCards(a), parseCards(b));

describe('categories', () => {
  it.each([
    ['AsKsQsJsTs', HandCategory.StraightFlush],
    ['9h9d9s9c2h', HandCategory.FourOfAKind],
    ['KhKdKs7c7h', HandCategory.FullHouse],
    ['Ah9h7h4h2h', HandCategory.Flush],
    ['9c8d7h6s5c', HandCategory.Straight],
    ['QhQdQs8c3h', HandCategory.ThreeOfAKind],
    ['JhJd4s4c9h', HandCategory.TwoPair],
    ['ThTd8s5c2h', HandCategory.Pair],
    ['AhJd8s5c2h', HandCategory.HighCard],
  ])('%s -> %s', (hand, expected) => {
    expect(cat(hand)).toBe(expected);
  });

  it('names royal flushes and describes hands', () => {
    expect(ev('AsKsQsJsTs').description).toBe('Royal flush');
    expect(ev('KhKdKs7c7h').description).toBe('Full house, Kings full of Sevens');
    expect(ev('5d4c3h2sAs').description).toBe('Straight, Five high');
    expect(CATEGORY_NAMES[HandCategory.TwoPair]).toBe('Two pair');
  });
});

describe('the wheel', () => {
  it('A-2-3-4-5 is a five-high straight', () => {
    expect(cat('As2d3h4c5s')).toBe(HandCategory.Straight);
    expect(best('As2d3h4c5s 9c Kd')).toBe('5s 4c 3h 2d As');
  });
  it('the wheel loses to a six-high straight', () => {
    expect(cmp('As2d3h4c5s', '2d3h4c5s6d')).toBeLessThan(0);
  });
  it('steel wheel is a straight flush that loses to 6-high straight flush', () => {
    expect(cat('Ah2h3h4h5h')).toBe(HandCategory.StraightFlush);
    expect(cmp('Ah2h3h4h5h', '2h3h4h5h6h')).toBeLessThan(0);
  });
  it('A-K-Q-J-T beats K-high; no wraparound straights', () => {
    expect(cmp('AsKdQhJcTs', 'KdQhJcTs9s')).toBeGreaterThan(0);
    expect(cat('QsKdAh2c3s')).toBe(HandCategory.HighCard);
  });
});

describe('kickers and comparisons', () => {
  it('pair kickers decide', () => {
    expect(cmp('AhAd Ks 7c 2h', 'AsAc Qs 7d 2d')).toBeGreaterThan(0);
    expect(cmp('AhAd Ks 7c 3h', 'AsAc Kd 7d 2d')).toBeGreaterThan(0);
  });
  it('two pair kicker decides', () => {
    expect(cmp('KhKd 5s5c Ah', 'KsKc 5h5d Qh')).toBeGreaterThan(0);
  });
  it('equal hands tie', () => {
    expect(cmp('AhKd Qs Jc 9h', 'AsKc Qd Jh 9s')).toBe(0);
  });
  it('flush compares all five cards', () => {
    expect(cmp('Ah Kh 9h 5h 3h', 'As Ks 9s 5s 2s')).toBeGreaterThan(0);
  });
  it('category order is respected', () => {
    const ladder = ['AhJd8s5c2h', 'ThTd8s5c2h', 'JhJd4s4c9h', 'QhQdQs8c3h', '9c8d7h6s5c', 'Ah9h7h4h2h', 'KhKdKs7c7h', '9h9d9s9c2h', 'AsKsQsJsTs'];
    for (let i = 1; i < ladder.length; i++) expect(cmp(ladder[i]!, ladder[i - 1]!)).toBeGreaterThan(0);
  });
});

describe('6 and 7 card hands pick the best five', () => {
  it('three pairs: best two pairs plus the best kicker', () => {
    // Board-style: KK 77 44 A -> Kings and Sevens with an Ace
    expect(ev('KhKd 7s7c 4h4d As').description).toBe('Two pair, Kings and Sevens');
    expect(bestRanks('KhKd 7s7c 4h4d As')).toBe('KK77A');
    // The third pair can be the kicker
    expect(bestRanks('KhKd 7s7c 6h6d 2s')).toBe('KK776');
  });
  it('two sets make the best full house', () => {
    expect(ev('9h9d9s 4c4h4d As').description).toBe('Full house, Nines full of Fours');
  });
  it('trips plus two pairs uses the higher pair', () => {
    expect(ev('5h5d5s Kc Kh 9d 9s').description).toBe('Full house, Fives full of Kings');
  });
  it('flush with six suited cards keeps the top five', () => {
    expect(best('Ah Kh 9h 6h 4h 2h Qs')).toBe('Ah Kh 9h 6h 4h');
  });
  it('straight flush beats a higher plain straight on the same board', () => {
    expect(cat('5h 6h 7h 8h 9h Td')).toBe(HandCategory.StraightFlush);
    expect(ev('5h 6h 7h 8h 9h Td Jc').description).toBe('Straight flush, Nine high');
  });
  it('quads use the highest remaining kicker', () => {
    expect(bestRanks('8h8d8s8c 2h Kd Kc')).toBe('8888K');
  });
  it('best five are always drawn from the given cards, without repeats', () => {
    for (const hand of ['KhKd 7s7c 4h4d As', '8h8d8s8c 2h Kd Kc', 'Ah Kh 9h 6h 4h 2h Qs', 'As2d3h4c5s 9c Kd']) {
      const given = new Set(parseCards(hand).map(cardToString));
      const picked = ev(hand).best.map(cardToString);
      expect(picked).toHaveLength(5);
      expect(new Set(picked).size).toBe(5);
      for (const c of picked) expect(given.has(c)).toBe(true);
    }
  });
  it('6-card straight uses the highest five', () => {
    expect(ev('4c5d6h7s8c9d').description).toBe('Straight, Nine high');
  });
  it('matches the best 5-card subset for random 7-card hands', () => {
    let seed = 12345;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let trial = 0; trial < 2000; trial++) {
      const deck = Array.from({ length: 52 }, (_, i) => i);
      for (let i = 51; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [deck[i], deck[j]] = [deck[j]!, deck[i]!];
      }
      const seven = deck.slice(0, 7);
      let bestSubset = -1;
      for (let a = 0; a < 7; a++)
        for (let b = a + 1; b < 7; b++) {
          const five = seven.filter((_, k) => k !== a && k !== b);
          bestSubset = Math.max(bestSubset, evaluateIndices(five));
        }
      expect(evaluateIndices(seven)).toBe(bestSubset);
    }
  });
});

describe('validation', () => {
  it('rejects bad hand sizes and duplicates', () => {
    expect(() => ev('AsKs')).toThrow();
    expect(() => evaluateHand([...parseCards('AsKsQsJsTs'), ...parseCards('9s8s7s')])).toThrow();
    expect(() => ev('AsAsKdQh2c')).toThrow();
  });
});

describe('exhaustive 5-card check', () => {
  it('matches the known category frequencies over all 2,598,960 hands', () => {
    const tally = new Array(9).fill(0);
    const h = new Int32Array(5);
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++)
          for (let d = c + 1; d < 52; d++)
            for (let e = d + 1; e < 52; e++) {
              h[0] = a; h[1] = b; h[2] = c; h[3] = d; h[4] = e;
              tally[evaluateIndices(h, 5) >> 20]++;
            }
    expect(tally).toEqual([1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40]);
  }, 30_000);
});

it('parseCardIndices round-trips', () => {
  expect(parseCardIndices('2s Ac')).toEqual([0, 51]);
});
