import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
} from "@/components/ui/dialog";
import {
  ChefHat,
  Plus,
  Package,
  ClipboardList,
  UtensilsCrossed,
  AlertTriangle,
  Loader2,
  Check,
} from "lucide-react";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChefProfileWithMenus, Allergen, Ingredient, OrderWithItems, Menu } from "@shared/schema";

const menuItemSchema = z.object({
  menuId: z.number(),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  price: z.number().min(0.01, "Price must be greater than 0"),
  stockQuantity: z.number().min(1, "Stock must be at least 1"),
  unitType: z.string().min(1, "Unit type is required"),
  allergenIds: z.array(z.number()).default([]),
  ingredientIds: z.array(z.number()).default([]),
});

type MenuItemForm = z.infer<typeof menuItemSchema>;

export default function Dashboard() {
  const [selectedChefId, setSelectedChefId] = useState<number | null>(null);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
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

  const { data: orders, isLoading: ordersLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders/chef", selectedChef?.id],
    enabled: !!selectedChef?.id,
  });

  const activeMenus = selectedChef?.menus?.filter((m) => m.status === "active") || [];
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

  const form = useForm<MenuItemForm>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      menuId: activeMenus[0]?.id || 0,
      title: "",
      description: "",
      price: 0,
      stockQuantity: 10,
      unitType: "per meal",
      allergenIds: [],
      ingredientIds: [],
    },
  });

  const createMenuItemMutation = useMutation({
    mutationFn: async (data: MenuItemForm) => {
      return apiRequest("POST", "/api/menu-items", data);
    },
    onSuccess: () => {
      toast({
        title: "Menu item created",
        description: "Your new menu item has been added.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chefs"] });
      setAddItemDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      return apiRequest("PATCH", `/api/orders/${orderId}`, { status });
    },
    onSuccess: () => {
      toast({
        title: "Order updated",
        description: "Order status has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/chef", selectedChef?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MenuItemForm) => {
    createMenuItemMutation.mutate(data);
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
              Manage your menus, orders, and prep list
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

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                  <UtensilsCrossed className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {activeMenus.reduce((sum, m) => sum + (m.items?.length || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Menu Items</p>
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

        <Tabs defaultValue="menus" className="space-y-6">
          <TabsList>
            <TabsTrigger value="menus" data-testid="tab-menus">Menu Items</TabsTrigger>
            <TabsTrigger value="prep" data-testid="tab-prep">Prep List</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="menus" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Active Menus</h2>
              
              <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={activeMenus.length === 0} data-testid="button-add-item">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Menu Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Menu Item</DialogTitle>
                  </DialogHeader>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="menuId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Menu</FormLabel>
                            <Select
                              value={field.value.toString()}
                              onValueChange={(value) => field.onChange(parseInt(value))}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-menu">
                                  <SelectValue placeholder="Select a menu" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {activeMenus.map((menu) => (
                                  <SelectItem key={menu.id} value={menu.id.toString()}>
                                    {menu.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item Title</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Homemade Lasagna"
                                  {...field}
                                  data-testid="input-item-title"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price ($)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                    data-testid="input-price"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="stockQuantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Stock</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    data-testid="input-stock"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe your dish..."
                                className="resize-none"
                                {...field}
                                data-testid="input-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
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

                      {allergens && allergens.length > 0 && (
                        <FormField
                          control={form.control}
                          name="allergenIds"
                          render={() => (
                            <FormItem>
                              <div className="mb-2">
                                <FormLabel className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  Allergens
                                </FormLabel>
                                <FormDescription>
                                  Select all allergens present in this dish
                                </FormDescription>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {allergens.map((allergen) => (
                                  <FormField
                                    key={allergen.id}
                                    control={form.control}
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
                                                field.onChange(
                                                  field.value?.filter((id) => id !== allergen.id)
                                                );
                                              }
                                            }}
                                            data-testid={`checkbox-allergen-${allergen.id}`}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal cursor-pointer">
                                          {allergen.name}
                                        </FormLabel>
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
                          control={form.control}
                          name="ingredientIds"
                          render={() => (
                            <FormItem>
                              <div className="mb-2">
                                <FormLabel>Ingredients</FormLabel>
                                <FormDescription>
                                  Select all main ingredients
                                </FormDescription>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-1">
                                {ingredients.map((ingredient) => (
                                  <FormField
                                    key={ingredient.id}
                                    control={form.control}
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
                                                field.onChange(
                                                  field.value?.filter((id) => id !== ingredient.id)
                                                );
                                              }
                                            }}
                                            data-testid={`checkbox-ingredient-${ingredient.id}`}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal cursor-pointer">
                                          {ingredient.name}
                                        </FormLabel>
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
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAddItemDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createMenuItemMutation.isPending}
                          data-testid="button-save-item"
                        >
                          {createMenuItemMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Add Item"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {activeMenus.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-medium mb-2">No Active Menus</h3>
                  <p className="text-muted-foreground text-sm">
                    This chef doesn't have any active menus yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {activeMenus.map((menu) => (
                  <Card key={menu.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{menu.title}</CardTitle>
                      {menu.description && (
                        <CardDescription>{menu.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {menu.items && menu.items.length > 0 ? (
                        <div className="divide-y">
                          {menu.items.map((item) => (
                            <div
                              key={item.id}
                              className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium truncate">{item.title}</h4>
                                  {item.allergens && item.allergens.length > 0 && (
                                    <div className="flex gap-1">
                                      {item.allergens.map((a) => (
                                        <Badge
                                          key={a.id}
                                          variant="outline"
                                          className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                                        >
                                          {a.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {item.description}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-medium">${item.price.toFixed(2)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {item.stockQuantity} in stock
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No items in this menu yet.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
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
                  <p className="text-muted-foreground text-sm">
                    When you have pending orders, you'll see a summary of items to prepare here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Items to Prepare</CardTitle>
                  <CardDescription>
                    Aggregated from {pendingOrders.length} pending order{pendingOrders.length !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {prepList.map((item) => (
                      <div
                        key={item.menuItemId}
                        className="py-4 first:pt-0 last:pb-0 flex items-center justify-between"
                      >
                        <div>
                          <h4 className="font-medium">{item.itemTitle}</h4>
                          <p className="text-sm text-muted-foreground">
                            From {item.orderCount} order{item.orderCount !== 1 ? "s" : ""}
                          </p>
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
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="py-4">
                      <Skeleton className="h-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !orders || orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-medium mb-2">No Orders Yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Orders will appear here when customers place them.
                  </p>
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
                          <CardDescription>
                            {order.buyerName} &bull; {order.fulfillmentMethod === "delivery" ? "Delivery" : "Pickup"}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={
                            order.status === "completed"
                              ? "default"
                              : order.status === "pending"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        {order.items?.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.itemTitle}</span>
                            <span className="text-muted-foreground">
                              ${(item.priceAtOrder * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span>${order.totalAmount.toFixed(2)}</span>
                      </div>

                      {order.deliveryAddress && (
                        <p className="text-sm text-muted-foreground">
                          Deliver to: {order.deliveryAddress}
                        </p>
                      )}

                      {order.notes && (
                        <p className="text-sm text-muted-foreground">
                          Note: {order.notes}
                        </p>
                      )}
                    </CardContent>
                    <CardFooter className="gap-2">
                      {order.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            updateOrderStatusMutation.mutate({
                              orderId: order.id,
                              status: "confirmed",
                            })
                          }
                          disabled={updateOrderStatusMutation.isPending}
                          data-testid={`button-confirm-${order.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Confirm
                        </Button>
                      )}
                      {order.status === "confirmed" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            updateOrderStatusMutation.mutate({
                              orderId: order.id,
                              status: "completed",
                            })
                          }
                          disabled={updateOrderStatusMutation.isPending}
                          data-testid={`button-complete-${order.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Mark Complete
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
    </div>
  );
}
