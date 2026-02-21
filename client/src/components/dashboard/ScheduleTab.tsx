import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { format, eachDayOfInterval, parseISO, isSameDay, isSameMonth, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus,
  Loader2,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  Search,
  Archive,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  ChefProfileWithDaySlots,
  MenuItemWithDetails,
  MenuItemWithAssignment,
  DaySlotWithItems,
  ServingSizeSelection,
} from "./types";

interface ScheduleTabProps {
  selectedChef: ChefProfileWithDaySlots | undefined;
  chefMenuItems: MenuItemWithDetails[] | undefined;
}

const ScheduleTab = React.memo(function ScheduleTab({
  selectedChef,
  chefMenuItems,
}: ScheduleTabProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Serving size selection dialog state
  const [servingSizeDialogOpen, setServingSizeDialogOpen] = useState(false);
  const [pendingItemToAdd, setPendingItemToAdd] = useState<{ item: MenuItemWithDetails; daySlotId: number; dateKey: string } | null>(null);
  const [selectedServingSizes, setSelectedServingSizes] = useState<Map<number, ServingSizeSelection>>(new Map());

  const { toast } = useToast();

  // Debounce the search query
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setItemSearchQuery(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(value);
    }, 300);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Reset debounced search when raw search is cleared
  useEffect(() => {
    if (itemSearchQuery === "") {
      setDebouncedSearchQuery("");
    }
  }, [itemSearchQuery]);

  // Mutations
  const createDaySlotMutation = useMutation({
    mutationFn: async (data: { chefId: number; date: string; orderCutoffDate: string }) => {
      return apiRequest("POST", "/api/day-slots", data);
    },
    onSuccess: () => {
      toast({ title: "Day added", description: "You can now assign food items to this day." });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating day slot", description: error.message, variant: "destructive" });
    },
  });

  const deleteDaySlotMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/day-slots/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Day removed", description: "This day has been removed from your schedule." });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting day slot", description: error.message, variant: "destructive" });
    },
  });

  const updateDaySlotMutation = useMutation({
    mutationFn: async ({ id, orderCutoffDate }: { id: number; orderCutoffDate: string }) => {
      return apiRequest("PATCH", `/api/day-slots/${id}`, { orderCutoffDate });
    },
    onSuccess: () => {
      toast({ title: "Cutoff updated", description: "Order cutoff date has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating cutoff", description: error.message, variant: "destructive" });
    },
  });

  const assignItemToDaySlotMutation = useMutation({
    mutationFn: async ({ daySlotId, itemId }: { daySlotId: number; itemId: number }) => {
      return apiRequest("POST", `/api/day-slots/${daySlotId}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menus/chef", selectedChef?.id] });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding item", description: error.message, variant: "destructive" });
    },
  });

  const addAssignmentServingOptionMutation = useMutation({
    mutationFn: async ({ assignmentId, servingOptionId, stockLimited, stockQuantity }: { assignmentId: number; servingOptionId: number; stockLimited?: boolean; stockQuantity?: number }) => {
      return apiRequest("POST", `/api/assignments/${assignmentId}/serving-options`, { servingOptionId, stockLimited, stockQuantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding serving option", description: error.message, variant: "destructive" });
    },
  });

  const removeAssignmentServingOptionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/assignment-serving-options/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Serving option removed", description: "Serving option has been removed from this day." });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error removing serving option", description: error.message, variant: "destructive" });
    },
  });

  const removeItemFromDaySlotMutation = useMutation({
    mutationFn: async ({ daySlotId, itemId }: { daySlotId: number; itemId: number }) => {
      return apiRequest("DELETE", `/api/day-slots/${daySlotId}/items/${itemId}`);
    },
    onSuccess: () => {
      toast({ title: "Item removed", description: "Item has been removed from the day." });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menus/chef", selectedChef?.id] });
    },
    onError: (error: Error) => {
      toast({ title: "Error removing item", description: error.message, variant: "destructive" });
    },
  });

  // Helpers
  const getSlotForDate = useCallback((dateKey: string): DaySlotWithItems | undefined => {
    return selectedChef?.daySlots?.find(
      (slot) => format(new Date(slot.date), "yyyy-MM-dd") === dateKey
    );
  }, [selectedChef?.daySlots]);

  const handleAddItemToDay = useCallback(async (item: MenuItemWithDetails, daySlotId: number | null, dateKey: string) => {
    let slotId = daySlotId;
    if (!slotId && selectedChef) {
      const cutoffDate = format(new Date(new Date(dateKey).getTime() - 86400000), "yyyy-MM-dd");
      const response = await createDaySlotMutation.mutateAsync({
        chefId: selectedChef.id,
        date: dateKey,
        orderCutoffDate: cutoffDate,
      });
      const daySlot = await (response as Response).json();
      slotId = daySlot.id;
    }

    if (!slotId) return;

    const initialSelections = new Map<number, ServingSizeSelection>();
    (item.servingOptions || []).forEach(opt => {
      initialSelections.set(opt.id, { selected: true, stockLimited: false, stockQuantity: 10 });
    });
    setSelectedServingSizes(initialSelections);
    setPendingItemToAdd({ item, daySlotId: slotId, dateKey });
    setServingSizeDialogOpen(true);
  }, [selectedChef, createDaySlotMutation]);

  const confirmAddItemWithServingSizes = useCallback(async () => {
    if (!pendingItemToAdd) return;

    const { item, daySlotId } = pendingItemToAdd;

    const response = await assignItemToDaySlotMutation.mutateAsync({ daySlotId, itemId: item.id });
    const assignment = await (response as Response).json();
    const assignmentId = assignment.id;

    const selectedOptions = Array.from(selectedServingSizes.entries())
      .filter(([_, settings]) => settings.selected);

    for (const [servingOptionId, settings] of selectedOptions) {
      await addAssignmentServingOptionMutation.mutateAsync({
        assignmentId,
        servingOptionId,
        stockLimited: settings.stockLimited,
        stockQuantity: settings.stockLimited ? settings.stockQuantity : undefined,
      });
    }

    toast({ title: "Item added", description: `${item.title} has been added to this day.` });
    setServingSizeDialogOpen(false);
    setPendingItemToAdd(null);
    setSelectedServingSizes(new Map());
  }, [pendingItemToAdd, selectedServingSizes, assignItemToDaySlotMutation, addAssignmentServingOptionMutation, toast]);

  const handleRemoveItemFromDay = useCallback(async (daySlotId: number, itemId: number) => {
    await removeItemFromDaySlotMutation.mutateAsync({ daySlotId, itemId });
  }, [removeItemFromDaySlotMutation]);

  // Filter items for search results using debounced query
  const getFilteredItems = useCallback((assignedIds: number[]) => {
    if (!debouncedSearchQuery) return [];
    const query = debouncedSearchQuery.toLowerCase();
    return (chefMenuItems || []).filter(item =>
      !assignedIds.includes(item.id) && (
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.ingredients?.some(i => i.name.toLowerCase().includes(query))
      )
    );
  }, [debouncedSearchQuery, chefMenuItems]);

  // Calendar computations
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const allCalendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const weeks: Date[][] = [];
    for (let i = 0; i < allCalendarDays.length; i += 7) {
      weeks.push(allCalendarDays.slice(i, i + 7));
    }

    return { weeks, monthStart, monthEnd };
  }, [calendarMonth]);

  // Mobile upcoming days
  const upcomingDays = useMemo(() => {
    const today = new Date();
    return eachDayOfInterval({
      start: today,
      end: new Date(today.getTime() + 13 * 24 * 60 * 60 * 1000),
    });
  }, []);

  const today = useMemo(() => new Date(), []);

  const selectedDateKey = selectedCalendarDate;
  const selectedSlot = selectedDateKey ? getSlotForDate(selectedDateKey) : null;

  // Price display helper
  const renderPriceRange = useCallback((item: MenuItemWithDetails) => {
    const opts = item.servingOptions || [];
    if (opts.length === 0) return "No price set";
    if (opts.length === 1) return `$${opts[0].price.toFixed(2)}`;
    const prices = opts.map(o => o.price).sort((a, b) => a - b);
    return `$${prices[0].toFixed(2)} - $${prices[prices.length - 1].toFixed(2)}`;
  }, []);

  // Shared assigned items renderer
  const renderAssignedItems = useCallback((slot: DaySlotWithItems, dateKeyForTestIds?: string) => {
    if (!slot.items || slot.items.length === 0) return null;

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Scheduled items:</p>
        <div className="space-y-2">
          {slot.items.map((assignedItem: MenuItemWithAssignment) => (
            <div key={assignedItem.id} className="p-3 rounded-lg border bg-primary/5 border-primary/20">
              <div className="flex items-start gap-3">
                {assignedItem.coverPhoto && (
                  <img src={assignedItem.coverPhoto} alt={assignedItem.title} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{assignedItem.title}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive flex-shrink-0"
                      onClick={() => handleRemoveItemFromDay(slot.id, assignedItem.id)}
                      disabled={removeItemFromDaySlotMutation.isPending}
                      {...(dateKeyForTestIds ? { "data-testid": `button-remove-item-${dateKeyForTestIds}-${assignedItem.id}` } : {})}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {assignedItem.assignedServingOptions && assignedItem.assignedServingOptions.length > 0 ? (
                      assignedItem.assignedServingOptions.map((aso) => (
                        <div key={aso.id} className="flex items-center justify-between text-sm pl-2 border-l-2 border-muted">
                          <div className="flex items-center gap-2">
                            <span>{aso.servingOption.label}</span>
                            <span className="text-muted-foreground">${aso.servingOption.price.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={aso.stockLimited === 1 ? "secondary" : "outline"} className="text-xs">
                              {aso.stockLimited === 1 ? `${aso.stockQuantity || 0} left` : "Unlimited"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-destructive"
                              onClick={() => removeAssignmentServingOptionMutation.mutate(aso.id)}
                              disabled={removeAssignmentServingOptionMutation.isPending}
                              {...(dateKeyForTestIds ? { "data-testid": `button-remove-serving-${aso.id}` } : {})}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No serving sizes configured</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [handleRemoveItemFromDay, removeItemFromDaySlotMutation.isPending, removeAssignmentServingOptionMutation]);

  // Shared search and add items renderer
  const renderSearchAndAdd = useCallback((
    slot: DaySlotWithItems | undefined,
    dateKey: string,
    testIdSuffix?: string
  ) => {
    const assignedIds = slot?.items?.map((i: MenuItemWithAssignment) => i.id) || [];
    const filteredItems = getFilteredItems(assignedIds);

    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Add items to this day:</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for items to add..."
            value={itemSearchQuery}
            onChange={handleSearchChange}
            className="pl-8"
            {...(testIdSuffix ? { "data-testid": `input-search-items-${testIdSuffix}` } : {})}
          />
        </div>
        {itemSearchQuery && (
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto border rounded-lg p-2">
            {filteredItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 px-1">
                No items found matching "{itemSearchQuery}"
              </p>
            ) : (
              filteredItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover-elevate cursor-pointer" onClick={() => handleAddItemToDay(item, slot?.id || null, dateKey)}>
                  {item.coverPhoto && (
                    <img src={item.coverPhoto} alt={item.title} className="w-10 h-10 rounded object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {renderPriceRange(item)}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="flex-shrink-0" {...(testIdSuffix ? { "data-testid": `button-add-item-${testIdSuffix}-${item.id}` } : {})}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
        {!itemSearchQuery && (!slot?.items || slot.items.length === 0) && (
          <p className="text-sm text-muted-foreground">Start typing to search for items to add to this day.</p>
        )}
      </div>
    );
  }, [itemSearchQuery, debouncedSearchQuery, getFilteredItems, handleAddItemToDay, handleSearchChange, renderPriceRange]);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Schedule</h2>
        <p className="text-sm text-muted-foreground">Click on any day to add your food offerings</p>
      </div>

      {/* Desktop calendar view */}
      <div className="hidden md:block space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setCalendarMonth(prev => subMonths(prev, 1))}>
            <ChevronUp className="h-4 w-4 rotate-[-90deg]" />
            <span className="ml-1">{format(subMonths(calendarMonth, 1), "MMM")}</span>
          </Button>
          <h3 className="text-lg font-semibold">{format(calendarMonth, "MMMM yyyy")}</h3>
          <Button variant="outline" size="sm" onClick={() => setCalendarMonth(prev => addMonths(prev, 1))}>
            <span className="mr-1">{format(addMonths(calendarMonth, 1), "MMM")}</span>
            <ChevronUp className="h-4 w-4 rotate-90" />
          </Button>
        </div>

        {/* Calendar grid */}
        <Card>
          <CardContent className="p-0">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 border-b">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-2 text-center text-sm font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            {/* Weeks */}
            {calendarData.weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
                {week.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const isCurrentMonth = isSameMonth(day, calendarMonth);
                  const isToday = isSameDay(day, today);
                  const isSelected = selectedDateKey === dateKey;
                  const slot = getSlotForDate(dateKey);
                  const itemCount = slot?.items?.length || 0;

                  return (
                    <div
                      key={dateKey}
                      className={`relative min-h-[90px] p-1.5 cursor-pointer border-r last:border-r-0 transition-colors
                        ${!isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""}
                        ${isSelected ? "bg-primary/10 ring-2 ring-primary ring-inset" : "hover:bg-accent/50"}
                        ${isToday && !isSelected ? "bg-accent" : ""}
                      `}
                      onClick={() => {
                        setSelectedCalendarDate(dateKey);
                        setItemSearchQuery("");
                        setDebouncedSearchQuery("");
                      }}
                    >
                      <span className={`text-sm ${isToday ? "font-bold text-primary" : ""}`}>
                        {format(day, "d")}
                      </span>
                      {itemCount > 0 && (
                        <div className="mt-0.5 space-y-0.5 overflow-hidden">
                          {slot!.items.slice(0, 3).map((item: MenuItemWithAssignment) => (
                            <div key={item.id} className="text-[10px] leading-tight truncate rounded bg-primary/10 text-primary px-1 py-px">
                              {item.title}
                            </div>
                          ))}
                          {itemCount > 3 && (
                            <div className="text-[10px] leading-tight text-muted-foreground px-1">
                              +{itemCount - 3} more
                            </div>
                          )}
                        </div>
                      )}
                      {slot && itemCount === 0 && (
                        <div className="mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 inline-block" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Slide-in detail panel for selected date */}
        <Sheet open={!!selectedDateKey} onOpenChange={(open) => { if (!open) { setSelectedCalendarDate(null); setItemSearchQuery(""); setDebouncedSearchQuery(""); } }}>
          <SheetContent side="right" className="sm:max-w-md w-full overflow-y-auto">
            {selectedDateKey && (
              <>
                <SheetHeader>
                  <SheetTitle>
                    {format(new Date(selectedDateKey + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                    {isSameDay(new Date(selectedDateKey + "T00:00:00"), today) && (
                      <Badge variant="outline" className="ml-2">Today</Badge>
                    )}
                  </SheetTitle>
                  {selectedSlot ? (
                    <SheetDescription>
                      {selectedSlot.items?.length || 0} item{(selectedSlot.items?.length || 0) !== 1 ? "s" : ""} • Orders by {format(new Date(selectedSlot.orderCutoffDate), "MMM d")}
                    </SheetDescription>
                  ) : (
                    <SheetDescription>No offerings scheduled — add items below</SheetDescription>
                  )}
                </SheetHeader>

                <div className="space-y-4 mt-6">
                  {/* Order cutoff editor */}
                  {selectedSlot && (
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Order cutoff:</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={format(new Date(selectedSlot.orderCutoffDate), "yyyy-MM-dd")}
                          className="w-auto"
                          onChange={async (e) => {
                            if (e.target.value) {
                              await updateDaySlotMutation.mutateAsync({
                                id: selectedSlot.id,
                                orderCutoffDate: e.target.value,
                              });
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive ml-auto"
                          onClick={async () => {
                            await deleteDaySlotMutation.mutateAsync(selectedSlot.id);
                          }}
                          disabled={deleteDaySlotMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove Day
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Assigned items display */}
                  {selectedSlot && renderAssignedItems(selectedSlot)}

                  {/* Search and add items */}
                  {renderSearchAndAdd(selectedSlot || undefined, selectedDateKey)}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* Mobile list view */}
      <div className="block md:hidden space-y-3">
        {upcomingDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const existingSlot = getSlotForDate(dateKey);
          const isExpanded = expandedDays.has(dateKey);
          const itemCount = existingSlot?.items?.length || 0;
          const isToday = format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");

          return (
            <Card key={dateKey} className={isToday ? "ring-2 ring-primary/20" : ""}>
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedDays(prev => {
                  const next = new Set(prev);
                  if (next.has(dateKey)) next.delete(dateKey);
                  else next.add(dateKey);
                  return next;
                })}
                data-testid={`day-row-${dateKey}`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center w-12">
                    <p className="text-xs text-muted-foreground uppercase">{format(day, "EEE")}</p>
                    <p className="text-lg font-semibold">{format(day, "d")}</p>
                  </div>
                  <div>
                    <p className="font-medium">
                      {format(day, "MMMM d, yyyy")}
                      {isToday && <Badge variant="outline" className="ml-2">Today</Badge>}
                    </p>
                    {existingSlot ? (
                      <p className="text-sm text-muted-foreground">
                        {itemCount} item{itemCount !== 1 ? "s" : ""} • Orders by {format(new Date(existingSlot.orderCutoffDate), "MMM d")}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No offerings scheduled</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {existingSlot && (
                    <Badge variant="default">{itemCount} item{itemCount !== 1 ? "s" : ""}</Badge>
                  )}
                  {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </div>

              {/* Expanded item assignment section */}
              {isExpanded && (
                <CardContent className="pt-0 border-t">
                  <div className="py-4 space-y-4">
                    {/* Order cutoff editor - only shown for existing slots */}
                    {existingSlot && (
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-muted-foreground whitespace-nowrap">Order cutoff:</label>
                        <Input
                          type="date"
                          value={format(new Date(existingSlot.orderCutoffDate), "yyyy-MM-dd")}
                          className="w-auto"
                          onChange={async (e) => {
                            if (e.target.value) {
                              await updateDaySlotMutation.mutateAsync({
                                id: existingSlot.id,
                                orderCutoffDate: e.target.value,
                              });
                            }
                          }}
                          data-testid={`input-cutoff-${dateKey}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive ml-auto"
                          onClick={async () => {
                            await deleteDaySlotMutation.mutateAsync(existingSlot.id);
                            setExpandedDays(prev => { const next = new Set(prev); next.delete(dateKey); return next; });
                          }}
                          disabled={deleteDaySlotMutation.isPending}
                          data-testid={`button-remove-day-${dateKey}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove Day
                        </Button>
                      </div>
                    )}

                    {/* Assigned items display */}
                    {existingSlot && renderAssignedItems(existingSlot, dateKey)}

                    {/* Search and add items section */}
                    {renderSearchAndAdd(existingSlot || undefined, dateKey, dateKey)}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Serving Size Selection Dialog */}
      <Dialog open={servingSizeDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setServingSizeDialogOpen(false);
          setPendingItemToAdd(null);
          setSelectedServingSizes(new Map());
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Serving Sizes for {pendingItemToAdd?.item.title}</DialogTitle>
            <DialogDescription>
              Choose which serving options to offer on {pendingItemToAdd?.dateKey ? format(parseISO(pendingItemToAdd.dateKey), "MMMM d, yyyy") : "this day"} and set stock limits if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {pendingItemToAdd?.item.servingOptions?.map((opt) => {
              const settings = selectedServingSizes.get(opt.id) || { selected: false, stockLimited: false, stockQuantity: 10 };
              return (
                <div key={opt.id} className={`p-3 rounded-lg border ${settings.selected ? 'bg-primary/5 border-primary/20' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={settings.selected}
                      onCheckedChange={(checked) => {
                        const newMap = new Map(selectedServingSizes);
                        newMap.set(opt.id, { ...settings, selected: !!checked });
                        setSelectedServingSizes(newMap);
                      }}
                      data-testid={`checkbox-serving-option-${opt.id}`}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-sm text-muted-foreground">${opt.price.toFixed(2)}</p>
                    </div>
                  </div>
                  {settings.selected && (
                    <div className="mt-3 ml-7 space-y-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={settings.stockLimited}
                          onCheckedChange={(checked) => {
                            const newMap = new Map(selectedServingSizes);
                            newMap.set(opt.id, { ...settings, stockLimited: !!checked });
                            setSelectedServingSizes(newMap);
                          }}
                          data-testid={`checkbox-stock-limited-${opt.id}`}
                        />
                        <Archive className="h-3.5 w-3.5" />
                        Limit stock
                      </label>
                      {settings.stockLimited && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={settings.stockQuantity}
                            onChange={(e) => {
                              const newMap = new Map(selectedServingSizes);
                              newMap.set(opt.id, { ...settings, stockQuantity: parseInt(e.target.value) || 1 });
                              setSelectedServingSizes(newMap);
                            }}
                            className="w-20 h-8"
                            data-testid={`input-stock-quantity-${opt.id}`}
                          />
                          <span className="text-sm text-muted-foreground">available</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => {
              setServingSizeDialogOpen(false);
              setPendingItemToAdd(null);
              setSelectedServingSizes(new Map());
            }} data-testid="button-cancel-serving-sizes">
              Cancel
            </Button>
            <Button
              onClick={confirmAddItemWithServingSizes}
              disabled={!Array.from(selectedServingSizes.values()).some(s => s.selected) || assignItemToDaySlotMutation.isPending || addAssignmentServingOptionMutation.isPending}
              data-testid="button-confirm-serving-sizes"
            >
              {(assignItemToDaySlotMutation.isPending || addAssignmentServingOptionMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Add to Day
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default ScheduleTab;
