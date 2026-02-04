import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, pgEnum, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["chef", "buyer"]);
export const fulfillmentMethodEnum = pgEnum("fulfillment_method", ["pickup", "delivery", "both"]);
export const menuStatusEnum = pgEnum("menu_status", ["draft", "active", "archived"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]);

// Chef Profiles
export const chefProfiles = pgTable("chef_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  cuisineTags: text("cuisine_tags").array().notNull().default(sql`'{}'::text[]`),
  locationLat: real("location_lat").notNull(),
  locationLong: real("location_long").notNull(),
  locationName: text("location_name"),
  serviceRadius: integer("service_radius").notNull().default(10),
  fulfillmentMethod: fulfillmentMethodEnum("fulfillment_method").notNull().default("both"),
  deliveryFee: real("delivery_fee").default(0),
});

// Menus (represents a date range of offerings)
export const menus = pgTable("menus", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chefId: integer("chef_id").notNull().references(() => chefProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: menuStatusEnum("status").notNull().default("draft"),
});

// Day Slots (individual days when chef offers food - belongs directly to chef)
export const menuDaySlots = pgTable("menu_day_slots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chefId: integer("chef_id").notNull().references(() => chefProfiles.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(), // The actual date for this slot
  orderCutoffDate: timestamp("order_cutoff_date").notNull(), // Cutoff for ordering this day's items
});

// Menu Items (belong to chef, can be assigned to multiple menus)
export const menuItems = pgTable("menu_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chefId: integer("chef_id").notNull().references(() => chefProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
});

// Serving Options (multiple price tiers per menu item, e.g., 1 serving $9.99, 4 servings $29.99)
export const servingOptions = pgTable("serving_options", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  servingSize: integer("serving_size").notNull().default(1),
  label: text("label").notNull(), // e.g., "1 serving", "Family Pack (4 servings)"
  price: real("price").notNull(),
  isDefault: integer("is_default").notNull().default(0), // Boolean as integer
});

// Item Photos (multiple photos per menu item with cover selection)
export const itemPhotos = pgTable("item_photos", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  isCover: integer("is_cover").notNull().default(0), // Boolean as integer
  sortOrder: integer("sort_order").notNull().default(0),
});

// Menu Item Assignments (many-to-many: items assigned to specific day slots)
export const menuItemAssignments = pgTable("menu_item_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  daySlotId: integer("day_slot_id").notNull().references(() => menuDaySlots.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
});

// Assignment Serving Options (which serving sizes are offered for each assignment, with per-size stock)
export const assignmentServingOptions = pgTable("assignment_serving_options", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  assignmentId: integer("assignment_id").notNull().references(() => menuItemAssignments.id, { onDelete: "cascade" }),
  servingOptionId: integer("serving_option_id").notNull().references(() => servingOptions.id, { onDelete: "cascade" }),
  stockQuantity: integer("stock_quantity"), // null means unlimited
  stockLimited: integer("stock_limited").notNull().default(0), // Boolean as integer
});

// Ingredients
export const ingredients = pgTable("ingredients", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
});

// Allergens (FDA Big 9 + additional common allergens)
export const allergens = pgTable("allergens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  icon: text("icon"),
  description: text("description"), // Additional info about the allergen
});

// Ingredient-Allergen mappings (which ingredients contain which allergens for auto-selection)
export const ingredientAllergens = pgTable("ingredient_allergens", {
  ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
  allergenId: integer("allergen_id").notNull().references(() => allergens.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.ingredientId, table.allergenId] }),
}));

// Item Ingredients (many-to-many)
export const itemIngredients = pgTable("item_ingredients", {
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.menuItemId, table.ingredientId] }),
}));

// Item Allergens (many-to-many)
export const itemAllergens = pgTable("item_allergens", {
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  allergenId: integer("allergen_id").notNull().references(() => allergens.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.menuItemId, table.allergenId] }),
}));

// Orders
export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chefId: integer("chef_id").notNull().references(() => chefProfiles.id),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email"),
  buyerPhone: text("buyer_phone"),
  totalAmount: real("total_amount").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  fulfillmentMethod: fulfillmentMethodEnum("fulfillment_method").notNull(),
  deliveryAddress: text("delivery_address"),
  deliveryLat: real("delivery_lat"),
  deliveryLong: real("delivery_long"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order Items
export const orderItems = pgTable("order_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItems.id),
  quantity: integer("quantity").notNull(),
  priceAtOrder: real("price_at_order").notNull(),
  itemTitle: text("item_title").notNull(),
});

