import { create } from 'zustand';
import type { CalEvent, Task } from '../types';

interface UIState {
  palette: boolean;
  quickAdd: boolean;
  editingTask: Task | null;
  editingEvent: CalEvent | null;
  shortcuts: boolean;
  setPalette: (v: boolean) => void;
  setQuickAdd: (v: boolean) => void;
  editTask: (t: Task | null) => void;
  editEvent: (e: CalEvent | null) => void;
  setShortcuts: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  palette: false, quickAdd: false, editingTask: null, editingEvent: null, shortcuts: false,
  setPalette: (palette) => set({ palette }),
  setQuickAdd: (quickAdd) => set({ quickAdd }),
  editTask: (editingTask) => set({ editingTask }),
  editEvent: (editingEvent) => set({ editingEvent }),
  setShortcuts: (shortcuts) => set({ shortcuts }),
}));
