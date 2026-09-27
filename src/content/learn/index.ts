import { UNIT1 } from './unit1';
import { UNIT2 } from './unit2';
import { UNIT3 } from './unit3';
import { UNIT4 } from './unit4';
import { UNIT5, UNIT6, UNIT7, UNIT8, UNIT9 } from './unit5to9';
import type { Lesson, Unit } from './types';

export const CURRICULUM: Unit[] = [UNIT1, UNIT2, UNIT3, UNIT4, UNIT5, UNIT6, UNIT7, UNIT8, UNIT9];
export const ALL_LESSONS: (Lesson & { unitId: string; unitNumber: number })[] = CURRICULUM.flatMap((u) => u.lessons.map((l) => ({ ...l, unitId: u.id, unitNumber: u.number })));
export const lessonById = (id: string) => ALL_LESSONS.find((l) => l.id === id);
export * from './types';
