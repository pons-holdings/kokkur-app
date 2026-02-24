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
import { NotificationBell } from "@/components/notification-bell";
import DashboardStats from "@/components/dashboard/DashboardStats";
import MenuItemsTab from "@/components/dashboard/MenuItemsTab";
import ScheduleTab from "@/components/dashboard/ScheduleTab";
import PrepListTab from "@/components/dashboard/PrepListTab";
import OrdersTab from "@/components/dashboard/OrdersTab";
import ProfileTab from "@/components/dashboard/ProfileTab";
import type {
  ChefProfileWithDaySlots,
  Allergen,
  MenuItemWithDetails,
  OrderWithItems,
  PrepListDayGroup,
} from "@/components/dashboard/types";

export default function Dashboard() {
  const [selectedChefId, setSelectedChefId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("items");

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
    () => orders?.filter((o) => ["pending", "confirmed", "paid", "ready"].includes(o.status)) || [],
    [orders]
  );

  const prepListByDay = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Group: daySlotDate -> menuItemId -> aggregated prep item
    const dayMap = new Map<string, Map<number, { menuItemId: number; itemTitle: string; totalQuantity: number; orderCount: number; orders: { orderId: number; buyerName: string; quantity: number }[] }>>();
    // Also track daySlotId per date for the group
    const dateToSlotId = new Map<string, number>();

    for (const order of pendingOrders) {
      for (const item of order.items || []) {
        let dateKey: string;

        if (item.daySlot) {
          const slotDate = new Date(item.daySlot.date);
          slotDate.setHours(0, 0, 0, 0);
          // Skip past dates
          if (slotDate < today) continue;

          dateKey = slotDate.toISOString();
          if (!dateToSlotId.has(dateKey)) {
            dateToSlotId.set(dateKey, item.daySlotId!);
          }
        } else {
          // Group legacy/unscheduled orders together
          dateKey = "unscheduled";
        }

        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, new Map());
        }
        const itemMap = dayMap.get(dateKey)!;

        if (!itemMap.has(item.menuItemId)) {
          itemMap.set(item.menuItemId, {
            menuItemId: item.menuItemId,
            itemTitle: item.itemTitle,
            totalQuantity: 0,
            orderCount: 0,
            orders: [],
          });
        }
        const prepItem = itemMap.get(item.menuItemId)!;
        prepItem.totalQuantity += item.quantity;
        prepItem.orderCount += 1;
        prepItem.orders.push({
          orderId: order.id,
          buyerName: order.buyerName,
          quantity: item.quantity,
        });
      }
    }

    // Convert to sorted array — "unscheduled" sorts last
    const groups: PrepListDayGroup[] = Array.from(dayMap.entries())
      .sort(([a], [b]) => {
        if (a === "unscheduled") return 1;
        if (b === "unscheduled") return -1;
        return a.localeCompare(b);
      })
      .map(([dateKey, itemMap]) => ({
        daySlotId: dateToSlotId.get(dateKey) ?? null,
        daySlotDate: dateKey === "unscheduled" ? null : dateKey,
        items: Array.from(itemMap.values()),
      }));

    return groups;
  }, [pendingOrders]);

  const prepItemCount = prepListByDay.reduce((sum, g) => sum + g.items.length, 0);

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

          <div className="flex items-center gap-3">
            <NotificationBell recipientType="chef" recipientId={selectedChef?.id} />
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
                      {chef.firstName} {chef.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DashboardStats
          menuItemCount={chefMenuItems?.length || 0}
          scheduledDayCount={selectedChef?.daySlots?.length || 0}
          pendingOrderCount={pendingOrders.length}
          prepItemCount={prepItemCount}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="items" data-testid="tab-items">My Food Items</TabsTrigger>
            <TabsTrigger value="menus" data-testid="tab-schedule">My Schedule</TabsTrigger>
            <TabsTrigger value="prep" data-testid="tab-prep">Prep List</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
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
              prepListByDay={prepListByDay}
              pendingOrderCount={pendingOrders.length}
              onViewOrder={() => setActiveTab("orders")}
            />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <OrdersTab
              orders={orders}
              ordersLoading={ordersLoading}
              chefId={selectedChef?.id}
            />
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <ProfileTab chef={selectedChef} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
