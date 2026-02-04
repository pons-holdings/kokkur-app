import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MenuItemWithDetails, ChefProfile, ServingOption } from "@shared/schema";

export interface CartItem {
  menuItem: MenuItemWithDetails;
  servingOption: ServingOption;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  chefId: number | null;
  chef: ChefProfile | null;
  addItem: (item: MenuItemWithDetails, chef: ChefProfile, servingOption?: ServingOption) => boolean;
  removeItem: (menuItemId: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  wouldRequireClear: (chefId: number) => boolean;
}

function getDefaultServingOption(item: MenuItemWithDetails): ServingOption {
  if (item.servingOptions && item.servingOptions.length > 0) {
    return item.servingOptions.find(o => o.isDefault === 1) || item.servingOptions[0];
  }
  return { id: 0, menuItemId: item.id, servingSize: 1, label: "1 serving", price: 0, isDefault: 1 };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      chefId: null,
      chef: null,
      
      addItem: (item: MenuItemWithDetails, chef: ChefProfile, servingOption?: ServingOption) => {
        const state = get();
        
        if (state.chefId && state.chefId !== chef.id) {
          return false;
        }
        
        const option = servingOption || getDefaultServingOption(item);
        const existingItem = state.items.find(i => i.menuItem.id === item.id);
        
        if (existingItem) {
          set({
            items: state.items.map(i => 
              i.menuItem.id === item.id 
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          });
        } else {
          set({
            items: [...state.items, { menuItem: item, servingOption: option, quantity: 1 }],
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
              ? { ...i, quantity }
              : i
          ),
        });
      },
      
      clearCart: () => {
        set({ items: [], chefId: null, chef: null });
      },
      
      getTotal: () => {
        return get().items.reduce((sum, item) => sum + (item.servingOption.price * item.quantity), 0);
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
