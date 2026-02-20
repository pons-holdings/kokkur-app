import { db } from "@/db";
import { menuItems, menus, chefProfiles, itemAllergens } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "CHEF") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { menuId, title, description, price, stockQuantity, unitType, allergenIds } = await req.json();

  // Verify menu belongs to this chef
  const menu = await db.select().from(menus).where(eq(menus.id, menuId)).get();
  if (!menu) {
    return NextResponse.json({ error: "Menu not found" }, { status: 404 });
  }

  const profile = await db
    .select()
    .from(chefProfiles)
    .where(eq(chefProfiles.id, menu.chefProfileId))
    .get();

  if (!profile || profile.userId !== session.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!title || price === undefined || stockQuantity === undefined) {
    return NextResponse.json({ error: "Title, price, and stock are required" }, { status: 400 });
  }

  const itemRows = await db
    .insert(menuItems)
    .values({
      menuId,
      title,
      description: description || null,
      price,
      stockQuantity,
      unitType: unitType || "Per Meal",
    })
    .returning();
  const item = itemRows[0];

  // Add allergen associations
  if (allergenIds && allergenIds.length > 0) {
    for (const allergenId of allergenIds) {
      await db.insert(itemAllergens).values({ itemId: item.id, allergenId }).run();
    }
  }

  return NextResponse.json({ item });
}
