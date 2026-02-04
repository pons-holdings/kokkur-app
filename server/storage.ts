import { 
  chefProfiles, menus, menuDaySlots, menuItems, menuItemAssignments, ingredients, allergens,
  itemIngredients, itemAllergens, orders, orderItems, userFavorites,
  type ChefProfile, type InsertChefProfile,
  type Menu, type InsertMenu,
  type MenuDaySlot, type InsertMenuDaySlot,
  type MenuItem, type InsertMenuItem,
  type MenuItemAssignment, type InsertMenuItemAssignment,
  type Ingredient, type InsertIngredient,
  type Allergen, type InsertAllergen,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type InsertItemIngredient, type InsertItemAllergen,
  type MenuItemWithDetails, type DaySlotWithItems, type MenuWithDaySlots, type ChefProfileWithMenus, type OrderWithItems
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, sql } from "drizzle-orm";

export interface IStorage {
  // Chefs
  getChefs(): Promise<ChefProfileWithMenus[]>;
  getChefBySlug(slug: string): Promise<ChefProfileWithMenus | undefined>;
  getChefById(id: number): Promise<ChefProfile | undefined>;
  createChef(chef: InsertChefProfile): Promise<ChefProfile>;

  // Menus
  getMenusByChefId(chefId: number): Promise<MenuWithDaySlots[]>;
  getMenuById(id: number): Promise<Menu | undefined>;
  createMenu(menu: InsertMenu): Promise<Menu>;
  updateMenu(id: number, menu: Partial<InsertMenu>): Promise<Menu | undefined>;
  deleteMenu(id: number): Promise<boolean>;

  // Day Slots
  getDaySlotsByMenuId(menuId: number): Promise<DaySlotWithItems[]>;
  getDaySlotById(id: number): Promise<MenuDaySlot | undefined>;
  createDaySlot(slot: InsertMenuDaySlot): Promise<MenuDaySlot>;
  updateDaySlot(id: number, slot: Partial<InsertMenuDaySlot>): Promise<MenuDaySlot | undefined>;
  deleteDaySlot(id: number): Promise<boolean>;

