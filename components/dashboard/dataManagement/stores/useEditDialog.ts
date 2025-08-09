// store/useEditDialog.ts
import { create } from "zustand";

interface EditDialogState {
  isOpen: boolean;
  data: any | null;
  open: () => void;
  close: () => void;
  dataget: (data: any) => void;
}

export const useEditDialog = create<EditDialogState>((set) => ({
  isOpen: false,
  data: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, data: null }),
  dataget: (data) => set({ data }),
}));
