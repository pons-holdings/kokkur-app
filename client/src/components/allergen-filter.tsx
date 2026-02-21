import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, Filter } from "lucide-react";
import type { Allergen } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface FilterContentProps {
  allergens: Allergen[];
  excludedAllergens: number[];
  onToggleAllergen: (allergenId: number) => void;
  onClearFilters: () => void;
}

const FilterContent = memo(function FilterContent({
  allergens,
  excludedAllergens,
  onToggleAllergen,
  onClearFilters,
}: FilterContentProps) {
  const hasFilters = excludedAllergens.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-sm">Exclude Allergens</span>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-7 text-xs"
            data-testid="button-clear-filters"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {allergens.map((allergen) => {
          const isExcluded = excludedAllergens.includes(allergen.id);
          return (
            <div
              key={allergen.id}
              className="flex items-center space-x-3 py-1.5"
            >
              <Checkbox
                id={`allergen-${allergen.id}`}
                checked={isExcluded}
                onCheckedChange={() => onToggleAllergen(allergen.id)}
                data-testid={`checkbox-allergen-${allergen.id}`}
              />
              <Label
                htmlFor={`allergen-${allergen.id}`}
                className="text-sm font-normal cursor-pointer flex-1"
              >
                {allergen.name}
              </Label>
            </div>
          );
        })}
      </div>

      {hasFilters && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Hiding dishes containing:{" "}
            {excludedAllergens
              .map((id) => allergens.find((a) => a.id === id)?.name)
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      )}
    </div>
  );
});

interface AllergenFilterProps {
  allergens: Allergen[];
  excludedAllergens: number[];
  onToggleAllergen: (allergenId: number) => void;
  onClearFilters: () => void;
}

export function AllergenFilter({
  allergens,
  excludedAllergens,
  onToggleAllergen,
  onClearFilters,
}: AllergenFilterProps) {
  const hasFilters = excludedAllergens.length > 0;

  return (
    <>
      <div className="hidden lg:block">
        <FilterContent
          allergens={allergens}
          excludedAllergens={excludedAllergens}
          onToggleAllergen={onToggleAllergen}
          onClearFilters={onClearFilters}
        />
      </div>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-filter-mobile">
              <Filter className="h-4 w-4 mr-2" />
              Allergen Filters
              {hasFilters && (
                <Badge variant="secondary" className="ml-2">
                  {excludedAllergens.length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Dietary Filters</SheetTitle>
              <SheetDescription>
                Exclude dishes containing specific allergens
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              <FilterContent
                allergens={allergens}
                excludedAllergens={excludedAllergens}
                onToggleAllergen={onToggleAllergen}
                onClearFilters={onClearFilters}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