// User Favorites (for demo, stored in localStorage, but schema for future)
export const userFavorites = pgTable("user_favorites", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chefId: integer("chef_id").notNull().references(() => chefProfiles.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
}, (table) => ({
}));

// Relations
export const chefProfilesRelations = relations(chefProfiles, ({ many }) => ({
  menus: many(menus),
  menuItems: many(menuItems),
  daySlots: many(menuDaySlots),
  orders: many(orders),
  favorites: many(userFavorites),
}));

export const menusRelations = relations(menus, ({ one, many }) => ({
  chef: one(chefProfiles, {
    fields: [menus.chefId],
    references: [chefProfiles.id],
  }),
  daySlots: many(menuDaySlots),
}));

export const menuDaySlotsRelations = relations(menuDaySlots, ({ one, many }) => ({
  chef: one(chefProfiles, {
    fields: [menuDaySlots.chefId],
    references: [chefProfiles.id],
  }),
  itemAssignments: many(menuItemAssignments),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  chef: one(chefProfiles, {
    fields: [menuItems.chefId],
    references: [chefProfiles.id],
  }),
  menuAssignments: many(menuItemAssignments),
  ingredients: many(itemIngredients),
  allergens: many(itemAllergens),
  orderItems: many(orderItems),
  servingOptions: many(servingOptions),
  photos: many(itemPhotos),
}));

export const servingOptionsRelations = relations(servingOptions, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [servingOptions.menuItemId],
    references: [menuItems.id],
  }),
}));

export const itemPhotosRelations = relations(itemPhotos, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [itemPhotos.menuItemId],
    references: [menuItems.id],
  }),
}));

export const menuItemAssignmentsRelations = relations(menuItemAssignments, ({ one, many }) => ({
  daySlot: one(menuDaySlots, {
    fields: [menuItemAssignments.daySlotId],
    references: [menuDaySlots.id],
  }),
  menuItem: one(menuItems, {
    fields: [menuItemAssignments.menuItemId],
    references: [menuItems.id],
  }),
  assignedServingOptions: many(assignmentServingOptions),
}));

export const assignmentServingOptionsRelations = relations(assignmentServingOptions, ({ one }) => ({
  assignment: one(menuItemAssignments, {
    fields: [assignmentServingOptions.assignmentId],
    references: [menuItemAssignments.id],
  }),
  servingOption: one(servingOptions, {
    fields: [assignmentServingOptions.servingOptionId],
    references: [servingOptions.id],
  }),
}));

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  menuItems: many(itemIngredients),
  allergens: many(ingredientAllergens),
}));

export const allergensRelations = relations(allergens, ({ many }) => ({
  menuItems: many(itemAllergens),
  ingredients: many(ingredientAllergens),
}));

export const ingredientAllergensRelations = relations(ingredientAllergens, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [ingredientAllergens.ingredientId],
    references: [ingredients.id],
  }),
  allergen: one(allergens, {
    fields: [ingredientAllergens.allergenId],
    references: [allergens.id],
  }),
}));

export const itemIngredientsRelations = relations(itemIngredients, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [itemIngredients.menuItemId],
    references: [menuItems.id],
  }),
  ingredient: one(ingredients, {
    fields: [itemIngredients.ingredientId],
    references: [ingredients.id],
  }),
}));

