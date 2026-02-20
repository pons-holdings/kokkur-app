import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { hashSync } from "bcryptjs";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "kokkur.db");

// Delete existing DB for fresh seed
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

// Run migrations
migrate(db, { migrationsFolder: "./drizzle" });

console.log("Running seed...");

// ─── Users ───────────────────────────────────────────────
const passwordHash = hashSync("password123", 10);

const insertedUsers = db.insert(schema.users).values([
  { email: "maria@kokkur.com", passwordHash, name: "Chef Maria", role: "CHEF" as const },
  { email: "james@kokkur.com", passwordHash, name: "Chef James", role: "CHEF" as const },
  { email: "priya@kokkur.com", passwordHash, name: "Chef Priya", role: "CHEF" as const },
  { email: "buyer@kokkur.com", passwordHash, name: "Alex Thompson", role: "BUYER" as const },
]).returning();

const userRows = insertedUsers.all();
console.log(`Created ${userRows.length} users`);

// ─── Chef Profiles ───────────────────────────────────────
// Locations around Austin, TX area (spaced ~5-10 miles apart)
const insertedChefs = db.insert(schema.chefProfiles).values([
  {
    userId: userRows[0].id,
    slug: "chef-maria",
    bio: "Bringing the flavors of Southern Italy to your table. My nonna's recipes, made with love and the freshest local ingredients. Specializing in handmade pasta, slow-cooked ragus, and traditional desserts.",
    profileImageUrl: "/images/chef-maria.jpg",
    cuisineTags: JSON.stringify(["Italian", "Mediterranean", "Pasta"]),
    locationLat: 30.2672,
    locationLong: -97.7431,
    serviceRadius: 12,
    fulfillmentMethods: "BOTH" as const,
    deliveryFee: 5.99,
  },
  {
    userId: userRows[1].id,
    slug: "chef-james",
    bio: "Texas BBQ meets global flavors. Low and slow smoked meats with unexpected fusion twists. Former pitmaster at Franklin's, now bringing craft BBQ directly to your door.",
    profileImageUrl: "/images/chef-james.jpg",
    cuisineTags: JSON.stringify(["BBQ", "Texan", "Fusion"]),
    locationLat: 30.3500,
    locationLong: -97.7500,
    serviceRadius: 8,
    fulfillmentMethods: "PICKUP" as const,
    deliveryFee: 0,
  },
  {
    userId: userRows[2].id,
    slug: "chef-priya",
    bio: "Authentic South Indian cuisine with a modern presentation. Every spice is freshly ground, every dish tells a story from Kerala. Vegetarian and vegan options always available.",
    profileImageUrl: "/images/chef-priya.jpg",
    cuisineTags: JSON.stringify(["Indian", "South Indian", "Vegetarian"]),
    locationLat: 30.2200,
    locationLong: -97.8000,
    serviceRadius: 15,
    fulfillmentMethods: "BOTH" as const,
    deliveryFee: 4.99,
  },
]).returning();

const chefRows = insertedChefs.all();
console.log(`Created ${chefRows.length} chef profiles`);

// ─── FDA Major Allergens ─────────────────────────────────
const allergenNames = [
  "Milk", "Eggs", "Fish", "Shellfish", "Tree Nuts",
  "Peanuts", "Wheat", "Soybeans", "Sesame",
];

const insertedAllergens = db.insert(schema.allergens).values(
  allergenNames.map((name) => ({ name }))
).returning();
const allergenRows = insertedAllergens.all();
console.log(`Created ${allergenRows.length} allergens`);

// ─── Ingredients ─────────────────────────────────────────
const ingredientNames = [
  "Olive Oil", "Garlic", "Tomatoes", "Basil", "Parmesan Cheese",
  "Pasta Flour", "Eggs", "Heavy Cream", "Butter", "Mozzarella",
  "Brisket", "Pork Ribs", "BBQ Rub", "Coleslaw Mix", "Cornbread Mix",
  "Rice", "Coconut Milk", "Curry Leaves", "Mustard Seeds", "Turmeric",
  "Chicken", "Bell Peppers", "Onions", "Potatoes", "Lentils",
];

