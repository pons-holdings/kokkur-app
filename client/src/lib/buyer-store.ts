import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BuyerState {
  sessionId: string;
  profileId: number | null;
  setProfileId: (id: number) => void;
}

export const useBuyerStore = create<BuyerState>()(
  persist(
    (set) => ({
      sessionId: crypto.randomUUID(),
      profileId: null,
      setProfileId: (id: number) => set({ profileId: id }),
    }),
    {
      name: "buyer-session",
    }
  )
);
