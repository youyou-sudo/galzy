import { create } from "zustand";
import { homeData } from "@/app/(app)/(home)/lib/homeData";

interface GameListItem {
  id: string;
  images: any;
  titles: { lang: string; title: string }[];
  olang: string;
}

interface GameListPage {
  currentPage: number;
  totalPages: number;
  items: GameListItem[];
}

interface GameListStore {
  pages: GameListPage[];
  loading: boolean;
  fetchNext: () => Promise<void>;
  reset: () => void;
}

export const useGameListStore = create<GameListStore>((set, get) => ({
  pages: [],
  loading: false,
  async fetchNext(): Promise<void> {
    const currentPage: number = get().pages.length;
    set({ loading: true });
    const nextPage: GameListPage = await homeData(20, currentPage);
    set((state: GameListStore) => ({
      pages: [...state.pages, nextPage],
      loading: false,
    }));
  },
  reset(): void {
    set({ pages: [] });
  },
}));
