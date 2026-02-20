import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

// ─── Users ───────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["CHEF", "BUYER"] }).notNull(),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

// ─── Chef Profiles ───────────────────────────────────────
export const chefProfiles = sqliteTable("chef_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  slug: text("slug").notNull().unique(),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  cuisineTags: text("cuisine_tags"), // JSON array stored as text
  locationLat: real("location_lat").notNull(),
  locationLong: real("location_long").notNull(),
  serviceRadius: integer("service_radius").notNull().default(10), // miles
  fulfillmentMethods: text("fulfillment_methods", { enum: ["PICKUP", "DELIVERY", "BOTH"] }).notNull().default("BOTH"),
  deliveryFee: real("delivery_fee").default(0),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

// ─── User Favorites ──────────────────────────────────────
export const userFavorites = sqliteTable("user_favorites", {
  buyerId: integer("buyer_id").notNull().references(() => users.id),
  chefId: integer("chef_id").notNull().references(() => chefProfiles.id),
}, (table) => [
  primaryKey({ columns: [table.buyerId, table.chefId] }),
]);

// ─── Menus ───────────────────────────────────────────────
export const menus = sqliteTable("menus", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chefProfileId: integer("chef_profile_id").notNull().references(() => chefProfiles.id),
  title: text("title").notNull(),
  orderCutoffDate: text("order_cutoff_date").notNull(),
  fulfillmentDate: text("fulfillment_date").notNull(),
  status: text("status", { enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }).notNull().default("DRAFT"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

// ─── Menu Items ──────────────────────────────────────────
export const menuItems = sqliteTable("menu_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  menuId: integer("menu_id").notNull().references(() => menus.id),
  title: text("title").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  imageUrl: text("image_url"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  unitType: text("unit_type").notNull().default("Per Meal"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

// ─── Ingredients ─────────────────────────────────────────
export const ingredients = sqliteTable("ingredients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

// ─── Allergens ───────────────────────────────────────────
export const allergens = sqliteTable("allergens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

// ─── Item ↔ Ingredients (Many-to-Many) ──────────────────
export const itemIngredients = sqliteTable("item_ingredients", {
  itemId: integer("item_id").notNull().references(() => menuItems.id),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id),
}, (table) => [
  primaryKey({ columns: [table.itemId, table.ingredientId] }),
]);

// ─── Item ↔ Allergens (Many-to-Many) ────────────────────
export const itemAllergens = sqliteTable("item_allergens", {
  itemId: integer("item_id").notNull().references(() => menuItems.id),
  allergenId: integer("allergen_id").notNull().references(() => allergens.id),
}, (table) => [
  primaryKey({ columns: [table.itemId, table.allergenId] }),
]);

// ─── Orders ──────────────────────────────────────────────
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buyerId: integer("buyer_id").notNull().references(() => users.id),
  chefId: integer("chef_id").notNull().references(() => chefProfiles.id),
  totalAmount: real("total_amount").notNull(),
  status: text("status", { enum: ["PENDING", "PAID", "COMPLETED", "CANCELLED"] }).notNull().default("PENDING"),
  fulfillmentMethod: text("fulfillment_method", { enum: ["PICKUP", "DELIVERY"] }).notNull(),
  deliveryAddress: text("delivery_address"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

// ─── Order Items ─────────────────────────────────────────
export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id),
  quantity: integer("quantity").notNull(),
  priceAtTime: real("price_at_time").notNull(),
});