  // Menu Items (belong to chef, can be assigned to multiple day slots)
  getMenuItemsByChefId(chefId: number): Promise<MenuItemWithDetails[]>;
  getMenuItemById(id: number): Promise<MenuItemWithDetails | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: number): Promise<boolean>;
  updateMenuItemStock(id: number, quantity: number): Promise<void>;
  addItemIngredients(menuItemId: number, ingredientIds: number[]): Promise<void>;
  addItemAllergens(menuItemId: number, allergenIds: number[]): Promise<void>;
  clearItemIngredients(menuItemId: number): Promise<void>;
  clearItemAllergens(menuItemId: number): Promise<void>;

  // Day Slot-Item Assignments (many-to-many)
  assignItemToDaySlot(daySlotId: number, menuItemId: number): Promise<void>;
  removeItemFromDaySlot(daySlotId: number, menuItemId: number): Promise<void>;
  getItemsForDaySlot(daySlotId: number): Promise<MenuItemWithDetails[]>;

  // Ingredients & Allergens
  getIngredients(): Promise<Ingredient[]>;
  getAllergens(): Promise<Allergen[]>;
  createIngredient(ingredient: InsertIngredient): Promise<Ingredient>;
  createAllergen(allergen: InsertAllergen): Promise<Allergen>;
  getIngredientsByMenuItemId(menuItemId: number): Promise<Ingredient[]>;
  getAllergensByMenuItemId(menuItemId: number): Promise<Allergen[]>;

  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderItems(items: InsertOrderItem[]): Promise<OrderItem[]>;
  getOrdersByChefId(chefId: number): Promise<OrderWithItems[]>;
  updateOrderStatus(orderId: number, status: string): Promise<Order | undefined>;

  // Seeding
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getChefs(): Promise<ChefProfileWithMenus[]> {
    const chefsData = await db.select().from(chefProfiles);
    
    const chefsWithMenus = await Promise.all(
      chefsData.map(async (chef) => {
        const menusData = await this.getMenusByChefId(chef.id);
        return { ...chef, menus: menusData };
      })
    );
    
    return chefsWithMenus;
  }

  async getChefBySlug(slug: string): Promise<ChefProfileWithMenus | undefined> {
    const [chef] = await db.select().from(chefProfiles).where(eq(chefProfiles.slug, slug));
    if (!chef) return undefined;
    
    const menusData = await this.getMenusByChefId(chef.id);
    return { ...chef, menus: menusData };
  }

  async getChefById(id: number): Promise<ChefProfile | undefined> {
    const [chef] = await db.select().from(chefProfiles).where(eq(chefProfiles.id, id));
    return chef || undefined;
  }

  async createChef(chef: InsertChefProfile): Promise<ChefProfile> {
    const [newChef] = await db.insert(chefProfiles).values(chef).returning();
    return newChef;
  }

  async getMenusByChefId(chefId: number): Promise<MenuWithDaySlots[]> {
    const menusData = await db.select().from(menus).where(eq(menus.chefId, chefId));
    
    const menusWithDaySlots = await Promise.all(
      menusData.map(async (menu) => {
        const daySlots = await this.getDaySlotsByMenuId(menu.id);
        return { ...menu, daySlots };
      })
    );
    
    return menusWithDaySlots;
  }

  async getMenuById(id: number): Promise<Menu | undefined> {
    const [menu] = await db.select().from(menus).where(eq(menus.id, id));
    return menu || undefined;
  }

  async createMenu(menu: InsertMenu): Promise<Menu> {
    const [newMenu] = await db.insert(menus).values(menu).returning();
    return newMenu;
  }

  async updateMenu(id: number, menu: Partial<InsertMenu>): Promise<Menu | undefined> {
    const [updated] = await db.update(menus).set(menu).where(eq(menus.id, id)).returning();
    return updated;
  }

  async deleteMenu(id: number): Promise<boolean> {
    const result = await db.delete(menus).where(eq(menus.id, id)).returning();
    return result.length > 0;
  }

  async getMenuItemById(id: number): Promise<MenuItemWithDetails | undefined> {
    const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    if (!item) return undefined;
    
    const ingredientsList = await this.getIngredientsByMenuItemId(id);
    const allergensList = await this.getAllergensByMenuItemId(id);
    
    return { ...item, ingredients: ingredientsList, allergens: allergensList };
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const [newItem] = await db.insert(menuItems).values(item).returning();
    return newItem;
  }

  async updateMenuItemStock(id: number, quantity: number): Promise<void> {
    await db.update(menuItems)
      .set({ stockQuantity: sql`${menuItems.stockQuantity} - ${quantity}` })
      .where(eq(menuItems.id, id));
  }

  async addItemIngredients(menuItemId: number, ingredientIds: number[]): Promise<void> {
    if (ingredientIds.length === 0) return;
    
    const values = ingredientIds.map((ingredientId) => ({
      menuItemId,
      ingredientId,
    }));
    
    await db.insert(itemIngredients).values(values).onConflictDoNothing();
  }

  async addItemAllergens(menuItemId: number, allergenIds: number[]): Promise<void> {
    if (allergenIds.length === 0) return;
    
    const values = allergenIds.map((allergenId) => ({
      menuItemId,
      allergenId,
    }));
    
    await db.insert(itemAllergens).values(values).onConflictDoNothing();
  }

  async clearItemIngredients(menuItemId: number): Promise<void> {
    await db.delete(itemIngredients).where(eq(itemIngredients.menuItemId, menuItemId));
  }

  async clearItemAllergens(menuItemId: number): Promise<void> {
    await db.delete(itemAllergens).where(eq(itemAllergens.menuItemId, menuItemId));
  }

  async getMenuItemsByChefId(chefId: number): Promise<MenuItemWithDetails[]> {
    const items = await db.select().from(menuItems).where(eq(menuItems.chefId, chefId));
    
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        const ingredientsList = await this.getIngredientsByMenuItemId(item.id);
        const allergensList = await this.getAllergensByMenuItemId(item.id);
        return { ...item, ingredients: ingredientsList, allergens: allergensList };
      })
    );
    
    return itemsWithDetails;
  }

  async updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const [updated] = await db.update(menuItems).set(item).where(eq(menuItems.id, id)).returning();
    return updated;
  }

  async deleteMenuItem(id: number): Promise<boolean> {
    const result = await db.delete(menuItems).where(eq(menuItems.id, id)).returning();
    return result.length > 0;
  }

  // Day Slot methods
  async getDaySlotsByMenuId(menuId: number): Promise<DaySlotWithItems[]> {
    const slots = await db.select().from(menuDaySlots).where(eq(menuDaySlots.menuId, menuId));
    
    const slotsWithItems = await Promise.all(
      slots.map(async (slot) => {
        const items = await this.getItemsForDaySlot(slot.id);
        return { ...slot, items };
      })
    );
    
    return slotsWithItems;
  }

  async getDaySlotById(id: number): Promise<MenuDaySlot | undefined> {
    const [slot] = await db.select().from(menuDaySlots).where(eq(menuDaySlots.id, id));
    return slot || undefined;
  }

  async createDaySlot(slot: InsertMenuDaySlot): Promise<MenuDaySlot> {
    const [newSlot] = await db.insert(menuDaySlots).values(slot).returning();
    return newSlot;
  }

  async updateDaySlot(id: number, slot: Partial<InsertMenuDaySlot>): Promise<MenuDaySlot | undefined> {
    const [updated] = await db.update(menuDaySlots).set(slot).where(eq(menuDaySlots.id, id)).returning();
    return updated;
  }

  async deleteDaySlot(id: number): Promise<boolean> {
    const result = await db.delete(menuDaySlots).where(eq(menuDaySlots.id, id)).returning();
    return result.length > 0;
  }

  // Item assignments to day slots
  async assignItemToDaySlot(daySlotId: number, menuItemId: number): Promise<void> {
    await db.insert(menuItemAssignments).values({ daySlotId, menuItemId }).onConflictDoNothing();
  }

  async removeItemFromDaySlot(daySlotId: number, menuItemId: number): Promise<void> {
    await db.delete(menuItemAssignments).where(
      and(
        eq(menuItemAssignments.daySlotId, daySlotId),
        eq(menuItemAssignments.menuItemId, menuItemId)
      )
    );
  }

  async getItemsForDaySlot(daySlotId: number): Promise<MenuItemWithDetails[]> {
    const result = await db
      .select({ menuItem: menuItems })
      .from(menuItemAssignments)
      .innerJoin(menuItems, eq(menuItemAssignments.menuItemId, menuItems.id))
      .where(eq(menuItemAssignments.daySlotId, daySlotId));
    
    const itemsWithDetails = await Promise.all(
      result.map(async (r) => {
        const ingredientsList = await this.getIngredientsByMenuItemId(r.menuItem.id);
        const allergensList = await this.getAllergensByMenuItemId(r.menuItem.id);
        return { ...r.menuItem, ingredients: ingredientsList, allergens: allergensList };
      })
    );
    
    return itemsWithDetails;
  }

  async getIngredients(): Promise<Ingredient[]> {
    return db.select().from(ingredients);
  }

  async getAllergens(): Promise<Allergen[]> {
    return db.select().from(allergens);
  }

  async createIngredient(ingredient: InsertIngredient): Promise<Ingredient> {
    const [newIngredient] = await db.insert(ingredients).values(ingredient).returning();
    return newIngredient;
  }

  async createAllergen(allergen: InsertAllergen): Promise<Allergen> {
    const [newAllergen] = await db.insert(allergens).values(allergen).returning();
    return newAllergen;
  }

  async getIngredientsByMenuItemId(menuItemId: number): Promise<Ingredient[]> {
    const result = await db
      .select({ ingredient: ingredients })
      .from(itemIngredients)
      .innerJoin(ingredients, eq(itemIngredients.ingredientId, ingredients.id))
      .where(eq(itemIngredients.menuItemId, menuItemId));
    
    return result.map((r) => r.ingredient);
  }

  async getAllergensByMenuItemId(menuItemId: number): Promise<Allergen[]> {
    const result = await db
      .select({ allergen: allergens })
      .from(itemAllergens)
      .innerJoin(allergens, eq(itemAllergens.allergenId, allergens.id))
      .where(eq(itemAllergens.menuItemId, menuItemId));
    
    return result.map((r) => r.allergen);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async createOrderItems(items: InsertOrderItem[]): Promise<OrderItem[]> {
    if (items.length === 0) return [];
    const newItems = await db.insert(orderItems).values(items).returning();
    return newItems;
  }

  async getOrdersByChefId(chefId: number): Promise<OrderWithItems[]> {
    const ordersData = await db.select().from(orders).where(eq(orders.chefId, chefId));
    
    const ordersWithItems = await Promise.all(
      ordersData.map(async (order) => {
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        const chef = await this.getChefById(order.chefId);
        return { ...order, items, chef };
      })
    );
    
    return ordersWithItems;
  }

  async updateOrderStatus(orderId: number, status: string): Promise<Order | undefined> {
    const [updated] = await db
      .update(orders)
      .set({ status: status as any })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async seedData(): Promise<void> {
    const existingChefs = await db.select().from(chefProfiles);
    if (existingChefs.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    console.log("Seeding database...");

    const allergensList = [
      { name: "Milk", icon: "milk" },
      { name: "Eggs", icon: "egg" },
      { name: "Fish", icon: "fish" },
      { name: "Shellfish", icon: "shrimp" },
      { name: "Tree Nuts", icon: "nut" },
      { name: "Peanuts", icon: "peanut" },
      { name: "Wheat", icon: "wheat" },
      { name: "Soy", icon: "soy" },
      { name: "Sesame", icon: "sesame" },
    ];

    const createdAllergens = await Promise.all(
      allergensList.map((a) => this.createAllergen(a))
    );

    const ingredientsList = [
      "Chicken", "Beef", "Pork", "Salmon", "Shrimp", "Tofu",
      "Rice", "Pasta", "Bread", "Potatoes", "Quinoa",
      "Tomatoes", "Onions", "Garlic", "Bell Peppers", "Spinach", "Broccoli", "Carrots",
      "Olive Oil", "Butter", "Cream", "Cheese", "Coconut Milk",
      "Basil", "Oregano", "Thyme", "Cumin", "Paprika", "Turmeric",
    ];

    const createdIngredients = await Promise.all(
      ingredientsList.map((name) => this.createIngredient({ name }))
    );

    const chef1 = await this.createChef({
      slug: "chef-maria",
      name: "Chef Maria Rodriguez",
      bio: "Bringing authentic Mexican flavors to your table. Family recipes passed down through generations, made with love and the freshest local ingredients.",
      cuisineTags: ["Mexican", "Latin American", "Vegetarian-Friendly"],
      locationLat: 40.7484,
      locationLong: -73.9967,
      locationName: "Chelsea, Manhattan",
      serviceRadius: 8,
      fulfillmentMethod: "both",
      deliveryFee: 5.99,
    });

    const chef2 = await this.createChef({
      slug: "chef-antonio",
      name: "Chef Antonio Russo",
      bio: "Italian home cooking at its finest. From fresh pasta to wood-fired pizzas, every dish is crafted with passion and tradition.",
      cuisineTags: ["Italian", "Mediterranean", "Pasta"],
      locationLat: 40.7282,
      locationLong: -73.9942,
      locationName: "East Village, Manhattan",
      serviceRadius: 6,
      fulfillmentMethod: "both",
      deliveryFee: 4.99,
    });

    const chef3 = await this.createChef({
      slug: "chef-mei-lin",
      name: "Chef Mei Lin",
      bio: "Fusion cuisine blending Asian traditions with modern techniques. Healthy, flavorful, and beautifully presented dishes for any occasion.",
      cuisineTags: ["Asian Fusion", "Japanese", "Thai", "Healthy"],
      locationLat: 40.7193,
      locationLong: -73.9951,
      locationName: "Lower East Side, Manhattan",
      serviceRadius: 7,
      fulfillmentMethod: "delivery",
      deliveryFee: 6.99,
    });

    const menu1 = await this.createMenu({
      chefId: chef1.id,
      title: "Week of February 3rd",
      description: "Fresh winter menu featuring hearty Mexican comfort food",
      status: "active",
      startDate: new Date("2026-02-03"),
      endDate: new Date("2026-02-09"),
    });

    // Create day slots for menu1 (multiple days in the week)
    const daySlot1_1 = await this.createDaySlot({
      menuId: menu1.id,
      date: new Date("2026-02-05"),
      orderCutoffDate: new Date("2026-02-04"),
    });
    const daySlot1_2 = await this.createDaySlot({
      menuId: menu1.id,
      date: new Date("2026-02-07"),
      orderCutoffDate: new Date("2026-02-06"),
    });

    const menu2 = await this.createMenu({
      chefId: chef2.id,
      title: "Sunday Feast Menu",
      description: "Traditional Italian family-style dishes",
      status: "active",
      startDate: new Date("2026-02-03"),
      endDate: new Date("2026-02-09"),
    });

    // Create day slot for menu2
    const daySlot2 = await this.createDaySlot({
      menuId: menu2.id,
      date: new Date("2026-02-08"),
      orderCutoffDate: new Date("2026-02-06"),
    });

    const menu3 = await this.createMenu({
      chefId: chef3.id,
      title: "Lunar New Year Special",
      description: "Celebrate with authentic Asian flavors",
      status: "active",
      startDate: new Date("2026-02-03"),
      endDate: new Date("2026-02-09"),
    });

    // Create day slots for menu3
    const daySlot3_1 = await this.createDaySlot({
      menuId: menu3.id,
      date: new Date("2026-02-06"),
      orderCutoffDate: new Date("2026-02-04"),
    });
    const daySlot3_2 = await this.createDaySlot({
      menuId: menu3.id,
      date: new Date("2026-02-08"),
      orderCutoffDate: new Date("2026-02-06"),
    });

    const findAllergen = (name: string) => createdAllergens.find((a) => a.name === name)?.id || 0;
    const findIngredient = (name: string) => createdIngredients.find((i) => i.name === name)?.id || 0;

    // Chef 1's items
    const item1 = await this.createMenuItem({
      chefId: chef1.id,
      title: "Chicken Enchiladas Verdes",
      description: "Tender shredded chicken wrapped in corn tortillas, smothered in tangy tomatillo salsa verde and melted cheese. Served with rice and beans.",
      price: 16.99,
      stockQuantity: 20,
      unitType: "per meal",
    });
    await this.addItemAllergens(item1.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item1.id, [findIngredient("Chicken"), findIngredient("Cheese"), findIngredient("Onions"), findIngredient("Rice")]);
    await this.assignItemToDaySlot(daySlot1_1.id, item1.id);
    await this.assignItemToDaySlot(daySlot1_2.id, item1.id);

    const item2 = await this.createMenuItem({
      chefId: chef1.id,
      title: "Vegetarian Tamales",
      description: "Handmade masa tamales filled with roasted poblano peppers and queso fresco, wrapped in corn husks.",
      price: 14.99,
      stockQuantity: 15,
      unitType: "per dozen",
    });
    await this.addItemAllergens(item2.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item2.id, [findIngredient("Cheese"), findIngredient("Bell Peppers")]);
    await this.assignItemToDaySlot(daySlot1_1.id, item2.id);

    const item3 = await this.createMenuItem({
      chefId: chef1.id,
      title: "Carnitas Taco Platter",
      description: "Slow-braised pork carnitas with pickled onions, fresh cilantro, and homemade salsa. Includes 6 tacos.",
      price: 18.99,
      stockQuantity: 12,
      unitType: "per platter",
    });
    await this.addItemIngredients(item3.id, [findIngredient("Pork"), findIngredient("Onions"), findIngredient("Garlic")]);
    await this.assignItemToDaySlot(daySlot1_2.id, item3.id);

    // Chef 2's items
    const item4 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Homemade Lasagna",
      description: "Layers of fresh pasta, rich beef bolognese, creamy bechamel, and aged parmesan. A family recipe perfected over generations.",
      price: 24.99,
      stockQuantity: 8,
      unitType: "per tray",
    });
    await this.addItemAllergens(item4.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item4.id, [findIngredient("Beef"), findIngredient("Pasta"), findIngredient("Cheese"), findIngredient("Tomatoes")]);
    await this.assignItemToDaySlot(daySlot2.id, item4.id);

    const item5 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Fresh Fettuccine Alfredo",
      description: "Hand-cut fettuccine in a velvety parmesan cream sauce with fresh cracked pepper.",
      price: 17.99,
      stockQuantity: 18,
      unitType: "per meal",
    });
    await this.addItemAllergens(item5.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item5.id, [findIngredient("Pasta"), findIngredient("Butter"), findIngredient("Cream"), findIngredient("Cheese")]);
    await this.assignItemToDaySlot(daySlot2.id, item5.id);

    const item6 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Chicken Parmesan",
      description: "Crispy breaded chicken cutlet topped with marinara and melted mozzarella, served over spaghetti.",
      price: 19.99,
      stockQuantity: 15,
      unitType: "per meal",
    });
    await this.addItemAllergens(item6.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item6.id, [findIngredient("Chicken"), findIngredient("Pasta"), findIngredient("Tomatoes"), findIngredient("Cheese")]);
    await this.assignItemToDaySlot(daySlot2.id, item6.id);

    const item7 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Tiramisu",
      description: "Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream.",
      price: 9.99,
      stockQuantity: 20,
      unitType: "per piece",
    });
    await this.addItemAllergens(item7.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.assignItemToDaySlot(daySlot2.id, item7.id);

    // Chef 3's items
    const item8 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Teriyaki Salmon Bowl",
      description: "Glazed salmon over jasmine rice with pickled vegetables, edamame, and sesame seeds.",
      price: 21.99,
      stockQuantity: 12,
      unitType: "per meal",
    });
    await this.addItemAllergens(item8.id, [findAllergen("Fish"), findAllergen("Soy"), findAllergen("Sesame")]);
    await this.addItemIngredients(item8.id, [findIngredient("Salmon"), findIngredient("Rice"), findIngredient("Carrots")]);
    await this.assignItemToDaySlot(daySlot3_1.id, item8.id);
    await this.assignItemToDaySlot(daySlot3_2.id, item8.id);

    const item9 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Pad Thai",
      description: "Stir-fried rice noodles with shrimp, tofu, bean sprouts, and crushed peanuts in tamarind sauce.",
      price: 16.99,
      stockQuantity: 20,
      unitType: "per meal",
    });
    await this.addItemAllergens(item9.id, [findAllergen("Shellfish"), findAllergen("Peanuts"), findAllergen("Soy"), findAllergen("Eggs")]);
    await this.addItemIngredients(item9.id, [findIngredient("Shrimp"), findIngredient("Tofu"), findIngredient("Rice")]);
    await this.assignItemToDaySlot(daySlot3_1.id, item9.id);

    const item10 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Thai Green Curry",
      description: "Aromatic coconut curry with vegetables and your choice of chicken or tofu. Served with jasmine rice.",
      price: 17.99,
      stockQuantity: 18,
      unitType: "per meal",
    });
    await this.addItemAllergens(item10.id, [findAllergen("Soy")]);
    await this.addItemIngredients(item10.id, [findIngredient("Chicken"), findIngredient("Coconut Milk"), findIngredient("Rice"), findIngredient("Broccoli")]);
    await this.assignItemToDaySlot(daySlot3_1.id, item10.id);
    await this.assignItemToDaySlot(daySlot3_2.id, item10.id);

    const item11 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Vegetable Spring Rolls",
      description: "Crispy fried spring rolls filled with cabbage, carrots, and glass noodles. Served with sweet chili sauce.",
      price: 8.99,
      stockQuantity: 30,
      unitType: "per piece",
    });
    await this.addItemAllergens(item11.id, [findAllergen("Wheat"), findAllergen("Soy")]);
    await this.addItemIngredients(item11.id, [findIngredient("Carrots")]);
    await this.assignItemToDaySlot(daySlot3_2.id, item11.id);

    const item12 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Miso Glazed Tofu Bowl",
      description: "Crispy tofu with miso glaze, quinoa, roasted vegetables, and ginger dressing. Vegan and gluten-free.",
      price: 15.99,
      stockQuantity: 15,
      unitType: "per meal",
    });
    await this.addItemAllergens(item12.id, [findAllergen("Soy")]);
    await this.addItemIngredients(item12.id, [findIngredient("Tofu"), findIngredient("Quinoa"), findIngredient("Broccoli"), findIngredient("Carrots")]);
    await this.assignItemToDaySlot(daySlot3_1.id, item12.id);
    await this.assignItemToDaySlot(daySlot3_2.id, item12.id);

    console.log("Database seeded successfully!");
  }
}

export const storage = new DatabaseStorage();