export const itemAllergensRelations = relations(itemAllergens, ({ one }) => ({
  menuItem: one(menuItems, {
    fields: [itemAllergens.menuItemId],
    references: [menuItems.id],
  }),
  allergen: one(allergens, {
    fields: [itemAllergens.allergenId],
    references: [allergens.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  chef: one(chefProfiles, {
    fields: [orders.chefId],
    references: [chefProfiles.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  chef: one(chefProfiles, {
    fields: [userFavorites.chefId],
    references: [chefProfiles.id],
  }),
}));

// Insert Schemas
export const insertChefProfileSchema = createInsertSchema(chefProfiles).omit({ id: true });
export const insertMenuSchema = createInsertSchema(menus).omit({ id: true });
export const insertMenuDaySlotSchema = createInsertSchema(menuDaySlots).omit({ id: true });
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true });
export const insertMenuItemAssignmentSchema = createInsertSchema(menuItemAssignments).omit({ id: true });
export const insertAssignmentServingOptionSchema = createInsertSchema(assignmentServingOptions).omit({ id: true });
export const insertServingOptionSchema = createInsertSchema(servingOptions).omit({ id: true });
export const insertItemPhotoSchema = createInsertSchema(itemPhotos).omit({ id: true });
export const insertIngredientSchema = createInsertSchema(ingredients).omit({ id: true });
export const insertAllergenSchema = createInsertSchema(allergens).omit({ id: true });
export const insertIngredientAllergenSchema = createInsertSchema(ingredientAllergens);
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertItemIngredientSchema = createInsertSchema(itemIngredients);
export const insertItemAllergenSchema = createInsertSchema(itemAllergens);
export const insertUserFavoriteSchema = createInsertSchema(userFavorites).omit({ id: true });

// Types
export type ChefProfile = typeof chefProfiles.$inferSelect;
export type InsertChefProfile = z.infer<typeof insertChefProfileSchema>;
export type Menu = typeof menus.$inferSelect;
export type InsertMenu = z.infer<typeof insertMenuSchema>;
export type MenuDaySlot = typeof menuDaySlots.$inferSelect;
export type InsertMenuDaySlot = z.infer<typeof insertMenuDaySlotSchema>;
export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type ServingOption = typeof servingOptions.$inferSelect;
export type InsertServingOption = z.infer<typeof insertServingOptionSchema>;
export type ItemPhoto = typeof itemPhotos.$inferSelect;
export type InsertItemPhoto = z.infer<typeof insertItemPhotoSchema>;
export type Ingredient = typeof ingredients.$inferSelect;
export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type IngredientAllergen = typeof ingredientAllergens.$inferSelect;
export type InsertIngredientAllergen = z.infer<typeof insertIngredientAllergenSchema>;
export type Allergen = typeof allergens.$inferSelect;
export type InsertAllergen = z.infer<typeof insertAllergenSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type ItemIngredient = typeof itemIngredients.$inferSelect;
export type InsertItemIngredient = z.infer<typeof insertItemIngredientSchema>;
export type ItemAllergen = typeof itemAllergens.$inferSelect;
export type InsertItemAllergen = z.infer<typeof insertItemAllergenSchema>;
export type MenuItemAssignment = typeof menuItemAssignments.$inferSelect;
export type InsertMenuItemAssignment = z.infer<typeof insertMenuItemAssignmentSchema>;
export type AssignmentServingOption = typeof assignmentServingOptions.$inferSelect;
export type InsertAssignmentServingOption = z.infer<typeof insertAssignmentServingOptionSchema>;
export type UserFavorite = typeof userFavorites.$inferSelect;
export type InsertUserFavorite = z.infer<typeof insertUserFavoriteSchema>;

// Extended types for API responses
export type IngredientWithAllergens = Ingredient & {
  allergens: Allergen[];
};

export type MenuItemWithDetails = MenuItem & {
  ingredients: Ingredient[];
  allergens: Allergen[];
  servingOptions: ServingOption[];
  photos: ItemPhoto[];
  coverPhoto?: string; // convenience field for the cover photo URL
};

// Assigned serving option with stock info
export type AssignedServingOptionWithDetails = AssignmentServingOption & {
  servingOption: ServingOption;
};

// Extended type that includes assignment-level serving options and stock info
export type MenuItemWithAssignment = MenuItemWithDetails & {
  assignmentId: number;
  assignedServingOptions: AssignedServingOptionWithDetails[];
};

export type DaySlotItemAssignment = MenuItemAssignment & {
  menuItem: MenuItemWithDetails;
  assignedServingOptions: AssignedServingOptionWithDetails[];
};

export type DaySlotWithItems = MenuDaySlot & {
  items: MenuItemWithAssignment[];
  assignments?: DaySlotItemAssignment[];
};

export type MenuWithDaySlots = Menu & {
  daySlots: DaySlotWithItems[];
};

export type ChefProfileWithDaySlots = ChefProfile & {
  daySlots: DaySlotWithItems[];
  menuItems?: MenuItemWithDetails[];
  distance?: number;
};

// Keep for backwards compatibility during transition
export type ChefProfileWithMenus = ChefProfileWithDaySlots;

export type OrderWithItems = Order & {
  items: (OrderItem & { menuItem?: MenuItem })[];
  chef?: ChefProfile;
};