const insertedIngredients = db.insert(schema.ingredients).values(
  ingredientNames.map((name) => ({ name }))
).returning();
const ingredientRows = insertedIngredients.all();
console.log(`Created ${ingredientRows.length} ingredients`);

// Helper to find IDs
const allergenId = (name: string) => allergenRows.find((a) => a.name === name)!.id;
const ingredientId = (name: string) => ingredientRows.find((i) => i.name === name)!.id;

// ─── Menus ───────────────────────────────────────────────
const insertedMenus = db.insert(schema.menus).values([
  {
    chefProfileId: chefRows[0].id,
    title: "Week of Feb 24 - Italian Classics",
    orderCutoffDate: "2026-02-22",
    fulfillmentDate: "2026-02-24",
    status: "ACTIVE" as const,
  },
  {
    chefProfileId: chefRows[1].id,
    title: "Weekend BBQ Special",
    orderCutoffDate: "2026-02-21",
    fulfillmentDate: "2026-02-23",
    status: "ACTIVE" as const,
  },
  {
    chefProfileId: chefRows[2].id,
    title: "South Indian Feast - February",
    orderCutoffDate: "2026-02-22",
    fulfillmentDate: "2026-02-24",
    status: "ACTIVE" as const,
  },
]).returning();
const menuRows = insertedMenus.all();
console.log(`Created ${menuRows.length} menus`);

// ─── Menu Items ──────────────────────────────────────────

// Chef Maria's items
const mariaItems = db.insert(schema.menuItems).values([
  {
    menuId: menuRows[0].id,
    title: "Classic Lasagna",
    description: "Layers of handmade pasta, slow-cooked beef ragu, bechamel, and aged parmesan. Serves 2-3.",
    price: 28.99,
    stockQuantity: 20,
    unitType: "Per Tray",
  },
  {
    menuId: menuRows[0].id,
    title: "Truffle Mushroom Risotto",
    description: "Arborio rice slowly cooked with porcini mushrooms, finished with truffle oil and parmesan.",
    price: 22.99,
    stockQuantity: 15,
    unitType: "Per Meal",
  },
  {
    menuId: menuRows[0].id,
    title: "Tiramisu",
    description: "Classic Italian dessert with espresso-soaked ladyfingers, mascarpone cream, and cocoa.",
    price: 12.99,
    stockQuantity: 25,
    unitType: "Per Serving",
  },
  {
    menuId: menuRows[0].id,
    title: "Caprese Salad",
    description: "Fresh buffalo mozzarella, heirloom tomatoes, basil, extra virgin olive oil.",
    price: 14.99,
    stockQuantity: 30,
    unitType: "Per Serving",
  },
]).returning();
const mariaItemRows = mariaItems.all();

// Chef James's items
const jamesItems = db.insert(schema.menuItems).values([
  {
    menuId: menuRows[1].id,
    title: "Smoked Brisket Plate",
    description: "12-hour oak-smoked brisket, house-made pickles, white bread, and two sides.",
    price: 24.99,
    stockQuantity: 30,
    unitType: "Per Plate",
  },
  {
    menuId: menuRows[1].id,
    title: "Pulled Pork Sandwich",
    description: "Hickory-smoked pulled pork on a brioche bun with tangy slaw.",
    price: 16.99,
    stockQuantity: 25,
    unitType: "Per Sandwich",
  },
  {
    menuId: menuRows[1].id,
    title: "Korean BBQ Ribs",
    description: "Pork ribs glazed with gochujang-sesame sauce. A fusion twist on a Texas classic.",
    price: 29.99,
    stockQuantity: 15,
    unitType: "Per Rack",
  },
  {
    menuId: menuRows[1].id,
    title: "Jalapeño Cornbread",
    description: "Buttery cornbread with roasted jalapeños and sharp cheddar.",
    price: 8.99,
    stockQuantity: 40,
    unitType: "Per Piece",
  },
]).returning();
const jamesItemRows = jamesItems.all();

