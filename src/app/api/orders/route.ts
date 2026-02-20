import { db } from "@/db";
import { orders, orderItems, menuItems, chefProfiles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { zipToLatLong, getDistanceMiles } from "@/lib/geo";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Must be logged in" }, { status: 401 });
  }

  const { chefId, items, fulfillmentMethod, deliveryAddress, deliveryZip } = await req.json();

  if (!chefId || !items || !items.length || !fulfillmentMethod) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate chef exists
  const chef = db.select().from(chefProfiles).where(eq(chefProfiles.id, chefId)).get();
  if (!chef) {
    return NextResponse.json({ error: "Chef not found" }, { status: 404 });
  }

  // If delivery, validate address is within range
  if (fulfillmentMethod === "DELIVERY") {
    if (chef.fulfillmentMethods === "PICKUP") {
      return NextResponse.json({ error: "This chef only offers pickup" }, { status: 400 });
    }

    if (!deliveryZip) {
      return NextResponse.json({ error: "Delivery zip code required" }, { status: 400 });
    }

    const deliveryLocation = zipToLatLong(deliveryZip);
    if (!deliveryLocation) {
      return NextResponse.json({ error: "Unknown delivery zip code" }, { status: 400 });
    }

    const distance = getDistanceMiles(
      deliveryLocation,
      { latitude: chef.locationLat, longitude: chef.locationLong }
    );

    if (distance > chef.serviceRadius) {
      return NextResponse.json(
        { error: `Address out of delivery range. You are ${Math.round(distance * 10) / 10} miles away, but chef's delivery radius is ${chef.serviceRadius} miles.` },
        { status: 400 }
      );
    }
  }

  // Validate stock and calculate total
  let totalAmount = 0;
  const validatedItems: { menuItemId: number; quantity: number; priceAtTime: number }[] = [];

  for (const item of items) {
    const menuItem = db.select().from(menuItems).where(eq(menuItems.id, item.menuItemId)).get();
    if (!menuItem) {
      return NextResponse.json({ error: `Item ${item.menuItemId} not found` }, { status: 404 });
    }

    if (menuItem.stockQuantity < item.quantity) {
      return NextResponse.json(
        { error: `Not enough stock for "${menuItem.title}". Only ${menuItem.stockQuantity} available.` },
        { status: 400 }
      );
    }

    totalAmount += menuItem.price * item.quantity;
    validatedItems.push({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      priceAtTime: menuItem.price,
    });
  }

  // Create order
  const order = db
    .insert(orders)
    .values({
      buyerId: session.id,
      chefId,
      totalAmount,
      fulfillmentMethod,
      deliveryAddress: deliveryAddress || null,
      status: "PENDING",
    })
    .returning()
    .get();

  // Create order items
  for (const item of validatedItems) {
    db.insert(orderItems).values({ orderId: order.id, ...item }).run();
  }

  // Decrement stock
  for (const item of validatedItems) {
    const current = db.select().from(menuItems).where(eq(menuItems.id, item.menuItemId)).get()!;
    db.update(menuItems)
      .set({ stockQuantity: current.stockQuantity - item.quantity })
      .where(eq(menuItems.id, item.menuItemId))
      .run();
  }

  return NextResponse.json({ order });
}
