import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectFilterProps {
  label: string;
  icon?: React.ReactNode;
  options: { value: string; label: string }[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  searchPlaceholder?: string;
  emptyText?: string;
}

export function MultiSelectFilter({
  label,
  icon,
  options,
  selected,
  onSelectionChange,
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter((s) => s !== value));
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  const triggerLabel = () => {
    if (selected.length === 0) return label;
    if (selected.length <= 2) {
      const names = selected.map(
        (s) => options.find((o) => o.value === s)?.label ?? s
      );
      return names.join(", ");
    }
    return label;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 border-dashed gap-1.5 text-xs font-medium",
            selected.length > 0 && "border-primary/50 bg-primary/5"
          )}
        >
          {icon && <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
          <span className={cn(selected.length === 0 && "text-muted-foreground")}>
            {triggerLabel()}
          </span>
          {selected.length >= 3 && (
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 min-w-[20px] px-1 text-[10px] font-semibold rounded-full"
            >
              {selected.length}
            </Badge>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggleOption(option.value)}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="mr-2 pointer-events-none"
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selected.length > 0 && (
            <div className="border-t p-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground"
                onClick={() => onSelectionChange([])}
              >
                Clear all
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