// Chef Priya's items
const priyaItems = db.insert(schema.menuItems).values([
  {
    menuId: menuRows[2].id,
    title: "Kerala Fish Curry",
    description: "Tangy coconut-based fish curry with kokum and curry leaves. Served with steamed rice.",
    price: 19.99,
    stockQuantity: 20,
    unitType: "Per Meal",
  },
  {
    menuId: menuRows[2].id,
    title: "Masala Dosa",
    description: "Crispy fermented rice crepe filled with spiced potato, served with sambar and coconut chutney.",
    price: 14.99,
    stockQuantity: 30,
    unitType: "Per Serving",
  },
  {
    menuId: menuRows[2].id,
    title: "Vegetable Biryani",
    description: "Fragrant basmati rice layered with seasonal vegetables, saffron, and whole spices.",
    price: 18.99,
    stockQuantity: 25,
    unitType: "Per Meal",
  },
  {
    menuId: menuRows[2].id,
    title: "Coconut Ladoo",
    description: "Sweet coconut balls with cardamom and condensed milk. Box of 6.",
    price: 10.99,
    stockQuantity: 35,
    unitType: "Per Box",
  },
]).returning();
const priyaItemRows = priyaItems.all();

console.log(`Created ${mariaItemRows.length + jamesItemRows.length + priyaItemRows.length} menu items`);

// ─── Item ↔ Allergen Mappings ────────────────────────────
const itemAllergenMappings = [
  // Maria's items
  { itemId: mariaItemRows[0].id, allergenId: allergenId("Milk") },
  { itemId: mariaItemRows[0].id, allergenId: allergenId("Eggs") },
  { itemId: mariaItemRows[0].id, allergenId: allergenId("Wheat") },
  { itemId: mariaItemRows[1].id, allergenId: allergenId("Milk") },
  { itemId: mariaItemRows[2].id, allergenId: allergenId("Eggs") },
  { itemId: mariaItemRows[2].id, allergenId: allergenId("Milk") },
  { itemId: mariaItemRows[2].id, allergenId: allergenId("Wheat") },
  { itemId: mariaItemRows[3].id, allergenId: allergenId("Milk") },
  // James's items
  { itemId: jamesItemRows[0].id, allergenId: allergenId("Soybeans") },
  { itemId: jamesItemRows[1].id, allergenId: allergenId("Wheat") },
  { itemId: jamesItemRows[1].id, allergenId: allergenId("Eggs") },
  { itemId: jamesItemRows[2].id, allergenId: allergenId("Soybeans") },
  { itemId: jamesItemRows[2].id, allergenId: allergenId("Sesame") },
  { itemId: jamesItemRows[3].id, allergenId: allergenId("Milk") },
  { itemId: jamesItemRows[3].id, allergenId: allergenId("Eggs") },
  { itemId: jamesItemRows[3].id, allergenId: allergenId("Wheat") },
  // Priya's items
  { itemId: priyaItemRows[0].id, allergenId: allergenId("Fish") },
  // Masala Dosa is allergen-free (no common allergens)
  { itemId: priyaItemRows[2].id, allergenId: allergenId("Tree Nuts") },
  { itemId: priyaItemRows[3].id, allergenId: allergenId("Milk") },
  { itemId: priyaItemRows[3].id, allergenId: allergenId("Tree Nuts") },
];

// Filter out any invalid mappings (allergenId could be 0 for non-existing allergens)
const validAllergenMappings = itemAllergenMappings.filter((m) => m.allergenId > 0);

db.insert(schema.itemAllergens).values(validAllergenMappings).run();
console.log(`Created ${validAllergenMappings.length} item-allergen mappings`);

