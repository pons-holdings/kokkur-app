import { db } from "@/db";
import { chefProfiles, menus, menuItems, itemAllergens, allergens, users } from "@/db/schema";
import { eq, and, inArray, notInArray, sql } from "drizzle-orm";
import { zipToLatLong, getDistanceMiles } from "@/lib/geo";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const zip = searchParams.get("zip");
  const excludeAllergens = searchParams.getAll("exclude");

  // Get all chefs with their active menus
  const allChefs = db
    .select({
      chef: chefProfiles,
      userName: users.name,
    })
    .from(chefProfiles)
    .innerJoin(users, eq(users.id, chefProfiles.userId))
    .all();

  let filteredChefs = allChefs;

  // If zip code provided, filter by distance
  if (zip) {
    const userLocation = zipToLatLong(zip);
    if (!userLocation) {
      return NextResponse.json({ error: "Unknown zip code. Try one of the Austin, TX area codes (78701-78759)." }, { status: 400 });
    }

    filteredChefs = allChefs.filter((row) => {
      const distance = getDistanceMiles(
        userLocation,
        { latitude: row.chef.locationLat, longitude: row.chef.locationLong }
      );
      return distance <= row.chef.serviceRadius;
    });
  }

  // Get active menus for each chef
  const results = [];

  for (const row of filteredChefs) {
    const activeMenus = db
      .select()
      .from(menus)
      .where(and(eq(menus.chefProfileId, row.chef.id), eq(menus.status, "ACTIVE")))
      .all();

    if (activeMenus.length === 0) continue;

    const menuData = [];

    for (const menu of activeMenus) {
      let items = db
        .select()
        .from(menuItems)
        .where(eq(menuItems.menuId, menu.id))
        .all();

      // If allergens to exclude, filter out items that contain those allergens
      if (excludeAllergens.length > 0) {
        const allergenRecords = db
          .select()
          .from(allergens)
          .where(inArray(allergens.name, excludeAllergens))
          .all();

        const allergenIds = allergenRecords.map((a) => a.id);

        if (allergenIds.length > 0) {
          // Find item IDs that have any of the excluded allergens
          const excludedItemIds = db
            .select({ itemId: itemAllergens.itemId })
            .from(itemAllergens)
            .where(inArray(itemAllergens.allergenId, allergenIds))
            .all()
            .map((r) => r.itemId);

          items = items.filter((item) => !excludedItemIds.includes(item.id));
        }
      }

      if (items.length > 0) {
        // Get allergens for each item
        const itemsWithAllergens = items.map((item) => {
          const itemAllergenList = db
            .select({ name: allergens.name })
            .from(itemAllergens)
            .innerJoin(allergens, eq(allergens.id, itemAllergens.allergenId))
            .where(eq(itemAllergens.itemId, item.id))
            .all();

          return {
            ...item,
            allergens: itemAllergenList.map((a) => a.name),
          };
        });

        menuData.push({
          ...menu,
          items: itemsWithAllergens,
        });
      }
    }

    if (menuData.length > 0) {
      const distance = zip
        ? getDistanceMiles(
            zipToLatLong(zip)!,
            { latitude: row.chef.locationLat, longitude: row.chef.locationLong }
          )
        : null;

      results.push({
        chef: {
          ...row.chef,
          cuisineTags: JSON.parse(row.chef.cuisineTags || "[]"),
          name: row.userName,
        },
        menus: menuData,
        distance: distance ? Math.round(distance * 10) / 10 : null,
      });
    }
  }

  // Sort by distance if available
  if (zip) {
    results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  // Get all allergens for the filter sidebar
  const allAllergens = db.select().from(allergens).all();

  return NextResponse.json({ results, allergens: allAllergens });
}
