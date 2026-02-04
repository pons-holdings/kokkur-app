import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MapPin, Truck, Store, ChefHat } from "lucide-react";
import { useFavoritesStore } from "@/lib/favorites-store";
import type { ChefProfileWithDaySlots } from "@shared/schema";

interface ChefCardProps {
  chef: ChefProfileWithDaySlots;
}

export function ChefCard({ chef }: ChefCardProps) {
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const favorite = isFavorite(chef.id);

  // Count unique items across all day slots
  const uniqueItemIds = new Set<number>();
  chef.daySlots?.forEach((slot) => {
    slot.items?.forEach((item) => uniqueItemIds.add(item.id));
  });
  const activeItemCount = uniqueItemIds.size;
  
  // Get a sample dish image to show in the card
  const sampleDishImage = chef.daySlots?.flatMap(slot => slot.items || [])
    .find(item => item.coverPhoto)?.coverPhoto;

  const getFulfillmentIcon = () => {
    switch (chef.fulfillmentMethod) {
      case "delivery":
        return <Truck className="h-3.5 w-3.5" />;
      case "pickup":
        return <Store className="h-3.5 w-3.5" />;
      default:
        return (
          <>
            <Truck className="h-3.5 w-3.5" />
            <Store className="h-3.5 w-3.5" />
          </>
        );
    }
  };

  const getFulfillmentLabel = () => {
    switch (chef.fulfillmentMethod) {
      case "delivery":
        return "Delivery";
      case "pickup":
        return "Pickup";
      default:
        return "Delivery & Pickup";
    }
  };

  return (
    <Link href={`/chef/${chef.slug}`}>
      <Card
        className="group overflow-hidden hover-elevate cursor-pointer transition-all duration-200"
        data-testid={`card-chef-${chef.id}`}
      >
        <CardContent className="p-0">
          <div className="relative h-36 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/30 overflow-hidden">
            {sampleDishImage ? (
              <img 
                src={sampleDishImage} 
                alt={`Dish from ${chef.name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <ChefHat className="h-16 w-16 text-primary/30" />
              </div>
            )}
            
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(chef.id);
              }}
              data-testid={`button-favorite-${chef.id}`}
            >
              <Heart
                className={`h-4 w-4 transition-colors ${
                  favorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                }`}
              />
            </Button>

            {chef.distance !== undefined && (
              <Badge
                variant="secondary"
                className="absolute bottom-3 left-3 bg-background/80 backdrop-blur-sm"
              >
                <MapPin className="h-3 w-3 mr-1" />
                {chef.distance.toFixed(1)} mi
              </Badge>
            )}
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-11 w-11 ring-2 ring-background shadow-sm">
                <AvatarImage src={chef.profileImageUrl || undefined} alt={chef.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {chef.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {chef.name}
                </h3>
                {chef.locationName && (
                  <p className="text-sm text-muted-foreground truncate">
                    {chef.locationName}
                  </p>
                )}
              </div>
            </div>

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

            <div className="flex items-center justify-between pt-1 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {getFulfillmentIcon()}
                <span>{getFulfillmentLabel()}</span>
              </div>
              
              <span className="text-muted-foreground">
                {activeItemCount} {activeItemCount === 1 ? "dish" : "dishes"} available
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
