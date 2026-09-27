import { create } from 'zustand';
import type { Grade } from '../engine';

export type ToastTone = Grade | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...toast, id }].slice(-3) });
    setTimeout(() => get().dismiss(id), 2800);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().push(t);
