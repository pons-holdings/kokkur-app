"use client";

import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Minus, Plus, Trash2, ChefHat } from "lucide-react";
import Link from "next/link";

export default function CartPage() {
  const { cart, updateQuantity, removeItem, clearCart, totalAmount, totalItems } = useCart();

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <ShoppingCart className="h-16 w-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">Your cart is empty</h2>
        <p className="text-muted-foreground mt-2">
          Browse local chefs and add some delicious items to your cart.
        </p>
        <Link href="/">
          <Button className="mt-6">Browse Chefs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" />
          Your Cart
        </h1>
        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={clearCart}>
          Clear Cart
        </Button>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-base">
              <Link href={`/chef/${cart.chefSlug}`} className="hover:underline">
                {cart.chefName}
              </Link>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {cart.items.map((item) => (
              <div key={item.menuItemId} className="flex items-center justify-between py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    ${item.price.toFixed(2)} {item.unitType}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                    disabled={item.quantity >= item.maxStock}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-500"
                    onClick={() => removeItem(item.menuItemId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <span className="w-16 text-right font-medium text-sm">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-emerald-600">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
          <Link href="/checkout">
            <Button className="w-full mt-4" size="lg">
              Proceed to Checkout
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
