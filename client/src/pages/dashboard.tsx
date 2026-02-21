import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChefHat } from "lucide-react";
import { Header } from "@/components/header";
import DashboardStats from "@/components/dashboard/DashboardStats";
import MenuItemsTab from "@/components/dashboard/MenuItemsTab";
import ScheduleTab from "@/components/dashboard/ScheduleTab";
import PrepListTab from "@/components/dashboard/PrepListTab";
import OrdersTab from "@/components/dashboard/OrdersTab";
import type {
  ChefProfileWithDaySlots,
  Allergen,
  MenuItemWithDetails,
  OrderWithItems,
  PrepListItem,
} from "@/components/dashboard/types";

export default function Dashboard() {
  const [selectedChefId, setSelectedChefId] = useState<number | null>(null);

  const { data: chefs, isLoading: chefsLoading } = useQuery<ChefProfileWithDaySlots[]>({
    queryKey: ["/api/chefs"],
  });

  const { data: allergens } = useQuery<Allergen[]>({
    queryKey: ["/api/allergens"],
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

  const pendingOrders = useMemo(
    () => orders?.filter((o) => o.status === "pending" || o.status === "confirmed") || [],
    [orders]
  );

  const prepList = useMemo(() => {
    return pendingOrders.reduce((acc, order) => {
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
    }, [] as PrepListItem[]);
  }, [pendingOrders]);

  const handleChefChange = useCallback((value: string) => {
    setSelectedChefId(parseInt(value));
  }, []);

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
              onValueChange={handleChefChange}
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

        <DashboardStats
          menuItemCount={chefMenuItems?.length || 0}
          scheduledDayCount={selectedChef?.daySlots?.length || 0}
          pendingOrderCount={pendingOrders.length}
          prepItemCount={prepList.length}
        />

        <Tabs defaultValue="items" className="space-y-6">
          <TabsList>
            <TabsTrigger value="items" data-testid="tab-items">My Food Items</TabsTrigger>
            <TabsTrigger value="menus" data-testid="tab-schedule">My Schedule</TabsTrigger>
            <TabsTrigger value="prep" data-testid="tab-prep">Prep List</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-6">
            <MenuItemsTab
              chefId={selectedChef?.id}
              chefMenuItems={chefMenuItems}
              itemsLoading={itemsLoading}
              allergens={allergens}
            />
          </TabsContent>

          <TabsContent value="menus" className="space-y-6">
            <ScheduleTab
              selectedChef={selectedChef}
              chefMenuItems={chefMenuItems}
            />
          </TabsContent>

          <TabsContent value="prep" className="space-y-6">
            <PrepListTab
              prepList={prepList}
              pendingOrderCount={pendingOrders.length}
            />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <OrdersTab
              orders={orders}
              ordersLoading={ordersLoading}
              chefId={selectedChef?.id}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
