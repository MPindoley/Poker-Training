import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { addEvent, addPlayer, bookmarkHand, createLiveSession, removePlayer, undoLast, type LiveEventType, type LivePlayer, type LiveSession } from '../engine';
import { idbStateStorage } from '../storage/db';

interface LiveState {
  active: LiveSession | null;
  /** Finished sessions, newest first (kept for reference; last 20). */
  history: LiveSession[];
  start: (opts: Parameters<typeof createLiveSession>[0]) => void;
  tap: (type: LiveEventType, player?: string) => void;
  undo: (player?: string) => void;
  bookmark: () => void;
  markLogged: (bookmarkId: string) => void;
  join: (p: Omit<LivePlayer, 'joinedHand'>) => void;
  leave: (id: string) => void;
  /** Stop tracking (the review screen applies profiles and saves the money session). */
  end: () => LiveSession | null;
  archive: (s: LiveSession) => void;
  discard: () => void;
}

/** The live table tracker. Saved on the device after every tap, so nothing is lost if the phone locks. */
export const useLive = create<LiveState>()(
  persist(
    (set, get) => ({
      active: null,
      history: [],
      start: (opts) => set({ active: createLiveSession(opts) }),
      tap: (type, player) => {
        const a = get().active;
        if (a) set({ active: addEvent(a, type, player ?? '') });
      },
      undo: (player) => {
        const a = get().active;
        if (a) set({ active: undoLast(a, player) });
      },
      bookmark: () => {
        const a = get().active;
        if (a) set({ active: bookmarkHand(a) });
      },
      markLogged: (bookmarkId) => {
        const mark = (s: LiveSession) => ({ ...s, bookmarks: s.bookmarks.map((b) => (b.id === bookmarkId ? { ...b, logged: true } : b)) });
        const a = get().active;
        set({ active: a ? mark(a) : a, history: get().history.map(mark) });
      },
      join: (p) => {
        const a = get().active;
        if (a) set({ active: addPlayer(a, p) });
      },
      leave: (id) => {
        const a = get().active;
        if (a) set({ active: removePlayer(a, id) });
      },
      end: () => {
        const a = get().active;
        if (!a) return null;
        const ended = { ...a, endedAt: Date.now() };
        set({ active: ended });
        return ended;
      },
      archive: (s) => set({ active: null, history: [s, ...get().history.filter((h) => h.id !== s.id)].slice(0, 20) }),
      discard: () => set({ active: null }),
    }),
    { name: 'live', storage: createJSONStorage(() => idbStateStorage) },
  ),
);
