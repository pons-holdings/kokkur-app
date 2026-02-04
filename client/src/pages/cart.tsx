import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChefHat,
  Truck,
  Store,
} from "lucide-react";
import { Header } from "@/components/header";
import { useCartStore } from "@/lib/cart-store";

export default function Cart() {
  const { items, chef, removeItem, updateQuantity, getTotal, clearCart } = useCartStore();
  const total = getTotal();
  const deliveryFee = chef?.deliveryFee || 0;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Your Cart is Empty</h1>
          <p className="text-muted-foreground mb-6">
            Discover local chefs and add delicious meals to your cart.
          </p>
          <Link href="/">
            <Button data-testid="button-browse-chefs">
              <ChefHat className="h-4 w-4 mr-2" />
              Browse Chefs
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

        <h1 className="text-2xl font-bold mb-6">Your Cart</h1>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          <div className="space-y-4">
            {chef && (
              <Card>
                <CardContent className="py-4">
                  <Link href={`/chef/${chef.slug}`}>
                    <div className="flex items-center gap-3 cursor-pointer group" data-testid="link-chef">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                        <ChefHat className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium group-hover:text-primary transition-colors">
                          {chef.name}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {chef.fulfillmentMethod === "both" ? (
                            <>
                              <Truck className="h-3.5 w-3.5" />
                              <Store className="h-3.5 w-3.5" />
                              <span>Delivery & Pickup</span>
                            </>
                          ) : chef.fulfillmentMethod === "delivery" ? (
                            <>
                              <Truck className="h-3.5 w-3.5" />
                              <span>Delivery</span>
                            </>
                          ) : (
                            <>
                              <Store className="h-3.5 w-3.5" />
                              <span>Pickup</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Items ({items.length})</span>
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
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((cartItem) => (
                  <div key={cartItem.menuItem.id} className="flex gap-4">
                    <div className="h-20 w-20 rounded-md bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/20 flex items-center justify-center shrink-0 overflow-hidden">
                      {cartItem.menuItem.imageUrl ? (
                        <img
                          src={cartItem.menuItem.imageUrl}
                          alt={cartItem.menuItem.title}
                          className="w-full h-full object-cover"
                          data-testid={`image-cart-item-${cartItem.menuItem.id}`}
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
                            ${cartItem.menuItem.price.toFixed(2)} / {cartItem.menuItem.unitType}
                          </p>
                        </div>
                        <p className="font-semibold shrink-0">
                          ${(cartItem.menuItem.price * cartItem.quantity).toFixed(2)}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(cartItem.menuItem.id, cartItem.quantity - 1)}
                            data-testid={`button-decrease-${cartItem.menuItem.id}`}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{cartItem.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(cartItem.menuItem.id, cartItem.quantity + 1)}
                            disabled={cartItem.quantity >= cartItem.menuItem.stockQuantity}
                            data-testid={`button-increase-${cartItem.menuItem.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeItem(cartItem.menuItem.id)}
                          data-testid={`button-remove-${cartItem.menuItem.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {cartItem.quantity >= cartItem.menuItem.stockQuantity && (
                        <Badge variant="secondary" className="mt-2 text-xs">
                          Max quantity reached
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>{deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : "Free"}</span>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-lg">${(total + deliveryFee).toFixed(2)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Link href="/checkout" className="w-full">
                  <Button className="w-full" size="lg" data-testid="button-checkout">
                    Proceed to Checkout
                  </Button>
                </Link>
                <Link href={chef ? `/chef/${chef.slug}` : "/"}>
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
