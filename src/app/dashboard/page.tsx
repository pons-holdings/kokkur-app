import { db } from "@/db";
import { chefProfiles, menus, menuItems, orders, orderItems, allergens, itemAllergens, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "CHEF") redirect("/login");

  // Get or check chef profile
  const chefProfile = db
    .select()
    .from(chefProfiles)
    .where(eq(chefProfiles.userId, session.id))
    .get();

  if (!chefProfile) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h2 className="text-2xl font-bold">Complete Your Chef Profile</h2>
        <p className="text-muted-foreground mt-2">You need to set up your chef profile first.</p>
      </div>
    );
  }

  // Get all menus for this chef
  const chefMenus = db
    .select()
    .from(menus)
    .where(eq(menus.chefProfileId, chefProfile.id))
    .all();

  // Get items for each menu with allergens
  const menusWithItems = chefMenus.map((menu) => {
    const items = db.select().from(menuItems).where(eq(menuItems.menuId, menu.id)).all();
    const itemsWithAllergens = items.map((item) => {
      const itemAllergenList = db
        .select({ id: allergens.id, name: allergens.name })
        .from(itemAllergens)
        .innerJoin(allergens, eq(allergens.id, itemAllergens.allergenId))
        .where(eq(itemAllergens.itemId, item.id))
        .all();
      return { ...item, allergens: itemAllergenList };
    });
    return { ...menu, items: itemsWithAllergens };
  });

  // Get pending orders for prep list
  const pendingOrders = db
    .select({
      order: orders,
      buyerName: users.name,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.buyerId))
    .where(and(eq(orders.chefId, chefProfile.id), eq(orders.status, "PENDING")))
    .all();

  const ordersWithItems = pendingOrders.map((row) => {
    const items = db
      .select({
        orderItem: orderItems,
        menuItemTitle: menuItems.title,
      })
      .from(orderItems)
      .innerJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
      .where(eq(orderItems.orderId, row.order.id))
      .all();

    return {
      ...row.order,
      buyerName: row.buyerName,
      items: items.map((i) => ({
        ...i.orderItem,
        title: i.menuItemTitle,
      })),
    };
  });

  // Aggregate prep list
  const prepMap = new Map<string, number>();
  for (const order of ordersWithItems) {
    for (const item of order.items) {
      const current = prepMap.get(item.title) || 0;
      prepMap.set(item.title, current + item.quantity);
    }
  }
  const prepList = Array.from(prepMap.entries()).map(([title, quantity]) => ({ title, quantity }));

  // Get all allergens for the form
  const allAllergens = db.select().from(allergens).all();

  return (
    <DashboardClient
      chefProfile={chefProfile}
      menus={menusWithItems}
      pendingOrders={ordersWithItems}
      prepList={prepList}
      allAllergens={allAllergens}
    />
  );
}
