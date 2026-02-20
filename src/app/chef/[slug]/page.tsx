import { db } from "@/db";
import { chefProfiles, menus, menuItems, itemAllergens, itemIngredients, allergens, ingredients, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ChefStorefront } from "@/components/chef-storefront";

export default async function ChefPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();

  const chefRow = db
    .select({
      chef: chefProfiles,
      userName: users.name,
    })
    .from(chefProfiles)
    .innerJoin(users, eq(users.id, chefProfiles.userId))
    .where(eq(chefProfiles.slug, slug))
    .get();

  if (!chefRow) notFound();

  const activeMenus = db
    .select()
    .from(menus)
    .where(and(eq(menus.chefProfileId, chefRow.chef.id), eq(menus.status, "ACTIVE")))
    .all();

  const menuData = activeMenus.map((menu) => {
    const items = db.select().from(menuItems).where(eq(menuItems.menuId, menu.id)).all();

    const itemsWithDetails = items.map((item) => {
      const itemAllergenList = db
        .select({ name: allergens.name })
        .from(itemAllergens)
        .innerJoin(allergens, eq(allergens.id, itemAllergens.allergenId))
        .where(eq(itemAllergens.itemId, item.id))
        .all();

      const itemIngredientList = db
        .select({ name: ingredients.name })
        .from(itemIngredients)
        .innerJoin(ingredients, eq(ingredients.id, itemIngredients.ingredientId))
        .where(eq(itemIngredients.itemId, item.id))
        .all();

      return {
        ...item,
        allergens: itemAllergenList.map((a) => a.name),
        ingredients: itemIngredientList.map((i) => i.name),
      };
    });

    return { ...menu, items: itemsWithDetails };
  });

  const chefData = {
    ...chefRow.chef,
    name: chefRow.userName,
    cuisineTags: JSON.parse(chefRow.chef.cuisineTags || "[]"),
  };

  return (
    <ChefStorefront
      chef={chefData}
      menus={menuData}
      userId={session?.id ?? null}
      userRole={session?.role ?? null}
    />
  );
}
