import { create } from 'zustand';

interface AppState {
  activeGameId: string | null;
  setActiveGameId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeGameId: null,
  setActiveGameId: (id) => set({ activeGameId: id }),
}));
