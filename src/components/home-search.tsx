"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Search, MapPin, Clock, Truck, ShoppingBag, AlertTriangle, Plus, X } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";

type MenuItem = {
  id: number;
  title: string;
  description: string;
  price: number;
  stockQuantity: number;
  unitType: string;
  allergens: string[];
};

type Menu = {
  id: number;
  title: string;
  orderCutoffDate: string;
  fulfillmentDate: string;
  items: MenuItem[];
};

type ChefResult = {
  chef: {
    id: number;
    name: string;
    slug: string;
    bio: string;
    cuisineTags: string[];
    fulfillmentMethods: string;
    deliveryFee: number;
    profileImageUrl: string;
  };
  menus: Menu[];
  distance: number | null;
};

type Allergen = { id: number; name: string };

export function HomeSearch({ userId }: { userId: number | null }) {
  const [zip, setZip] = useState("");
  const [searchedZip, setSearchedZip] = useState("");
  const [results, setResults] = useState<ChefResult[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const { addItem, confirmNewCart, cart } = useCart();
  const [conflictItem, setConflictItem] = useState<{
    chefId: number;
    chefName: string;
    chefSlug: string;
    item: Omit<import("@/lib/cart").CartItem, "quantity">;
  } | null>(null);

  const doSearch = useCallback(async (zipCode: string, excluded: string[]) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (zipCode) params.set("zip", zipCode);
      excluded.forEach((a) => params.append("exclude", a));

      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setResults([]);
        return;
      }

      setResults(data.results);
      setAllergens(data.allergens);
      setHasSearched(true);
    } catch {
      setError("Failed to search");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial data (no zip filter)
  useEffect(() => {
    doSearch("", []);
  }, [doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedZip(zip);
    doSearch(zip, excludedAllergens);
  };

  const toggleAllergen = (name: string) => {
    const next = excludedAllergens.includes(name)
      ? excludedAllergens.filter((a) => a !== name)
      : [...excludedAllergens, name];
    setExcludedAllergens(next);
    doSearch(searchedZip, next);
  };

  const handleAddToCart = (chef: ChefResult["chef"], item: MenuItem) => {
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
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar */}
      <div className="w-full lg:w-72 shrink-0 space-y-6">
        {/* Location Search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Your Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Zip code (e.g. 78701)"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                maxLength={5}
              />
              <Button type="submit" size="icon" disabled={loading}>
                <Search className="h-4 w-4" />
              </Button>
            </form>
            {searchedZip && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Showing results near {searchedZip}
                <button
                  className="ml-auto text-emerald-600 hover:underline"
                  onClick={() => {
                    setZip("");
                    setSearchedZip("");
                    doSearch("", excludedAllergens);
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Allergen Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Allergens to Exclude
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {allergens.map((allergen) => (
                <label key={allergen.id} className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={excludedAllergens.includes(allergen.name)}
                    onCheckedChange={() => toggleAllergen(allergen.name)}
                  />
                  <span className="text-sm">{allergen.name}</span>
                </label>
              ))}
            </div>
            {excludedAllergens.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex flex-wrap gap-1">
                  {excludedAllergens.map((name) => (
                    <Badge key={name} variant="secondary" className="gap-1 text-xs">
                      {name}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => toggleAllergen(name)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <div className="flex-1">
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : results.length === 0 && hasSearched ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No chefs found</h3>
            <p className="text-muted-foreground mt-1">
              Try adjusting your location or allergen filters.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {results.map((result) => (
              <Card key={result.chef.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link href={`/chef/${result.chef.slug}`} className="hover:underline">
                        <CardTitle className="text-xl">{result.chef.name}</CardTitle>
                      </Link>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{result.chef.bio}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex gap-1.5">
                          {result.chef.cuisineTags.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      {result.distance !== null && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {result.distance} mi
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Truck className="h-3 w-3" />
                        {result.chef.fulfillmentMethods === "BOTH"
                          ? "Pickup & Delivery"
                          : result.chef.fulfillmentMethods === "PICKUP"
                          ? "Pickup Only"
                          : "Delivery Only"}
                      </div>
                      {result.chef.deliveryFee > 0 && (
                        <div className="text-xs text-muted-foreground">
                          + ${result.chef.deliveryFee.toFixed(2)} delivery
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {result.menus.map((menu) => (
                    <div key={menu.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="font-medium text-sm">{menu.title}</h4>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Order by {new Date(menu.orderCutoffDate + "T00:00:00").toLocaleDateString()}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {menu.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between rounded-lg border p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{item.title}</div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {item.description}
                              </p>
                              {item.allergens.length > 0 && (
                                <div className="flex gap-1 mt-1.5 flex-wrap">
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
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="font-semibold text-sm text-emerald-600">
                                  ${item.price.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {item.unitType}
                                </span>
                                {item.stockQuantity <= 5 && (
                                  <span className="text-[10px] text-red-500 font-medium">
                                    Only {item.stockQuantity} left
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 shrink-0 ml-2"
                              onClick={() => handleAddToCart(result.chef, item)}
                              disabled={item.stockQuantity === 0}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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
