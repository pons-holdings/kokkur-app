import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
  ChefHat,
  Plus,
  Package,
  ClipboardList,
  UtensilsCrossed,
  AlertTriangle,
  Loader2,
  Check,
  Upload,
  ImageIcon,
  X,
  Calendar,
  CalendarDays,
  Pencil,
  Trash2,
  ListPlus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Header } from "@/components/header";
import { IngredientTypeahead } from "@/components/ingredient-typeahead";
import { ServingOptionsEditor, type ServingOptionInput } from "@/components/serving-options-editor";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChefProfileWithDaySlots, Allergen, Ingredient, OrderWithItems, MenuItem, MenuItemWithDetails, ServingOption } from "@shared/schema";

const servingOptionSchema = z.object({
  id: z.number().optional(),
  servingSize: z.number().min(1),
  label: z.string().min(1),
  price: z.number().min(0.01, "Price must be greater than 0"),
  isDefault: z.boolean(),
});

const menuItemSchema = z.object({
  chefId: z.number(),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  allergenIds: z.array(z.number()).default([]),
  ingredientIds: z.array(z.number()).default([]),
  servingOptions: z.array(servingOptionSchema).min(1, "At least one serving option is required"),
});

type MenuItemForm = z.infer<typeof menuItemSchema>;

const daySlotSchema = z.object({
  chefId: z.number(),
  date: z.string(),
  orderCutoffDate: z.string(),
});

type DaySlotForm = z.infer<typeof daySlotSchema>;

interface DaySlot {
  id: number;
  chefId: number;
  date: string;
  orderCutoffDate: string;
  items?: MenuItemWithDetails[];
}