// ─── Item ↔ Ingredient Mappings ──────────────────────────
const itemIngredientMappings = [
  // Maria's Lasagna
  { itemId: mariaItemRows[0].id, ingredientId: ingredientId("Pasta Flour") },
  { itemId: mariaItemRows[0].id, ingredientId: ingredientId("Eggs") },
  { itemId: mariaItemRows[0].id, ingredientId: ingredientId("Tomatoes") },
  { itemId: mariaItemRows[0].id, ingredientId: ingredientId("Parmesan Cheese") },
  { itemId: mariaItemRows[0].id, ingredientId: ingredientId("Butter") },
  // Maria's Risotto
  { itemId: mariaItemRows[1].id, ingredientId: ingredientId("Butter") },
  { itemId: mariaItemRows[1].id, ingredientId: ingredientId("Parmesan Cheese") },
  { itemId: mariaItemRows[1].id, ingredientId: ingredientId("Olive Oil") },
  // Maria's Tiramisu
  { itemId: mariaItemRows[2].id, ingredientId: ingredientId("Eggs") },
  { itemId: mariaItemRows[2].id, ingredientId: ingredientId("Heavy Cream") },
  // Maria's Caprese
  { itemId: mariaItemRows[3].id, ingredientId: ingredientId("Mozzarella") },
  { itemId: mariaItemRows[3].id, ingredientId: ingredientId("Tomatoes") },
  { itemId: mariaItemRows[3].id, ingredientId: ingredientId("Basil") },
  { itemId: mariaItemRows[3].id, ingredientId: ingredientId("Olive Oil") },
  // James's Brisket
  { itemId: jamesItemRows[0].id, ingredientId: ingredientId("Brisket") },
  { itemId: jamesItemRows[0].id, ingredientId: ingredientId("BBQ Rub") },
  // James's Pulled Pork
  { itemId: jamesItemRows[1].id, ingredientId: ingredientId("Pork Ribs") },
  { itemId: jamesItemRows[1].id, ingredientId: ingredientId("Coleslaw Mix") },
  // James's Korean Ribs
  { itemId: jamesItemRows[2].id, ingredientId: ingredientId("Pork Ribs") },
  // James's Cornbread
  { itemId: jamesItemRows[3].id, ingredientId: ingredientId("Cornbread Mix") },
  { itemId: jamesItemRows[3].id, ingredientId: ingredientId("Butter") },
  // Priya's Fish Curry
  { itemId: priyaItemRows[0].id, ingredientId: ingredientId("Coconut Milk") },
  { itemId: priyaItemRows[0].id, ingredientId: ingredientId("Curry Leaves") },
  { itemId: priyaItemRows[0].id, ingredientId: ingredientId("Turmeric") },
  { itemId: priyaItemRows[0].id, ingredientId: ingredientId("Rice") },
  // Priya's Dosa
  { itemId: priyaItemRows[1].id, ingredientId: ingredientId("Rice") },
  { itemId: priyaItemRows[1].id, ingredientId: ingredientId("Potatoes") },
  { itemId: priyaItemRows[1].id, ingredientId: ingredientId("Mustard Seeds") },
  // Priya's Biryani
  { itemId: priyaItemRows[2].id, ingredientId: ingredientId("Rice") },
  { itemId: priyaItemRows[2].id, ingredientId: ingredientId("Onions") },
  { itemId: priyaItemRows[2].id, ingredientId: ingredientId("Bell Peppers") },
  // Priya's Ladoo
  { itemId: priyaItemRows[3].id, ingredientId: ingredientId("Coconut Milk") },
];

db.insert(schema.itemIngredients).values(itemIngredientMappings).run();
console.log(`Created ${itemIngredientMappings.length} item-ingredient mappings`);

console.log("\nSeed completed successfully!");
console.log("─────────────────────────────");
console.log("Test accounts:");
console.log("  Chef Maria:  maria@kokkur.com / password123");
console.log("  Chef James:  james@kokkur.com / password123");
console.log("  Chef Priya:  priya@kokkur.com / password123");
console.log("  Buyer Alex:  buyer@kokkur.com / password123");
