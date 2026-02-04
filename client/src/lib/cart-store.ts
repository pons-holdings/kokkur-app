import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MenuItem, ChefProfile } from "@shared/schema";

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  chefId: number | null;
  chef: ChefProfile | null;
  addItem: (item: MenuItem, chef: ChefProfile) => boolean;
  removeItem: (menuItemId: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  wouldRequireClear: (chefId: number) => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      chefId: null,
      chef: null,
      
      addItem: (item: MenuItem, chef: ChefProfile) => {
        const state = get();
        
        if (state.chefId && state.chefId !== chef.id) {
          return false;
        }
        
        const existingItem = state.items.find(i => i.menuItem.id === item.id);
        
        if (existingItem) {
          set({
            items: state.items.map(i => 
              i.menuItem.id === item.id 
                ? { ...i, quantity: Math.min(i.quantity + 1, item.stockQuantity) }
                : i
            ),
          });
        } else {
          set({
            items: [...state.items, { menuItem: item, quantity: 1 }],
            chefId: chef.id,
            chef: chef,
          });
        }
        
        return true;
      },
      
      removeItem: (menuItemId: number) => {
        const state = get();
        const newItems = state.items.filter(i => i.menuItem.id !== menuItemId);
        
        set({
          items: newItems,
          chefId: newItems.length > 0 ? state.chefId : null,
          chef: newItems.length > 0 ? state.chef : null,
        });
      },
      
      updateQuantity: (menuItemId: number, quantity: number) => {
        const state = get();
        
        if (quantity <= 0) {
          get().removeItem(menuItemId);
          return;
        }
        
        set({
          items: state.items.map(i =>
            i.menuItem.id === menuItemId
              ? { ...i, quantity: Math.min(quantity, i.menuItem.stockQuantity) }
              : i
          ),
        });
      },
      
      clearCart: () => {
        set({ items: [], chefId: null, chef: null });
      },
      
      getTotal: () => {
        return get().items.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
      },
      
      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
      
      wouldRequireClear: (chefId: number) => {
        const state = get();
        return state.chefId !== null && state.chefId !== chefId && state.items.length > 0;
      },
    }),
    {
      name: "kokkur-cart",
    }
  )
);
