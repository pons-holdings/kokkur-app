import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  CreditCard,
} from "lucide-react";
import { Header } from "@/components/header";
import { MenuItemCard } from "@/components/menu-item-card";
import { AllergenFilter } from "@/components/allergen-filter";
import { useFavoritesStore } from "@/lib/favorites-store";
import { useCartStore } from "@/lib/cart-store";
import { useLocationStore } from "@/lib/location-store";
import { useToast } from "@/hooks/use-toast";
import type { ChefProfileWithDaySlots, Allergen } from "@shared/schema";
import { getDistance } from "geolib";
import { format, isBefore, parseISO } from "date-fns";

export default function ChefProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [excludedAllergens, setExcludedAllergens] = useState<number[]>([]);
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const { addItem } = useCartStore();
  const { lat, lng } = useLocationStore();
  const { toast } = useToast();

  const { data: chef, isLoading: chefLoading } = useQuery<ChefProfileWithDaySlots>({
    queryKey: ["/api/chefs", slug],
    enabled: !!slug,
    staleTime: 0,
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

  // Get upcoming day slots (filter out past dates and sort by date)
  const upcomingDaySlots = useMemo(() => {
    if (!chef?.daySlots) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return chef.daySlots
      .filter((slot: any) => {
        const slotDate = parseISO(slot.date);
        return !isBefore(slotDate, today);
      })
      .sort((a: any, b: any) =>
        parseISO(a.date).getTime() - parseISO(b.date).getTime()
      );
  }, [chef]);

  // Filter day slots by excluded allergens
  const filteredDaySlots = useMemo(() => {
    if (excludedAllergens.length === 0) return upcomingDaySlots;

    return upcomingDaySlots.map((slot: any) => ({
      ...slot,
      items: slot.items?.filter((item: any) => {
        const itemAllergenIds = item.allergens?.map((a: any) => a.id) || [];
        return !excludedAllergens.some((excluded) =>
          itemAllergenIds.includes(excluded)
        );
      }),
    }));
  }, [upcomingDaySlots, excludedAllergens]);

  const toggleAllergen = (allergenId: number) => {
    setExcludedAllergens((prev) =>
      prev.includes(allergenId)
        ? prev.filter((id) => id !== allergenId)
        : [...prev, allergenId]
    );
  };

  const handleAddToCart = (item: any, slotId: number, slotDate: string) => {
    if (!chef) return;

    addItem(item, chef, slotId, slotDate);
    toast({
      title: "Added to cart",
      description: `${item.title} has been added to your cart.`,
    });
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
                      <AvatarImage src={chef.profileImageUrl || undefined} alt={chef.name} referrerPolicy="no-referrer" />
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

                {(() => {
                  const methods = chef.paymentMethods as Array<{ method: string; handle: string }> | null;
                  if (!methods || methods.length === 0) return null;
                  const methodLabels: Record<string, string> = {
                    venmo: "Venmo",
                    paypal: "PayPal",
                    zelle: "Zelle",
                    cashapp: "Cash App",
                    cash: "Cash",
                    other: "Other",
                  };
                  return (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <CreditCard className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Payment</p>
                        <div className="space-y-1 mt-0.5">
                          {methods.map((pm, i) => (
                            <p key={i} className="text-muted-foreground">
                              <span className="font-medium text-foreground">{methodLabels[pm.method] || pm.method}</span>{" "}
                              {pm.handle}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Upcoming Offerings</h2>
              {filteredDaySlots.length > 0 && (
                <Badge variant="outline" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {filteredDaySlots.length} {filteredDaySlots.length === 1 ? 'day' : 'days'} available
                </Badge>
              )}
            </div>

            {filteredDaySlots.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <ChefHat className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Upcoming Offerings</h3>
                  <p className="text-muted-foreground">
                    {excludedAllergens.length > 0
                      ? "No offerings match your allergen filters. Try adjusting your filters."
                      : "This chef doesn't have any upcoming food offerings scheduled."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {filteredDaySlots.map((slot: any) => (
                  <div key={slot.id} className="space-y-4" data-testid={`day-slot-${slot.id}`}>
                    <div className="flex items-center gap-4 py-2 border-b">
                      <h3 className="font-medium text-lg">
                        {format(parseISO(slot.date), 'EEEE, MMM d')}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                        <Clock className="h-4 w-4" />
                        Order by {format(parseISO(slot.orderCutoffDate), 'MMM d')}
                      </div>
                    </div>

                    {slot.items?.length > 0 ? (
                      <div className="grid sm:grid-cols-2 gap-6">
                        {slot.items.map((item: any) => (
                          <MenuItemCard
                            key={`${slot.id}-${item.id}`}
                            item={item}
                            chef={chef}
                            daySlotId={slot.id}
                            daySlotDate={slot.date}
                            orderCutoffDate={slot.orderCutoffDate}
                            onAddToCart={() => handleAddToCart(item, slot.id, slot.date)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4">
                        {excludedAllergens.length > 0
                          ? "No items match your allergen filters for this day."
                          : "No items scheduled for this day."}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
