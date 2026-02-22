import { useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChefHat,
  Truck,
  Store,
  Calendar,
  UtensilsCrossed,
} from "lucide-react";
import { Header } from "@/components/header";
import { useCartStore } from "@/lib/cart-store";
import { format, parseISO } from "date-fns";

export default function Cart() {
  const { items, removeItem, updateQuantity, getTotal, getItemsByChef, clearCart } = useCartStore();
  const total = getTotal();

  const chefGroups = useMemo(() => {
    const map = getItemsByChef();
    return Array.from(map.entries()).map(([chefId, { chef, items }]) => {
      // Group items by day within each chef
      const dayMap = new Map<string, typeof items>();
      for (const item of items) {
        const key = item.daySlotDate || "unscheduled";
        const existing = dayMap.get(key);
        if (existing) existing.push(item);
        else dayMap.set(key, [item]);
      }
      const subtotal = items.reduce((sum, i) => sum + i.servingOption.price * i.quantity, 0);
      const deliveryFee = chef?.deliveryFee || 0;
      return { chefId, chef, items, dayGroups: dayMap, subtotal, deliveryFee };
    });
  }, [items]);

  const grandDeliveryFee = chefGroups.reduce((sum, g) => sum + g.deliveryFee, 0);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Your Cart is Empty</h1>
          <p className="text-muted-foreground mb-6">
            Browse menus and add delicious meals to your cart.
          </p>
          <Link href="/">
            <Button data-testid="button-browse-chefs">
              <UtensilsCrossed className="h-4 w-4 mr-2" />
              Browse Menus
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Continue Shopping
          </Button>
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your Cart</h1>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={clearCart}
            data-testid="button-clear-cart"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          <div className="space-y-6">
            {chefGroups.map(({ chefId, chef, dayGroups, subtotal }) => (
              <Card key={chefId}>
                {/* Chef header */}
                <CardHeader className="pb-3">
                  <Link href={chef ? `/chef/${chef.slug}` : "/"}>
                    <div className="flex items-center gap-3 cursor-pointer group">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={chef?.profileImageUrl || undefined} alt={chef?.name} referrerPolicy="no-referrer" />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                          {chef?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold group-hover:text-primary transition-colors">
                          {chef?.name || "Chef"}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {chef?.fulfillmentMethod === "both" ? (
                            <>
                              <Truck className="h-3 w-3" />
                              <Store className="h-3 w-3" />
                              <span>Delivery & Pickup</span>
                            </>
                          ) : chef?.fulfillmentMethod === "delivery" ? (
                            <>
                              <Truck className="h-3 w-3" />
                              <span>Delivery</span>
                            </>
                          ) : (
                            <>
                              <Store className="h-3 w-3" />
                              <span>Pickup</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        ${subtotal.toFixed(2)}
                      </Badge>
                    </div>
                  </Link>
                </CardHeader>

                <CardContent className="space-y-4">
                  {Array.from(dayGroups.entries()).map(([dayDate, dayItems]) => (
                    <div key={dayDate}>
                      {/* Day subgroup header */}
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {dayDate !== "unscheduled"
                            ? format(parseISO(dayDate), "EEEE, MMM d")
                            : "Unscheduled"}
                        </span>
                      </div>

                      {/* Item rows */}
                      <div className="space-y-4">
                        {dayItems.map((cartItem) => {
                          const coverPhoto = cartItem.menuItem.coverPhoto ||
                            (cartItem.menuItem.photos && cartItem.menuItem.photos.length > 0
                              ? cartItem.menuItem.photos[0].imageUrl
                              : undefined);
                          return (
                            <div key={`${cartItem.menuItem.id}-${cartItem.daySlotId}`} className="flex gap-4">
                              <div className="h-20 w-20 rounded-md bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/20 flex items-center justify-center shrink-0 overflow-hidden">
                                {coverPhoto ? (
                                  <img
                                    src={coverPhoto}
                                    alt={cartItem.menuItem.title}
                                    className="w-full h-full object-cover"
                                    data-testid={`image-cart-item-${cartItem.menuItem.id}`}
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <ChefHat className="h-8 w-8 text-primary/30" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium truncate">{cartItem.menuItem.title}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      ${cartItem.servingOption.price.toFixed(2)} / {cartItem.servingOption.label}
                                    </p>
                                  </div>
                                  <p className="font-semibold shrink-0">
                                    ${(cartItem.servingOption.price * cartItem.quantity).toFixed(2)}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => updateQuantity(cartItem.menuItem.id, cartItem.daySlotId, cartItem.quantity - 1)}
                                      data-testid={`button-decrease-${cartItem.menuItem.id}`}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="w-8 text-center font-medium">{cartItem.quantity}</span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => updateQuantity(cartItem.menuItem.id, cartItem.daySlotId, cartItem.quantity + 1)}
                                      data-testid={`button-increase-${cartItem.menuItem.id}`}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => removeItem(cartItem.menuItem.id, cartItem.daySlotId)}
                                    data-testid={`button-remove-${cartItem.menuItem.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary Sidebar */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Per-chef subtotals */}
                {chefGroups.map(({ chefId, chef, subtotal, deliveryFee }) => (
                  <div key={chefId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{chef?.name || "Chef"}</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    {deliveryFee > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="pl-2">Delivery fee</span>
                        <span>${deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Fees</span>
                  <span>{grandDeliveryFee > 0 ? `$${grandDeliveryFee.toFixed(2)}` : "Free"}</span>
                </div>

                <Separator />

                <div className="flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-lg">${(total + grandDeliveryFee).toFixed(2)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Link href="/checkout" className="w-full">
                  <Button className="w-full" size="lg" data-testid="button-checkout">
                    Proceed to Checkout
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="ghost" size="sm" data-testid="button-add-more">
                    Add More Items
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
