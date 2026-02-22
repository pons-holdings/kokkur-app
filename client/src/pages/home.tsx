import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  MapPin,
  ChefHat,
  Search,
  Star,
  ShoppingBag,
  Heart,
  Mail,
  ArrowRight,
  Locate,
  Loader2,
  X,
  UtensilsCrossed,
  Truck,
  Store,
  AlertTriangle,
} from "lucide-react";
import { FaInstagram, FaXTwitter, FaFacebookF, FaTiktok } from "react-icons/fa6";
import { Header } from "@/components/header";
import { KokkurIcon } from "@/components/kokkur-logo";
import { MenuItemCard } from "@/components/menu-item-card";
import { DaySelector } from "@/components/day-selector";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { useLocationStore, getCoordinatesFromZip, getLocationNameFromZip } from "@/lib/location-store";
import { getDistance } from "geolib";
import { parseISO, isBefore } from "date-fns";
import type { ChefProfileWithDaySlots } from "@shared/schema";

// ─── Constants ───────────────────────────────────────────────────────────────

const PLACEHOLDER_TEXTS = [
  '"BBQ"',
  '"Chef Maria"',
  '"jollof rice"',
  '"pasta"',
  '"enchiladas"',
  '"salmon"',
];

// Mock ratings since the DB schema doesn't have ratings yet
const MOCK_RATINGS: Record<number, { rating: number; reviewCount: number }> = {};
function getRating(chefId: number) {
  if (!MOCK_RATINGS[chefId]) {
    // Deterministic pseudo-random from chefId
    const seed = ((chefId * 2654435761) >>> 0) / 4294967296;
    MOCK_RATINGS[chefId] = {
      rating: Math.round((4.0 + seed * 1.0) * 10) / 10,
      reviewCount: Math.floor(8 + seed * 342),
    };
  }
  return MOCK_RATINGS[chefId];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCuisines, setActiveCuisines] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("nearest");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [manualLocationInput, setManualLocationInput] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [excludedAllergens, setExcludedAllergens] = useState<number[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    zipCode, lat, lng, locationName, geoStatus,
    setLocation, setLocationFromCoords, setGeoStatus, clearLocation,
  } = useLocationStore();

  // ── Fetch real chef data from API ──
  const { data: apiChefs, isLoading } = useQuery<ChefProfileWithDaySlots[]>({
    queryKey: ["/api/chefs"],
    staleTime: 0, // Always refetch to ensure fresh data after server restarts
  });

  // Attach distance to each chef
  const chefsWithDistance = useMemo(() => {
    if (!apiChefs) return [];
    return apiChefs.map((chef) => {
      if (lat && lng) {
        const dist = getDistance(
          { latitude: lat, longitude: lng },
          { latitude: chef.locationLat, longitude: chef.locationLong }
        );
        return { ...chef, distance: dist / 1609.34 };
      }
      return chef;
    });
  }, [apiChefs, lat, lng]);

  // ── Dynamic cuisine filters from real data ──
  const cuisineOptions = useMemo(() => {
    const tags = new Set<string>();
    chefsWithDistance.forEach((c) => c.cuisineTags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort().map((t) => ({ value: t, label: t }));
  }, [chefsWithDistance]);

  // ── Compute available dates from all chefs' day slots ──
  const availableDates = useMemo(() => {
    const dateMap = new Map<string, Date>();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    chefsWithDistance.forEach((chef) => {
      chef.daySlots?.forEach((slot) => {
        const slotDate = parseISO(slot.date);
        if (isBefore(slotDate, now)) return;
        // Also filter by cutoff
        if (slot.orderCutoffDate) {
          const cutoff = parseISO(slot.orderCutoffDate);
          if (isBefore(cutoff, new Date())) return;
        }
        const key = slotDate.toDateString();
        if (!dateMap.has(key)) {
          dateMap.set(key, slotDate);
        }
      });
    });

    return Array.from(dateMap.values()).sort((a, b) => a.getTime() - b.getTime());
  }, [chefsWithDistance]);

  // Extract unique allergens from all menu items
  const uniqueAllergens = useMemo(() => {
    const allergenMap = new Map<number, string>();
    chefsWithDistance.forEach((chef) => {
      chef.daySlots?.forEach((slot) => {
        slot.items?.forEach((item: any) => {
          item.allergens?.forEach((a: any) => {
            if (!allergenMap.has(a.id)) {
              allergenMap.set(a.id, a.name);
            }
          });
        });
      });
    });
    return Array.from(allergenMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [chefsWithDistance]);

  const allergenOptions = useMemo(
    () => uniqueAllergens.map((a) => ({ value: String(a.id), label: a.name })),
    [uniqueAllergens]
  );

  // Cycle placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_TEXTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-detect location on mount
  useEffect(() => {
    if (zipCode || geoStatus !== "idle") return;
    if (!navigator.geolocation) return;

    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const name = reverseGeocode(latitude, longitude);
        setLocationFromCoords(latitude, longitude, name);
        setGeoStatus("granted");
      },
      () => {
        setGeoStatus("denied");
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  const handleManualLocation = useCallback(() => {
    const input = manualLocationInput.trim();
    if (!input) return;

    if (/^\d{5}$/.test(input)) {
      const coords = getCoordinatesFromZip(input);
      if (coords) {
        const name = getLocationNameFromZip(input) || input;
        setLocation(input, coords.lat, coords.lng, name);
      }
    } else {
      setLocationFromCoords(40.7128, -74.006, input);
    }
    setManualLocationInput("");
  }, [manualLocationInput, setLocation, setLocationFromCoords]);

  // ── Search: filter chefs AND extract matching dishes ──
  const searchLower = searchQuery.toLowerCase().trim();

  const { filteredChefs, dishResults } = useMemo(() => {
    if (zipCode === "00000") {
      return { filteredChefs: [], dishResults: [] };
    }

    let chefs = [...chefsWithDistance];

    // Cuisine filter (multi-select OR logic)
    if (activeCuisines.length > 0) {
      chefs = chefs.filter((c) =>
        c.cuisineTags?.some((t) =>
          activeCuisines.some((ac) => t.toLowerCase().includes(ac.toLowerCase()))
        )
      );
    }

    // Search filter — searches chefs AND dishes
    interface DishResult {
      chef: ChefProfileWithDaySlots & { distance?: number };
      item: any;
      dates: Date[];
      coverPhoto?: string;
      minPrice: number;
      maxPrice: number;
    }
    const dishes: DishResult[] = [];

    if (searchLower) {
      const matchedChefIds = new Set<number>();

      chefs.forEach((chef) => {
        const chefNameMatch = chef.name.toLowerCase().includes(searchLower);
        const cuisineMatch = chef.cuisineTags?.some((t) =>
          t.toLowerCase().includes(searchLower)
        );

        // Search through all day slots and their items
        chef.daySlots?.forEach((slot) => {
          slot.items?.forEach((item) => {
            const titleMatch = item.title.toLowerCase().includes(searchLower);
            const descMatch = item.description?.toLowerCase().includes(searchLower);
            const ingredientMatch = item.ingredients?.some((ing) =>
              ing.name.toLowerCase().includes(searchLower)
            );

            if (titleMatch || descMatch || ingredientMatch) {
              matchedChefIds.add(chef.id);

              // Collect all dates this item appears on
              const existingDish = dishes.find(
                (d) => d.chef.id === chef.id && d.item.id === item.id
              );
              const slotDate = slot.date ? new Date(slot.date) : null;

              if (existingDish) {
                if (slotDate) existingDish.dates.push(slotDate);
              } else {
                const servingOptions = item.servingOptions || item.assignedServingOptions?.map((a: any) => a.servingOption) || [];
                const prices = servingOptions.map((o: any) => o.price).filter(Boolean);
                dishes.push({
                  chef,
                  item,
                  dates: slotDate ? [slotDate] : [],
                  coverPhoto: item.coverPhoto || item.photos?.[0]?.imageUrl,
                  minPrice: prices.length > 0 ? Math.min(...prices) : 0,
                  maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
                });
              }
            }
          });
        });

        // If chef name/cuisine matched, include all their dishes
        if (chefNameMatch || cuisineMatch) {
          matchedChefIds.add(chef.id);
        }
      });

      chefs = chefs.filter((c) => matchedChefIds.has(c.id));
    }

    // Sort
    switch (sortBy) {
      case "nearest":
        chefs.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
        break;
      case "highest": {
        chefs.sort((a, b) => getRating(b.id).rating - getRating(a.id).rating);
        break;
      }
      case "newest": {
        const toTime = (d: Date | string | null | undefined) =>
          d ? new Date(d).getTime() : 0;
        chefs.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
        break;
      }
    }

    return { filteredChefs: chefs, dishResults: dishes };
  }, [chefsWithDistance, searchLower, activeCuisines, sortBy, zipCode]);

  // ── Day Menu: flat list of items available on the selected day ──
  type FlatMenuItem = {
    item: any;
    chef: ChefProfileWithDaySlots & { distance?: number };
    slotId: number;
    slotDate: string | Date;
    orderCutoffDate?: string | Date;
  };

  const flatDayMenuItems = useMemo(() => {
    if (zipCode === "00000") return [] as FlatMenuItem[];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Apply cuisine filter (multi-select OR logic)
    let chefs = [...chefsWithDistance];
    if (activeCuisines.length > 0) {
      chefs = chefs.filter((c) =>
        c.cuisineTags?.some((t) =>
          activeCuisines.some((ac) => t.toLowerCase().includes(ac.toLowerCase()))
        )
      );
    }

    const items: FlatMenuItem[] = [];

    for (const chef of chefs) {
      if (!chef.daySlots) continue;

      for (const slot of chef.daySlots) {
        const slotDate = parseISO(slot.date);
        if (isBefore(slotDate, now)) continue;
        if (slot.orderCutoffDate) {
          const cutoff = parseISO(slot.orderCutoffDate);
          if (isBefore(cutoff, new Date())) continue;
        }

        // If a specific date is selected, filter to that date
        if (selectedDate && slotDate.toDateString() !== selectedDate.toDateString()) continue;

        let slotItems = slot.items || [];

        // Apply search filter
        if (searchLower) {
          slotItems = slotItems.filter((item: any) => {
            const titleMatch = item.title.toLowerCase().includes(searchLower);
            const descMatch = item.description?.toLowerCase().includes(searchLower);
            const ingredientMatch = item.ingredients?.some((ing: any) =>
              ing.name.toLowerCase().includes(searchLower)
            );
            const chefNameMatch = chef.name.toLowerCase().includes(searchLower);
            const cuisineMatch = chef.cuisineTags?.some((t: string) =>
              t.toLowerCase().includes(searchLower)
            );
            return titleMatch || descMatch || ingredientMatch || chefNameMatch || cuisineMatch;
          });
        }

        // Apply allergen exclusion filter
        if (excludedAllergens.length > 0) {
          slotItems = slotItems.filter((item: any) => {
            const itemAllergenIds = item.allergens?.map((a: any) => a.id) || [];
            return !excludedAllergens.some((excluded) => itemAllergenIds.includes(excluded));
          });
        }

        for (const item of slotItems) {
          items.push({
            item,
            chef,
            slotId: slot.id,
            slotDate: slot.date,
            orderCutoffDate: slot.orderCutoffDate,
          });
        }
      }
    }

    // Sort the flat list
    switch (sortBy) {
      case "nearest":
        items.sort((a, b) => (a.chef.distance ?? 999) - (b.chef.distance ?? 999));
        break;
      case "highest":
        items.sort((a, b) => getRating(b.chef.id).rating - getRating(a.chef.id).rating);
        break;
      case "newest": {
        const toTime = (d: Date | string | null | undefined) => d ? new Date(d).getTime() : 0;
        items.sort((a, b) => toTime(b.chef.createdAt) - toTime(a.chef.createdAt));
        break;
      }
    }

    return items;
  }, [chefsWithDistance, selectedDate, searchLower, activeCuisines, sortBy, zipCode, excludedAllergens]);

  const totalDayMenuItems = flatDayMenuItems.length;
  const uniqueChefCount = new Set(flatDayMenuItems.map((fi) => fi.chef.id)).size;

  const featuredChefs = useMemo(
    () => chefsWithDistance.slice(0, 6),
    [chefsWithDistance]
  );

  const isNoChefs = zipCode === "00000";
  const hasLocation = !!locationName;

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onSearchChange={setSearchQuery} searchQuery={searchQuery} />


      {/* ── Hero Section ── */}
      <section className="bg-[linear-gradient(160deg,#1B2E1A_0%,rgba(27,46,26,0.93)_35%,rgba(46,125,50,0.8)_100%)]">
        <div className="container mx-auto px-4 pt-6 pb-4 md:pt-10 md:pb-6">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight text-white">
              Real food, made by <span className="text-[#6AAF4A]">real people</span> near you
            </h1>

            {/* ── Smart Search Bar ── */}
            <div className="max-w-2xl mx-auto space-y-2">
              <div className="bg-card rounded-xl shadow-lg border p-2 sm:p-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Location field */}
                  <div className="relative flex-shrink-0 sm:w-52">
                    {hasLocation ? (
                      <div className="flex items-center h-11 px-3 rounded-lg bg-accent/50 border border-accent gap-2">
                        <MapPin className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{locationName}</span>
                        <button
                          onClick={() => { clearLocation(); }}
                          className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
                          aria-label="Clear location"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="relative flex-1">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Zip code or city"
                            value={manualLocationInput}
                            onChange={(e) => setManualLocationInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleManualLocation()}
                            className="pl-9 h-11"
                            aria-label="Enter your location"
                          />
                        </div>
                        {geoStatus === "requesting" ? (
                          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled>
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 shrink-0"
                            onClick={() => {
                              if (!navigator.geolocation) return;
                              setGeoStatus("requesting");
                              navigator.geolocation.getCurrentPosition(
                                (pos) => {
                                  const name = reverseGeocode(pos.coords.latitude, pos.coords.longitude);
                                  setLocationFromCoords(pos.coords.latitude, pos.coords.longitude, name);
                                  setGeoStatus("granted");
                                },
                                () => setGeoStatus("denied"),
                                { timeout: 8000 }
                              );
                            }}
                            aria-label="Detect my location"
                            title="Use my location"
                          >
                            <Locate className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Search field */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder={`Search for ${PLACEHOLDER_TEXTS[placeholderIndex]}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-9 h-11"
                      aria-label="Search for chefs, cuisines, or dishes"
                    />
                    {searchQuery && (
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setSearchQuery("")}
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {geoStatus === "denied" && !hasLocation && (
                  <p className="text-xs text-muted-foreground mt-2 px-1">
                    Location access was denied. Enter a zip code or city above.
                  </p>
                )}
              </div>

              {/* Multi-select filter dropdowns */}
              <div className="flex items-center justify-center gap-2 flex-wrap [&_button]:!border-white/30 [&_button]:!text-white [&_button_span]:!text-white/90 [&_button_svg]:!text-white/60 [&_button]:hover:!bg-white/10">
                <MultiSelectFilter
                  label="Cuisine"
                  icon={<UtensilsCrossed className="h-3.5 w-3.5" />}
                  options={cuisineOptions}
                  selected={activeCuisines}
                  onSelectionChange={setActiveCuisines}
                  searchPlaceholder="Search cuisines..."
                  emptyText="No cuisines found."
                />
                <MultiSelectFilter
                  label="Exclude Allergens"
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  options={allergenOptions}
                  selected={excludedAllergens.map(String)}
                  onSelectionChange={(vals) =>
                    setExcludedAllergens(vals.map(Number))
                  }
                  searchPlaceholder="Search allergens..."
                  emptyText="No allergens found."
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Day Selector ── */}
      {!isNoChefs && !isLoading && availableDates.length > 0 && (
        <section className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3">
            <DaySelector
              availableDates={availableDates}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>
        </section>
      )}

      {/* ── Day Menu Section ── */}
      {!isNoChefs && !isLoading && flatDayMenuItems.length > 0 && (
        <section className="container mx-auto px-4 py-8 md:py-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold">
                {selectedDate
                  ? `Menu for ${selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`
                  : "All Upcoming Menus"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {totalDayMenuItems} item{totalDayMenuItems !== 1 ? "s" : ""} from {uniqueChefCount} chef{uniqueChefCount !== 1 ? "s" : ""}
                {excludedAllergens.length > 0 && (
                  <span className="ml-1">
                    ({excludedAllergens.length} allergen{excludedAllergens.length !== 1 ? "s" : ""} excluded)
                  </span>
                )}
              </p>
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]" aria-label="Sort items">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nearest">Nearest first</SelectItem>
                <SelectItem value="highest">Highest rated</SelectItem>
                <SelectItem value="newest">Newest chefs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {flatDayMenuItems.map(({ item, chef, slotId, slotDate, orderCutoffDate }) => (
              <MenuItemCard
                key={`${slotId}-${item.id}`}
                item={item}
                chef={chef}
                daySlotId={slotId}
                daySlotDate={String(slotDate)}
                orderCutoffDate={orderCutoffDate ? String(orderCutoffDate) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state for day menu when date selected but no items */}
      {!isNoChefs && !isLoading && availableDates.length > 0 && flatDayMenuItems.length === 0 && (
        <section className="container mx-auto px-4 py-12 text-center">
          <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">No menus available</h3>
          <p className="text-muted-foreground text-sm">
            {searchLower
              ? `No items match "${searchQuery}" for this day. Try a different search or day.`
              : "No items available for this day. Try selecting a different day."}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearchQuery("");
              setActiveCuisines([]);
              setSelectedDate(null);
              setExcludedAllergens([]);
            }}
          >
            Clear filters
          </Button>
        </section>
      )}

      {/* ── Chef Results or Newsletter ── */}
      <section className="container mx-auto px-4 py-8 md:py-12">
        <AnimatePresence mode="wait">
          {isNoChefs ? (
            <NoChefSection
              key="no-chefs"
              email={newsletterEmail}
              setEmail={setNewsletterEmail}
              submitted={newsletterSubmitted}
              onSubmit={handleNewsletterSubmit}
            />
          ) : isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i}>
                    <Skeleton className="h-28" />
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-14 w-14 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-14" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="chef-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Explore Chefs heading */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold">
                    {searchQuery
                      ? `Chefs matching "${searchQuery}"`
                      : activeCuisines.length > 0
                        ? `${activeCuisines.slice(0, 2).join(", ")} Chefs`
                        : "Explore Chefs"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {filteredChefs.length} chef{filteredChefs.length !== 1 ? "s" : ""} available
                  </p>
                </div>

                {/* Sort moved to day menu section; keep for chef grid when no day menu */}
                {flatDayMenuItems.length === 0 && (
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px]" aria-label="Sort chefs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nearest">Nearest first</SelectItem>
                      <SelectItem value="highest">Highest rated</SelectItem>
                      <SelectItem value="newest">Newest chefs</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Chef card grid */}
              {filteredChefs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredChefs.map((chef, i) => (
                    <ChefCardHome key={chef.id} chef={chef} index={i} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No matches found</h3>
                  <p className="text-muted-foreground text-sm">
                    Try adjusting your search or filters.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCuisines([]);
                      setExcludedAllergens([]);
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-muted/50 border-y">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                icon: <Search className="h-7 w-7" />,
                title: "Pick a Day",
                desc: "Choose an upcoming day and browse all available homemade food near you",
              },
              {
                icon: <ShoppingBag className="h-7 w-7" />,
                title: "Build Your Cart",
                desc: "Add dishes from multiple chefs and days into a single cart",
              },
              {
                icon: <Heart className="h-7 w-7" />,
                title: "Enjoy Homemade",
                desc: "Savor fresh, homemade food made with love by someone in your community",
              },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.15 }}
                className="text-center space-y-3"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {step.icon}
                </div>
                <h3 className="font-semibold text-lg">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Chefs Carousel ── */}
      {!isNoChefs && featuredChefs.length > 0 && (
        <section className="container mx-auto px-4 py-12 md:py-16">
          <Carousel
            opts={{ align: "start", loop: true }}
            className="w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold">Featured Chefs</h2>
              <div className="flex items-center gap-2">
                <CarouselPrevious className="static translate-y-0 h-9 w-9" />
                <CarouselNext className="static translate-y-0 h-9 w-9" />
              </div>
            </div>
            <CarouselContent className="-ml-4">
              {featuredChefs.map((chef) => (
                <CarouselItem
                  key={chef.id}
                  className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                >
                  <div className="h-full">
                    <ChefCardHome chef={chef} index={0} />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="bg-card border-t">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1 space-y-4">
              <Link href="/">
                <div className="flex items-center gap-2 cursor-pointer">
                  <KokkurIcon size={36} />
                  <span className="text-xl font-bold tracking-tight">kokkur</span>
                </div>
              </Link>
              <p className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                LOCAL CHEFS · REAL FOOD
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connecting communities through the joy of homemade food.
              </p>
              <div className="flex gap-3">
                {[
                  { icon: <FaInstagram className="h-4 w-4" />, label: "Instagram" },
                  { icon: <FaXTwitter className="h-4 w-4" />, label: "X" },
                  { icon: <FaFacebookF className="h-4 w-4" />, label: "Facebook" },
                  { icon: <FaTiktok className="h-4 w-4" />, label: "TikTok" },
                ].map((social) => (
                  <a
                    key={social.label}
                    href="#"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                    aria-label={social.label}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Company</h4>
              <nav className="flex flex-col gap-2">
                {["About", "For Chefs", "Careers"].map((link) => (
                  <a key={link} href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link}
                  </a>
                ))}
              </nav>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Support</h4>
              <nav className="flex flex-col gap-2">
                {["FAQ", "Contact", "Help Center"].map((link) => (
                  <a key={link} href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link}
                  </a>
                ))}
              </nav>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Legal</h4>
              <nav className="flex flex-col gap-2">
                {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((link) => (
                  <a key={link} href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          <div className="border-t mt-8 pt-6 text-center text-sm text-muted-foreground">
            &copy; 2026 kokkur. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Chef Card Component ─────────────────────────────────────────────────────

function ChefCardHome({ chef, index }: { chef: ChefProfileWithDaySlots & { distance?: number }; index: number }) {
  const { rating, reviewCount } = getRating(chef.id);

  // Count unique items across all day slots
  const uniqueItemIds = new Set<number>();
  chef.daySlots?.forEach((slot) => {
    slot.items?.forEach((item) => uniqueItemIds.add(item.id));
  });
  const dishCount = uniqueItemIds.size;

  // Get sample dish image
  const sampleDishImage = chef.daySlots
    ?.flatMap((s) => s.items || [])
    .find((item) => item.coverPhoto)?.coverPhoto;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className="h-full"
    >
      <Link href={`/chef/${chef.slug}`}>
        <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full cursor-pointer flex flex-col">
          <CardContent className="p-0 flex flex-col flex-1">
            {/* Card header with image or gradient */}
            <div className="relative h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 overflow-hidden">
              {sampleDishImage ? (
                <img
                  src={sampleDishImage}
                  alt={`Dish from ${chef.name}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <ChefHat className="h-16 w-16 text-primary" />
                </div>
              )}

              {/* Distance badge */}
              {chef.distance !== undefined && (
                <Badge
                  variant="secondary"
                  className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm text-xs"
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  {chef.distance.toFixed(1)} mi
                </Badge>
              )}
            </div>

            <div className="p-4 space-y-3 flex flex-col flex-1">
              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 shrink-0 ring-2 ring-background shadow-sm">
                  <AvatarImage src={chef.profileImageUrl || undefined} alt={chef.name} referrerPolicy="no-referrer" />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                    {chef.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {chef.name}
                  </h3>
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-medium">{rating}</span>
                    <span className="text-muted-foreground">({reviewCount})</span>
                  </div>
                </div>
              </div>

              {/* Cuisine tags */}
              {chef.cuisineTags && chef.cuisineTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chef.cuisineTags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs font-normal">
                      {tag}
                    </Badge>
                  ))}
                  {chef.cuisineTags.length > 3 && (
                    <Badge variant="outline" className="text-xs font-normal">
                      +{chef.cuisineTags.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Bio */}
              {chef.bio && (
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                  {chef.bio}
                </p>
              )}

              {/* Dish count + CTA */}
              <div className="flex items-center justify-between pt-1 mt-auto">
                <span className="text-xs text-muted-foreground">
                  {dishCount} {dishCount === 1 ? "dish" : "dishes"} available
                </span>
                <Button size="sm" className="h-8">
                  View Menu
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

// ─── No Chefs / Newsletter Section ───────────────────────────────────────────

function NoChefSection({
  email,
  setEmail,
  submitted,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  submitted: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <motion.div
      key="no-chefs"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-lg mx-auto text-center py-8 md:py-12"
    >
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        <div className="relative">
          <ChefHat className="h-12 w-12 text-primary" />
          <Heart className="absolute -bottom-1 -right-1 h-5 w-5 text-primary fill-primary" />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-3">
        We're not in your neighborhood yet — but we're on our way!
      </h2>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        kokkur is growing every day. Drop your email below and we'll let you
        know the moment chefs near you start cooking.
      </p>

      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.form
            key="form"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={onSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 h-11"
                required
                aria-label="Email address for notifications"
              />
            </div>
            <Button type="submit" className="h-11 px-6">
              Notify Me
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/10 rounded-xl p-6"
          >
            <p className="text-lg font-semibold text-primary mb-1">
              You're on the list!
            </p>
            <p className="text-sm text-muted-foreground">
              We'll reach out as soon as chefs are available near you.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-sm text-muted-foreground mt-6">
        Know a chef who should be on kokkur?{" "}
        <a href="#" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
          Tell them about us <ArrowRight className="h-3 w-3" />
        </a>
      </p>
    </motion.div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function reverseGeocode(lat: number, lng: number): string {
  if (lat > 40.5 && lat < 41.0 && lng > -74.3 && lng < -73.7) return "New York, NY";
  if (lat > 33.9 && lat < 34.2 && lng > -118.5 && lng < -118.1) return "Los Angeles, CA";
  if (lat > 41.8 && lat < 42.0 && lng > -87.8 && lng < -87.5) return "Chicago, IL";
  if (lat > 29.6 && lat < 30.0 && lng > -95.5 && lng < -95.2) return "Houston, TX";
  if (lat > 30.2 && lat < 30.4 && lng > -97.8 && lng < -97.6) return "Austin, TX";
  if (lat > 37.7 && lat < 37.9 && lng > -122.5 && lng < -122.3) return "San Francisco, CA";
  if (lat > 47.5 && lat < 47.7 && lng > -122.4 && lng < -122.2) return "Seattle, WA";
  if (lat > 25.7 && lat < 25.9 && lng > -80.3 && lng < -80.1) return "Miami, FL";
  if (lat > 33.7 && lat < 33.9 && lng > -84.5 && lng < -84.3) return "Atlanta, GA";
  if (lat > 39.9 && lat < 40.1 && lng > -75.2 && lng < -75.1) return "Philadelphia, PA";
  return "Your Neighborhood";
}
