import { useState } from "react";
import { Plus, Trash2, GripVertical, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface ServingOptionInput {
  id?: number;
  servingSize: number;
  label: string;
  price: number;
  isDefault: boolean;
}

interface ServingOptionsEditorProps {
  options: ServingOptionInput[];
  onChange: (options: ServingOptionInput[]) => void;
}

export function ServingOptionsEditor({
  options,
  onChange,
}: ServingOptionsEditorProps) {
  const addOption = () => {
    const newOption: ServingOptionInput = {
      servingSize: 1,
      label: `${options.length + 1} serving${options.length > 0 ? 's' : ''}`,
      price: 0,
      isDefault: options.length === 0,
    };
    onChange([...options, newOption]);
  };

  const updateOption = (index: number, updates: Partial<ServingOptionInput>) => {
    const newOptions = options.map((opt, i) => {
      if (i === index) {
        return { ...opt, ...updates };
      }
      if (updates.isDefault && opt.isDefault) {
        return { ...opt, isDefault: false };
      }
      return opt;
    });
    onChange(newOptions);
  };

  const removeOption = (index: number) => {
    const wasDefault = options[index].isDefault;
    const newOptions = options.filter((_, i) => i !== index);
    if (wasDefault && newOptions.length > 0) {
      newOptions[0].isDefault = true;
    }
    onChange(newOptions);
  };

  const setDefault = (index: number) => {
    const newOptions = options.map((opt, i) => ({
      ...opt,
      isDefault: i === index,
    }));
    onChange(newOptions);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Serving Options & Pricing</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          className="gap-1"
          data-testid="button-add-serving-option"
        >
          <Plus className="h-4 w-4" />
          Add Option
        </Button>
      </div>

      {options.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
          No serving options yet. Add at least one pricing option.
        </div>
      )}

      <div className="space-y-2">
        {options.map((option, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-3 border rounded-md bg-card"
            data-testid={`serving-option-${index}`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />

            <div className="flex-1 grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Label</Label>
                <Input
                  value={option.label}
                  onChange={(e) => updateOption(index, { label: e.target.value })}
                  placeholder="e.g., 1 serving"
                  className="h-8 text-sm"
                  data-testid={`input-serving-label-${index}`}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Size</Label>
                <Input
                  type="number"
                  min={1}
                  value={option.servingSize}
                  onChange={(e) => updateOption(index, { servingSize: parseInt(e.target.value) || 1 })}
                  className="h-8 text-sm"
                  data-testid={`input-serving-size-${index}`}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={option.price}
                  onChange={(e) => updateOption(index, { price: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-sm"
                  data-testid={`input-serving-price-${index}`}
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              {option.isDefault ? (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Default
                </Badge>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDefault(index)}
                  className="text-xs text-muted-foreground"
                  data-testid={`button-set-default-${index}`}
                >
                  Set Default
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeOption(index)}
                className="h-8 w-8 text-destructive"
                disabled={options.length === 1}
                data-testid={`button-remove-serving-${index}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {options.length > 0 && (
        <p className="text-xs text-muted-foreground">
          The default option will be shown first. You can drag to reorder.
        </p>
      )}
    </div>
  );
}
