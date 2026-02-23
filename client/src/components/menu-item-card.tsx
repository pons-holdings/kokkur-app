import { memo, useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Minus,
  AlertTriangle,
  UtensilsCrossed,
  MapPin,
  Truck,
  Store,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useCartStore } from "@/lib/cart-store";
import { getChefDisplayName } from "@/lib/chef-utils";
import type { MenuItemWithDetails, ChefProfile, ServingOption } from "@shared/schema";

interface MenuItemCardProps {
  item: MenuItemWithDetails;
  chef: ChefProfile & { distance?: number };
  daySlotId: number;
  daySlotDate: string;
  orderCutoffDate?: string;
  onAddToCart?: () => void;
}


export const MenuItemCard = memo(function MenuItemCard({ item, chef, daySlotId, daySlotDate, orderCutoffDate, onAddToCart }: MenuItemCardProps) {
  const { items, addItem, updateQuantity, updateServingOption } = useCartStore();

  const cartItem = items.find((i) => i.menuItem.id === item.id && i.daySlotId === daySlotId);
  const quantity = cartItem?.quantity || 0;

  const servingOptions = item.servingOptions || [];
  const defaultOption = servingOptions.find(o => o.isDefault === 1) || servingOptions[0];
  const hasMultipleOptions = servingOptions.length > 1;

  // Track which serving option is selected — sync with cart if already added
  const [selectedOption, setSelectedOption] = useState<ServingOption | undefined>(
    cartItem?.servingOption || defaultOption
  );

  // Keep local state in sync if the cart item changes externally
  useEffect(() => {
    if (cartItem?.servingOption) {
      setSelectedOption(cartItem.servingOption);
    }
  }, [cartItem?.servingOption]);

  const coverPhotoUrl = item.coverPhoto || (item.photos && item.photos.length > 0 ? item.photos[0].imageUrl : undefined);

  const handleAdd = () => {
    addItem(item, chef, daySlotId, daySlotDate, selectedOption);
    if (onAddToCart) {
      onAddToCart();
    }
  };

  const handleIncrement = () => {
    updateQuantity(item.id, daySlotId, quantity + 1);
  };

  const handleDecrement = () => {
    if (quantity > 0) {
      updateQuantity(item.id, daySlotId, quantity - 1);
    }
  };

  const handleOptionChange = (option: ServingOption) => {
    setSelectedOption(option);
    // If item is already in cart, update the serving option there too
    if (quantity > 0) {
      updateServingOption(item.id, daySlotId, option);
    }
  };

  return (
    <Card
      className="overflow-hidden transition-all"
      data-testid={`card-menu-item-${item.id}`}
    >
      <CardContent className="p-0">
        <div className="relative h-40 bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/20 overflow-hidden">
          {coverPhotoUrl ? (
            <img
              src={coverPhotoUrl}
              alt={item.title}
              className="absolute inset-0 w-full h-full object-cover"
              data-testid={`image-menu-item-${item.id}`}
              referrerPolicy="no-referrer"
              onError={(e) => {
                console.warn('[IMAGE ERROR]', item.title, coverPhotoUrl);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <UtensilsCrossed className="h-12 w-12 text-primary/20" />
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          {/* Chef info row */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
            <Link href={`/chef/${(chef as any).slug || chef.id}`}>
              <span className="font-medium text-foreground hover:text-primary transition-colors cursor-pointer">
                {getChefDisplayName(chef)}
              </span>
            </Link>
            {chef.distance !== undefined && (
              <>
                <span>|</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  {chef.distance.toFixed(1)} mi
                </span>
              </>
            )}
            <span>|</span>
            {(chef as any).fulfillmentMethod === "both" ? (
              <span className="flex items-center gap-0.5">
                <Truck className="h-3 w-3" />
                <Store className="h-3 w-3" />
              </span>
            ) : (chef as any).fulfillmentMethod === "delivery" ? (
              <span className="flex items-center gap-0.5">
                <Truck className="h-3 w-3" />
              </span>
            ) : (
              <span className="flex items-center gap-0.5">
                <Store className="h-3 w-3" />
              </span>
            )}
          </div>

          {/* Title and description — full width, no truncation */}
          <div>
            <h4 className="font-semibold text-foreground">{item.title}</h4>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>

          {/* Serving options / price */}
          {hasMultipleOptions ? (
            <div className="space-y-1.5">
              {servingOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleOptionChange(option)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors ${
                    selectedOption?.id === option.id
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedOption?.id === option.id
                        ? "border-primary"
                        : "border-muted-foreground/40"
                    }`}>
                      {selectedOption?.id === option.id && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </span>
                    <span>{option.label}</span>
                  </span>
                  <span className="font-semibold">${option.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          ) : selectedOption ? (
            <p className="text-sm font-semibold text-primary">
              ${selectedOption.price.toFixed(2)}
              {selectedOption.label && (
                <span className="font-normal text-muted-foreground"> · {selectedOption.label}</span>
              )}
            </p>
          ) : null}

          {orderCutoffDate && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Order by {format(parseISO(orderCutoffDate), "EEE h:mma")}</span>
            </div>
          )}

          {item.allergens && item.allergens.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.allergens.map((allergen) => (
                <Badge
                  key={allergen.id}
                  variant="outline"
                  className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {allergen.name}
                </Badge>
              ))}
            </div>
          )}

          {item.ingredients && item.ingredients.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Ingredients:</span>{" "}
              {item.ingredients.map((i) => i.name).join(", ")}
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            {quantity === 0 ? (
              <Button
                size="sm"
                onClick={handleAdd}
                data-testid={`button-add-${item.id}`}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleDecrement}
                  data-testid={`button-decrease-${item.id}`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleIncrement}
                  data-testid={`button-increase-${item.id}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
