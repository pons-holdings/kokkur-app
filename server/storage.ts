import { 
  chefProfiles, menus, menuDaySlots, menuItems, menuItemAssignments, ingredients, allergens,
  itemIngredients, itemAllergens, orders, orderItems, userFavorites,
  servingOptions, itemPhotos, ingredientAllergens, assignmentServingOptions,
  type ChefProfile, type InsertChefProfile,
  type Menu, type InsertMenu,
  type MenuDaySlot, type InsertMenuDaySlot,
  type MenuItem, type InsertMenuItem,
  type MenuItemAssignment, type InsertMenuItemAssignment,
  type AssignmentServingOption, type InsertAssignmentServingOption,
  type Ingredient, type InsertIngredient,
  type Allergen, type InsertAllergen,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type InsertItemIngredient, type InsertItemAllergen,
  type ServingOption, type InsertServingOption,
  type ItemPhoto, type InsertItemPhoto,
  type IngredientWithAllergens,
  type MenuItemWithDetails, type MenuItemWithAssignment, type DaySlotWithItems, type MenuWithDaySlots, type ChefProfileWithDaySlots, type OrderWithItems,
  type AssignedServingOptionWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // Chefs
  getChefs(): Promise<ChefProfileWithDaySlots[]>;
  getChefBySlug(slug: string): Promise<ChefProfileWithDaySlots | undefined>;
  getChefById(id: number): Promise<ChefProfile | undefined>;
  createChef(chef: InsertChefProfile): Promise<ChefProfile>;

  // Menus
  getMenusByChefId(chefId: number): Promise<MenuWithDaySlots[]>;
  getMenuById(id: number): Promise<Menu | undefined>;
  createMenu(menu: InsertMenu): Promise<Menu>;
  updateMenu(id: number, menu: Partial<InsertMenu>): Promise<Menu | undefined>;
  deleteMenu(id: number): Promise<boolean>;

  // Day Slots (belong directly to chef)
  getDaySlotsByChefId(chefId: number): Promise<DaySlotWithItems[]>;
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
  addItemIngredients(menuItemId: number, ingredientIds: number[]): Promise<void>;
  addItemAllergens(menuItemId: number, allergenIds: number[]): Promise<void>;
  clearItemIngredients(menuItemId: number): Promise<void>;
  clearItemAllergens(menuItemId: number): Promise<void>;

  // Serving Options
  getServingOptionsByMenuItemId(menuItemId: number): Promise<ServingOption[]>;
  createServingOption(option: InsertServingOption): Promise<ServingOption>;
  updateServingOption(id: number, option: Partial<InsertServingOption>): Promise<ServingOption | undefined>;
  deleteServingOption(id: number): Promise<boolean>;
  clearServingOptions(menuItemId: number): Promise<void>;

  // Item Photos
  getPhotosByMenuItemId(menuItemId: number): Promise<ItemPhoto[]>;
  createItemPhoto(photo: InsertItemPhoto): Promise<ItemPhoto>;
  updateItemPhoto(id: number, photo: Partial<InsertItemPhoto>): Promise<ItemPhoto | undefined>;
  deleteItemPhoto(id: number): Promise<boolean>;
  setCoverPhoto(menuItemId: number, photoId: number): Promise<void>;

  // Day Slot-Item Assignments (many-to-many)
  assignItemToDaySlot(daySlotId: number, menuItemId: number): Promise<MenuItemAssignment>;
  removeItemFromDaySlot(daySlotId: number, menuItemId: number): Promise<void>;
  getItemsForDaySlot(daySlotId: number): Promise<MenuItemWithAssignment[]>;
  getAssignmentForDaySlot(daySlotId: number, menuItemId: number): Promise<MenuItemAssignment | undefined>;
  
  // Assignment Serving Options (per-serving-size stock tracking)
  addAssignmentServingOption(assignmentId: number, servingOptionId: number, stockLimited?: boolean, stockQuantity?: number): Promise<AssignmentServingOption>;
  updateAssignmentServingOption(id: number, stockLimited: boolean, stockQuantity?: number): Promise<void>;
  removeAssignmentServingOption(id: number): Promise<void>;
  getAssignmentServingOptions(assignmentId: number): Promise<AssignedServingOptionWithDetails[]>;

  // Ingredients & Allergens
  getIngredients(): Promise<Ingredient[]>;
  searchIngredients(query: string): Promise<Ingredient[]>;
  getAllergens(): Promise<Allergen[]>;
  createIngredient(ingredient: InsertIngredient): Promise<Ingredient>;
  createAllergen(allergen: InsertAllergen): Promise<Allergen>;
  getIngredientsByMenuItemId(menuItemId: number): Promise<Ingredient[]>;
  getAllergensByMenuItemId(menuItemId: number): Promise<Allergen[]>;
  getIngredientsWithAllergens(): Promise<IngredientWithAllergens[]>;
  getIngredientWithAllergens(id: number): Promise<IngredientWithAllergens | undefined>;
  addIngredientAllergen(ingredientId: number, allergenId: number): Promise<void>;
  removeIngredientAllergen(ingredientId: number, allergenId: number): Promise<void>;
  getAllergensByIngredientId(ingredientId: number): Promise<Allergen[]>;

  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderItems(items: InsertOrderItem[]): Promise<OrderItem[]>;
  getOrdersByChefId(chefId: number): Promise<OrderWithItems[]>;
  updateOrderStatus(orderId: number, status: string): Promise<Order | undefined>;

  // Seeding
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getChefs(): Promise<ChefProfileWithDaySlots[]> {
    const chefsData = await db.select().from(chefProfiles);
    
    const chefsWithDaySlots = await Promise.all(
      chefsData.map(async (chef) => {
        const daySlotsData = await this.getDaySlotsByChefId(chef.id);
        return { ...chef, daySlots: daySlotsData };
      })
    );
    
    return chefsWithDaySlots;
  }

  async getChefBySlug(slug: string): Promise<ChefProfileWithDaySlots | undefined> {
    const [chef] = await db.select().from(chefProfiles).where(eq(chefProfiles.slug, slug));
    if (!chef) return undefined;
    
    const daySlotsData = await this.getDaySlotsByChefId(chef.id);
    return { ...chef, daySlots: daySlotsData };
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
    // Menus are deprecated - day slots now belong directly to chefs
    // This method is kept for backwards compatibility but returns menus without day slots
    const menusData = await db.select().from(menus).where(eq(menus.chefId, chefId));
    return menusData.map((menu) => ({ ...menu, daySlots: [] }));
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
    const servingOptionsList = await this.getServingOptionsByMenuItemId(id);
    const photosList = await this.getPhotosByMenuItemId(id);
    const coverPhotoObj = photosList.find(p => p.isCover === 1);
    
    return { 
      ...item, 
      ingredients: ingredientsList, 
      allergens: allergensList,
      servingOptions: servingOptionsList,
      photos: photosList,
      coverPhoto: coverPhotoObj?.imageUrl
    };
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const [newItem] = await db.insert(menuItems).values(item).returning();
    return newItem;
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
        const servingOptionsList = await this.getServingOptionsByMenuItemId(item.id);
        const photosList = await this.getPhotosByMenuItemId(item.id);
        const coverPhotoObj = photosList.find(p => p.isCover === 1);
        return { 
          ...item, 
          ingredients: ingredientsList, 
          allergens: allergensList,
          servingOptions: servingOptionsList,
          photos: photosList,
          coverPhoto: coverPhotoObj?.imageUrl
        };
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

  // Day Slot methods (belong directly to chef)
  async getDaySlotsByChefId(chefId: number): Promise<DaySlotWithItems[]> {
    const slots = await db.select().from(menuDaySlots).where(eq(menuDaySlots.chefId, chefId));
    
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
  async assignItemToDaySlot(daySlotId: number, menuItemId: number): Promise<MenuItemAssignment> {
    const [assignment] = await db.insert(menuItemAssignments).values({ 
      daySlotId, 
      menuItemId
    }).returning();
    return assignment;
  }

  async getAssignmentForDaySlot(daySlotId: number, menuItemId: number): Promise<MenuItemAssignment | undefined> {
    const [assignment] = await db.select().from(menuItemAssignments)
      .where(
        and(
          eq(menuItemAssignments.daySlotId, daySlotId),
          eq(menuItemAssignments.menuItemId, menuItemId)
        )
      );
    return assignment || undefined;
  }
  
  // Assignment Serving Options
  async addAssignmentServingOption(assignmentId: number, servingOptionId: number, stockLimited?: boolean, stockQuantity?: number): Promise<AssignmentServingOption> {
    const [option] = await db.insert(assignmentServingOptions).values({
      assignmentId,
      servingOptionId,
      stockLimited: stockLimited ? 1 : 0,
      stockQuantity: stockQuantity ?? null
    }).returning();
    return option;
  }
  
  async updateAssignmentServingOption(id: number, stockLimited: boolean, stockQuantity?: number): Promise<void> {
    await db.update(assignmentServingOptions)
      .set({
        stockLimited: stockLimited ? 1 : 0,
        stockQuantity: stockQuantity ?? null
      })
      .where(eq(assignmentServingOptions.id, id));
  }
  
  async removeAssignmentServingOption(id: number): Promise<void> {
    await db.delete(assignmentServingOptions).where(eq(assignmentServingOptions.id, id));
  }
  
  async getAssignmentServingOptions(assignmentId: number): Promise<AssignedServingOptionWithDetails[]> {
    const result = await db
      .select({ 
        assignmentServingOption: assignmentServingOptions,
        servingOption: servingOptions
      })
      .from(assignmentServingOptions)
      .innerJoin(servingOptions, eq(assignmentServingOptions.servingOptionId, servingOptions.id))
      .where(eq(assignmentServingOptions.assignmentId, assignmentId));
    
    return result.map(r => ({
      ...r.assignmentServingOption,
      servingOption: r.servingOption
    }));
  }

  async removeItemFromDaySlot(daySlotId: number, menuItemId: number): Promise<void> {
    await db.delete(menuItemAssignments).where(
      and(
        eq(menuItemAssignments.daySlotId, daySlotId),
        eq(menuItemAssignments.menuItemId, menuItemId)
      )
    );
  }

  async getItemsForDaySlot(daySlotId: number): Promise<MenuItemWithAssignment[]> {
    const result = await db
      .select({ menuItem: menuItems, assignment: menuItemAssignments })
      .from(menuItemAssignments)
      .innerJoin(menuItems, eq(menuItemAssignments.menuItemId, menuItems.id))
      .where(eq(menuItemAssignments.daySlotId, daySlotId));
    
    const itemsWithDetails = await Promise.all(
      result.map(async (r) => {
        const ingredientsList = await this.getIngredientsByMenuItemId(r.menuItem.id);
        const allergensList = await this.getAllergensByMenuItemId(r.menuItem.id);
        const servingOptionsList = await this.getServingOptionsByMenuItemId(r.menuItem.id);
        const photosList = await this.getPhotosByMenuItemId(r.menuItem.id);
        const coverPhotoObj = photosList.find(p => p.isCover === 1);
        const assignedServingOptionsList = await this.getAssignmentServingOptions(r.assignment.id);
        return { 
          ...r.menuItem, 
          ingredients: ingredientsList, 
          allergens: allergensList,
          servingOptions: servingOptionsList,
          photos: photosList,
          coverPhoto: coverPhotoObj?.imageUrl,
          assignmentId: r.assignment.id,
          assignedServingOptions: assignedServingOptionsList
        };
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

  // Serving Options
  async getServingOptionsByMenuItemId(menuItemId: number): Promise<ServingOption[]> {
    return db.select().from(servingOptions).where(eq(servingOptions.menuItemId, menuItemId));
  }

  async createServingOption(option: InsertServingOption): Promise<ServingOption> {
    const [newOption] = await db.insert(servingOptions).values(option).returning();
    return newOption;
  }

  async updateServingOption(id: number, option: Partial<InsertServingOption>): Promise<ServingOption | undefined> {
    const [updated] = await db.update(servingOptions).set(option).where(eq(servingOptions.id, id)).returning();
    return updated;
  }

  async deleteServingOption(id: number): Promise<boolean> {
    const result = await db.delete(servingOptions).where(eq(servingOptions.id, id)).returning();
    return result.length > 0;
  }

  async clearServingOptions(menuItemId: number): Promise<void> {
    await db.delete(servingOptions).where(eq(servingOptions.menuItemId, menuItemId));
  }

  // Item Photos
  async getPhotosByMenuItemId(menuItemId: number): Promise<ItemPhoto[]> {
    return db.select().from(itemPhotos).where(eq(itemPhotos.menuItemId, menuItemId));
  }

  async createItemPhoto(photo: InsertItemPhoto): Promise<ItemPhoto> {
    const [newPhoto] = await db.insert(itemPhotos).values(photo).returning();
    return newPhoto;
  }

  async updateItemPhoto(id: number, photo: Partial<InsertItemPhoto>): Promise<ItemPhoto | undefined> {
    const [updated] = await db.update(itemPhotos).set(photo).where(eq(itemPhotos.id, id)).returning();
    return updated;
  }

  async deleteItemPhoto(id: number): Promise<boolean> {
    const result = await db.delete(itemPhotos).where(eq(itemPhotos.id, id)).returning();
    return result.length > 0;
  }

  async setCoverPhoto(menuItemId: number, photoId: number): Promise<void> {
    // First, unset all cover photos for this item
    await db.update(itemPhotos)
      .set({ isCover: 0 })
      .where(eq(itemPhotos.menuItemId, menuItemId));
    // Then set the specified photo as cover
    await db.update(itemPhotos)
      .set({ isCover: 1 })
      .where(eq(itemPhotos.id, photoId));
  }

  // Ingredient search
  async searchIngredients(query: string): Promise<Ingredient[]> {
    if (!query.trim()) return this.getIngredients();
    return db.select().from(ingredients).where(ilike(ingredients.name, `%${query}%`));
  }

  // Ingredient-Allergen mappings
  async getIngredientsWithAllergens(): Promise<IngredientWithAllergens[]> {
    const allIngredients = await db.select().from(ingredients);
    const ingredientsWithAllergens = await Promise.all(
      allIngredients.map(async (ingredient) => {
        const allergensList = await this.getAllergensByIngredientId(ingredient.id);
        return { ...ingredient, allergens: allergensList };
      })
    );
    return ingredientsWithAllergens;
  }

  async getIngredientWithAllergens(id: number): Promise<IngredientWithAllergens | undefined> {
    const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, id));
    if (!ingredient) return undefined;
    const allergensList = await this.getAllergensByIngredientId(id);
    return { ...ingredient, allergens: allergensList };
  }

  async getAllergensByIngredientId(ingredientId: number): Promise<Allergen[]> {
    const result = await db
      .select({ allergen: allergens })
      .from(ingredientAllergens)
      .innerJoin(allergens, eq(ingredientAllergens.allergenId, allergens.id))
      .where(eq(ingredientAllergens.ingredientId, ingredientId));
    return result.map((r) => r.allergen);
  }

  async addIngredientAllergen(ingredientId: number, allergenId: number): Promise<void> {
    await db.insert(ingredientAllergens).values({ ingredientId, allergenId }).onConflictDoNothing();
  }

  async removeIngredientAllergen(ingredientId: number, allergenId: number): Promise<void> {
    await db.delete(ingredientAllergens).where(
      and(
        eq(ingredientAllergens.ingredientId, ingredientId),
        eq(ingredientAllergens.allergenId, allergenId)
      )
    );
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

    // FDA Big 9 Allergens + additional common allergens
    const allergensList = [
      { name: "Milk", icon: "milk", description: "Includes all dairy from cows, goats, sheep (casein, whey, lactose)" },
      { name: "Eggs", icon: "egg", description: "All forms of chicken eggs" },
      { name: "Fish", icon: "fish", description: "All finned fish species (salmon, tuna, cod, etc.)" },
      { name: "Shellfish", icon: "shrimp", description: "Crustaceans: crab, lobster, shrimp (not mollusks)" },
      { name: "Tree Nuts", icon: "nut", description: "Almonds, walnuts, pecans, cashews, pistachios, hazelnuts, pine nuts" },
      { name: "Peanuts", icon: "peanut", description: "A legume (not a tree nut)" },
      { name: "Wheat", icon: "wheat", description: "All species of genus Triticum" },
      { name: "Soy", icon: "soy", description: "Tofu, soy sauce, soy milk, edamame, soy lecithin" },
      { name: "Sesame", icon: "sesame", description: "Tahini, sesame oil, sesame seeds (added to FDA list 2023)" },
      { name: "Gluten", icon: "wheat", description: "Found in wheat, barley, rye, and their derivatives" },
      { name: "Mustard", icon: "leaf", description: "Common allergen in EU regulations" },
      { name: "Celery", icon: "leaf", description: "Common allergen in EU regulations" },
      { name: "Lupin", icon: "flower", description: "Legume commonly used in flour" },
      { name: "Mollusks", icon: "shell", description: "Oysters, clams, mussels, squid, octopus" },
      { name: "Sulfites", icon: "flask", description: "Preservatives in wine, dried fruits" },
    ];

    const createdAllergens = await Promise.all(
      allergensList.map((a) => this.createAllergen(a))
    );

    const ingredientsList = [
      // Proteins
      "Chicken", "Beef", "Pork", "Salmon", "Shrimp", "Tofu", "Eggs", "Tuna", "Cod", "Crab", "Lobster", "Scallops", "Mussels", "Clams", "Oysters", "Squid", "Octopus", "Turkey", "Duck", "Lamb",
      // Grains & Starches
      "Rice", "Pasta", "Bread", "Potatoes", "Quinoa", "Flour", "Breadcrumbs", "Couscous", "Barley", "Oats", "Noodles", "Tortillas", "Corn",
      // Vegetables
      "Tomatoes", "Onions", "Garlic", "Bell Peppers", "Spinach", "Broccoli", "Carrots", "Celery", "Mushrooms", "Zucchini", "Eggplant", "Cabbage", "Lettuce", "Kale", "Asparagus", "Green Beans", "Peas",
      // Dairy & Eggs
      "Butter", "Cream", "Cheese", "Milk", "Yogurt", "Sour Cream", "Cream Cheese", "Parmesan", "Mozzarella", "Ricotta", "Mascarpone", "Whey Protein", "Ghee",
      // Oils & Fats
      "Olive Oil", "Vegetable Oil", "Sesame Oil", "Coconut Oil", "Peanut Oil",
      // Nuts & Seeds
      "Almonds", "Walnuts", "Cashews", "Peanuts", "Pistachios", "Pine Nuts", "Hazelnuts", "Pecans", "Macadamia Nuts", "Sesame Seeds", "Sunflower Seeds", "Pumpkin Seeds", "Tahini", "Almond Butter", "Peanut Butter",
      // Soy Products
      "Soy Sauce", "Miso", "Edamame", "Tempeh", "Soy Milk",
      // Other
      "Coconut Milk", "Coconut", "Honey", "Maple Syrup",
      // Herbs & Spices
      "Basil", "Oregano", "Thyme", "Cumin", "Paprika", "Turmeric", "Ginger", "Cilantro", "Parsley", "Rosemary", "Mustard", "Mustard Seed",
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

    // Create day slots directly for chefs (calendar-based architecture)
    const daySlot1_1 = await this.createDaySlot({
      chefId: chef1.id,
      date: new Date("2026-02-05"),
      orderCutoffDate: new Date("2026-02-04"),
    });
    const daySlot1_2 = await this.createDaySlot({
      chefId: chef1.id,
      date: new Date("2026-02-07"),
      orderCutoffDate: new Date("2026-02-06"),
    });

    const daySlot2 = await this.createDaySlot({
      chefId: chef2.id,
      date: new Date("2026-02-08"),
      orderCutoffDate: new Date("2026-02-06"),
    });

    const daySlot3_1 = await this.createDaySlot({
      chefId: chef3.id,
      date: new Date("2026-02-06"),
      orderCutoffDate: new Date("2026-02-04"),
    });
    const daySlot3_2 = await this.createDaySlot({
      chefId: chef3.id,
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
    });
    await this.createServingOption({ menuItemId: item1.id, servingSize: 1, label: "1 serving", price: 16.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item1.id, servingSize: 2, label: "2 servings", price: 29.99, isDefault: 0 });
    await this.addItemAllergens(item1.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item1.id, [findIngredient("Chicken"), findIngredient("Cheese"), findIngredient("Onions"), findIngredient("Rice")]);
    await this.createItemPhoto({ menuItemId: item1.id, imageUrl: "/images/dishes/enchiladas-verdes.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot1_1.id, item1.id);
    await this.assignItemToDaySlot(daySlot1_2.id, item1.id);

    const item2 = await this.createMenuItem({
      chefId: chef1.id,
      title: "Vegetarian Tamales",
      description: "Handmade masa tamales filled with roasted poblano peppers and queso fresco, wrapped in corn husks.",
    });
    await this.createServingOption({ menuItemId: item2.id, servingSize: 6, label: "Half dozen", price: 14.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item2.id, servingSize: 12, label: "Full dozen", price: 26.99, isDefault: 0 });
    await this.addItemAllergens(item2.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item2.id, [findIngredient("Cheese"), findIngredient("Bell Peppers")]);
    await this.createItemPhoto({ menuItemId: item2.id, imageUrl: "/images/dishes/tamales.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot1_1.id, item2.id);

    const item3 = await this.createMenuItem({
      chefId: chef1.id,
      title: "Carnitas Taco Platter",
      description: "Slow-braised pork carnitas with pickled onions, fresh cilantro, and homemade salsa. Includes 6 tacos.",
    });
    await this.createServingOption({ menuItemId: item3.id, servingSize: 1, label: "6 tacos", price: 18.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item3.id, servingSize: 2, label: "12 tacos (party size)", price: 34.99, isDefault: 0 });
    await this.addItemIngredients(item3.id, [findIngredient("Pork"), findIngredient("Onions"), findIngredient("Garlic")]);
    await this.createItemPhoto({ menuItemId: item3.id, imageUrl: "/images/dishes/carnitas-tacos.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot1_2.id, item3.id);

    // Chef 2's items
    const item4 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Homemade Lasagna",
      description: "Layers of fresh pasta, rich beef bolognese, creamy bechamel, and aged parmesan. A family recipe perfected over generations.",
    });
    await this.createServingOption({ menuItemId: item4.id, servingSize: 2, label: "Half tray (2-3 servings)", price: 24.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item4.id, servingSize: 4, label: "Full tray (4-6 servings)", price: 44.99, isDefault: 0 });
    await this.addItemAllergens(item4.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item4.id, [findIngredient("Beef"), findIngredient("Pasta"), findIngredient("Cheese"), findIngredient("Tomatoes")]);
    await this.createItemPhoto({ menuItemId: item4.id, imageUrl: "/images/dishes/lasagna.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot2.id, item4.id);

    const item5 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Fresh Fettuccine Alfredo",
      description: "Hand-cut fettuccine in a velvety parmesan cream sauce with fresh cracked pepper.",
    });
    await this.createServingOption({ menuItemId: item5.id, servingSize: 1, label: "1 serving", price: 17.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item5.id, servingSize: 2, label: "2 servings", price: 32.99, isDefault: 0 });
    await this.addItemAllergens(item5.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item5.id, [findIngredient("Pasta"), findIngredient("Butter"), findIngredient("Cream"), findIngredient("Cheese")]);
    await this.createItemPhoto({ menuItemId: item5.id, imageUrl: "/images/dishes/fettuccine-alfredo.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot2.id, item5.id);

    const item6 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Chicken Parmesan",
      description: "Crispy breaded chicken cutlet topped with marinara and melted mozzarella, served over spaghetti.",
    });
    await this.createServingOption({ menuItemId: item6.id, servingSize: 1, label: "1 serving", price: 19.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item6.id, servingSize: 4, label: "Family size (4 servings)", price: 69.99, isDefault: 0 });
    await this.addItemAllergens(item6.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item6.id, [findIngredient("Chicken"), findIngredient("Pasta"), findIngredient("Tomatoes"), findIngredient("Cheese")]);
    await this.createItemPhoto({ menuItemId: item6.id, imageUrl: "/images/dishes/chicken-parmesan.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot2.id, item6.id);

    const item7 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Tiramisu",
      description: "Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream.",
    });
    await this.createServingOption({ menuItemId: item7.id, servingSize: 1, label: "1 slice", price: 9.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item7.id, servingSize: 6, label: "Whole cake (6-8 slices)", price: 49.99, isDefault: 0 });
    await this.addItemAllergens(item7.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.createItemPhoto({ menuItemId: item7.id, imageUrl: "/images/dishes/tiramisu.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot2.id, item7.id);

    // Chef 3's items
    const item8 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Teriyaki Salmon Bowl",
      description: "Glazed salmon over jasmine rice with pickled vegetables, edamame, and sesame seeds.",
    });
    await this.createServingOption({ menuItemId: item8.id, servingSize: 1, label: "1 bowl", price: 21.99, isDefault: 1 });
    await this.addItemAllergens(item8.id, [findAllergen("Fish"), findAllergen("Soy"), findAllergen("Sesame")]);
    await this.addItemIngredients(item8.id, [findIngredient("Salmon"), findIngredient("Rice"), findIngredient("Carrots")]);
    await this.createItemPhoto({ menuItemId: item8.id, imageUrl: "/images/dishes/teriyaki-salmon.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot3_1.id, item8.id);
    await this.assignItemToDaySlot(daySlot3_2.id, item8.id);

    const item9 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Pad Thai",
      description: "Stir-fried rice noodles with shrimp, tofu, bean sprouts, and crushed peanuts in tamarind sauce.",
    });
    await this.createServingOption({ menuItemId: item9.id, servingSize: 1, label: "1 serving", price: 16.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item9.id, servingSize: 2, label: "2 servings", price: 30.99, isDefault: 0 });
    await this.addItemAllergens(item9.id, [findAllergen("Shellfish"), findAllergen("Peanuts"), findAllergen("Soy"), findAllergen("Eggs")]);
    await this.addItemIngredients(item9.id, [findIngredient("Shrimp"), findIngredient("Tofu"), findIngredient("Rice")]);
    await this.createItemPhoto({ menuItemId: item9.id, imageUrl: "/images/dishes/pad-thai.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot3_1.id, item9.id);

    const item10 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Thai Green Curry",
      description: "Aromatic coconut curry with vegetables and your choice of chicken or tofu. Served with jasmine rice.",
    });
    await this.createServingOption({ menuItemId: item10.id, servingSize: 1, label: "1 serving", price: 17.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item10.id, servingSize: 4, label: "Family size (4 servings)", price: 59.99, isDefault: 0 });
    await this.addItemAllergens(item10.id, [findAllergen("Soy")]);
    await this.addItemIngredients(item10.id, [findIngredient("Chicken"), findIngredient("Coconut Milk"), findIngredient("Rice"), findIngredient("Broccoli")]);
    await this.createItemPhoto({ menuItemId: item10.id, imageUrl: "/images/dishes/green-curry.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot3_1.id, item10.id);
    await this.assignItemToDaySlot(daySlot3_2.id, item10.id);

    const item11 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Vegetable Spring Rolls",
      description: "Crispy fried spring rolls filled with cabbage, carrots, and glass noodles. Served with sweet chili sauce.",
    });
    await this.createServingOption({ menuItemId: item11.id, servingSize: 4, label: "4 pieces", price: 8.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item11.id, servingSize: 8, label: "8 pieces", price: 15.99, isDefault: 0 });
    await this.addItemAllergens(item11.id, [findAllergen("Wheat"), findAllergen("Soy")]);
    await this.addItemIngredients(item11.id, [findIngredient("Carrots")]);
    await this.createItemPhoto({ menuItemId: item11.id, imageUrl: "/images/dishes/spring-rolls.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot3_2.id, item11.id);

    const item12 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Miso Glazed Tofu Bowl",
      description: "Crispy tofu with miso glaze, quinoa, roasted vegetables, and ginger dressing. Vegan and gluten-free.",
    });
    await this.createServingOption({ menuItemId: item12.id, servingSize: 1, label: "1 bowl", price: 15.99, isDefault: 1 });
    await this.addItemAllergens(item12.id, [findAllergen("Soy")]);
    await this.addItemIngredients(item12.id, [findIngredient("Tofu"), findIngredient("Quinoa"), findIngredient("Broccoli"), findIngredient("Carrots")]);
    await this.createItemPhoto({ menuItemId: item12.id, imageUrl: "/images/dishes/miso-tofu.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot3_1.id, item12.id);
    await this.assignItemToDaySlot(daySlot3_2.id, item12.id);

    // Add comprehensive ingredient-allergen mappings for auto-selection
    // DAIRY/MILK allergens
    const dairyIngredients = ["Cheese", "Butter", "Cream", "Milk", "Yogurt", "Sour Cream", "Cream Cheese", "Parmesan", "Mozzarella", "Ricotta", "Mascarpone", "Whey Protein", "Ghee"];
    for (const ing of dairyIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Milk"));
    }

    // EGG allergens
    const eggIngredients = ["Eggs"];
    for (const ing of eggIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Eggs"));
    }

    // FISH allergens
    const fishIngredients = ["Salmon", "Tuna", "Cod"];
    for (const ing of fishIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Fish"));
    }

    // SHELLFISH/CRUSTACEAN allergens
    const shellfishIngredients = ["Shrimp", "Crab", "Lobster", "Scallops"];
    for (const ing of shellfishIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Shellfish"));
    }

    // MOLLUSKS allergens
    const molluskIngredients = ["Mussels", "Clams", "Oysters", "Squid", "Octopus"];
    for (const ing of molluskIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Mollusks"));
    }

    // WHEAT/GLUTEN allergens
    const wheatIngredients = ["Pasta", "Bread", "Flour", "Breadcrumbs", "Couscous", "Barley", "Noodles"];
    for (const ing of wheatIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) {
        await this.addIngredientAllergen(ingId, findAllergen("Wheat"));
        await this.addIngredientAllergen(ingId, findAllergen("Gluten"));
      }
    }

    // TREE NUTS allergens
    const treeNutIngredients = ["Almonds", "Walnuts", "Cashews", "Pistachios", "Pine Nuts", "Hazelnuts", "Pecans", "Macadamia Nuts", "Almond Butter"];
    for (const ing of treeNutIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Tree Nuts"));
    }

    // PEANUT allergens
    const peanutIngredients = ["Peanuts", "Peanut Butter", "Peanut Oil"];
    for (const ing of peanutIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Peanuts"));
    }

    // SOY allergens
    const soyIngredients = ["Tofu", "Soy Sauce", "Miso", "Edamame", "Tempeh", "Soy Milk"];
    for (const ing of soyIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Soy"));
    }

    // SESAME allergens
    const sesameIngredients = ["Sesame Seeds", "Sesame Oil", "Tahini"];
    for (const ing of sesameIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Sesame"));
    }

    // MUSTARD allergens
    const mustardIngredients = ["Mustard", "Mustard Seed"];
    for (const ing of mustardIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Mustard"));
    }

    // CELERY allergens
    const celeryIngredients = ["Celery"];
    for (const ing of celeryIngredients) {
      const ingId = findIngredient(ing);
      if (ingId) await this.addIngredientAllergen(ingId, findAllergen("Celery"));
    }

    console.log("Database seeded successfully!");
  }
}

export const storage = new DatabaseStorage();
