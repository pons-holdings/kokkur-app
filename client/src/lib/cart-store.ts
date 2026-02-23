import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MenuItemWithDetails, ChefProfile, ServingOption } from "@shared/schema";

export interface CartItem {
  menuItem: MenuItemWithDetails;
  servingOption: ServingOption;
  quantity: number;
  chefId: number;
  chef: ChefProfile;
  daySlotId: number;
  daySlotDate: string; // ISO string for display
}

export interface CartState {
  items: CartItem[];
  addItem: (item: MenuItemWithDetails, chef: ChefProfile, daySlotId: number, daySlotDate: string, servingOption?: ServingOption) => void;
  removeItem: (menuItemId: number, daySlotId: number) => void;
  updateQuantity: (menuItemId: number, daySlotId: number, quantity: number) => void;
  updateServingOption: (menuItemId: number, daySlotId: number, servingOption: ServingOption) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  getItemsByChef: () => Map<number, { chef: ChefProfile; items: CartItem[] }>;
  getItemsByDay: () => Map<string, CartItem[]>;
}

function getDefaultServingOption(item: MenuItemWithDetails): ServingOption {
  if (item.servingOptions && item.servingOptions.length > 0) {
    return item.servingOptions.find(o => o.isDefault === 1) || item.servingOptions[0];
  }
  return { id: 0, menuItemId: item.id, servingSize: 1, label: "1 serving", price: 0, isDefault: 1 };
}

// Migrate old cart format (version 1) to new format (version 2)
function migrateCart(persisted: any): any {
  if (!persisted || !persisted.state) return persisted;
  const state = persisted.state;

  // Old format had chefId/chef at top level — migrate to per-item
  if (state.chefId !== undefined || state.chef !== undefined) {
    const oldChef = state.chef;
    const oldChefId = state.chefId;
    const newItems = (state.items || []).map((item: any) => ({
      ...item,
      chefId: item.chefId ?? oldChefId ?? 0,
      chef: item.chef ?? oldChef ?? null,
      daySlotId: item.daySlotId ?? 0,
      daySlotDate: item.daySlotDate ?? "",
    }));
    return {
      ...persisted,
      version: 2,
      state: { items: newItems },
    };
  }

  return persisted;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item: MenuItemWithDetails, chef: ChefProfile, daySlotId: number, daySlotDate: string, servingOption?: ServingOption) => {
        const state = get();
        const option = servingOption || getDefaultServingOption(item);
        const existingItem = state.items.find(
          i => i.menuItem.id === item.id && i.daySlotId === daySlotId
        );

        if (existingItem) {
          set({
            items: state.items.map(i =>
              i.menuItem.id === item.id && i.daySlotId === daySlotId
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          });
        } else {
          set({
            items: [
              ...state.items,
              { menuItem: item, servingOption: option, quantity: 1, chefId: chef.id, chef, daySlotId, daySlotDate },
            ],
          });
        }
      },

      removeItem: (menuItemId: number, daySlotId: number) => {
        const state = get();
        set({
          items: state.items.filter(
            i => !(i.menuItem.id === menuItemId && i.daySlotId === daySlotId)
          ),
        });
      },

      updateQuantity: (menuItemId: number, daySlotId: number, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId, daySlotId);
          return;
        }

        const state = get();
        set({
          items: state.items.map(i =>
            i.menuItem.id === menuItemId && i.daySlotId === daySlotId
              ? { ...i, quantity }
              : i
          ),
        });
      },

      updateServingOption: (menuItemId: number, daySlotId: number, servingOption: ServingOption) => {
        const state = get();
        set({
          items: state.items.map(i =>
            i.menuItem.id === menuItemId && i.daySlotId === daySlotId
              ? { ...i, servingOption }
              : i
          ),
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotal: () => {
        return get().items.reduce((sum, item) => sum + (item.servingOption.price * item.quantity), 0);
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getItemsByChef: () => {
        const map = new Map<number, { chef: ChefProfile; items: CartItem[] }>();
        for (const item of get().items) {
          const existing = map.get(item.chefId);
          if (existing) {
            existing.items.push(item);
          } else {
            map.set(item.chefId, { chef: item.chef, items: [item] });
          }
        }
        return map;
      },

      getItemsByDay: () => {
        const map = new Map<string, CartItem[]>();
        for (const item of get().items) {
          const key = item.daySlotDate || "unscheduled";
          const existing = map.get(key);
          if (existing) {
            existing.push(item);
          } else {
            map.set(key, [item]);
          }
        }
        return map;
      },
    }),
    {
      name: "kokkur-cart",
      version: 2,
      migrate: migrateCart,
    }
  )
);
