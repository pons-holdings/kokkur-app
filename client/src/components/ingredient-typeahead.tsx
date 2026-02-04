import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Search, Plus, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Ingredient, Allergen } from "@shared/schema";

interface IngredientWithAllergens extends Ingredient {
  allergens: Allergen[];
}

interface IngredientTypeaheadProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  onAllergensDetected?: (allergenIds: number[]) => void;
  placeholder?: string;
}

export function IngredientTypeahead({
  selectedIds,
  onChange,
  onAllergensDetected,
  placeholder = "Search ingredients...",
}: IngredientTypeaheadProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allIngredients = [] } = useQuery<IngredientWithAllergens[]>({
    queryKey: ["/api/ingredients-with-allergens"],
  });

  const { data: searchResults = [], isLoading: searching } = useQuery<Ingredient[]>({
    queryKey: [`/api/ingredients?search=${encodeURIComponent(search)}`],
    enabled: search.length >= 1,
  });

  const createIngredientMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/ingredients", { name });
      return res.json();
    },
    onSuccess: (newIngredient: Ingredient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients-with-allergens"] });
      onChange([...selectedIds, newIngredient.id]);
      setSearch("");
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIngredients = allIngredients.filter((i) => selectedIds.includes(i.id));
  const displayResults = search.length >= 1 ? searchResults : allIngredients;
  const filteredResults = displayResults.filter((i) => !selectedIds.includes(i.id));
  const showCreateOption = search.length >= 2 && !displayResults.some(
    (i) => i.name.toLowerCase() === search.toLowerCase()
  );

  const handleSelect = (ingredient: Ingredient) => {
    const newIds = [...selectedIds, ingredient.id];
    onChange(newIds);
    
    // Find the ingredient with allergens and notify parent
    const ingredientWithAllergens = allIngredients.find(i => i.id === ingredient.id);
    if (ingredientWithAllergens?.allergens?.length && onAllergensDetected) {
      const allergenIds = ingredientWithAllergens.allergens.map(a => a.id);
      onAllergensDetected(allergenIds);
    }
    
    setSearch("");
    setIsOpen(false);
  };

  const handleRemove = (id: number) => {
    onChange(selectedIds.filter((i) => i !== id));
  };

  const handleCreate = () => {
    if (search.trim().length >= 2) {
      createIngredientMutation.mutate(search.trim());
    }
  };

  // Get allergen display for an ingredient
  const getIngredientAllergens = (ingredientId: number): Allergen[] => {
    const ing = allIngredients.find(i => i.id === ingredientId);
    return ing?.allergens || [];
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {selectedIngredients.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIngredients.map((ingredient) => {
            const allergens = getIngredientAllergens(ingredient.id);
            return (
              <Badge
                key={ingredient.id}
                variant="secondary"
                className="gap-1 pr-1"
                data-testid={`badge-ingredient-${ingredient.id}`}
              >
                {ingredient.name}
                {allergens.length > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                    <AlertTriangle className="h-3 w-3 inline" />
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => handleRemove(ingredient.id)}
                  data-testid={`button-remove-ingredient-${ingredient.id}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-9"
          data-testid="input-ingredient-search"
        />

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
            {searching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!searching && filteredResults.length === 0 && !showCreateOption && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {search.length >= 1 ? "No ingredients found" : "Start typing to search"}
              </div>
            )}

            {!searching && filteredResults.map((ingredient) => {
              const allergens = getIngredientAllergens(ingredient.id);
              return (
                <button
                  key={ingredient.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover-elevate cursor-pointer flex items-center justify-between gap-2"
                  onClick={() => handleSelect(ingredient)}
                  data-testid={`option-ingredient-${ingredient.id}`}
                >
                  <span>{ingredient.name}</span>
                  {allergens.length > 0 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {allergens.map(a => a.name).join(", ")}
                    </span>
                  )}
                </button>
              );
            })}

            {showCreateOption && (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover-elevate cursor-pointer flex items-center gap-2 text-primary border-t"
                onClick={handleCreate}
                disabled={createIngredientMutation.isPending}
                data-testid="button-create-ingredient"
              >
                {createIngredientMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add "{search}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
