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
} from "lucide-react";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChefProfileWithMenus, Allergen, Ingredient, OrderWithItems, Menu, MenuItem } from "@shared/schema";

const menuItemSchema = z.object({
  chefId: z.number(),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  price: z.number().min(0.01, "Price must be greater than 0"),
  stockQuantity: z.number().min(1, "Stock must be at least 1"),
  unitType: z.string().min(1, "Unit type is required"),
  imageUrl: z.string().optional(),
  allergenIds: z.array(z.number()).default([]),
  ingredientIds: z.array(z.number()).default([]),
});

type MenuItemForm = z.infer<typeof menuItemSchema>;

const menuSchema = z.object({
  chefId: z.number(),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
});

type MenuForm = z.infer<typeof menuSchema>;

const daySlotSchema = z.object({
  menuId: z.number(),
  date: z.string(),
  orderCutoffDate: z.string(),
});

type DaySlotForm = z.infer<typeof daySlotSchema>;

interface DaySlot {
  id: number;
  menuId: number;
  date: string;
  orderCutoffDate: string;
  items: MenuItemWithDetails[];
}

interface MenuWithDaySlots extends Menu {
  daySlots: DaySlot[];
}

interface MenuItemWithDetails extends MenuItem {
  allergens?: Allergen[];
  ingredients?: Ingredient[];
}

