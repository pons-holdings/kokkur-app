"use client";

import { useState, useEffect } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { MapPin, Truck, Clock, Heart, Plus, ChefHat, Leaf } from "lucide-react";
import { useCart } from "@/lib/cart";

type MenuItem = {
  id: number;
  title: string;
  description: string | null;
  price: number;
  stockQuantity: number;
  unitType: string;
  allergens: string[];
  ingredients: string[];
};

type Menu = {
  id: number;
  title: string;
  orderCutoffDate: string;
  fulfillmentDate: string;
  items: MenuItem[];
};

type ChefData = {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  cuisineTags: string[];
  fulfillmentMethods: string;
  deliveryFee: number | null;
  serviceRadius: number;
};

export function ChefStorefront({
  chef,
  menus,
  userId,
  userRole,
}: {
  chef: ChefData;
  menus: Menu[];
  userId: number | null;
  userRole: string | null;
}) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const { addItem, confirmNewCart, cart } = useCart();
  const [conflictItem, setConflictItem] = useState<{
    chefId: number;
    chefName: string;
    chefSlug: string;
    item: Omit<import("@/lib/cart").CartItem, "quantity">;
  } | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    if (userId && userRole === "BUYER") {
      fetch(`/api/favorites?chefId=${chef.id}`)
        .then((res) => res.json())
        .then((data) => setIsFavorite(data.isFavorite))
        .catch(() => {});
    }
  }, [userId, userRole, chef.id]);

  const toggleFavorite = async () => {
    if (!userId) return;
    setFavLoading(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chefId: chef.id }),
      });
      const data = await res.json();
      setIsFavorite(data.isFavorite);
    } catch {
      // ignore
    } finally {
      setFavLoading(false);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    const cartItem = {
      menuItemId: item.id,
      title: item.title,
      price: item.price,
      unitType: item.unitType,
      maxStock: item.stockQuantity,
    };

    const result = addItem(chef.id, chef.name, chef.slug, cartItem);
    if (result === "conflict") {
      setConflictItem({ chefId: chef.id, chefName: chef.name, chefSlug: chef.slug, item: cartItem });
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Chef Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <ChefHat className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{chef.name}</h1>
                <div className="flex gap-1.5 mt-1">
                  {chef.cuisineTags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-4 text-slate-600 max-w-2xl">{chef.bio}</p>
          </div>

          {userId && userRole === "BUYER" && (
            <Button
              variant={isFavorite ? "default" : "outline"}
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={toggleFavorite}
              disabled={favLoading}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
              {isFavorite ? "Favorited" : "Favorite"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {chef.serviceRadius} mi radius
          </div>
          <div className="flex items-center gap-1">
            <Truck className="h-4 w-4" />
            {chef.fulfillmentMethods === "BOTH"
              ? "Pickup & Delivery"
              : chef.fulfillmentMethods === "PICKUP"
              ? "Pickup Only"
              : "Delivery Only"}
          </div>
          {chef.deliveryFee && chef.deliveryFee > 0 && (
            <div>${chef.deliveryFee.toFixed(2)} delivery fee</div>
          )}
        </div>
      </div>

      {/* Menus */}
      {menus.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No active menus right now. Check back soon!</p>
          </CardContent>
        </Card>
      ) : (
        menus.map((menu) => (
          <Card key={menu.id} className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{menu.title}</CardTitle>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Order by {new Date(menu.orderCutoffDate + "T00:00:00").toLocaleDateString()}
                  </span>
                  <span>
                    Fulfills {new Date(menu.fulfillmentDate + "T00:00:00").toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {menu.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border p-4 hover:border-emerald-200 transition-colors cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium">{item.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0 ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(item);
                        }}
                        disabled={item.stockQuantity === 0}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {item.allergens.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {item.allergens.map((a) => (
                          <Badge
                            key={a}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-200"
                          >
                            {a}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-semibold text-emerald-600">
                        ${item.price.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.unitType}</span>
                      {item.stockQuantity <= 5 && item.stockQuantity > 0 && (
                        <span className="text-xs text-red-500 font-medium ml-auto">
                          Only {item.stockQuantity} left
                        </span>
                      )}
                      {item.stockQuantity === 0 && (
                        <span className="text-xs text-red-500 font-medium ml-auto">Sold out</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent>
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedItem.title}</DialogTitle>
                <DialogDescription>{selectedItem.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                    <Leaf className="h-4 w-4 text-emerald-600" />
                    Ingredients
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.ingredients.map((ing) => (
                      <Badge key={ing} variant="secondary" className="text-xs">{ing}</Badge>
                    ))}
                  </div>
                </div>
                {selectedItem.allergens.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2 text-amber-600">
                      Allergens
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedItem.allergens.map((a) => (
                        <Badge key={a} variant="outline" className="text-xs text-amber-600 border-amber-200">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <span className="text-xl font-bold text-emerald-600">
                      ${selectedItem.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">{selectedItem.unitType}</span>
                  </div>
                  <Button
                    onClick={() => {
                      handleAddToCart(selectedItem);
                      setSelectedItem(null);
                    }}
                    disabled={selectedItem.stockQuantity === 0}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add to Cart
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Mixed Cart Conflict Dialog */}
      <Dialog open={!!conflictItem} onOpenChange={() => setConflictItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new order?</DialogTitle>
            <DialogDescription>
              You already have items from <strong>{cart.chefName}</strong> in your cart.
              Adding this item will clear your current cart and start a new order with{" "}
              <strong>{conflictItem?.chefName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflictItem(null)}>
              Keep Current Cart
            </Button>
            <Button
              onClick={() => {
                if (conflictItem) {
                  confirmNewCart(
                    conflictItem.chefId,
                    conflictItem.chefName,
                    conflictItem.chefSlug,
                    conflictItem.item
                  );
                }
                setConflictItem(null);
              }}
            >
              Start New Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
