import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, eachDayOfInterval, parseISO, isSameDay, isSameMonth, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek, subDays } from "date-fns";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Loader2,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  Search,
  Archive,
  Zap,
  CalendarClock,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { computeScheduleForDateRange } from "@/lib/schedule-utils";
import MenuItemFormComponent from "./MenuItemForm";
import { menuItemSchema, defaultServingOptions } from "./types";
import type { MenuItemFormData, Allergen } from "./types";
import type { ServingOptionInput } from "@/components/serving-options-editor";
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
  allergens: Allergen[] | undefined;
}

const ScheduleTab = React.memo(function ScheduleTab({
  selectedChef,
  chefMenuItems,
  allergens,
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

  // Schedule dialog state (shown after adding item)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [pendingScheduleItem, setPendingScheduleItem] = useState<MenuItemWithDetails | null>(null);
  const [scheduleType, setScheduleType] = useState<string>("manual");
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [cutoffLeadHours, setCutoffLeadHours] = useState(24);

  // Scope dialog (shared for edit & delete)
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [scopeDialogMode, setScopeDialogMode] = useState<"edit" | "delete">("edit");
  const [scopeDialogItem, setScopeDialogItem] = useState<MenuItemWithDetails | null>(null);
  const [scopeDialogDateKey, setScopeDialogDateKey] = useState<string | null>(null);
  const [scopeDialogSlot, setScopeDialogSlot] = useState<DaySlotWithItems | null>(null);
  const [scopeDialogAssignedItem, setScopeDialogAssignedItem] = useState<MenuItemWithAssignment | null>(null);

  // Edit all future instances dialog
  const [editAllDialogOpen, setEditAllDialogOpen] = useState(false);
  const [editingItemForAll, setEditingItemForAll] = useState<MenuItemWithDetails | null>(null);

  const { toast } = useToast();

  // Edit-all form (for "all future instances" edit)
  const editAllForm = useForm<MenuItemFormData>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      chefId: selectedChef?.id || 0,
      title: "",
      description: "",
      imageUrl: "",
      allergenIds: [],
      ingredientIds: [],
      servingOptions: defaultServingOptions,
      scheduleType: "manual",
      cutoffLeadHours: 24,
      scheduleDays: null,
      scheduleStartDate: null,
      scheduleEndDate: null,
      oneOffDate: null,
      isScheduleActive: 1,
    },
  });

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

  // Populate edit-all form when editingItemForAll changes
  useEffect(() => {
    if (editingItemForAll && editAllDialogOpen) {
      const item = editingItemForAll;
      const mappedServingOptions: ServingOptionInput[] = item.servingOptions?.map(o => ({
        id: o.id,
        servingSize: o.servingSize,
        label: o.label,
        price: o.price,
        isDefault: o.isDefault === 1,
      })) || defaultServingOptions;
      const anyItem = item as any;
      editAllForm.reset({
        chefId: selectedChef?.id || 0,
        title: item.title,
        description: item.description || "",
        imageUrl: item.coverPhoto || "",
        allergenIds: item.allergens?.map(a => a.id) || [],
        ingredientIds: item.ingredients?.map(i => i.id) || [],
        servingOptions: mappedServingOptions,
        scheduleType: anyItem.scheduleType || "manual",
        cutoffLeadHours: anyItem.cutoffLeadHours || 24,
        scheduleDays: anyItem.scheduleDays || null,
        scheduleStartDate: anyItem.scheduleStartDate ? new Date(anyItem.scheduleStartDate).toISOString().split("T")[0] : null,
        scheduleEndDate: anyItem.scheduleEndDate ? new Date(anyItem.scheduleEndDate).toISOString().split("T")[0] : null,
        oneOffDate: anyItem.oneOffDate ? new Date(anyItem.oneOffDate).toISOString().split("T")[0] : null,
        isScheduleActive: anyItem.isScheduleActive ?? 1,
      });
    }
  }, [editingItemForAll, editAllDialogOpen, editAllForm, selectedChef?.id]);

  // Open schedule dialog after serving size dialog finishes closing
  // (delayed to avoid Radix Dialog close-animation suppressing the new dialog)
  useEffect(() => {
    if (pendingScheduleItem && !servingSizeDialogOpen) {
      const timer = setTimeout(() => {
        setScheduleDialogOpen(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pendingScheduleItem, servingSizeDialogOpen]);

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
    onError: (error: Error) => {
      toast({ title: "Error adding item", description: error.message, variant: "destructive" });
    },
  });

  const addAssignmentServingOptionMutation = useMutation({
    mutationFn: async ({ assignmentId, servingOptionId, stockLimited, stockQuantity }: { assignmentId: number; servingOptionId: number; stockLimited?: boolean; stockQuantity?: number }) => {
      return apiRequest("POST", `/api/assignments/${assignmentId}/serving-options`, { servingOptionId, stockLimited, stockQuantity });
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

  const updateAssignmentServingOptionMutation = useMutation({
    mutationFn: async ({ id, stockLimited, stockQuantity }: { id: number; stockLimited: boolean; stockQuantity?: number }) => {
      return apiRequest("PATCH", `/api/assignment-serving-options/${id}`, { stockLimited, stockQuantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating stock", description: error.message, variant: "destructive" });
    },
  });

  const removeItemFromDaySlotMutation = useMutation({
    mutationFn: async ({ daySlotId, itemId }: { daySlotId: number; itemId: number }) => {
      return apiRequest("DELETE", `/api/day-slots/${daySlotId}/items/${itemId}`);
    },
    onSuccess: (_, variables) => {
      // Check if the removed item has a recurring schedule
      const item = chefMenuItems?.find(i => i.id === variables.itemId);
      if (item && item.scheduleType !== "manual") {
        toast({ title: "Removed from this day", description: "The recurring schedule is unchanged." });
      } else {
        toast({ title: "Item removed", description: "Item has been removed from the day." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", selectedChef?.id] });
    },
    onError: (error: Error) => {
      toast({ title: "Error removing item", description: error.message, variant: "destructive" });
    },
  });

  const updateItemScheduleMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/menu-items/${itemId}`, data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/chefs"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", selectedChef?.id] }),
      ]);
    },
    onError: (error: Error) => {
      toast({ title: "Error updating schedule", description: error.message, variant: "destructive" });
    },
  });

  const editAllMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MenuItemFormData> }) => {
      const res = await fetch(`/api/menu-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update item");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Food item updated", description: "All future instances have been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", selectedChef?.id] });
      setEditAllDialogOpen(false);
      setEditingItemForAll(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error updating item", description: error.message, variant: "destructive" });
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

    // Consolidated invalidation after all mutations complete
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", selectedChef?.id] }),
    ]);

    toast({ title: "Item added", description: `${item.title} has been added to this day.` });
    setServingSizeDialogOpen(false);
    setSelectedServingSizes(new Map());

    // Always offer to set/change schedule when adding from Schedule tab
    setPendingScheduleItem(item);
    setScheduleType(item.scheduleType || "manual");
    setScheduleDays(item.scheduleDays || []);
    setCutoffLeadHours(item.cutoffLeadHours || 24);
    // Don't open schedule dialog here — let the useEffect handle it
    // after the serving size dialog finishes closing

    setPendingItemToAdd(null);
  }, [pendingItemToAdd, selectedServingSizes, assignItemToDaySlotMutation, addAssignmentServingOptionMutation, toast, selectedChef?.id]);

  const confirmSetSchedule = useCallback(async () => {
    if (!pendingScheduleItem) return;

    if (scheduleType === "manual" && (pendingScheduleItem.scheduleType === "manual" || !pendingScheduleItem.scheduleType)) {
      // User chose "Just this day" and item was already manual — no change needed
      setScheduleDialogOpen(false);
      setPendingScheduleItem(null);
      return;
    }

    const data: Record<string, unknown> = {
      scheduleType,
      cutoffLeadHours,
      isScheduleActive: scheduleType !== "manual" ? 1 : 0,
    };

    if (scheduleType === "custom_days") {
      data.scheduleDays = scheduleDays;
    }

    await updateItemScheduleMutation.mutateAsync({
      itemId: pendingScheduleItem.id,
      data,
    });

    toast({
      title: scheduleType === "manual" ? "Schedule removed" : "Schedule updated",
      description: scheduleType === "manual"
        ? `${pendingScheduleItem.title} will no longer auto-appear on scheduled days.`
        : `${pendingScheduleItem.title} will now automatically appear on scheduled days.`,
    });

    setScheduleDialogOpen(false);
    setPendingScheduleItem(null);
  }, [pendingScheduleItem, scheduleType, scheduleDays, cutoffLeadHours, updateItemScheduleMutation, toast]);

  const handleRemoveItemFromDay = useCallback(async (daySlotId: number, itemId: number) => {
    await removeItemFromDaySlotMutation.mutateAsync({ daySlotId, itemId });
  }, [removeItemFromDaySlotMutation]);

  // Filter items for search results using debounced query
  const getFilteredItems = useCallback((assignedIds: number[]) => {
    if (!debouncedSearchQuery) return [];
    const query = debouncedSearchQuery.toLowerCase();
    return (chefMenuItems || []).filter(item =>
      item.chefId === selectedChef?.id &&
      !assignedIds.includes(item.id) && (
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.ingredients?.some(i => i.name.toLowerCase().includes(query))
      )
    );
  }, [debouncedSearchQuery, chefMenuItems, selectedChef?.id]);

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

  // Client-side computed schedule from item schedule rules
  const computedSchedule = useMemo(() => {
    const allExceptions = (chefMenuItems || []).flatMap(item =>
      (item.scheduleExceptions || []).map(exc => ({
        menuItemId: item.id,
        exceptionDate: exc.exceptionDate,
      }))
    );
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 86400000);
    return computeScheduleForDateRange(chefMenuItems || [], start, end, allExceptions);
  }, [chefMenuItems]);

  // Mutation for creating exceptions directly (for items in computed view with no materialized assignment)
  const addExceptionMutation = useMutation({
    mutationFn: async ({ menuItemId, exceptionDate }: { menuItemId: number; exceptionDate: string }) => {
      return apiRequest("POST", `/api/menu-items/${menuItemId}/exceptions`, { date: exceptionDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", selectedChef?.id] });
    },
    onError: (error: Error) => {
      toast({ title: "Error removing item from day", description: error.message, variant: "destructive" });
    },
  });

  // Entry point for edit/delete actions on items
  const handleItemAction = useCallback((
    mode: "edit" | "delete",
    item: MenuItemWithDetails,
    dateKey: string,
    slot: DaySlotWithItems | null,
    assignedItem: MenuItemWithAssignment | null,
  ) => {
    const anyItem = item as any;
    const isRecurring = anyItem.scheduleType && anyItem.scheduleType !== "manual" && anyItem.isScheduleActive;

    if (isRecurring) {
      // Open scope dialog for recurring items
      setScopeDialogMode(mode);
      setScopeDialogItem(item);
      setScopeDialogDateKey(dateKey);
      setScopeDialogSlot(slot);
      setScopeDialogAssignedItem(assignedItem);
      setScopeDialogOpen(true);
    } else {
      // Direct action for manual items
      if (mode === "delete") {
        if (assignedItem && slot) {
          handleRemoveItemFromDay(slot.id, item.id);
        }
      } else {
        // Edit: open serving size dialog for this day
        if (assignedItem && slot) {
          const initialSelections = new Map<number, ServingSizeSelection>();
          (item.servingOptions || []).forEach(opt => {
            const existing = assignedItem.assignedServingOptions?.find(aso => aso.servingOption.id === opt.id);
            initialSelections.set(opt.id, {
              selected: !!existing,
              stockLimited: existing ? existing.stockLimited === 1 : false,
              stockQuantity: existing?.stockQuantity || 10,
            });
          });
          setSelectedServingSizes(initialSelections);
          setPendingItemToAdd({ item, daySlotId: slot.id, dateKey });
          setServingSizeDialogOpen(true);
        }
      }
    }
  }, [handleRemoveItemFromDay]);

  // "This day only" scope handler
  const handleScopeThisDay = useCallback(async () => {
    if (!scopeDialogItem || !scopeDialogDateKey) return;

    if (scopeDialogMode === "delete") {
      if (scopeDialogAssignedItem && scopeDialogSlot) {
        await handleRemoveItemFromDay(scopeDialogSlot.id, scopeDialogItem.id);
      } else {
        await addExceptionMutation.mutateAsync({
          menuItemId: scopeDialogItem.id,
          exceptionDate: scopeDialogDateKey,
        });
        toast({ title: "Removed from this day", description: "The recurring schedule is unchanged." });
      }
    } else {
      // Edit this day: open serving size dialog
      if (scopeDialogAssignedItem && scopeDialogSlot) {
        // Already materialized — open serving size editor pre-populated
        const initialSelections = new Map<number, ServingSizeSelection>();
        (scopeDialogItem.servingOptions || []).forEach(opt => {
          const existing = scopeDialogAssignedItem.assignedServingOptions?.find(aso => aso.servingOption.id === opt.id);
          initialSelections.set(opt.id, {
            selected: !!existing,
            stockLimited: existing ? existing.stockLimited === 1 : false,
            stockQuantity: existing?.stockQuantity || 10,
          });
        });
        setSelectedServingSizes(initialSelections);
        setPendingItemToAdd({ item: scopeDialogItem, daySlotId: scopeDialogSlot.id, dateKey: scopeDialogDateKey });
        setServingSizeDialogOpen(true);
      } else if (selectedChef) {
        // Not materialized — create day slot + assignment first, then open serving size dialog
        await handleAddItemToDay(scopeDialogItem, null, scopeDialogDateKey);
      }
    }

    setScopeDialogOpen(false);
    setScopeDialogItem(null);
    setScopeDialogDateKey(null);
    setScopeDialogSlot(null);
    setScopeDialogAssignedItem(null);
  }, [scopeDialogMode, scopeDialogItem, scopeDialogDateKey, scopeDialogSlot, scopeDialogAssignedItem, handleRemoveItemFromDay, addExceptionMutation, toast, selectedChef, handleAddItemToDay]);

  // "All future instances" scope handler
  const handleScopeAllFuture = useCallback(async () => {
    if (!scopeDialogItem || !scopeDialogDateKey) return;

    if (scopeDialogMode === "delete") {
      // Set scheduleEndDate to day before selected date
      const selectedDate = parseISO(scopeDialogDateKey);
      const dayBefore = format(subDays(selectedDate, 1), "yyyy-MM-dd");
      const anyItem = scopeDialogItem as any;
      const startDate = anyItem.scheduleStartDate ? format(new Date(anyItem.scheduleStartDate), "yyyy-MM-dd") : null;

      if (startDate && scopeDialogDateKey <= startDate) {
        // Selected date is on or before start — deactivate entirely
        await updateItemScheduleMutation.mutateAsync({
          itemId: scopeDialogItem.id,
          data: { isScheduleActive: 0 },
        });
        toast({ title: "Schedule deactivated", description: `${scopeDialogItem.title} will no longer auto-appear on scheduled days.` });
      } else {
        await updateItemScheduleMutation.mutateAsync({
          itemId: scopeDialogItem.id,
          data: { scheduleEndDate: dayBefore },
        });
        toast({ title: "Schedule ended", description: `${scopeDialogItem.title} will no longer appear from ${format(selectedDate, "MMM d")} onwards.` });
      }

      // Also remove the materialized assignment if it exists
      if (scopeDialogAssignedItem && scopeDialogSlot) {
        await handleRemoveItemFromDay(scopeDialogSlot.id, scopeDialogItem.id);
      }
    } else {
      // Edit all future — open full edit form
      setEditingItemForAll(scopeDialogItem);
      setEditAllDialogOpen(true);
    }

    setScopeDialogOpen(false);
    setScopeDialogItem(null);
    setScopeDialogDateKey(null);
    setScopeDialogSlot(null);
    setScopeDialogAssignedItem(null);
  }, [scopeDialogMode, scopeDialogItem, scopeDialogDateKey, scopeDialogSlot, scopeDialogAssignedItem, updateItemScheduleMutation, toast, handleRemoveItemFromDay]);

  // Submit handler for edit-all form
  const handleEditAllSubmit = useCallback((data: MenuItemFormData) => {
    if (!editingItemForAll) return;
    editAllMutation.mutate({ id: editingItemForAll.id, data });
  }, [editingItemForAll, editAllMutation]);

  // Helper: get merged item count for a date (computed + materialized, deduplicated)
  const getMergedItemsForDate = useCallback((dateKey: string): { items: MenuItemWithDetails[]; sources: Map<number, "schedule" | "manual"> } => {
    const computedEntry = computedSchedule.get(dateKey);
    const slot = getSlotForDate(dateKey);
    const items: MenuItemWithDetails[] = [];
    const sources = new Map<number, "schedule" | "manual">();

    // Add computed items first
    if (computedEntry) {
      for (const item of computedEntry.items) {
        items.push(item);
        sources.set(item.id, "schedule");
      }
    }

    // Add materialized items (manual assignments not already in computed)
    if (slot?.items) {
      for (const assignedItem of slot.items) {
        if (!sources.has(assignedItem.id)) {
          // Find full item details from chefMenuItems
          const fullItem = chefMenuItems?.find(mi => mi.id === assignedItem.id);
          if (fullItem) {
            items.push(fullItem);
            sources.set(assignedItem.id, "manual");
          }
        }
      }
    }

    return { items, sources };
  }, [computedSchedule, getSlotForDate, chefMenuItems]);

  const selectedDateKey = selectedCalendarDate;
  const selectedSlot = selectedDateKey ? getSlotForDate(selectedDateKey) : null;

  // Schedule type label helper
  const getScheduleLabel = useCallback((scheduleType: string | null | undefined): string | null => {
    switch (scheduleType) {
      case "daily": return "Every day";
      case "weekdays": return "Weekdays";
      case "weekends": return "Weekends";
      case "custom_days": return "Custom days";
      case "one_off": return "One-off";
      default: return null;
    }
  }, []);

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
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium truncate">{assignedItem.title}</p>
                      {(() => {
                        const menuItem = chefMenuItems?.find(mi => mi.id === assignedItem.id);
                        const label = menuItem ? getScheduleLabel(menuItem.scheduleType) : null;
                        return label ? (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            <CalendarClock className="h-3 w-3 mr-1" />
                            {label}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
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
                            {aso.stockLimited === 1 ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="1"
                                  defaultValue={aso.stockQuantity || 10}
                                  className="w-16 h-6 text-xs px-1"
                                  onBlur={(e) => {
                                    const qty = parseInt(e.target.value) || 1;
                                    if (qty !== aso.stockQuantity) {
                                      updateAssignmentServingOptionMutation.mutate({ id: aso.id, stockLimited: true, stockQuantity: qty });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  }}
                                />
                                <Badge
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-secondary/80"
                                  onClick={() => updateAssignmentServingOptionMutation.mutate({ id: aso.id, stockLimited: false })}
                                >
                                  Limited
                                </Badge>
                              </div>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs cursor-pointer hover:bg-accent"
                                onClick={() => updateAssignmentServingOptionMutation.mutate({ id: aso.id, stockLimited: true, stockQuantity: aso.stockQuantity || 10 })}
                              >
                                Unlimited
                              </Badge>
                            )}
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
  }, [handleRemoveItemFromDay, removeItemFromDaySlotMutation.isPending, removeAssignmentServingOptionMutation, updateAssignmentServingOptionMutation, chefMenuItems, getScheduleLabel]);

  // Shared search and add items renderer
  const renderSearchAndAdd = useCallback((
    slot: DaySlotWithItems | undefined,
    dateKey: string,
    testIdSuffix?: string
  ) => {
    // Exclude items that are already shown (both materialized and computed)
    const merged = getMergedItemsForDate(dateKey);
    const assignedIds = merged.items.map(i => i.id);
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        {renderPriceRange(item)}
                      </p>
                      {getScheduleLabel(item.scheduleType) && (
                        <Badge variant="secondary" className="text-xs">
                          <CalendarClock className="h-3 w-3 mr-1" />
                          {getScheduleLabel(item.scheduleType)}
                        </Badge>
                      )}
                    </div>
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
  }, [itemSearchQuery, debouncedSearchQuery, getFilteredItems, handleAddItemToDay, handleSearchChange, renderPriceRange, getScheduleLabel, getMergedItemsForDate]);

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
                  const merged = getMergedItemsForDate(dateKey);
                  const itemCount = merged.items.length;

                  return (
                    <div
                      key={dateKey}
                      className={`relative min-h-[90px] p-1.5 cursor-pointer border-r last:border-r-0 transition-colors
                        ${!isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""}
                        ${isSelected ? "bg-primary/10 ring-2 ring-primary ring-inset" : "hover:bg-accent/50"}
                        ${isToday && !isSelected ? "bg-primary/5 ring-1 ring-primary/30 ring-inset" : ""}
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
                          {merged.items.slice(0, 3).map((item) => (
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
            {selectedDateKey && (() => {
              const mergedForPanel = getMergedItemsForDate(selectedDateKey);
              const totalItems = mergedForPanel.items.length;
              return (
              <>
                <SheetHeader>
                  <SheetTitle>
                    {format(new Date(selectedDateKey + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                    {isSameDay(new Date(selectedDateKey + "T00:00:00"), today) && (
                      <Badge variant="outline" className="ml-2">Today</Badge>
                    )}
                  </SheetTitle>
                  {totalItems > 0 || selectedSlot ? (
                    <SheetDescription>
                      {selectedSlot && (selectedSlot as any).autoGenerated === 1 && (
                        <Badge variant="secondary" className="mr-2 text-xs"><Zap className="h-3 w-3 mr-1" />Auto</Badge>
                      )}
                      {totalItems} item{totalItems !== 1 ? "s" : ""}{selectedSlot ? ` • Orders by ${format(new Date(selectedSlot.orderCutoffDate), "MMM d")}` : ""}
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

                  {/* Merged items display (computed + materialized) */}
                  {totalItems > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Scheduled items:</p>
                      <div className="space-y-2">
                        {mergedForPanel.items.map((item) => {
                          const source = mergedForPanel.sources.get(item.id);
                          // Check if this item has a materialized assignment in the slot
                          const assignedItem = selectedSlot?.items?.find((ai: MenuItemWithAssignment) => ai.id === item.id);
                          return (
                            <div key={item.id} className="p-3 rounded-lg border bg-primary/5 border-primary/20">
                              <div className="flex items-start gap-3">
                                {item.coverPhoto && (
                                  <img src={item.coverPhoto} alt={item.title} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <p className="font-medium truncate">{item.title}</p>
                                      {source === "schedule" && (
                                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                                          <CalendarClock className="h-3 w-3 mr-1" />
                                          {getScheduleLabel(item.scheduleType) || "Scheduled"}
                                        </Badge>
                                      )}
                                      {source === "manual" && (
                                        <Badge variant="outline" className="text-xs flex-shrink-0">Manual</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleItemAction("edit", item, selectedDateKey!, selectedSlot || null, assignedItem || null)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive flex-shrink-0"
                                        onClick={() => handleItemAction("delete", item, selectedDateKey!, selectedSlot || null, assignedItem || null)}
                                        disabled={removeItemFromDaySlotMutation.isPending || addExceptionMutation.isPending}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  {/* Show assigned serving options if materialized */}
                                  {assignedItem?.assignedServingOptions && assignedItem.assignedServingOptions.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {assignedItem.assignedServingOptions.map((aso) => (
                                        <div key={aso.id} className="flex items-center justify-between text-sm pl-2 border-l-2 border-muted">
                                          <div className="flex items-center gap-2">
                                            <span>{aso.servingOption.label}</span>
                                            <span className="text-muted-foreground">${aso.servingOption.price.toFixed(2)}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {aso.stockLimited === 1 ? (
                                              <div className="flex items-center gap-1">
                                                <Input
                                                  type="number"
                                                  min="1"
                                                  defaultValue={aso.stockQuantity || 10}
                                                  className="w-16 h-6 text-xs px-1"
                                                  onBlur={(e) => {
                                                    const qty = parseInt(e.target.value) || 1;
                                                    if (qty !== aso.stockQuantity) {
                                                      updateAssignmentServingOptionMutation.mutate({ id: aso.id, stockLimited: true, stockQuantity: qty });
                                                    }
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                                  }}
                                                />
                                                <Badge
                                                  variant="secondary"
                                                  className="text-xs cursor-pointer hover:bg-secondary/80"
                                                  onClick={() => updateAssignmentServingOptionMutation.mutate({ id: aso.id, stockLimited: false })}
                                                >
                                                  Limited
                                                </Badge>
                                              </div>
                                            ) : (
                                              <Badge
                                                variant="outline"
                                                className="text-xs cursor-pointer hover:bg-accent"
                                                onClick={() => updateAssignmentServingOptionMutation.mutate({ id: aso.id, stockLimited: true, stockQuantity: aso.stockQuantity || 10 })}
                                              >
                                                Unlimited
                                              </Badge>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 text-destructive"
                                              onClick={() => removeAssignmentServingOptionMutation.mutate(aso.id)}
                                              disabled={removeAssignmentServingOptionMutation.isPending}
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Show price range for computed-only items */}
                                  {!assignedItem && item.servingOptions && item.servingOptions.length > 0 && (
                                    <p className="text-sm text-muted-foreground mt-1">{renderPriceRange(item)}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Search and add items */}
                  {renderSearchAndAdd(selectedSlot || undefined, selectedDateKey)}
                </div>
              </>
              );
            })()}
          </SheetContent>
        </Sheet>
      </div>

      {/* Mobile list view */}
      <div className="block md:hidden space-y-3">
        {upcomingDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const existingSlot = getSlotForDate(dateKey);
          const isExpanded = expandedDays.has(dateKey);
          const mergedMobile = getMergedItemsForDate(dateKey);
          const itemCount = mergedMobile.items.length;
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
                    {itemCount > 0 || existingSlot ? (
                      <p className="text-sm text-muted-foreground">
                        {existingSlot && (existingSlot as any).autoGenerated === 1 && (
                          <Badge variant="secondary" className="mr-1 text-xs"><Zap className="h-3 w-3 mr-0.5" />Auto</Badge>
                        )}
                        {itemCount} item{itemCount !== 1 ? "s" : ""}{existingSlot ? ` • Orders by ${format(new Date(existingSlot.orderCutoffDate), "MMM d")}` : ""}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No offerings scheduled</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
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

                    {/* Merged items display (computed + materialized) */}
                    {mergedMobile.items.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Scheduled items:</p>
                        <div className="space-y-2">
                          {mergedMobile.items.map((item) => {
                            const source = mergedMobile.sources.get(item.id);
                            const assignedItem = existingSlot?.items?.find((ai: MenuItemWithAssignment) => ai.id === item.id);
                            return (
                              <div key={item.id} className="p-3 rounded-lg border bg-primary/5 border-primary/20">
                                <div className="flex items-start gap-3">
                                  {item.coverPhoto && (
                                    <img src={item.coverPhoto} alt={item.title} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <p className="font-medium truncate">{item.title}</p>
                                        {source === "schedule" && (
                                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                                            <CalendarClock className="h-3 w-3 mr-1" />
                                            {getScheduleLabel(item.scheduleType) || "Scheduled"}
                                          </Badge>
                                        )}
                                        {source === "manual" && (
                                          <Badge variant="outline" className="text-xs flex-shrink-0">Manual</Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => handleItemAction("edit", item, dateKey, existingSlot || null, assignedItem || null)}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-destructive flex-shrink-0"
                                          onClick={() => handleItemAction("delete", item, dateKey, existingSlot || null, assignedItem || null)}
                                          disabled={removeItemFromDaySlotMutation.isPending || addExceptionMutation.isPending}
                                          data-testid={`button-remove-item-${dateKey}-${item.id}`}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    {/* Show assigned serving options if materialized */}
                                    {assignedItem?.assignedServingOptions && assignedItem.assignedServingOptions.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {assignedItem.assignedServingOptions.map((aso) => (
                                          <div key={aso.id} className="flex items-center justify-between text-sm pl-2 border-l-2 border-muted">
                                            <div className="flex items-center gap-2">
                                              <span>{aso.servingOption.label}</span>
                                              <span className="text-muted-foreground">${aso.servingOption.price.toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {aso.stockLimited === 1 ? (
                                                <div className="flex items-center gap-1">
                                                  <Input
                                                    type="number"
                                                    min="1"
                                                    defaultValue={aso.stockQuantity || 10}
                                                    className="w-16 h-6 text-xs px-1"
                                                    onBlur={(e) => {
                                                      const qty = parseInt(e.target.value) || 1;
                                                      if (qty !== aso.stockQuantity) {
                                                        updateAssignmentServingOptionMutation.mutate({ id: aso.id, stockLimited: true, stockQuantity: qty });
                                                      }
                                                    }}
                                                    onKeyDown={(e) => {
                                                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                                    }}
                                                  />
                                                  <Badge
                                                    variant="secondary"
                                                    className="text-xs cursor-pointer hover:bg-secondary/80"
                                                    onClick={() => updateAssignmentServingOptionMutation.mutate({ id: aso.id, stockLimited: false })}
                                                  >
                                                    Limited
                                                  </Badge>
                                                </div>
                                              ) : (
                                                <Badge
                                                  variant="outline"
                                                  className="text-xs cursor-pointer hover:bg-accent"
                                                  onClick={() => updateAssignmentServingOptionMutation.mutate({ id: aso.id, stockLimited: true, stockQuantity: aso.stockQuantity || 10 })}
                                                >
                                                  Unlimited
                                                </Badge>
                                              )}
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 text-destructive"
                                                onClick={() => removeAssignmentServingOptionMutation.mutate(aso.id)}
                                                disabled={removeAssignmentServingOptionMutation.isPending}
                                                data-testid={`button-remove-serving-${aso.id}`}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {/* Show price range for computed-only items */}
                                    {!assignedItem && item.servingOptions && item.servingOptions.length > 0 && (
                                      <p className="text-sm text-muted-foreground mt-1">{renderPriceRange(item)}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

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

      {/* Schedule Dialog - shown after adding a manual item */}
      <Dialog open={scheduleDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setScheduleDialogOpen(false);
          setPendingScheduleItem(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Schedule "{pendingScheduleItem?.title}"
            </DialogTitle>
            <DialogDescription>
              Would you like this item to automatically appear on other days?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>How often should this item appear?</Label>
              <Select value={scheduleType} onValueChange={setScheduleType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Just this day</SelectItem>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekdays">Weekdays (Mon–Fri)</SelectItem>
                  <SelectItem value="weekends">Weekends (Sat–Sun)</SelectItem>
                  <SelectItem value="custom_days">Specific days of the week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleType === "custom_days" && (
              <div className="space-y-2">
                <Label>Select days</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { label: "Sun", value: 0 },
                    { label: "Mon", value: 1 },
                    { label: "Tue", value: 2 },
                    { label: "Wed", value: 3 },
                    { label: "Thu", value: 4 },
                    { label: "Fri", value: 5 },
                    { label: "Sat", value: 6 },
                  ].map((day) => (
                    <Button
                      key={day.value}
                      variant={scheduleDays.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      className="w-12"
                      onClick={() => {
                        setScheduleDays(prev =>
                          prev.includes(day.value)
                            ? prev.filter(d => d !== day.value)
                            : [...prev, day.value]
                        );
                      }}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {scheduleType !== "manual" && (
              <div className="space-y-2">
                <Label>Advance notice (hours before day)</Label>
                <Input
                  type="number"
                  min="1"
                  value={cutoffLeadHours}
                  onChange={(e) => setCutoffLeadHours(parseInt(e.target.value) || 24)}
                  className="w-24"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => {
              setScheduleDialogOpen(false);
              setPendingScheduleItem(null);
            }}>
              Skip
            </Button>
            <Button
              onClick={confirmSetSchedule}
              disabled={
                updateItemScheduleMutation.isPending ||
                (scheduleType === "custom_days" && scheduleDays.length === 0)
              }
            >
              {updateItemScheduleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {scheduleType === "manual" ? "Done" : "Set Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scope Dialog — "This day only" vs "All future instances" */}
      <AlertDialog open={scopeDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setScopeDialogOpen(false);
          setScopeDialogItem(null);
          setScopeDialogDateKey(null);
          setScopeDialogSlot(null);
          setScopeDialogAssignedItem(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {scopeDialogMode === "edit" ? "Edit this item" : "Remove this item"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is a recurring item ({scopeDialogItem?.title}). Would you like to apply this change to just this day, or all future instances?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleScopeThisDay}>
              This day only
            </AlertDialogAction>
            <AlertDialogAction onClick={handleScopeAllFuture}>
              All future instances
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit All Future Dialog */}
      <Dialog open={editAllDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditAllDialogOpen(false);
          setEditingItemForAll(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Food Item (All Future Instances)</DialogTitle>
            <DialogDescription>
              Changes will apply to {editingItemForAll?.title} across all future scheduled dates.
            </DialogDescription>
          </DialogHeader>
          <MenuItemFormComponent
            form={editAllForm}
            allergens={allergens}
            onSubmit={handleEditAllSubmit}
            onCancel={() => {
              setEditAllDialogOpen(false);
              setEditingItemForAll(null);
            }}
            isPending={editAllMutation.isPending}
            submitLabel="Save Changes"
            pendingLabel="Saving..."
            imageUploadId="edit-all-image-upload"
            testIds={{
              titleInput: "edit-all-title",
              removeImageButton: "edit-all-remove-image",
              imageUploadInput: "edit-all-image-input",
              allergenCheckboxPrefix: "edit-all-allergen-",
              submitButton: "edit-all-submit",
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
});

export default ScheduleTab;
