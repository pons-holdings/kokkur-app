"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type CartItem = {
  menuItemId: number;
  title: string;
  price: number;
  quantity: number;
  unitType: string;
  maxStock: number;
};

type CartState = {
  chefId: number | null;
  chefName: string;
  chefSlug: string;
  items: CartItem[];
};

type CartContextType = {
  cart: CartState;
  addItem: (chefId: number, chefName: string, chefSlug: string, item: Omit<CartItem, "quantity">) => "added" | "conflict";
  removeItem: (menuItemId: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  clearCart: () => void;
  confirmNewCart: (chefId: number, chefName: string, chefSlug: string, item: Omit<CartItem, "quantity">) => void;
  totalAmount: number;
  totalItems: number;
};

const EMPTY_CART: CartState = { chefId: null, chefName: "", chefSlug: "", items: [] };

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>(EMPTY_CART);

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("kokkur-cart");
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem("kokkur-cart", JSON.stringify(cart));
  }, [cart]);

  const addItem = useCallback(
    (chefId: number, chefName: string, chefSlug: string, item: Omit<CartItem, "quantity">): "added" | "conflict" => {
      if (cart.chefId !== null && cart.chefId !== chefId) {
        return "conflict";
      }

      setCart((prev) => {
        const existing = prev.items.find((i) => i.menuItemId === item.menuItemId);
        if (existing) {
          return {
            ...prev,
            chefId,
            chefName,
            chefSlug,
            items: prev.items.map((i) =>
              i.menuItemId === item.menuItemId
                ? { ...i, quantity: Math.min(i.quantity + 1, i.maxStock) }
                : i
            ),
          };
        }
        return {
          ...prev,
          chefId,
          chefName,
          chefSlug,
          items: [...prev.items, { ...item, quantity: 1 }],
        };
      });
      return "added";
    },
    [cart.chefId]
  );

  const confirmNewCart = useCallback(
    (chefId: number, chefName: string, chefSlug: string, item: Omit<CartItem, "quantity">) => {
      setCart({
        chefId,
        chefName,
        chefSlug,
        items: [{ ...item, quantity: 1 }],
      });
    },
    []
  );

  const removeItem = useCallback((menuItemId: number) => {
    setCart((prev) => {
      const newItems = prev.items.filter((i) => i.menuItemId !== menuItemId);
      if (newItems.length === 0) return EMPTY_CART;
      return { ...prev, items: newItems };
    });
  }, []);

  const updateQuantity = useCallback((menuItemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.menuItemId === menuItemId
          ? { ...i, quantity: Math.min(quantity, i.maxStock) }
          : i
      ),
    }));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setCart(EMPTY_CART);
  }, []);

  const totalAmount = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, addItem, removeItem, updateQuantity, clearCart, confirmNewCart, totalAmount, totalItems }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
