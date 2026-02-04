import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesState {
  favoriteChefIds: number[];
  toggleFavorite: (chefId: number) => void;
  isFavorite: (chefId: number) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favoriteChefIds: [],
      
      toggleFavorite: (chefId: number) => {
        const state = get();
        if (state.favoriteChefIds.includes(chefId)) {
          set({ favoriteChefIds: state.favoriteChefIds.filter(id => id !== chefId) });
        } else {
          set({ favoriteChefIds: [...state.favoriteChefIds, chefId] });
        }
      },
      
      isFavorite: (chefId: number) => {
        return get().favoriteChefIds.includes(chefId);
      },
    }),
    {
      name: "kokkur-favorites",
    }
  )
);
