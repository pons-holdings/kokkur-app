import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  MapPin, 
  ChefHat, 
  Search,
  Leaf,
  ShieldCheck,
  Heart,
  X,
  UtensilsCrossed
} from "lucide-react";
import { Header } from "@/components/header";
import { ChefCard } from "@/components/chef-card";
import { AllergenFilter } from "@/components/allergen-filter";
import { LocationModal } from "@/components/location-modal";
import { useLocationStore } from "@/lib/location-store";
import { useFavoritesStore } from "@/lib/favorites-store";
import type { ChefProfileWithMenus, Allergen } from "@shared/schema";
import { getDistance } from "geolib";

export default function Home() {
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [excludedAllergens, setExcludedAllergens] = useState<number[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { zipCode, lat, lng } = useLocationStore();
  const { favoriteChefIds } = useFavoritesStore();

  useEffect(() => {
    if (!zipCode) {
      const timer = setTimeout(() => setLocationModalOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [zipCode]);

  const { data: chefs, isLoading: chefsLoading } = useQuery<ChefProfileWithMenus[]>({
    queryKey: ["/api/chefs"],
  });

  const { data: allergens, isLoading: allergensLoading } = useQuery<Allergen[]>({
    queryKey: ["/api/allergens"],
  });

  const searchLower = searchQuery.toLowerCase().trim();

  const filteredChefs = useMemo(() => {
    if (!chefs) return [];

    let result = chefs.map((chef) => {
      if (lat && lng) {
        const distance = getDistance(
          { latitude: lat, longitude: lng },
          { latitude: chef.locationLat, longitude: chef.locationLong }
        );
        const distanceMiles = distance / 1609.34;
        return { ...chef, distance: distanceMiles };
      }
      return chef;
    });

    if (lat && lng) {
      result = result.filter((chef) => {
        return (chef.distance || 0) <= chef.serviceRadius;
      });
    }

    if (showFavoritesOnly) {
      result = result.filter((chef) => favoriteChefIds.includes(chef.id));
    }

    if (excludedAllergens.length > 0) {
      result = result.map((chef: any) => {
        const filteredMenus = chef.menus?.map((menu: any) => ({
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
        return { ...chef, menus: filteredMenus };
      });

      result = result.filter((chef: any) =>
        chef.menus?.some((menu: any) => 
          menu.daySlots?.some((slot: any) => (slot.items?.length || 0) > 0)
        )
      );
    }

    // Apply search filter
    if (searchLower) {
      result = result.map((chef: any) => {
        // Check if chef name or cuisine tags match
        const chefNameMatch = chef.name.toLowerCase().includes(searchLower);
        const cuisineMatch = chef.cuisineTags?.some((tag: string) =>
          tag.toLowerCase().includes(searchLower)
        );

        // Filter menu items by search query (within day slots)
        const filteredMenus = chef.menus?.map((menu: any) => ({
          ...menu,
          daySlots: menu.daySlots?.map((slot: any) => ({
            ...slot,
            items: slot.items?.filter((item: any) =>
              item.title.toLowerCase().includes(searchLower) ||
              item.description?.toLowerCase().includes(searchLower) ||
              item.ingredients?.some((ing: any) => 
                ing.name.toLowerCase().includes(searchLower)
              )
            ),
          })),
        }));

        // If chef name or cuisine matches, keep all items
        // Otherwise only keep matching items
        if (chefNameMatch || cuisineMatch) {
          return chef;
        }

        return { ...chef, menus: filteredMenus, matchedByDish: true };
      });

      // Filter out chefs with no matching content
      result = result.filter((chef: any) => {
        const chefNameMatch = chef.name.toLowerCase().includes(searchLower);
        const cuisineMatch = chef.cuisineTags?.some((tag: string) =>
          tag.toLowerCase().includes(searchLower)
        );
        const hasMatchingItems = chef.menus?.some((menu: any) => 
          menu.daySlots?.some((slot: any) => (slot.items?.length || 0) > 0)
        );

        return chefNameMatch || cuisineMatch || hasMatchingItems;
      });
    }

    result.sort((a, b) => (a.distance || 999) - (b.distance || 999));

    return result;
  }, [chefs, lat, lng, excludedAllergens, showFavoritesOnly, favoriteChefIds, searchLower]);

  // Get matching menu items for search results display
  const searchResults = useMemo(() => {
    if (!searchLower || !filteredChefs.length) return null;

    const matchingItems: Array<{
      chef: any;
      item: any;
      menuTitle: string;
      dayDate: Date | string | null;
    }> = [];

    filteredChefs.forEach((chef: any) => {
      chef.menus?.forEach((menu: any) => {
        menu.daySlots?.forEach((slot: any) => {
          slot.items?.forEach((item: any) => {
            const itemMatches = 
              item.title.toLowerCase().includes(searchLower) ||
              item.description?.toLowerCase().includes(searchLower) ||
              item.ingredients?.some((ing: any) => 
                ing.name.toLowerCase().includes(searchLower)
              );
            
            if (itemMatches) {
              matchingItems.push({
                chef,
                item,
                menuTitle: menu.title,
                dayDate: slot.date,
              });
            }
          });
        });
      });
    });

    return matchingItems.length > 0 ? matchingItems : null;
  }, [filteredChefs, searchLower]);

  const toggleAllergen = (allergenId: number) => {
    setExcludedAllergens((prev) =>
      prev.includes(allergenId)
        ? prev.filter((id) => id !== allergenId)
        : [...prev, allergenId]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="relative bg-gradient-to-br from-primary/10 via-accent/5 to-background border-b">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-2xl space-y-6">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              Discover{" "}
              <span className="text-primary">Local Chefs</span>
              <br />
              In Your Neighborhood
            </h1>
            <p className="text-lg text-muted-foreground">
              Fresh, homemade meals from passionate local chefs. Full transparency 
              on every ingredient and allergen.
            </p>
            
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={() => setLocationModalOpen(true)}
                size="lg"
                data-testid="button-set-location"
              >
                <MapPin className="h-4 w-4 mr-2" />
                {zipCode ? `Change Location (${zipCode})` : "Set Your Location"}
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 right-0 w-1/3 h-full opacity-10 pointer-events-none hidden lg:block">
          <ChefHat className="w-full h-full text-primary" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          <aside className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search & Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search chefs, cuisines, dishes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                    data-testid="input-search"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 px-2"
                      onClick={() => setSearchQuery("")}
                      data-testid="button-clear-search"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <Button
                  variant={showFavoritesOnly ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  data-testid="button-favorites-filter"
                >
                  <Heart className={`h-4 w-4 mr-2 ${showFavoritesOnly ? "fill-current" : ""}`} />
                  {showFavoritesOnly ? "Showing Favorites" : "Show Favorites Only"}
                </Button>

                {allergens && allergens.length > 0 && (
                  <AllergenFilter
                    allergens={allergens}
                    excludedAllergens={excludedAllergens}
                    onToggleAllergen={toggleAllergen}
                    onClearFilters={() => setExcludedAllergens([])}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="hidden lg:block">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Leaf className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Fresh & Local</h4>
                    <p className="text-xs text-muted-foreground">
                      All meals made fresh by chefs in your area
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Full Transparency</h4>
                    <p className="text-xs text-muted-foreground">
                      Every ingredient and allergen listed clearly
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          <main>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold">
                  {searchQuery
                    ? `Results for "${searchQuery}"`
                    : zipCode
                    ? "Chefs Near You"
                    : "All Chefs"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {searchResults
                    ? `${searchResults.length} dish${searchResults.length !== 1 ? "es" : ""} found from ${filteredChefs.length} chef${filteredChefs.length !== 1 ? "s" : ""}`
                    : `${filteredChefs.length} chef${filteredChefs.length !== 1 ? "s" : ""} available`}
                  {excludedAllergens.length > 0 && " (filtered)"}
                </p>
              </div>
            </div>

            {chefsLoading || allergensLoading ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i}>
                    <Skeleton className="h-36" />
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-11 w-11 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-14" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredChefs.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <ChefHat className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {searchQuery ? "No Results Found" : "No Chefs Found"}
                  </h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    {searchQuery
                      ? `No chefs or dishes match "${searchQuery}". Try a different search term.`
                      : !zipCode
                      ? "Set your location to find chefs near you."
                      : showFavoritesOnly
                      ? "You haven't favorited any chefs yet."
                      : excludedAllergens.length > 0
                      ? "Try adjusting your allergen filters to see more options."
                      : "No chefs are currently delivering to your area."}
                  </p>
                  {searchQuery && (
                    <Button
                      onClick={() => setSearchQuery("")}
                      className="mt-4"
                      data-testid="button-clear-search-empty"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Search
                    </Button>
                  )}
                  {!zipCode && !searchQuery && (
                    <Button
                      onClick={() => setLocationModalOpen(true)}
                      className="mt-4"
                      data-testid="button-empty-set-location"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Set Location
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : searchResults ? (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {searchResults.slice(0, 9).map((result, index) => (
                    <Link key={`${result.chef.id}-${result.item.id}-${index}`} href={`/chef/${result.chef.slug}`}>
                      <Card className="hover-elevate cursor-pointer transition-all duration-200" data-testid={`card-search-result-${result.item.id}`}>
                        <CardContent className="p-4">
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-16 h-16 rounded-md bg-gradient-to-br from-primary/20 to-accent/30 flex items-center justify-center overflow-hidden">
                              {result.item.imageUrl ? (
                                <img
                                  src={result.item.imageUrl}
                                  alt={result.item.title}
                                  className="w-full h-full object-cover"
                                  data-testid={`image-search-result-${result.item.id}`}
                                />
                              ) : (
                                <UtensilsCrossed className="h-6 w-6 text-primary/50" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{result.item.title}</h4>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                by {result.chef.name}
                              </p>
                              <div className="flex items-center justify-between gap-2 mt-2">
                                <span className="text-sm font-semibold">
                                  ${Number(result.item.price).toFixed(2)}
                                </span>
                                {result.chef.distance !== undefined && (
                                  <span className="text-xs text-muted-foreground">
                                    {result.chef.distance.toFixed(1)} mi
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
                
                {searchResults.length > 9 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Showing 9 of {searchResults.length} matching dishes
                  </p>
                )}

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Chefs with matching dishes</h3>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredChefs.map((chef) => (
                      <ChefCard key={chef.id} chef={chef} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredChefs.map((chef) => (
                  <ChefCard key={chef.id} chef={chef} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <LocationModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
      />
    </div>
  );
}
