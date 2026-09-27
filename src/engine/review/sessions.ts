/** Real-game session tracking: profit, hourly rate and big blinds per hour. */

export type GameLocation = 'home' | 'casino';

export interface RealSession {
  id: string;
  date: string;
  location: GameLocation;
  buyIn: number;
  rebuys: number;
  cashOut: number;
  hours: number;
  smallBlind: number;
  bigBlind: number;
  notes: string;
}

export const sessionProfit = (s: RealSession) => Math.round((s.cashOut - s.buyIn - s.rebuys) * 100) / 100;

export interface SessionStats {
  sessions: number;
  profit: number;
  hours: number;
  /** $ per hour. */
  hourly: number | null;
  /** Big blinds won per hour. */
  bbPerHour: number | null;
  /** Cumulative profit after each session, oldest first. */
  running: { date: string; profit: number; total: number }[];
  byLocation: Record<GameLocation, { sessions: number; profit: number; hours: number; hourly: number | null; bbPerHour: number | null }>;
}

function rollup(list: RealSession[]) {
  const profit = list.reduce((a, s) => a + sessionProfit(s), 0);
  const hours = list.reduce((a, s) => a + s.hours, 0);
  const bbs = list.reduce((a, s) => a + (s.bigBlind > 0 ? sessionProfit(s) / s.bigBlind : 0), 0);
  return {
    sessions: list.length,
    profit: Math.round(profit * 100) / 100,
    hours,
    hourly: hours > 0 ? profit / hours : null,
    bbPerHour: hours > 0 ? bbs / hours : null,
  };
}

export function sessionStats(sessions: RealSession[]): SessionStats {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  let total = 0;
  const running = sorted.map((s) => {
    total = Math.round((total + sessionProfit(s)) * 100) / 100;
    return { date: s.date, profit: sessionProfit(s), total };
  });
  const all = rollup(sorted);
  return {
    ...all,
    running,
    byLocation: {
      home: rollup(sorted.filter((s) => s.location === 'home')),
      casino: rollup(sorted.filter((s) => s.location === 'casino')),
    },
  };
}
