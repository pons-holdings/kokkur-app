"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, MapPin, CreditCard, Truck, Package, ChefHat, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function CheckoutPage() {
  const { cart, totalAmount, totalItems, clearCart } = useCart();
  const router = useRouter();
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  if (orderComplete) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <CheckCircle className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">Order Placed!</h2>
        <p className="text-muted-foreground mt-2">
          Your order #{orderId} has been placed successfully. The chef will prepare your food.
        </p>
        <Link href="/">
          <Button className="mt-6">Back to Home</Button>
        </Link>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <ShoppingCart className="h-16 w-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">Your cart is empty</h2>
        <Link href="/">
          <Button className="mt-4">Browse Chefs</Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chefId: cart.chefId,
          items: cart.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
          })),
          fulfillmentMethod,
          deliveryAddress: fulfillmentMethod === "DELIVERY" ? deliveryAddress : null,
          deliveryZip: fulfillmentMethod === "DELIVERY" ? deliveryZip : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setOrderId(data.order.id);
      setOrderComplete(true);
      clearCart();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <CreditCard className="h-6 w-6" />
        Checkout
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        {/* Order Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-emerald-600" />
              Order from {cart.chefName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {cart.items.map((item) => (
                <div key={item.menuItemId} className="flex justify-between py-2 text-sm">
                  <span>
                    {item.title} x{item.quantity}
                  </span>
                  <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-3 border-t mt-2 font-bold">
              <span>Total ({totalItems} items)</span>
              <span className="text-emerald-600">${totalAmount.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Fulfillment Method */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fulfillment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFulfillmentMethod("PICKUP")}
                className={`rounded-lg border-2 p-4 text-center transition flex flex-col items-center gap-2 ${
                  fulfillmentMethod === "PICKUP"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <Package className="h-5 w-5" />
                <div className="font-medium">Pickup</div>
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentMethod("DELIVERY")}
                className={`rounded-lg border-2 p-4 text-center transition flex flex-col items-center gap-2 ${
                  fulfillmentMethod === "DELIVERY"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <Truck className="h-5 w-5" />
                <div className="font-medium">Delivery</div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        {fulfillmentMethod === "DELIVERY" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St, Austin TX"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">Zip Code</Label>
                <Input
                  id="zip"
                  placeholder="78701"
                  value={deliveryZip}
                  onChange={(e) => setDeliveryZip(e.target.value)}
                  maxLength={5}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Used to verify you&apos;re within the chef&apos;s delivery radius.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mock Payment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment (Mock)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This is a mock checkout. No real payment will be processed.
            </p>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Placing Order..." : `Place Order - $${totalAmount.toFixed(2)}`}
        </Button>
      </form>
    </div>
  );
}
