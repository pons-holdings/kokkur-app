import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Minus, 
  AlertTriangle, 
  Package,
  UtensilsCrossed
} from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import type { MenuItemWithDetails, ChefProfile } from "@shared/schema";

interface MenuItemCardProps {
  item: MenuItemWithDetails;
  chef: ChefProfile;
  onAddToCart?: () => void;
}

export function MenuItemCard({ item, chef, onAddToCart }: MenuItemCardProps) {
  const { items, addItem, removeItem, updateQuantity } = useCartStore();
  
  const cartItem = items.find((i) => i.menuItem.id === item.id);
  const quantity = cartItem?.quantity || 0;
  const isOutOfStock = item.stockQuantity <= 0;
  const maxReached = quantity >= item.stockQuantity;

  const handleAdd = () => {
    const success = addItem(item, chef);
    if (success && onAddToCart) {
      onAddToCart();
    }
  };

  const handleIncrement = () => {
    if (!maxReached) {
      updateQuantity(item.id, quantity + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 0) {
      updateQuantity(item.id, quantity - 1);
    }
  };

  return (
    <Card 
      className={`overflow-hidden transition-all ${isOutOfStock ? "opacity-60" : ""}`}
      data-testid={`card-menu-item-${item.id}`}
    >
      <CardContent className="p-0">
        <div className="relative h-40 bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/20 overflow-hidden">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="absolute inset-0 w-full h-full object-cover"
              data-testid={`image-menu-item-${item.id}`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <UtensilsCrossed className="h-12 w-12 text-primary/20" />
            </div>
          )}
          
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Badge variant="secondary" className="text-sm">
                Sold Out
              </Badge>
            </div>
          )}
          
          {!isOutOfStock && item.stockQuantity <= 5 && (
            <Badge 
              variant="secondary" 
              className="absolute top-3 right-3 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
            >
              Only {item.stockQuantity} left
            </Badge>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground">{item.title}</h4>
              {item.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold text-primary">${item.price.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{item.unitType}</p>
            </div>
          </div>

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

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              <span>{item.stockQuantity} available</span>
            </div>

            {quantity === 0 ? (
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={isOutOfStock}
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
                  disabled={maxReached}
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
}
