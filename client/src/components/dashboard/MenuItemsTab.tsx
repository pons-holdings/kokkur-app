import React, { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  UtensilsCrossed,
  Pencil,
  Trash2,
  CalendarClock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import MenuItemFormComponent from "./MenuItemForm";
import type { ServingOptionInput } from "@/components/serving-options-editor";
import {
  menuItemSchema,
  defaultServingOptions,
} from "./types";
import type { MenuItemFormData, MenuItemWithDetails, Allergen } from "./types";

interface MenuItemsTabProps {
  chefId: number | undefined;
  chefMenuItems: MenuItemWithDetails[] | undefined;
  itemsLoading: boolean;
  allergens: Allergen[] | undefined;
}

const MenuItemsTab = React.memo(function MenuItemsTab({
  chefId,
  chefMenuItems,
  itemsLoading,
  allergens,
}: MenuItemsTabProps) {
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemWithDetails | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const { toast } = useToast();

  const itemForm = useForm<MenuItemFormData>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      chefId: chefId || 0,
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

  // Keep chefId in sync
  React.useEffect(() => {
    if (chefId) {
      itemForm.setValue("chefId", chefId);
    }
  }, [chefId, itemForm]);

  const createMenuItemMutation = useMutation({
    mutationFn: async (data: MenuItemFormData) => {
      const res = await fetch("/api/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create item");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      const scheduleLabels: Record<string, string> = {
        daily: "every day",
        weekdays: "weekdays",
        weekends: "weekends",
        custom_days: "your selected days",
      };
      const schedLabel = scheduleLabels[variables.scheduleType || ""];
      if (schedLabel) {
        toast({ title: "Food item created — schedule active!", description: `This item will auto-appear on ${schedLabel} in your calendar.` });
      } else {
        toast({ title: "Food item created", description: "Your new food item has been added." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", chefId] });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      setAddItemDialogOpen(false);
      itemForm.reset({ chefId: chefId || 0, title: "", description: "", imageUrl: "", allergenIds: [], ingredientIds: [], servingOptions: defaultServingOptions, scheduleType: "manual", cutoffLeadHours: 24, scheduleDays: null, scheduleStartDate: null, scheduleEndDate: null, oneOffDate: null, isScheduleActive: 1 });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating item", description: error.message, variant: "destructive" });
    },
  });

  const updateMenuItemMutation = useMutation({
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
    onSuccess: (_data, variables) => {
      const scheduleLabels: Record<string, string> = {
        daily: "every day",
        weekdays: "weekdays",
        weekends: "weekends",
        custom_days: "your selected days",
      };
      const schedLabel = scheduleLabels[variables.data.scheduleType || ""];
      if (schedLabel) {
        toast({ title: "Food item updated — schedule active!", description: `This item will auto-appear on ${schedLabel} in your calendar.` });
      } else {
        toast({ title: "Food item updated", description: "Your food item has been updated." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", chefId] });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      setEditItemDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error updating item", description: error.message, variant: "destructive" });
    },
  });

  const deleteMenuItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/menu-items/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete item");
      }
    },
    onSuccess: () => {
      toast({ title: "Food item deleted", description: "Your food item has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", chefId] });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      setDeleteItemId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting item", description: error.message, variant: "destructive" });
    },
  });

  const onSubmitItem = useCallback((data: MenuItemFormData) => {
    createMenuItemMutation.mutate(data);
  }, [createMenuItemMutation]);

  const handleEditItem = useCallback((item: MenuItemWithDetails) => {
    setEditingItem(item);
    const mappedServingOptions: ServingOptionInput[] = item.servingOptions?.map(o => ({
      id: o.id,
      servingSize: o.servingSize,
      label: o.label,
      price: o.price,
      isDefault: o.isDefault === 1,
    })) || defaultServingOptions;
    const anyItem = item as any;
    itemForm.reset({
      chefId: chefId || 0,
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
    setEditItemDialogOpen(true);
  }, [chefId, itemForm]);

  const handleEditSubmit = useCallback((data: MenuItemFormData) => {
    if (editingItem) {
      updateMenuItemMutation.mutate({ id: editingItem.id, data });
    }
  }, [editingItem, updateMenuItemMutation]);

  const handleCancelAdd = useCallback(() => {
    setAddItemDialogOpen(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditItemDialogOpen(false);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteItemId) {
      deleteMenuItemMutation.mutate(deleteItemId);
    }
  }, [deleteItemId, deleteMenuItemMutation]);

  const getScheduleBadge = useCallback((item: MenuItemWithDetails) => {
    const anyItem = item as any;
    const type = anyItem.scheduleType;
    if (!type || type === "manual") return null;

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let label = "";
    switch (type) {
      case "daily": label = "Every day"; break;
      case "weekdays": label = "Weekdays"; break;
      case "weekends": label = "Weekends"; break;
      case "one_off":
        label = anyItem.oneOffDate
          ? new Date(anyItem.oneOffDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " only"
          : "One-time";
        break;
      case "custom_days":
        label = (anyItem.scheduleDays || []).map((d: number) => dayNames[d]).join(", ");
        break;
    }

    const hours = anyItem.cutoffLeadHours || 24;
    const cutoffLabel = hours >= 24 ? `${Math.floor(hours / 24)}d notice` : `${hours}h notice`;

    return (
      <div className="flex flex-wrap gap-1">
        <Badge variant="secondary" className="text-xs">
          <CalendarClock className="h-3 w-3 mr-1" />
          {label}
        </Badge>
        <Badge variant="outline" className="text-xs">{cutoffLabel}</Badge>
        {anyItem.isScheduleActive === 0 && (
          <Badge variant="destructive" className="text-xs">Paused</Badge>
        )}
      </div>
    );
  }, []);

  const priceDisplay = useCallback((item: MenuItemWithDetails) => {
    const opts = item.servingOptions || [];
    if (opts.length === 0) return <span className="font-semibold text-lg text-muted-foreground">No pricing</span>;
    const prices = opts.map(o => o.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return <span className="font-semibold text-lg">{min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} - $${max.toFixed(2)}`}</span>;
  }, []);

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Food Items</h2>

        <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-item">
              <Plus className="h-4 w-4 mr-2" />
              Add Food Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Food Item</DialogTitle>
              <DialogDescription>Create a reusable food item that can be added to any of your menus.</DialogDescription>
            </DialogHeader>

            <MenuItemFormComponent
              form={itemForm}
              allergens={allergens}
              onSubmit={onSubmitItem}
              onCancel={handleCancelAdd}
              isPending={createMenuItemMutation.isPending}
              submitLabel="Add Item"
              pendingLabel="Saving..."
              imageUploadId="image-upload"
              testIds={{
                titleInput: "input-item-title",
                descriptionInput: "input-description",
                removeImageButton: "button-remove-image",
                imageUploadInput: "input-image-upload",
                allergenCheckboxPrefix: "checkbox-allergen-",
                submitButton: "button-save-item",
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {itemsLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (<Card key={i}><CardContent className="py-4"><Skeleton className="h-32" /></CardContent></Card>))}
        </div>
      ) : !chefMenuItems || chefMenuItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-medium mb-2">No Food Items Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first food item to add to your menus.</p>
            <Button onClick={() => setAddItemDialogOpen(true)} data-testid="button-add-first-item">
              <Plus className="h-4 w-4 mr-2" />Add Your First Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chefMenuItems.map((item) => (
            <Card key={item.id} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base truncate">{item.title}</CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditItem(item)} data-testid={`button-edit-item-${item.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteItemId(item.id)} data-testid={`button-delete-item-${item.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {item.description && (
                  <CardDescription className="line-clamp-2">{item.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {(item.coverPhoto || item.photos?.[0]?.imageUrl) && (
                  <div className="aspect-video rounded-md overflow-hidden bg-muted">
                    <img src={item.coverPhoto || item.photos?.[0]?.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  {priceDisplay(item)}
                  <span className="text-sm text-muted-foreground">{item.servingOptions?.length || 0} serving option(s)</span>
                </div>
                {getScheduleBadge(item)}
                {item.allergens && item.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.allergens.map((a) => (
                      <Badge key={a.id} variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                        {a.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Item Dialog */}
      <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Food Item</DialogTitle>
          </DialogHeader>

          <MenuItemFormComponent
            form={itemForm}
            allergens={allergens}
            onSubmit={handleEditSubmit}
            onCancel={handleCancelEdit}
            isPending={updateMenuItemMutation.isPending}
            submitLabel="Save Changes"
            pendingLabel="Saving..."
            imageUploadId="edit-image-upload"
            testIds={{
              titleInput: "input-edit-item-title",
              removeImageButton: "button-edit-remove-image",
              imageUploadInput: "input-edit-image-upload",
              allergenCheckboxPrefix: "checkbox-edit-allergen-",
              submitButton: "button-update-item",
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteItemId !== null} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Food Item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the food item and remove it from all menus.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

export default MenuItemsTab;