export default function Dashboard() {
  const [selectedChefId, setSelectedChefId] = useState<number | null>(null);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemWithDetails | null>(null);
  const [addMenuDialogOpen, setAddMenuDialogOpen] = useState(false);
  const [editMenuDialogOpen, setEditMenuDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<number | null>(null);
  const [assignItemsDialogOpen, setAssignItemsDialogOpen] = useState(false);
  const [assigningToMenu, setAssigningToMenu] = useState<any>(null);
  const [manageDaySlotsOpen, setManageDaySlotsOpen] = useState(false);
  const [managingMenu, setManagingMenu] = useState<any>(null);
  const [selectedDaySlot, setSelectedDaySlot] = useState<DaySlot | null>(null);
  const [addDaySlotDate, setAddDaySlotDate] = useState("");
  const [addDaySlotCutoff, setAddDaySlotCutoff] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: chefs, isLoading: chefsLoading } = useQuery<ChefProfileWithMenus[]>({
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

  const { data: chefMenus, isLoading: menusLoading } = useQuery<Menu[]>({
    queryKey: ["/api/menus/chef", selectedChef?.id],
    enabled: !!selectedChef?.id,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders/chef", selectedChef?.id],
    enabled: !!selectedChef?.id,
  });

  const activeMenus = chefMenus?.filter((m) => m.status === "active") || [];
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

  const itemForm = useForm<MenuItemForm>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      chefId: selectedChef?.id || 0,
      title: "",
      description: "",
      price: 0,
      stockQuantity: 10,
      unitType: "per meal",
      imageUrl: "",
      allergenIds: [],
      ingredientIds: [],
    },
  });

  const menuForm = useForm<MenuForm>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      chefId: selectedChef?.id || 0,
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "draft",
    },
  });

  useEffect(() => {
    if (selectedChef?.id) {
      itemForm.setValue("chefId", selectedChef.id);
      menuForm.setValue("chefId", selectedChef.id);
    }
  }, [selectedChef?.id, itemForm, menuForm]);

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
      itemForm.reset({ chefId: selectedChef?.id || 0, title: "", description: "", price: 0, stockQuantity: 10, unitType: "per meal", imageUrl: "", allergenIds: [], ingredientIds: [] });
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

  const createMenuMutation = useMutation({
    mutationFn: async (data: MenuForm) => {
      return apiRequest("POST", "/api/menus", data);
    },
    onSuccess: () => {
      toast({ title: "Menu created", description: "Your new menu has been added." });
      queryClient.invalidateQueries({ queryKey: ["/api/menus/chef", selectedChef?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      setAddMenuDialogOpen(false);
      menuForm.reset({ chefId: selectedChef?.id || 0, title: "", description: "", startDate: "", endDate: "", status: "draft" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating menu", description: error.message, variant: "destructive" });
    },
  });

  const updateMenuMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MenuForm> }) => {
      return apiRequest("PATCH", `/api/menus/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Menu updated", description: "Your menu has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/menus/chef", selectedChef?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      setEditMenuDialogOpen(false);
      setEditingMenu(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error updating menu", description: error.message, variant: "destructive" });
    },
  });

  const deleteMenuMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/menus/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Menu deleted", description: "Your menu has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/menus/chef", selectedChef?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      setDeleteMenuId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting menu", description: error.message, variant: "destructive" });
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
      toast({ title: "Day added", description: "New day slot has been added to the menu." });
      queryClient.invalidateQueries({ queryKey: ["/api/menus/chef", selectedChef?.id] });
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
      toast({ title: "Day removed", description: "Day slot has been removed from the menu." });
      queryClient.invalidateQueries({ queryKey: ["/api/menus/chef", selectedChef?.id] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/menus/chef", selectedChef?.id] });
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

  const onSubmitMenu = (data: MenuForm) => {
    createMenuMutation.mutate(data);
  };

  const handleEditItem = (item: MenuItemWithDetails) => {
    setEditingItem(item);
    itemForm.reset({
      chefId: selectedChef?.id || 0,
      title: item.title,
      description: item.description || "",
      price: Number(item.price),
      stockQuantity: item.stockQuantity,
      unitType: item.unitType,
      imageUrl: item.imageUrl || "",
      allergenIds: item.allergens?.map(a => a.id) || [],
      ingredientIds: item.ingredients?.map(i => i.id) || [],
    });
    setEditItemDialogOpen(true);
  };

  const handleEditMenu = (menu: any) => {
    setEditingMenu(menu);
    menuForm.reset({
      chefId: selectedChef?.id || 0,
      title: menu.title,
      description: menu.description || "",
      startDate: menu.startDate ? format(new Date(menu.startDate), "yyyy-MM-dd") : "",
      endDate: menu.endDate ? format(new Date(menu.endDate), "yyyy-MM-dd") : "",
      status: menu.status as "draft" | "active" | "archived",
    });
    setEditMenuDialogOpen(true);
  };

  const handleOpenAssignItems = (menu: any) => {
    setAssigningToMenu(menu);
    setAssignItemsDialogOpen(true);
  };

  // Get all item IDs assigned to any day slot in this menu
  const getMenuItemIds = (menu: any) => {
    const allItemIds = new Set<number>();
    menu?.daySlots?.forEach((slot: DaySlot) => {
      slot.items?.forEach((item: MenuItemWithDetails) => {
        allItemIds.add(item.id);
      });
    });
    return Array.from(allItemIds);
  };

  // Get fresh menu data from the query to ensure we have updated day slots
  const getCurrentMenu = (menuId: number): any | undefined => {
    for (const chef of chefs || []) {
      const menu = chef.menus?.find((m: any) => m.id === menuId);
      if (menu) return menu;
    }
    return undefined;
  };

  // Get fresh day slot data from the query to ensure we have updated item assignments
  const getCurrentDaySlot = (daySlotId: number): DaySlot | undefined => {
    for (const chef of chefs || []) {
      for (const menu of chef.menus || []) {
        const slot = (menu as any).daySlots?.find((s: DaySlot) => s.id === daySlotId);
        if (slot) return slot;
      }
    }
    return undefined;
  };

  const getDaySlotItemIds = (daySlot: DaySlot) => {
    // Get fresh data from the query
    const freshSlot = getCurrentDaySlot(daySlot.id);
    return freshSlot?.items?.map((item: MenuItemWithDetails) => item.id) || [];
  };

  // Get the current menu with fresh data
  const currentManagingMenu = managingMenu ? getCurrentMenu(managingMenu.id) : null;

  const toggleItemAssignment = async (daySlotId: number, itemId: number, isAssigned: boolean) => {
    if (isAssigned) {
      await removeItemFromDaySlotMutation.mutateAsync({ daySlotId, itemId });
    } else {
      await assignItemToDaySlotMutation.mutateAsync({ daySlotId, itemId });
    }
  };

  const handleManageDaySlots = (menu: any) => {
    setManagingMenu(menu);
    setSelectedDaySlot(null);
    setAddDaySlotDate("");
    setAddDaySlotCutoff("");
    setManageDaySlotsOpen(true);
  };

  const handleAddDaySlot = async () => {
    if (!managingMenu || !addDaySlotDate || !addDaySlotCutoff) return;
    
    await createDaySlotMutation.mutateAsync({
      menuId: managingMenu.id,
      date: addDaySlotDate,
      orderCutoffDate: addDaySlotCutoff,
    });
    
    setAddDaySlotDate("");
    setAddDaySlotCutoff("");
  };

  const handleDeleteDaySlot = async (daySlotId: number) => {
    await deleteDaySlotMutation.mutateAsync(daySlotId);
  };

  const handleSelectDaySlotForAssignment = (daySlot: DaySlot) => {
    setSelectedDaySlot(daySlot);
    setManageDaySlotsOpen(false);
    setAssignItemsDialogOpen(true);
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
                  <p className="text-2xl font-bold">{activeMenus.length}</p>
                  <p className="text-sm text-muted-foreground">Active Menus</p>
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
            <TabsTrigger value="menus" data-testid="tab-menus">My Menus</TabsTrigger>
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
                      <div className="grid sm:grid-cols-2 gap-4">
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

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={itemForm.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price ($)</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} data-testid="input-price" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={itemForm.control}
                            name="stockQuantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Stock</FormLabel>
                                <FormControl>
                                  <Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} data-testid="input-stock" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

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
                        name="unitType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger data-testid="select-unit">
                                  <SelectValue placeholder="Select unit type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="per meal">Per Meal</SelectItem>
                                <SelectItem value="per tray">Per Tray</SelectItem>
                                <SelectItem value="per dozen">Per Dozen</SelectItem>
                                <SelectItem value="per piece">Per Piece</SelectItem>
                                <SelectItem value="per pound">Per Pound</SelectItem>
                              </SelectContent>
                            </Select>
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

                      {ingredients && ingredients.length > 0 && (
                        <FormField
                          control={itemForm.control}
                          name="ingredientIds"
                          render={() => (
                            <FormItem>
                              <div className="mb-2">
                                <FormLabel>Ingredients</FormLabel>
                                <FormDescription>Select all main ingredients</FormDescription>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-1">
                                {ingredients.map((ingredient) => (
                                  <FormField
                                    key={ingredient.id}
                                    control={itemForm.control}
                                    name="ingredientIds"
                                    render={({ field }) => (
                                      <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(ingredient.id)}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                field.onChange([...field.value, ingredient.id]);
                                              } else {
                                                field.onChange(field.value?.filter((id) => id !== ingredient.id));
                                              }
                                            }}
                                            data-testid={`checkbox-ingredient-${ingredient.id}`}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal cursor-pointer">{ingredient.name}</FormLabel>
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
                      {item.imageUrl && (
                        <div className="aspect-video rounded-md overflow-hidden bg-muted">
                          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-lg">${Number(item.price).toFixed(2)}</span>
                        <span className="text-sm text-muted-foreground">{item.stockQuantity} {item.unitType}</span>
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
              <h2 className="text-xl font-semibold">My Menus</h2>
              
              <Dialog open={addMenuDialogOpen} onOpenChange={setAddMenuDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-menu">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Menu
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Menu</DialogTitle>
                    <DialogDescription>Create a menu with date ranges for ordering and fulfillment.</DialogDescription>
                  </DialogHeader>
                  
                  <Form {...menuForm}>
                    <form onSubmit={menuForm.handleSubmit(onSubmitMenu)} className="space-y-4">
                      <FormField
                        control={menuForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Menu Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Week of Feb 10th" {...field} data-testid="input-menu-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={menuForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Describe this menu..." className="resize-none" {...field} data-testid="input-menu-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid sm:grid-cols-2 gap-4">
                        <FormField
                          control={menuForm.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-start-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={menuForm.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-end-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={menuForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger data-testid="select-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setAddMenuDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createMenuMutation.isPending} data-testid="button-save-menu">
                          {createMenuMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>) : "Create Menu"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {menusLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (<Card key={i}><CardContent className="py-4"><Skeleton className="h-24" /></CardContent></Card>))}
              </div>
            ) : !chefMenus || chefMenus.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-medium mb-2">No Menus Yet</h3>
                  <p className="text-muted-foreground text-sm mb-4">Create your first menu to start selling.</p>
                  <Button onClick={() => setAddMenuDialogOpen(true)} data-testid="button-add-first-menu">
                    <Plus className="h-4 w-4 mr-2" />Create Your First Menu
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {chefMenus.map((menu) => {
                  const menuItemIds = getMenuItemIds(menu);
                  const itemCount = menuItemIds.length;
                  
                  return (
                    <Card key={menu.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-lg">{menu.title}</CardTitle>
                              <Badge variant={menu.status === "active" ? "default" : menu.status === "draft" ? "secondary" : "outline"}>
                                {menu.status.charAt(0).toUpperCase() + menu.status.slice(1)}
                              </Badge>
                            </div>
                            {menu.description && (
                              <CardDescription className="mt-1">{menu.description}</CardDescription>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleManageDaySlots(menu)} data-testid={`button-manage-days-${menu.id}`} title="Manage Days">
                              <CalendarDays className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditMenu(menu)} data-testid={`button-edit-menu-${menu.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteMenuId(menu.id)} data-testid={`button-delete-menu-${menu.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                          {menu.startDate && menu.endDate && (
                            <span>{format(new Date(menu.startDate), "MMM d")} - {format(new Date(menu.endDate), "MMM d, yyyy")}</span>
                          )}
                          <span>{menu.daySlots?.length || 0} day{(menu.daySlots?.length || 0) !== 1 ? "s" : ""}</span>
                          <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
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
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField control={itemForm.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Title</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-item-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={itemForm.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price ($)</FormLabel>
                      <FormControl><Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={itemForm.control} name="stockQuantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl><Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
              <FormField control={itemForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea className="resize-none" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={itemForm.control} name="unitType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="per meal">Per Meal</SelectItem>
                      <SelectItem value="per tray">Per Tray</SelectItem>
                      <SelectItem value="per dozen">Per Dozen</SelectItem>
                      <SelectItem value="per piece">Per Piece</SelectItem>
                      <SelectItem value="per pound">Per Pound</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

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

              {ingredients && ingredients.length > 0 && (
                <FormField
                  control={itemForm.control}
                  name="ingredientIds"
                  render={() => (
                    <FormItem>
                      <div className="mb-2">
                        <FormLabel>Ingredients</FormLabel>
                        <FormDescription>Select all main ingredients</FormDescription>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-1">
                        {ingredients.map((ingredient) => (
                          <FormField
                            key={ingredient.id}
                            control={itemForm.control}
                            name="ingredientIds"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(ingredient.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        field.onChange([...field.value, ingredient.id]);
                                      } else {
                                        field.onChange(field.value?.filter((id) => id !== ingredient.id));
                                      }
                                    }}
                                    data-testid={`checkbox-edit-ingredient-${ingredient.id}`}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">{ingredient.name}</FormLabel>
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

      <Dialog open={editMenuDialogOpen} onOpenChange={setEditMenuDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Menu</DialogTitle>
          </DialogHeader>
          
          <Form {...menuForm}>
            <form onSubmit={menuForm.handleSubmit((data) => editingMenu && updateMenuMutation.mutate({ id: editingMenu.id, data }))} className="space-y-4">
              <FormField control={menuForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Menu Title</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-menu-title" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={menuForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea className="resize-none" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField control={menuForm.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-edit-start-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={menuForm.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-edit-end-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={menuForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditMenuDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateMenuMutation.isPending} data-testid="button-update-menu">
                  {updateMenuMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Unified Manage Menu Dialog */}
      <Dialog open={manageDaySlotsOpen} onOpenChange={(open) => { setManageDaySlotsOpen(open); if (!open) setExpandedDays(new Set()); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Menu: {managingMenu?.title}</DialogTitle>
            <DialogDescription>
              Configure which days you'll offer food and assign items to each day.
              {currentManagingMenu?.startDate && currentManagingMenu?.endDate && (
                <span className="block mt-1">
                  Date range: {format(new Date(currentManagingMenu.startDate), "MMM d")} - {format(new Date(currentManagingMenu.endDate), "MMM d, yyyy")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {/* All days in the date range */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {currentManagingMenu?.startDate && currentManagingMenu?.endDate ? (
              (() => {
                const allDays = eachDayOfInterval({
                  start: new Date(currentManagingMenu.startDate),
                  end: new Date(currentManagingMenu.endDate)
                });
                
                return allDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const existingSlot = currentManagingMenu.daySlots?.find(
                    (slot: DaySlot) => format(new Date(slot.date), "yyyy-MM-dd") === dateKey
                  );
                  const isEnabled = !!existingSlot;
                  const isExpanded = expandedDays.has(dateKey);
                  
                  return (
                    <div key={dateKey} className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isEnabled}
                            onCheckedChange={async (checked) => {
                              if (checked && !existingSlot) {
                                const cutoffDate = format(new Date(day.getTime() - 86400000), "yyyy-MM-dd");
                                await createDaySlotMutation.mutateAsync({
                                  menuId: currentManagingMenu.id,
                                  date: dateKey,
                                  orderCutoffDate: cutoffDate,
                                });
                              } else if (!checked && existingSlot) {
                                await deleteDaySlotMutation.mutateAsync(existingSlot.id);
                                setExpandedDays(prev => { const next = new Set(prev); next.delete(dateKey); return next; });
                              }
                            }}
                            disabled={createDaySlotMutation.isPending || deleteDaySlotMutation.isPending}
                            data-testid={`checkbox-day-${dateKey}`}
                          />
                          <div>
                            <p className="font-medium">{format(day, "EEEE, MMMM d")}</p>
                            {existingSlot && (
                              <p className="text-xs text-muted-foreground">
                                Order by {format(new Date(existingSlot.orderCutoffDate), "MMM d")} • {existingSlot.items?.length || 0} items
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {isEnabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedDays(prev => {
                              const next = new Set(prev);
                              if (next.has(dateKey)) next.delete(dateKey);
                              else next.add(dateKey);
                              return next;
                            })}
                            data-testid={`button-expand-day-${dateKey}`}
                          >
                            {isExpanded ? "Hide Items" : "Add Items"}
                          </Button>
                        )}
                      </div>
                      
                      {/* Expanded item assignment section */}
                      {isEnabled && isExpanded && (
                        <div className="p-3 border-t space-y-3">
                          {/* Order cutoff date editor */}
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground whitespace-nowrap">Order cutoff:</label>
                            <Input
                              type="date"
                              value={format(new Date(existingSlot!.orderCutoffDate), "yyyy-MM-dd")}
                              className="w-auto"
                              onChange={async (e) => {
                                if (e.target.value && existingSlot) {
                                  await updateDaySlotMutation.mutateAsync({
                                    id: existingSlot.id,
                                    orderCutoffDate: e.target.value,
                                  });
                                }
                              }}
                              data-testid={`input-cutoff-${dateKey}`}
                            />
                          </div>
                          
                          {/* Item checkboxes */}
                          <div className="grid grid-cols-2 gap-2">
                            {chefMenuItems && chefMenuItems.length > 0 ? (
                              chefMenuItems.map((item) => {
                                const freshSlot = getCurrentDaySlot(existingSlot!.id);
                                const isAssigned = freshSlot?.items?.some((i: MenuItemWithDetails) => i.id === item.id) || false;
                                return (
                                  <div key={item.id} className="flex items-center gap-2 p-2 rounded border">
                                    <Checkbox
                                      checked={isAssigned}
                                      onCheckedChange={async (checked) => {
                                        await toggleItemAssignment(existingSlot!.id, item.id, isAssigned);
                                      }}
                                      disabled={assignItemToDaySlotMutation.isPending || removeItemFromDaySlotMutation.isPending}
                                      data-testid={`checkbox-item-${dateKey}-${item.id}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">{item.title}</p>
                                      <p className="text-xs text-muted-foreground">${Number(item.price).toFixed(2)}</p>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="col-span-2 text-center text-sm text-muted-foreground py-2">No food items available. Create items first.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            ) : (
              <p className="text-center text-muted-foreground py-8">Menu has no date range set.</p>
            )}
          </div>
          
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => { setManageDaySlotsOpen(false); setExpandedDays(new Set()); }}>Done</Button>
          </div>
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

      <AlertDialog open={deleteMenuId !== null} onOpenChange={() => setDeleteMenuId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the menu. Food items will not be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMenuId && deleteMenuMutation.mutate(deleteMenuId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
