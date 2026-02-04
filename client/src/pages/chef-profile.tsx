import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  MapPin,
  Truck,
  Store,
  ArrowLeft,
  Calendar,
  Clock,
  ChefHat,
  AlertTriangle,
} from "lucide-react";
import { Header } from "@/components/header";
import { MenuItemCard } from "@/components/menu-item-card";
import { AllergenFilter } from "@/components/allergen-filter";
import { CartClearModal } from "@/components/cart-clear-modal";
import { useFavoritesStore } from "@/lib/favorites-store";
import { useCartStore } from "@/lib/cart-store";
import { useLocationStore } from "@/lib/location-store";
import { useToast } from "@/hooks/use-toast";
import type { ChefProfileWithMenus, Allergen } from "@shared/schema";
import { getDistance } from "geolib";

export default function ChefProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [excludedAllergens, setExcludedAllergens] = useState<number[]>([]);
  const [cartClearModalOpen, setCartClearModalOpen] = useState(false);
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const { wouldRequireClear, clearCart, addItem } = useCartStore();
  const { lat, lng } = useLocationStore();
  const { toast } = useToast();
  const [pendingItem, setPendingItem] = useState<any>(null);

  const { data: chef, isLoading: chefLoading } = useQuery<ChefProfileWithMenus>({
    queryKey: ["/api/chefs", slug],
    enabled: !!slug,
  });

  const { data: allergens } = useQuery<Allergen[]>({
    queryKey: ["/api/allergens"],
  });

  const distance = useMemo(() => {
    if (!chef || !lat || !lng) return null;
    const distanceMeters = getDistance(
      { latitude: lat, longitude: lng },
      { latitude: chef.locationLat, longitude: chef.locationLong }
    );
    return distanceMeters / 1609.34;
  }, [chef, lat, lng]);

  const favorite = chef ? isFavorite(chef.id) : false;

  const activeMenus = useMemo(() => {
    if (!chef?.menus) return [];
    return chef.menus.filter((m) => m.status === "active");
  }, [chef]);

  // Helper to get all items from a menu's day slots
  const getMenuItems = (menu: any) => {
    const allItems: any[] = [];
    const seenIds = new Set<number>();
    menu.daySlots?.forEach((slot: any) => {
      slot.items?.forEach((item: any) => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allItems.push(item);
        }
      });
    });
    return allItems;
  };

  // Filter items by excluded allergens within day slots
  const filteredMenus = useMemo(() => {
    if (excludedAllergens.length === 0) return activeMenus;

    return activeMenus.map((menu: any) => ({
      ...menu,
      daySlots: menu.daySlots?.map((slot: any) => ({
        ...slot,
        items: slot.items?.filter((item: any) => {
          const itemAllergenIds = item.allergens?.map((a: any) => a.id) || [];
          return !excludedAllergens.some((excluded) =>
            itemAllergenIds.includes(excluded)
          );
        }),
      })),
    }));
  }, [activeMenus, excludedAllergens]);

  const toggleAllergen = (allergenId: number) => {
    setExcludedAllergens((prev) =>
      prev.includes(allergenId)
        ? prev.filter((id) => id !== allergenId)
        : [...prev, allergenId]
    );
  };

  const handleAddToCart = (item: any) => {
    if (!chef) return;

    if (wouldRequireClear(chef.id)) {
      setPendingItem(item);
      setCartClearModalOpen(true);
      return;
    }

    const success = addItem(item, chef);
    if (success) {
      toast({
        title: "Added to cart",
        description: `${item.title} has been added to your cart.`,
      });
    }
  };

  const handleConfirmClear = () => {
    if (pendingItem && chef) {
      clearCart();
      addItem(pendingItem, chef);
      toast({
        title: "Cart updated",
        description: `Started new order with ${pendingItem.title}.`,
      });
      setPendingItem(null);
    }
  };

  const getFulfillmentInfo = () => {
    if (!chef) return { icon: null, label: "" };
    switch (chef.fulfillmentMethod) {
      case "delivery":
        return { icon: <Truck className="h-4 w-4" />, label: "Delivery only" };
      case "pickup":
        return { icon: <Store className="h-4 w-4" />, label: "Pickup only" };
      default:
        return {
          icon: (
            <>
              <Truck className="h-4 w-4" />
              <Store className="h-4 w-4" />
            </>
          ),
          label: "Delivery & Pickup",
        };
    }
  };

  if (chefLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-6 w-32 mb-8" />
          <div className="grid lg:grid-cols-[320px_1fr] gap-8">
            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-24" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div>
              <Skeleton className="h-10 w-full mb-6" />
              <div className="grid sm:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <Skeleton className="h-40" />
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!chef) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <ChefHat className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Chef Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This chef profile doesn't exist or may have been removed.
          </p>
          <Link href="/">
            <Button data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const fulfillmentInfo = getFulfillmentInfo();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Chefs
          </Button>
        </Link>

        <div className="grid lg:grid-cols-[320px_1fr] gap-8">
          <aside className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
                      <AvatarImage src={chef.profileImageUrl || undefined} alt={chef.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                        {chef.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
                      onClick={() => toggleFavorite(chef.id)}
                      data-testid="button-toggle-favorite"
                    >
                      <Heart
                        className={`h-4 w-4 transition-colors ${
                          favorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                        }`}
                      />
                    </Button>
                  </div>

                  <div>
                    <h1 className="text-xl font-bold">{chef.name}</h1>
                    {chef.locationName && (
                      <p className="text-sm text-muted-foreground">{chef.locationName}</p>
                    )}
                  </div>

                  {chef.cuisineTags && chef.cuisineTags.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {chef.cuisineTags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {chef.bio && (
                    <p className="text-sm text-muted-foreground">{chef.bio}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Service Area</p>
                    <p className="text-muted-foreground">
                      {chef.serviceRadius} mile radius
                      {distance !== null && (
                        <span className="ml-1">({distance.toFixed(1)} mi away)</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 gap-0.5">
                    {fulfillmentInfo.icon}
                  </div>
                  <div>
                    <p className="font-medium">Fulfillment</p>
                    <p className="text-muted-foreground">
                      {fulfillmentInfo.label}
                      {chef.deliveryFee && chef.deliveryFee > 0 && (
                        <span className="ml-1">(${chef.deliveryFee.toFixed(2)} delivery)</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {allergens && allergens.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Dietary Filters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AllergenFilter
                    allergens={allergens}
                    excludedAllergens={excludedAllergens}
                    onToggleAllergen={toggleAllergen}
                    onClearFilters={() => setExcludedAllergens([])}
                  />
                </CardContent>
              </Card>
            )}
          </aside>

          <main>
            {filteredMenus.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <ChefHat className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Active Menus</h3>
                  <p className="text-muted-foreground">
                    This chef doesn't have any active menus right now.
                  </p>
                </CardContent>
              </Card>
            ) : filteredMenus.length === 1 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{filteredMenus[0].title}</h2>
                    {filteredMenus[0].description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {filteredMenus[0].description}
                      </p>
                    )}
                  </div>
                  {(filteredMenus[0] as any).weekStartDate && (
                    <Badge variant="outline" className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Week of {new Date((filteredMenus[0] as any).weekStartDate).toLocaleDateString()}
                    </Badge>
                  )}
                </div>

                {/* Display items by day slots */}
                {(filteredMenus[0] as any).daySlots?.length > 0 ? (
                  (filteredMenus[0] as any).daySlots.map((slot: any) => (
                    <div key={slot.id} className="space-y-4">
                      <div className="flex items-center gap-4 py-2 border-b">
                        <h3 className="font-medium">
                          {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </h3>
                        <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                          <Clock className="h-4 w-4" />
                          Order by {new Date(slot.orderCutoffDate).toLocaleDateString()}
                        </div>
                      </div>

                      {slot.items?.length > 0 ? (
                        <div className="grid sm:grid-cols-2 gap-6">
                          {slot.items.map((item: any) => (
                            <MenuItemCard
                              key={`${slot.id}-${item.id}`}
                              item={item}
                              chef={chef}
                              onAddToCart={() => handleAddToCart(item)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4">No items available for this day after filtering.</p>
                      )}
                    </div>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">No available days for this menu.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Tabs defaultValue={filteredMenus[0]?.id.toString()} className="space-y-6">
                <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
                  {filteredMenus.map((menu) => (
                    <TabsTrigger
                      key={menu.id}
                      value={menu.id.toString()}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      data-testid={`tab-menu-${menu.id}`}
                    >
                      {menu.title}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {filteredMenus.map((menu: any) => (
                  <TabsContent key={menu.id} value={menu.id.toString()} className="space-y-6">
                    {menu.description && (
                      <p className="text-muted-foreground">{menu.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {menu.weekStartDate && (
                        <Badge variant="outline" className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          Week of {new Date(menu.weekStartDate).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>

                    {/* Display items by day slots */}
                    {menu.daySlots?.length > 0 ? (
                      menu.daySlots.map((slot: any) => (
                        <div key={slot.id} className="space-y-4">
                          <div className="flex items-center gap-4 py-2 border-b">
                            <h3 className="font-medium">
                              {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </h3>
                            <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                              <Clock className="h-4 w-4" />
                              Order by {new Date(slot.orderCutoffDate).toLocaleDateString()}
                            </div>
                          </div>

                          {slot.items?.length > 0 ? (
                            <div className="grid sm:grid-cols-2 gap-6">
                              {slot.items.map((item: any) => (
                                <MenuItemCard
                                  key={`${slot.id}-${item.id}`}
                                  item={item}
                                  chef={chef}
                                  onAddToCart={() => handleAddToCart(item)}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground py-4">
                              {excludedAllergens.length > 0
                                ? "No items match your allergen filters for this day."
                                : "No items available for this day."}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <p className="text-muted-foreground">
                            {excludedAllergens.length > 0
                              ? "No items match your allergen filters."
                              : "No items in this menu."}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </main>
        </div>
      </div>

      <CartClearModal
        open={cartClearModalOpen}
        onOpenChange={setCartClearModalOpen}
        newChefName={chef.name}
        onConfirm={handleConfirmClear}
      />
    </div>
  );
}
