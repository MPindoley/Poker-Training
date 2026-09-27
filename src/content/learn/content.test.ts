import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, CURRICULUM, dyn } from './index';

const ROUTE_PREFIXES = ['/train', '/play', '/review', '/learn'];

describe('curriculum', () => {
  it('has the nine units', () => {
    expect(CURRICULUM.map((u) => u.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(ALL_LESSONS.map((l) => l.id)).size).toBe(ALL_LESSONS.length);
  });

  for (const lesson of ALL_LESSONS) {
    it(`${lesson.unitNumber}. ${lesson.title}: renders, quiz is valid`, () => {
      expect(lesson.minutes).toBeGreaterThanOrEqual(2);
      expect(lesson.minutes).toBeLessThanOrEqual(4);
      for (const b of lesson.blocks) {
        const texts = b.kind === 'list' ? b.items.map(dyn) : 'text' in b ? [dyn(b.text)] : [];
        for (const t of texts) expect(t).not.toMatch(/NaN|undefined|Infinity/);
      }
      expect(lesson.blocks.some((b) => b.kind === 'example')).toBe(true);
      expect(lesson.quiz.length).toBeGreaterThanOrEqual(3);
      expect(lesson.quiz.length).toBeLessThanOrEqual(5);
      for (const q of lesson.quiz) {
        const choices = q.choices.map(dyn);
        expect(new Set(choices).size).toBe(choices.length);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(choices.length);
        expect(dyn(q.prompt).length).toBeGreaterThan(5);
        expect(dyn(q.why)).not.toMatch(/NaN|undefined/);
      }
      expect(ROUTE_PREFIXES.some((p) => lesson.drill.route.startsWith(p))).toBe(true);
    });
  }
});