export default function Dashboard() {
  const [selectedChefId, setSelectedChefId] = useState<number | null>(null);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemWithDetails | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [selectedDaySlot, setSelectedDaySlot] = useState<DaySlot | null>(null);
  const [addDaySlotDate, setAddDaySlotDate] = useState("");
  const [addDaySlotCutoff, setAddDaySlotCutoff] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: chefs, isLoading: chefsLoading } = useQuery<ChefProfileWithDaySlots[]>({
    queryKey: ["/api/chefs"],
  });

  const { data: allergens } = useQuery<Allergen[]>({
    queryKey: ["/api/allergens"],
  });

  const { data: ingredients } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const selectedChef = chefs?.find((c) => c.id === selectedChefId) || chefs?.[0];

  const { data: chefMenuItems, isLoading: itemsLoading } = useQuery<MenuItemWithDetails[]>({
    queryKey: ["/api/menu-items/chef", selectedChef?.id],
    enabled: !!selectedChef?.id,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders/chef", selectedChef?.id],
    enabled: !!selectedChef?.id,
  });

  const pendingOrders = orders?.filter((o) => o.status === "pending" || o.status === "confirmed") || [];

  const prepList = pendingOrders.reduce((acc, order) => {
    order.items?.forEach((item) => {
      const existing = acc.find((p) => p.menuItemId === item.menuItemId);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.orderCount += 1;
      } else {
        acc.push({
          menuItemId: item.menuItemId,
          itemTitle: item.itemTitle,
          totalQuantity: item.quantity,
          orderCount: 1,
        });
      }
    });
    return acc;
  }, [] as { menuItemId: number; itemTitle: string; totalQuantity: number; orderCount: number }[]);

  const defaultServingOptions: ServingOptionInput[] = [
    { servingSize: 1, label: "1 serving", price: 0, isDefault: true }
  ];

  const itemForm = useForm<MenuItemForm>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      chefId: selectedChef?.id || 0,
      title: "",
      description: "",
      imageUrl: "",
      allergenIds: [],
      ingredientIds: [],
      servingOptions: defaultServingOptions,
    },
  });

  useEffect(() => {
    if (selectedChef?.id) {
      itemForm.setValue("chefId", selectedChef.id);
    }
  }, [selectedChef?.id, itemForm]);

  const [uploadingImage, setUploadingImage] = useState(false);

  const createMenuItemMutation = useMutation({
    mutationFn: async (data: MenuItemForm) => {
      return apiRequest("POST", "/api/menu-items", data);
    },
    onSuccess: () => {
      toast({ title: "Food item created", description: "Your new food item has been added." });
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", selectedChef?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      setAddItemDialogOpen(false);
      itemForm.reset({ chefId: selectedChef?.id || 0, title: "", description: "", imageUrl: "", allergenIds: [], ingredientIds: [], servingOptions: defaultServingOptions });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating item", description: error.message, variant: "destructive" });
    },
  });

  const updateMenuItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MenuItemForm> }) => {
      return apiRequest("PATCH", `/api/menu-items/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Food item updated", description: "Your food item has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", selectedChef?.id] });
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
      return apiRequest("DELETE", `/api/menu-items/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Food item deleted", description: "Your food item has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items/chef", selectedChef?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      setDeleteItemId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting item", description: error.message, variant: "destructive" });
    },
  });

  const assignItemToDaySlotMutation = useMutation({
    mutationFn: async ({ daySlotId, itemId }: { daySlotId: number; itemId: number }) => {
      return apiRequest("POST", `/api/day-slots/${daySlotId}/items/${itemId}`);
    },
    onSuccess: () => {
      toast({ title: "Item added", description: "Item has been added to the day." });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/menus/chef", selectedChef?.id] });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding item", description: error.message, variant: "destructive" });
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

  const createDaySlotMutation = useMutation({
    mutationFn: async (data: DaySlotForm) => {
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

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      return apiRequest("PATCH", `/api/orders/${orderId}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Order updated", description: "Order status has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/chef", selectedChef?.id] });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating order", description: error.message, variant: "destructive" });
    },
  });

  const onSubmitItem = (data: MenuItemForm) => {
    createMenuItemMutation.mutate(data);
  };

  const handleEditItem = (item: MenuItemWithDetails) => {
    setEditingItem(item);
    const mappedServingOptions: ServingOptionInput[] = item.servingOptions?.map(o => ({
      id: o.id,
      servingSize: o.servingSize,
      label: o.label,
      price: o.price,
      isDefault: o.isDefault === 1,
    })) || defaultServingOptions;
    itemForm.reset({
      chefId: selectedChef?.id || 0,
      title: item.title,
      description: item.description || "",
      imageUrl: item.coverPhoto || "",
      allergenIds: item.allergens?.map(a => a.id) || [],
      ingredientIds: item.ingredients?.map(i => i.id) || [],
      servingOptions: mappedServingOptions,
    });
    setEditItemDialogOpen(true);
  };

  // Get fresh day slot data from the query to ensure we have updated item assignments
  const getCurrentDaySlot = (daySlotId: number): DaySlot | undefined => {
    for (const chef of chefs || []) {
      const slot = chef.daySlots?.find((s: any) => s.id === daySlotId);
      if (slot) return slot as unknown as DaySlot;
    }
    return undefined;
  };

  const getDaySlotItemIds = (daySlot: DaySlot) => {
    // Get fresh data from the query
    const freshSlot = getCurrentDaySlot(daySlot.id);
    return freshSlot?.items?.map((item: MenuItemWithDetails) => item.id) || [];
  };

  const toggleItemAssignment = async (daySlotId: number, itemId: number, isAssigned: boolean) => {
    if (isAssigned) {
      await removeItemFromDaySlotMutation.mutateAsync({ daySlotId, itemId });
    } else {
      await assignItemToDaySlotMutation.mutateAsync({ daySlotId, itemId });
    }
  };

  const handleDeleteDaySlot = async (daySlotId: number) => {
    await deleteDaySlotMutation.mutateAsync(daySlotId);
  };

  if (chefsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <div className="grid md:grid-cols-3 gap-6">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ChefHat className="h-6 w-6 text-primary" />
              Chef Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your food items, menus, and orders
            </p>
          </div>

          {chefs && chefs.length > 1 && (
            <Select
              value={selectedChef?.id.toString()}
              onValueChange={(value) => setSelectedChefId(parseInt(value))}
            >
              <SelectTrigger className="w-[200px]" data-testid="select-chef">
                <SelectValue placeholder="Select chef" />
              </SelectTrigger>
              <SelectContent>
                {chefs.map((chef) => (
                  <SelectItem key={chef.id} value={chef.id.toString()}>
                    {chef.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                  <UtensilsCrossed className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{chefMenuItems?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Food Items</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
                  <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{selectedChef?.daySlots?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Scheduled Days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
                  <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingOrders.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-green-100 dark:bg-green-900/30">
                  <ClipboardList className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{prepList.length}</p>
                  <p className="text-sm text-muted-foreground">Items to Prepare</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="items" className="space-y-6">
          <TabsList>
            <TabsTrigger value="items" data-testid="tab-items">My Food Items</TabsTrigger>
            <TabsTrigger value="menus" data-testid="tab-schedule">My Schedule</TabsTrigger>
            <TabsTrigger value="prep" data-testid="tab-prep">Prep List</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-6">
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
                  
                  <Form {...itemForm}>
                    <form onSubmit={itemForm.handleSubmit(onSubmitItem)} className="space-y-6">
                      <FormField
                        control={itemForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Item Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Homemade Lasagna" {...field} data-testid="input-item-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Describe your dish..." className="resize-none" {...field} data-testid="input-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="servingOptions"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <ServingOptionsEditor
                                options={field.value || []}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="imageUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" />
                              Dish Photo
                            </FormLabel>
                            <FormDescription>Upload an appetizing photo of your dish</FormDescription>
                            <FormControl>
                              <div className="space-y-3">
                                {field.value ? (
                                  <div className="relative w-full h-40 rounded-md overflow-hidden bg-muted">
                                    <img src={field.value} alt="Dish preview" className="w-full h-full object-cover" />
                                    <Button type="button" variant="secondary" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => field.onChange("")} data-testid="button-remove-image">
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors">
                                    {uploadingImage ? (
                                      <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">Uploading...</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-2">
                                        <Upload className="h-8 w-8 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">Click to upload photo</span>
                                        <span className="text-xs text-muted-foreground">PNG, JPG up to 10MB</span>
                                      </div>
                                    )}
                                    <input
                                      id="image-upload"
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      disabled={uploadingImage}
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setUploadingImage(true);
                                        try {
                                          const urlRes = await fetch("/api/uploads/request-url", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
                                          });
                                          if (!urlRes.ok) throw new Error("Failed to get upload URL");
                                          const { uploadURL, objectPath } = await urlRes.json();
                                          const uploadRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
                                          if (!uploadRes.ok) throw new Error("Failed to upload image");
                                          field.onChange(objectPath);
                                          toast({ title: "Image uploaded", description: "Your dish photo has been uploaded successfully." });
                                        } catch (error) {
                                          toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to upload image", variant: "destructive" });
                                        } finally {
                                          setUploadingImage(false);
                                          e.target.value = "";
                                        }
                                      }}
                                      data-testid="input-image-upload"
                                    />
                                  </label>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {allergens && allergens.length > 0 && (
                        <FormField
                          control={itemForm.control}
                          name="allergenIds"
                          render={() => (
                            <FormItem>
                              <div className="mb-2">
                                <FormLabel className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  Allergens
                                </FormLabel>
                                <FormDescription>Select all allergens present in this dish</FormDescription>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {allergens.map((allergen) => (
                                  <FormField
                                    key={allergen.id}
                                    control={itemForm.control}
                                    name="allergenIds"
                                    render={({ field }) => (
                                      <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(allergen.id)}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                field.onChange([...field.value, allergen.id]);
                                              } else {
                                                field.onChange(field.value?.filter((id) => id !== allergen.id));
                                              }
                                            }}
                                            data-testid={`checkbox-allergen-${allergen.id}`}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal cursor-pointer">{allergen.name}</FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={itemForm.control}
                        name="ingredientIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ingredients</FormLabel>
                            <FormDescription>Search and add ingredients - you can also create new ones</FormDescription>
                            <FormControl>
                              <IngredientTypeahead
                                selectedIds={field.value || []}
                                onChange={field.onChange}
                                placeholder="Search or add ingredients..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setAddItemDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createMenuItemMutation.isPending} data-testid="button-save-item">
                          {createMenuItemMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : "Add Item"}
                        </Button>
                      </div>
                    </form>
                  </Form>
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
                        {(() => {
                          const opts = item.servingOptions || [];
                          if (opts.length === 0) return <span className="font-semibold text-lg text-muted-foreground">No pricing</span>;
                          const prices = opts.map(o => o.price);
                          const min = Math.min(...prices);
                          const max = Math.max(...prices);
                          return <span className="font-semibold text-lg">{min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} - $${max.toFixed(2)}`}</span>;
                        })()}
                        <span className="text-sm text-muted-foreground">{item.servingOptions?.length || 0} serving option(s)</span>
                      </div>
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
          </TabsContent>

          <TabsContent value="menus" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">My Schedule</h2>
              <p className="text-sm text-muted-foreground">Click on any day to add your food offerings</p>
            </div>

            {/* Calendar-based day selection */}
            <div className="space-y-3">
              {(() => {
                const today = new Date();
                const upcomingDays = eachDayOfInterval({
                  start: today,
                  end: new Date(today.getTime() + 13 * 24 * 60 * 60 * 1000) // 14 days
                });
                
                return upcomingDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const existingSlot = selectedChef?.daySlots?.find(
                    (slot: any) => format(new Date(slot.date), "yyyy-MM-dd") === dateKey
                  );
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
                          {!existingSlot ? (
                            <div className="py-4">
                              <p className="text-sm text-muted-foreground mb-3">Set up offerings for this day:</p>
                              <div className="flex items-center gap-3 mb-4">
                                <label className="text-sm whitespace-nowrap">Order cutoff:</label>
                                <Input
                                  type="date"
                                  defaultValue={format(new Date(day.getTime() - 86400000), "yyyy-MM-dd")}
                                  className="w-auto"
                                  id={`cutoff-new-${dateKey}`}
                                  data-testid={`input-new-cutoff-${dateKey}`}
                                />
                                <Button 
                                  size="sm"
                                  onClick={async () => {
                                    const cutoffInput = document.getElementById(`cutoff-new-${dateKey}`) as HTMLInputElement;
                                    const cutoffDate = cutoffInput?.value || format(new Date(day.getTime() - 86400000), "yyyy-MM-dd");
                                    await createDaySlotMutation.mutateAsync({
                                      chefId: selectedChef!.id,
                                      date: dateKey,
                                      orderCutoffDate: cutoffDate,
                                    });
                                  }}
                                  disabled={createDaySlotMutation.isPending}
                                  data-testid={`button-enable-day-${dateKey}`}
                                >
                                  {createDaySlotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable Day"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="py-4 space-y-4">
                              {/* Order cutoff editor */}
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
                              
                              {/* Item checkboxes */}
                              <div>
                                <p className="text-sm font-medium mb-2">Select items to offer:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {chefMenuItems && chefMenuItems.length > 0 ? (
                                    chefMenuItems.map((item) => {
                                      const isAssigned = existingSlot.items?.some((i: MenuItemWithDetails) => i.id === item.id) || false;
                                      return (
                                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border">
                                          <Checkbox
                                            checked={isAssigned}
                                            onCheckedChange={async () => {
                                              await toggleItemAssignment(existingSlot.id, item.id, isAssigned);
                                            }}
                                            disabled={assignItemToDaySlotMutation.isPending || removeItemFromDaySlotMutation.isPending}
                                            data-testid={`checkbox-item-${dateKey}-${item.id}`}
                                          />
                                          <div className="min-w-0 flex-1">
                                            <p className="font-medium truncate">{item.title}</p>
                                            <p className="text-sm text-muted-foreground">
                                              {(() => {
                                                const opts = item.servingOptions || [];
                                                if (opts.length === 0) return "No price set";
                                                const defaultOpt = opts.find(o => o.isDefault === 1) || opts[0];
                                                return `$${defaultOpt.price.toFixed(2)}`;
                                              })()}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="col-span-2 text-sm text-muted-foreground py-4">
                                      No food items yet. Create some items in the "Food Items" tab first.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                });
              })()}
            </div>
          </TabsContent>

          <TabsContent value="prep" className="space-y-6">
            <h2 className="text-xl font-semibold">Prep List</h2>
            
            {prepList.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-medium mb-2">No Items to Prepare</h3>
                  <p className="text-muted-foreground text-sm">When you have pending orders, you'll see a summary of items to prepare here.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Items to Prepare</CardTitle>
                  <CardDescription>Aggregated from {pendingOrders.length} pending order{pendingOrders.length !== 1 ? "s" : ""}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {prepList.map((item) => (
                      <div key={item.menuItemId} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{item.itemTitle}</h4>
                          <p className="text-sm text-muted-foreground">From {item.orderCount} order{item.orderCount !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">{item.totalQuantity}</p>
                          <p className="text-sm text-muted-foreground">to make</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <h2 className="text-xl font-semibold">Recent Orders</h2>
            
            {ordersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (<Card key={i}><CardContent className="py-4"><Skeleton className="h-20" /></CardContent></Card>))}
              </div>
            ) : !orders || orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-medium mb-2">No Orders Yet</h3>
                  <p className="text-muted-foreground text-sm">Orders will appear here when customers place them.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-base">Order #{order.id}</CardTitle>
                          <CardDescription>{order.buyerName} &bull; {order.fulfillmentMethod === "delivery" ? "Delivery" : "Pickup"}</CardDescription>
                        </div>
                        <Badge variant={order.status === "completed" ? "default" : order.status === "pending" ? "secondary" : "outline"}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        {order.items?.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.itemTitle}</span>
                            <span className="text-muted-foreground">${(Number(item.priceAtOrder) * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span>${Number(order.totalAmount).toFixed(2)}</span>
                      </div>
                      {order.deliveryAddress && (<p className="text-sm text-muted-foreground">Deliver to: {order.deliveryAddress}</p>)}
                      {order.notes && (<p className="text-sm text-muted-foreground">Note: {order.notes}</p>)}
                    </CardContent>
                    <CardFooter className="gap-2">
                      {order.status === "pending" && (
                        <Button size="sm" onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: "confirmed" })} disabled={updateOrderStatusMutation.isPending} data-testid={`button-confirm-${order.id}`}>
                          <Check className="h-4 w-4 mr-1" />Confirm
                        </Button>
                      )}
                      {order.status === "confirmed" && (
                        <Button size="sm" onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: "completed" })} disabled={updateOrderStatusMutation.isPending} data-testid={`button-complete-${order.id}`}>
                          <Check className="h-4 w-4 mr-1" />Mark Complete
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Food Item</DialogTitle>
          </DialogHeader>
          
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit((data) => editingItem && updateMenuItemMutation.mutate({ id: editingItem.id, data }))} className="space-y-6">
              <FormField control={itemForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Title</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-item-title" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={itemForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea className="resize-none" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField
                control={itemForm.control}
                name="servingOptions"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ServingOptionsEditor
                        options={field.value || []}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={itemForm.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Dish Photo
                    </FormLabel>
                    <FormDescription>Upload an appetizing photo of your dish</FormDescription>
                    <FormControl>
                      <div className="space-y-3">
                        {field.value ? (
                          <div className="relative w-full h-40 rounded-md overflow-hidden bg-muted">
                            <img src={field.value} alt="Dish preview" className="w-full h-full object-cover" />
                            <Button type="button" variant="secondary" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => field.onChange("")} data-testid="button-edit-remove-image">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <label htmlFor="edit-image-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors">
                            {uploadingImage ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Uploading...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <Upload className="h-8 w-8 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Click to upload photo</span>
                                <span className="text-xs text-muted-foreground">PNG, JPG up to 10MB</span>
                              </div>
                            )}
                            <input
                              id="edit-image-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingImage}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingImage(true);
                                try {
                                  const urlRes = await fetch("/api/uploads/request-url", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
                                  });
                                  if (!urlRes.ok) throw new Error("Failed to get upload URL");
                                  const { uploadURL, objectPath } = await urlRes.json();
                                  const uploadRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
                                  if (!uploadRes.ok) throw new Error("Failed to upload image");
                                  field.onChange(objectPath);
                                  toast({ title: "Image uploaded", description: "Your dish photo has been uploaded successfully." });
                                } catch (error) {
                                  toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to upload image", variant: "destructive" });
                                } finally {
                                  setUploadingImage(false);
                                  e.target.value = "";
                                }
                              }}
                              data-testid="input-edit-image-upload"
                            />
                          </label>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {allergens && allergens.length > 0 && (
                <FormField
                  control={itemForm.control}
                  name="allergenIds"
                  render={() => (
                    <FormItem>
                      <div className="mb-2">
                        <FormLabel className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Allergens
                        </FormLabel>
                        <FormDescription>Select all allergens present in this dish</FormDescription>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {allergens.map((allergen) => (
                          <FormField
                            key={allergen.id}
                            control={itemForm.control}
                            name="allergenIds"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(allergen.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        field.onChange([...field.value, allergen.id]);
                                      } else {
                                        field.onChange(field.value?.filter((id) => id !== allergen.id));
                                      }
                                    }}
                                    data-testid={`checkbox-edit-allergen-${allergen.id}`}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">{allergen.name}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={itemForm.control}
                name="ingredientIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ingredients</FormLabel>
                    <FormDescription>Search and add ingredients - you can also create new ones</FormDescription>
                    <FormControl>
                      <IngredientTypeahead
                        selectedIds={field.value || []}
                        onChange={field.onChange}
                        placeholder="Search or add ingredients..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditItemDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateMenuItemMutation.isPending} data-testid="button-update-item">
                  {updateMenuItemMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteItemId !== null} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Food Item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the food item and remove it from all menus.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItemId && deleteMenuItemMutation.mutate(deleteItemId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
