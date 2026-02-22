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
import { eq, and, ilike, sql, inArray } from "drizzle-orm";

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
  // Batch helper: fetch all details for a set of menu item IDs in 4 queries instead of 4N
  private async batchFetchMenuItemDetails(itemIds: number[]): Promise<{
    ingredientsByItemId: Map<number, typeof ingredients.$inferSelect[]>;
    allergensByItemId: Map<number, typeof allergens.$inferSelect[]>;
    servingOptionsByItemId: Map<number, typeof servingOptions.$inferSelect[]>;
    photosByItemId: Map<number, typeof itemPhotos.$inferSelect[]>;
  }> {
    if (itemIds.length === 0) {
      return {
        ingredientsByItemId: new Map(),
        allergensByItemId: new Map(),
        servingOptionsByItemId: new Map(),
        photosByItemId: new Map(),
      };
    }

    const [allIngredients, allAllergens, allServingOptions, allPhotos] = await Promise.all([
      db.select({ menuItemId: itemIngredients.menuItemId, ingredient: ingredients })
        .from(itemIngredients)
        .innerJoin(ingredients, eq(itemIngredients.ingredientId, ingredients.id))
        .where(inArray(itemIngredients.menuItemId, itemIds)),
      db.select({ menuItemId: itemAllergens.menuItemId, allergen: allergens })
        .from(itemAllergens)
        .innerJoin(allergens, eq(itemAllergens.allergenId, allergens.id))
        .where(inArray(itemAllergens.menuItemId, itemIds)),
      db.select().from(servingOptions).where(inArray(servingOptions.menuItemId, itemIds)),
      db.select().from(itemPhotos).where(inArray(itemPhotos.menuItemId, itemIds)),
    ]);

    const ingredientsByItemId = new Map<number, typeof ingredients.$inferSelect[]>();
    const allergensByItemId = new Map<number, typeof allergens.$inferSelect[]>();
    const servingOptionsByItemId = new Map<number, typeof servingOptions.$inferSelect[]>();
    const photosByItemId = new Map<number, typeof itemPhotos.$inferSelect[]>();

    for (const r of allIngredients) {
      const list = ingredientsByItemId.get(r.menuItemId) || [];
      list.push(r.ingredient);
      ingredientsByItemId.set(r.menuItemId, list);
    }
    for (const r of allAllergens) {
      const list = allergensByItemId.get(r.menuItemId) || [];
      list.push(r.allergen);
      allergensByItemId.set(r.menuItemId, list);
    }
    for (const opt of allServingOptions) {
      const list = servingOptionsByItemId.get(opt.menuItemId) || [];
      list.push(opt);
      servingOptionsByItemId.set(opt.menuItemId, list);
    }
    for (const photo of allPhotos) {
      const list = photosByItemId.get(photo.menuItemId) || [];
      list.push(photo);
      photosByItemId.set(photo.menuItemId, list);
    }

    return { ingredientsByItemId, allergensByItemId, servingOptionsByItemId, photosByItemId };
  }

  private buildMenuItemWithDetails(
    item: typeof menuItems.$inferSelect,
    details: Awaited<ReturnType<DatabaseStorage["batchFetchMenuItemDetails"]>>
  ): MenuItemWithDetails {
    const photos = details.photosByItemId.get(item.id) || [];
    const coverPhotoObj = photos.find(p => p.isCover === 1);
    return {
      ...item,
      ingredients: details.ingredientsByItemId.get(item.id) || [],
      allergens: details.allergensByItemId.get(item.id) || [],
      servingOptions: details.servingOptionsByItemId.get(item.id) || [],
      photos,
      coverPhoto: coverPhotoObj?.imageUrl,
    };
  }

  async getChefs(): Promise<ChefProfileWithDaySlots[]> {
    const chefsData = await db.select().from(chefProfiles);
    if (chefsData.length === 0) return [];

    const chefIds = chefsData.map(c => c.id);

    // Batch fetch all day slots for all chefs
    const allSlots = await db.select().from(menuDaySlots).where(inArray(menuDaySlots.chefId, chefIds));

    if (allSlots.length === 0) {
      return chefsData.map(chef => ({ ...chef, daySlots: [] }));
    }

    const slotIds = allSlots.map(s => s.id);

    // Batch fetch all assignments for all slots
    const allAssignments = await db
      .select({ assignment: menuItemAssignments, menuItem: menuItems })
      .from(menuItemAssignments)
      .innerJoin(menuItems, eq(menuItemAssignments.menuItemId, menuItems.id))
      .where(inArray(menuItemAssignments.daySlotId, slotIds));

    // Get unique item IDs and batch fetch their details
    const uniqueItemIds = Array.from(new Set(allAssignments.map(a => a.menuItem.id)));
    const details = await this.batchFetchMenuItemDetails(uniqueItemIds);

    // Batch fetch all assignment serving options
    const assignmentIds = allAssignments.map(a => a.assignment.id);
    const allAssignmentServingOptions = assignmentIds.length > 0
      ? await db
          .select({ assignmentServingOption: assignmentServingOptions, servingOption: servingOptions })
          .from(assignmentServingOptions)
          .innerJoin(servingOptions, eq(assignmentServingOptions.servingOptionId, servingOptions.id))
          .where(inArray(assignmentServingOptions.assignmentId, assignmentIds))
      : [];

    // Group assignment serving options by assignment ID
    const asoByAssignmentId = new Map<number, AssignedServingOptionWithDetails[]>();
    for (const r of allAssignmentServingOptions) {
      const list = asoByAssignmentId.get(r.assignmentServingOption.assignmentId) || [];
      list.push({ ...r.assignmentServingOption, servingOption: r.servingOption });
      asoByAssignmentId.set(r.assignmentServingOption.assignmentId, list);
    }

    // Group assignments by slot ID
    const assignmentsBySlotId = new Map<number, MenuItemWithAssignment[]>();
    for (const a of allAssignments) {
      const list = assignmentsBySlotId.get(a.assignment.daySlotId) || [];
      const itemWithDetails = this.buildMenuItemWithDetails(a.menuItem, details);
      list.push({
        ...itemWithDetails,
        assignmentId: a.assignment.id,
        assignedServingOptions: asoByAssignmentId.get(a.assignment.id) || [],
      });
      assignmentsBySlotId.set(a.assignment.daySlotId, list);
    }

    // Group slots by chef ID
    const slotsByChefId = new Map<number, DaySlotWithItems[]>();
    for (const slot of allSlots) {
      const list = slotsByChefId.get(slot.chefId) || [];
      list.push({ ...slot, items: assignmentsBySlotId.get(slot.id) || [] });
      slotsByChefId.set(slot.chefId, list);
    }

    return chefsData.map(chef => ({
      ...chef,
      daySlots: slotsByChefId.get(chef.id) || [],
    }));
  }

  async getChefBySlug(slug: string): Promise<ChefProfileWithDaySlots | undefined> {
    const [chef] = await db.select().from(chefProfiles).where(eq(chefProfiles.slug, slug));
    if (!chef) return undefined;

    // Use the optimized batch approach for a single chef
    const slots = await db.select().from(menuDaySlots).where(eq(menuDaySlots.chefId, chef.id));
    if (slots.length === 0) return { ...chef, daySlots: [] };

    const slotIds = slots.map(s => s.id);
    const assignments = await db
      .select({ assignment: menuItemAssignments, menuItem: menuItems })
      .from(menuItemAssignments)
      .innerJoin(menuItems, eq(menuItemAssignments.menuItemId, menuItems.id))
      .where(inArray(menuItemAssignments.daySlotId, slotIds));

    const uniqueItemIds = Array.from(new Set(assignments.map(a => a.menuItem.id)));
    const details = await this.batchFetchMenuItemDetails(uniqueItemIds);

    const assignmentIds = assignments.map(a => a.assignment.id);
    const allAso = assignmentIds.length > 0
      ? await db
          .select({ assignmentServingOption: assignmentServingOptions, servingOption: servingOptions })
          .from(assignmentServingOptions)
          .innerJoin(servingOptions, eq(assignmentServingOptions.servingOptionId, servingOptions.id))
          .where(inArray(assignmentServingOptions.assignmentId, assignmentIds))
      : [];

    const asoByAssignmentId = new Map<number, AssignedServingOptionWithDetails[]>();
    for (const r of allAso) {
      const list = asoByAssignmentId.get(r.assignmentServingOption.assignmentId) || [];
      list.push({ ...r.assignmentServingOption, servingOption: r.servingOption });
      asoByAssignmentId.set(r.assignmentServingOption.assignmentId, list);
    }

    const assignmentsBySlotId = new Map<number, MenuItemWithAssignment[]>();
    for (const a of assignments) {
      const list = assignmentsBySlotId.get(a.assignment.daySlotId) || [];
      const itemWithDetails = this.buildMenuItemWithDetails(a.menuItem, details);
      list.push({
        ...itemWithDetails,
        assignmentId: a.assignment.id,
        assignedServingOptions: asoByAssignmentId.get(a.assignment.id) || [],
      });
      assignmentsBySlotId.set(a.assignment.daySlotId, list);
    }

    const daySlotsData: DaySlotWithItems[] = slots.map(slot => ({
      ...slot,
      items: assignmentsBySlotId.get(slot.id) || [],
    }));

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

    const details = await this.batchFetchMenuItemDetails([id]);
    return this.buildMenuItemWithDetails(item, details);
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
    if (items.length === 0) return [];

    const itemIds = items.map(i => i.id);
    const details = await this.batchFetchMenuItemDetails(itemIds);

    return items.map(item => this.buildMenuItemWithDetails(item, details));
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
    if (slots.length === 0) return [];

    const slotIds = slots.map(s => s.id);

    // Batch fetch all assignments for all slots
    const allAssignments = await db
      .select({ assignment: menuItemAssignments, menuItem: menuItems })
      .from(menuItemAssignments)
      .innerJoin(menuItems, eq(menuItemAssignments.menuItemId, menuItems.id))
      .where(inArray(menuItemAssignments.daySlotId, slotIds));

    const uniqueItemIds = Array.from(new Set(allAssignments.map(a => a.menuItem.id)));
    const details = await this.batchFetchMenuItemDetails(uniqueItemIds);

    // Batch fetch assignment serving options
    const assignmentIds = allAssignments.map(a => a.assignment.id);
    const allAso = assignmentIds.length > 0
      ? await db
          .select({ assignmentServingOption: assignmentServingOptions, servingOption: servingOptions })
          .from(assignmentServingOptions)
          .innerJoin(servingOptions, eq(assignmentServingOptions.servingOptionId, servingOptions.id))
          .where(inArray(assignmentServingOptions.assignmentId, assignmentIds))
      : [];

    const asoByAssignmentId = new Map<number, AssignedServingOptionWithDetails[]>();
    for (const r of allAso) {
      const list = asoByAssignmentId.get(r.assignmentServingOption.assignmentId) || [];
      list.push({ ...r.assignmentServingOption, servingOption: r.servingOption });
      asoByAssignmentId.set(r.assignmentServingOption.assignmentId, list);
    }

    // Group assignments by slot ID
    const assignmentsBySlotId = new Map<number, MenuItemWithAssignment[]>();
    for (const a of allAssignments) {
      const list = assignmentsBySlotId.get(a.assignment.daySlotId) || [];
      const itemWithDetails = this.buildMenuItemWithDetails(a.menuItem, details);
      list.push({
        ...itemWithDetails,
        assignmentId: a.assignment.id,
        assignedServingOptions: asoByAssignmentId.get(a.assignment.id) || [],
      });
      assignmentsBySlotId.set(a.assignment.daySlotId, list);
    }

    return slots.map(slot => ({
      ...slot,
      items: assignmentsBySlotId.get(slot.id) || [],
    }));
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

    if (result.length === 0) return [];

    const itemIds = result.map(r => r.menuItem.id);
    const details = await this.batchFetchMenuItemDetails(itemIds);

    // Batch fetch assignment serving options
    const assignmentIds = result.map(r => r.assignment.id);
    const allAso = await db
      .select({ assignmentServingOption: assignmentServingOptions, servingOption: servingOptions })
      .from(assignmentServingOptions)
      .innerJoin(servingOptions, eq(assignmentServingOptions.servingOptionId, servingOptions.id))
      .where(inArray(assignmentServingOptions.assignmentId, assignmentIds));

    const asoByAssignmentId = new Map<number, AssignedServingOptionWithDetails[]>();
    for (const r of allAso) {
      const list = asoByAssignmentId.get(r.assignmentServingOption.assignmentId) || [];
      list.push({ ...r.assignmentServingOption, servingOption: r.servingOption });
      asoByAssignmentId.set(r.assignmentServingOption.assignmentId, list);
    }

    return result.map(r => {
      const itemWithDetails = this.buildMenuItemWithDetails(r.menuItem, details);
      return {
        ...itemWithDetails,
        assignmentId: r.assignment.id,
        assignedServingOptions: asoByAssignmentId.get(r.assignment.id) || [],
      };
    });
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
    if (allIngredients.length === 0) return [];

    // Single join query instead of N+1
    const allMappings = await db
      .select({ ingredientId: ingredientAllergens.ingredientId, allergen: allergens })
      .from(ingredientAllergens)
      .innerJoin(allergens, eq(ingredientAllergens.allergenId, allergens.id));

    const allergensByIngredientId = new Map<number, typeof allergens.$inferSelect[]>();
    for (const m of allMappings) {
      const list = allergensByIngredientId.get(m.ingredientId) || [];
      list.push(m.allergen);
      allergensByIngredientId.set(m.ingredientId, list);
    }

    return allIngredients.map(ingredient => ({
      ...ingredient,
      allergens: allergensByIngredientId.get(ingredient.id) || [],
    }));
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
    if (ordersData.length === 0) return [];

    // Batch fetch all order items in a single query
    const orderIds = ordersData.map(o => o.id);
    const allOrderItems = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));

    // Group order items by order ID
    const itemsByOrderId = new Map<number, typeof orderItems.$inferSelect[]>();
    for (const item of allOrderItems) {
      const list = itemsByOrderId.get(item.orderId) || [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }

    // Fetch the chef once (all orders share the same chef)
    const chef = await this.getChefById(chefId);

    return ordersData.map(order => ({
      ...order,
      items: itemsByOrderId.get(order.id) || [],
      chef,
    }));
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

    const chef4 = await this.createChef({
      slug: "chef-luna",
      name: "Chef Luna Reyes",
      bio: "100% plant-based meals that prove vegan food can be bold, satisfying, and delicious. Zero compromise on flavor.",
      cuisineTags: ["Vegan", "Plant-Based", "Healthy"],
      locationLat: 40.7340,
      locationLong: -74.0054,
      locationName: "West Village, Manhattan",
      serviceRadius: 5,
      fulfillmentMethod: "both",
      deliveryFee: 4.99,
    });

    const chef5 = await this.createChef({
      slug: "chef-kenji",
      name: "Chef Kenji Tanaka",
      bio: "Authentic Japanese comfort food — from rich tonkotsu ramen to hand-rolled sushi, made with traditional techniques.",
      cuisineTags: ["Japanese", "Ramen", "Sushi"],
      locationLat: 40.7527,
      locationLong: -73.9735,
      locationName: "Midtown East, Manhattan",
      serviceRadius: 6,
      fulfillmentMethod: "pickup",
    });

    const chef6 = await this.createChef({
      slug: "chef-sophie",
      name: "Chef Sophie Martin",
      bio: "Parisian-trained pastry chef bringing artisan croissants, tarts, and cakes to your doorstep.",
      cuisineTags: ["Baked Goods", "French", "Pastry"],
      locationLat: 40.7654,
      locationLong: -73.9857,
      locationName: "Hell's Kitchen, Manhattan",
      serviceRadius: 5,
      fulfillmentMethod: "both",
      deliveryFee: 3.99,
    });

    const chef7 = await this.createChef({
      slug: "chef-marcus",
      name: "Chef Marcus Williams",
      bio: "Low-and-slow smoked meats with homemade rubs and sauces. Texas-style BBQ, Brooklyn soul.",
      cuisineTags: ["BBQ", "Southern", "Smoked Meats"],
      locationLat: 40.7128,
      locationLong: -73.9566,
      locationName: "Williamsburg, Brooklyn",
      serviceRadius: 8,
      fulfillmentMethod: "both",
      deliveryFee: 5.99,
    });

    const chef8 = await this.createChef({
      slug: "chef-denise",
      name: "Chef Denise Jackson",
      bio: "Harlem soul food rooted in family tradition. Collard greens, fried chicken, and mac & cheese like grandma made.",
      cuisineTags: ["Soul Food", "Southern", "Comfort Food"],
      locationLat: 40.8116,
      locationLong: -73.9465,
      locationName: "Harlem, Manhattan",
      serviceRadius: 10,
      fulfillmentMethod: "delivery",
      deliveryFee: 6.99,
    });

    const chef9 = await this.createChef({
      slug: "chef-nadine",
      name: "Chef Nadine Baptiste",
      bio: "Island flavors from Jamaica and Haiti. Jerk chicken, oxtail stew, and plantains that transport you to the Caribbean.",
      cuisineTags: ["Caribbean", "Jamaican", "Haitian"],
      locationLat: 40.6694,
      locationLong: -73.9422,
      locationName: "Crown Heights, Brooklyn",
      serviceRadius: 7,
      fulfillmentMethod: "both",
      deliveryFee: 5.99,
    });

    const chef10 = await this.createChef({
      slug: "chef-bobby",
      name: "Chef Bobby Hayes",
      bio: "Classic American comfort food done right. Burgers, meatloaf, and milkshakes — honest food, no fuss.",
      cuisineTags: ["Comfort Food", "American", "Diner"],
      locationLat: 40.7720,
      locationLong: -73.9303,
      locationName: "Astoria, Queens",
      serviceRadius: 8,
      fulfillmentMethod: "pickup",
    });

    const chef11 = await this.createChef({
      slug: "chef-priya",
      name: "Chef Priya Sharma",
      bio: "Vibrant Indian home cooking. From butter chicken to dosas, every spice blend is ground fresh daily.",
      cuisineTags: ["Indian", "Curry", "Vegetarian-Friendly"],
      locationLat: 40.7497,
      locationLong: -73.8831,
      locationName: "Jackson Heights, Queens",
      serviceRadius: 10,
      fulfillmentMethod: "delivery",
      deliveryFee: 7.99,
    });

    // Create day slots directly for chefs (calendar-based architecture)
    // Use relative dates so seed data always shows upcoming offerings
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const futureDate = (daysFromNow: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + daysFromNow);
      return d;
    };

    // Chef 1 (Maria) - 4 day slots staggered across next 10 days
    const daySlot1_1 = await this.createDaySlot({ chefId: chef1.id, date: futureDate(1), orderCutoffDate: futureDate(0) });
    const daySlot1_2 = await this.createDaySlot({ chefId: chef1.id, date: futureDate(4), orderCutoffDate: futureDate(3) });
    const daySlot1_3 = await this.createDaySlot({ chefId: chef1.id, date: futureDate(7), orderCutoffDate: futureDate(6) });
    const daySlot1_4 = await this.createDaySlot({ chefId: chef1.id, date: futureDate(10), orderCutoffDate: futureDate(9) });

    // Chef 2 (Marco) - 4 day slots
    const daySlot2_1 = await this.createDaySlot({ chefId: chef2.id, date: futureDate(2), orderCutoffDate: futureDate(1) });
    const daySlot2_2 = await this.createDaySlot({ chefId: chef2.id, date: futureDate(5), orderCutoffDate: futureDate(4) });
    const daySlot2_3 = await this.createDaySlot({ chefId: chef2.id, date: futureDate(8), orderCutoffDate: futureDate(7) });
    const daySlot2_4 = await this.createDaySlot({ chefId: chef2.id, date: futureDate(11), orderCutoffDate: futureDate(10) });

    // Chef 3 (Mei) - 5 day slots
    const daySlot3_1 = await this.createDaySlot({ chefId: chef3.id, date: futureDate(1), orderCutoffDate: futureDate(0) });
    const daySlot3_2 = await this.createDaySlot({ chefId: chef3.id, date: futureDate(3), orderCutoffDate: futureDate(2) });
    const daySlot3_3 = await this.createDaySlot({ chefId: chef3.id, date: futureDate(6), orderCutoffDate: futureDate(5) });
    const daySlot3_4 = await this.createDaySlot({ chefId: chef3.id, date: futureDate(8), orderCutoffDate: futureDate(7) });
    const daySlot3_5 = await this.createDaySlot({ chefId: chef3.id, date: futureDate(11), orderCutoffDate: futureDate(10) });

    // Chef 4 (Luna) - 3 day slots
    const daySlot4_1 = await this.createDaySlot({ chefId: chef4.id, date: futureDate(2), orderCutoffDate: futureDate(1) });
    const daySlot4_2 = await this.createDaySlot({ chefId: chef4.id, date: futureDate(5), orderCutoffDate: futureDate(4) });
    const daySlot4_3 = await this.createDaySlot({ chefId: chef4.id, date: futureDate(9), orderCutoffDate: futureDate(8) });

    // Chef 5 (Kenji) - 3 day slots
    const daySlot5_1 = await this.createDaySlot({ chefId: chef5.id, date: futureDate(1), orderCutoffDate: futureDate(0) });
    const daySlot5_2 = await this.createDaySlot({ chefId: chef5.id, date: futureDate(4), orderCutoffDate: futureDate(3) });
    const daySlot5_3 = await this.createDaySlot({ chefId: chef5.id, date: futureDate(8), orderCutoffDate: futureDate(7) });

    // Chef 6 (Sophie) - 3 day slots
    const daySlot6_1 = await this.createDaySlot({ chefId: chef6.id, date: futureDate(3), orderCutoffDate: futureDate(2) });
    const daySlot6_2 = await this.createDaySlot({ chefId: chef6.id, date: futureDate(6), orderCutoffDate: futureDate(5) });
    const daySlot6_3 = await this.createDaySlot({ chefId: chef6.id, date: futureDate(10), orderCutoffDate: futureDate(9) });

    // Chef 7 (Marcus) - 3 day slots
    const daySlot7_1 = await this.createDaySlot({ chefId: chef7.id, date: futureDate(2), orderCutoffDate: futureDate(1) });
    const daySlot7_2 = await this.createDaySlot({ chefId: chef7.id, date: futureDate(5), orderCutoffDate: futureDate(4) });
    const daySlot7_3 = await this.createDaySlot({ chefId: chef7.id, date: futureDate(9), orderCutoffDate: futureDate(8) });

    // Chef 8 (Denise) - 3 day slots
    const daySlot8_1 = await this.createDaySlot({ chefId: chef8.id, date: futureDate(1), orderCutoffDate: futureDate(0) });
    const daySlot8_2 = await this.createDaySlot({ chefId: chef8.id, date: futureDate(4), orderCutoffDate: futureDate(3) });
    const daySlot8_3 = await this.createDaySlot({ chefId: chef8.id, date: futureDate(7), orderCutoffDate: futureDate(6) });

    // Chef 9 (Nadine) - 3 day slots
    const daySlot9_1 = await this.createDaySlot({ chefId: chef9.id, date: futureDate(3), orderCutoffDate: futureDate(2) });
    const daySlot9_2 = await this.createDaySlot({ chefId: chef9.id, date: futureDate(6), orderCutoffDate: futureDate(5) });
    const daySlot9_3 = await this.createDaySlot({ chefId: chef9.id, date: futureDate(10), orderCutoffDate: futureDate(9) });

    // Chef 10 (Bobby) - 3 day slots
    const daySlot10_1 = await this.createDaySlot({ chefId: chef10.id, date: futureDate(2), orderCutoffDate: futureDate(1) });
    const daySlot10_2 = await this.createDaySlot({ chefId: chef10.id, date: futureDate(5), orderCutoffDate: futureDate(4) });
    const daySlot10_3 = await this.createDaySlot({ chefId: chef10.id, date: futureDate(8), orderCutoffDate: futureDate(7) });

    // Chef 11 (Priya) - 3 day slots
    const daySlot11_1 = await this.createDaySlot({ chefId: chef11.id, date: futureDate(1), orderCutoffDate: futureDate(0) });
    const daySlot11_2 = await this.createDaySlot({ chefId: chef11.id, date: futureDate(4), orderCutoffDate: futureDate(3) });
    const daySlot11_3 = await this.createDaySlot({ chefId: chef11.id, date: futureDate(7), orderCutoffDate: futureDate(6) });

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
    await this.assignItemToDaySlot(daySlot1_3.id, item1.id);
    await this.assignItemToDaySlot(daySlot1_4.id, item1.id);

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
    await this.assignItemToDaySlot(daySlot1_3.id, item2.id);

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
    await this.assignItemToDaySlot(daySlot1_4.id, item3.id);

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
    await this.assignItemToDaySlot(daySlot2_1.id, item4.id);
    await this.assignItemToDaySlot(daySlot2_2.id, item4.id);
    await this.assignItemToDaySlot(daySlot2_3.id, item4.id);
    await this.assignItemToDaySlot(daySlot2_4.id, item4.id);

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
    await this.assignItemToDaySlot(daySlot2_1.id, item5.id);
    await this.assignItemToDaySlot(daySlot2_3.id, item5.id);

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
    await this.assignItemToDaySlot(daySlot2_2.id, item6.id);
    await this.assignItemToDaySlot(daySlot2_4.id, item6.id);

    const item7 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Tiramisu",
      description: "Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream.",
    });
    await this.createServingOption({ menuItemId: item7.id, servingSize: 1, label: "1 slice", price: 9.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item7.id, servingSize: 6, label: "Whole cake (6-8 slices)", price: 49.99, isDefault: 0 });
    await this.addItemAllergens(item7.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.createItemPhoto({ menuItemId: item7.id, imageUrl: "/images/dishes/tiramisu.jpg", isCover: 1 });
    await this.assignItemToDaySlot(daySlot2_1.id, item7.id);
    await this.assignItemToDaySlot(daySlot2_2.id, item7.id);

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
    await this.assignItemToDaySlot(daySlot3_3.id, item8.id);
    await this.assignItemToDaySlot(daySlot3_4.id, item8.id);
    await this.assignItemToDaySlot(daySlot3_5.id, item8.id);

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
    await this.assignItemToDaySlot(daySlot3_3.id, item9.id);
    await this.assignItemToDaySlot(daySlot3_5.id, item9.id);

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
    await this.assignItemToDaySlot(daySlot3_2.id, item10.id);
    await this.assignItemToDaySlot(daySlot3_4.id, item10.id);

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
    await this.assignItemToDaySlot(daySlot3_3.id, item11.id);
    await this.assignItemToDaySlot(daySlot3_5.id, item11.id);

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
    await this.assignItemToDaySlot(daySlot3_4.id, item12.id);

    // Chef 4 (Luna) items - Vegan
    const item13 = await this.createMenuItem({
      chefId: chef4.id,
      title: "Quinoa Buddha Bowl",
      description: "Roasted sweet potato, avocado, chickpeas, kale, and tahini dressing over fluffy quinoa. 100% plant-based.",
    });
    await this.createServingOption({ menuItemId: item13.id, servingSize: 1, label: "1 bowl", price: 15.99, isDefault: 1 });
    await this.addItemAllergens(item13.id, [findAllergen("Sesame")]);
    await this.addItemIngredients(item13.id, [findIngredient("Quinoa"), findIngredient("Kale"), findIngredient("Olive Oil")]);
    await this.assignItemToDaySlot(daySlot4_1.id, item13.id);
    await this.assignItemToDaySlot(daySlot4_2.id, item13.id);
    await this.assignItemToDaySlot(daySlot4_3.id, item13.id);

    const item14 = await this.createMenuItem({
      chefId: chef4.id,
      title: "Jackfruit Tacos",
      description: "Smoky pulled jackfruit with pickled red onion, cilantro lime crema (cashew-based), and fresh salsa on corn tortillas.",
    });
    await this.createServingOption({ menuItemId: item14.id, servingSize: 1, label: "3 tacos", price: 14.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item14.id, servingSize: 2, label: "6 tacos", price: 26.99, isDefault: 0 });
    await this.addItemAllergens(item14.id, [findAllergen("Tree Nuts")]);
    await this.addItemIngredients(item14.id, [findIngredient("Onions"), findIngredient("Cilantro"), findIngredient("Cashews")]);
    await this.assignItemToDaySlot(daySlot4_1.id, item14.id);
    await this.assignItemToDaySlot(daySlot4_2.id, item14.id);
    await this.assignItemToDaySlot(daySlot4_3.id, item14.id);

    // Chef 5 (Kenji) items - Japanese
    const item15 = await this.createMenuItem({
      chefId: chef5.id,
      title: "Tonkotsu Ramen",
      description: "Rich, creamy pork bone broth simmered 12 hours, with chashu pork, soft-boiled egg, nori, and fresh noodles.",
    });
    await this.createServingOption({ menuItemId: item15.id, servingSize: 1, label: "1 bowl", price: 18.99, isDefault: 1 });
    await this.addItemAllergens(item15.id, [findAllergen("Wheat"), findAllergen("Eggs"), findAllergen("Soy")]);
    await this.addItemIngredients(item15.id, [findIngredient("Pork"), findIngredient("Eggs"), findIngredient("Noodles"), findIngredient("Soy Sauce")]);
    await this.assignItemToDaySlot(daySlot5_1.id, item15.id);
    await this.assignItemToDaySlot(daySlot5_2.id, item15.id);
    await this.assignItemToDaySlot(daySlot5_3.id, item15.id);

    const item16 = await this.createMenuItem({
      chefId: chef5.id,
      title: "Chirashi Sushi Bowl",
      description: "Assorted fresh sashimi over seasoned sushi rice with pickled ginger, wasabi, and soy sauce.",
    });
    await this.createServingOption({ menuItemId: item16.id, servingSize: 1, label: "1 bowl", price: 22.99, isDefault: 1 });
    await this.addItemAllergens(item16.id, [findAllergen("Fish"), findAllergen("Soy"), findAllergen("Sesame")]);
    await this.addItemIngredients(item16.id, [findIngredient("Salmon"), findIngredient("Tuna"), findIngredient("Rice"), findIngredient("Soy Sauce")]);
    await this.assignItemToDaySlot(daySlot5_1.id, item16.id);
    await this.assignItemToDaySlot(daySlot5_2.id, item16.id);
    await this.assignItemToDaySlot(daySlot5_3.id, item16.id);

    // Chef 6 (Sophie) items - Baked Goods
    const item17 = await this.createMenuItem({
      chefId: chef6.id,
      title: "Butter Croissant Box",
      description: "Flaky, golden croissants made with French butter. Baked fresh the morning of your order.",
    });
    await this.createServingOption({ menuItemId: item17.id, servingSize: 4, label: "Box of 4", price: 12.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item17.id, servingSize: 8, label: "Box of 8", price: 22.99, isDefault: 0 });
    await this.addItemAllergens(item17.id, [findAllergen("Wheat"), findAllergen("Milk"), findAllergen("Eggs")]);
    await this.addItemIngredients(item17.id, [findIngredient("Butter"), findIngredient("Flour"), findIngredient("Eggs")]);
    await this.assignItemToDaySlot(daySlot6_1.id, item17.id);
    await this.assignItemToDaySlot(daySlot6_2.id, item17.id);
    await this.assignItemToDaySlot(daySlot6_3.id, item17.id);

    const item18 = await this.createMenuItem({
      chefId: chef6.id,
      title: "Mixed Berry Tart",
      description: "Buttery shortcrust pastry filled with vanilla pastry cream and topped with fresh seasonal berries.",
    });
    await this.createServingOption({ menuItemId: item18.id, servingSize: 1, label: "1 slice", price: 8.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item18.id, servingSize: 8, label: "Whole tart (8 slices)", price: 44.99, isDefault: 0 });
    await this.addItemAllergens(item18.id, [findAllergen("Wheat"), findAllergen("Milk"), findAllergen("Eggs")]);
    await this.addItemIngredients(item18.id, [findIngredient("Butter"), findIngredient("Flour"), findIngredient("Cream"), findIngredient("Eggs")]);
    await this.assignItemToDaySlot(daySlot6_1.id, item18.id);
    await this.assignItemToDaySlot(daySlot6_2.id, item18.id);
    await this.assignItemToDaySlot(daySlot6_3.id, item18.id);

    // Chef 7 (Marcus) items - BBQ
    const item19 = await this.createMenuItem({
      chefId: chef7.id,
      title: "Smoked Brisket Plate",
      description: "14-hour smoked beef brisket with house-made BBQ sauce, coleslaw, cornbread, and baked beans.",
    });
    await this.createServingOption({ menuItemId: item19.id, servingSize: 1, label: "1 plate", price: 22.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item19.id, servingSize: 4, label: "Family platter (4 servings)", price: 79.99, isDefault: 0 });
    await this.addItemIngredients(item19.id, [findIngredient("Beef"), findIngredient("Corn")]);
    await this.assignItemToDaySlot(daySlot7_1.id, item19.id);
    await this.assignItemToDaySlot(daySlot7_2.id, item19.id);
    await this.assignItemToDaySlot(daySlot7_3.id, item19.id);

    const item20 = await this.createMenuItem({
      chefId: chef7.id,
      title: "Pulled Pork Sandwich",
      description: "Slow-smoked pulled pork on a brioche bun with tangy vinegar slaw and pickles.",
    });
    await this.createServingOption({ menuItemId: item20.id, servingSize: 1, label: "1 sandwich", price: 14.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item20.id, servingSize: 2, label: "2 sandwiches", price: 26.99, isDefault: 0 });
    await this.addItemAllergens(item20.id, [findAllergen("Wheat")]);
    await this.addItemIngredients(item20.id, [findIngredient("Pork"), findIngredient("Bread")]);
    await this.assignItemToDaySlot(daySlot7_1.id, item20.id);
    await this.assignItemToDaySlot(daySlot7_2.id, item20.id);
    await this.assignItemToDaySlot(daySlot7_3.id, item20.id);

    // Chef 8 (Denise) items - Soul Food
    const item21 = await this.createMenuItem({
      chefId: chef8.id,
      title: "Southern Fried Chicken",
      description: "Buttermilk-brined, crispy fried chicken with honey-hot sauce drizzle. Served with collard greens and cornbread.",
    });
    await this.createServingOption({ menuItemId: item21.id, servingSize: 1, label: "2 piece dinner", price: 18.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item21.id, servingSize: 2, label: "4 piece dinner", price: 32.99, isDefault: 0 });
    await this.addItemAllergens(item21.id, [findAllergen("Milk"), findAllergen("Wheat"), findAllergen("Eggs")]);
    await this.addItemIngredients(item21.id, [findIngredient("Chicken"), findIngredient("Butter"), findIngredient("Flour")]);
    await this.assignItemToDaySlot(daySlot8_1.id, item21.id);
    await this.assignItemToDaySlot(daySlot8_2.id, item21.id);
    await this.assignItemToDaySlot(daySlot8_3.id, item21.id);

    const item22 = await this.createMenuItem({
      chefId: chef8.id,
      title: "Mac & Cheese",
      description: "Creamy three-cheese baked macaroni with a crispy breadcrumb topping. The ultimate comfort side.",
    });
    await this.createServingOption({ menuItemId: item22.id, servingSize: 1, label: "Side portion", price: 12.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item22.id, servingSize: 4, label: "Family size", price: 22.99, isDefault: 0 });
    await this.addItemAllergens(item22.id, [findAllergen("Milk"), findAllergen("Wheat")]);
    await this.addItemIngredients(item22.id, [findIngredient("Pasta"), findIngredient("Cheese"), findIngredient("Butter"), findIngredient("Cream")]);
    await this.assignItemToDaySlot(daySlot8_1.id, item22.id);
    await this.assignItemToDaySlot(daySlot8_2.id, item22.id);
    await this.assignItemToDaySlot(daySlot8_3.id, item22.id);

    // Chef 9 (Nadine) items - Caribbean
    const item23 = await this.createMenuItem({
      chefId: chef9.id,
      title: "Jerk Chicken Plate",
      description: "Marinated and grilled jerk chicken with rice and peas, fried plantains, and festival bread.",
    });
    await this.createServingOption({ menuItemId: item23.id, servingSize: 1, label: "1 plate", price: 17.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item23.id, servingSize: 2, label: "2 plates", price: 32.99, isDefault: 0 });
    await this.addItemIngredients(item23.id, [findIngredient("Chicken"), findIngredient("Rice"), findIngredient("Garlic"), findIngredient("Thyme")]);
    await this.assignItemToDaySlot(daySlot9_1.id, item23.id);
    await this.assignItemToDaySlot(daySlot9_2.id, item23.id);
    await this.assignItemToDaySlot(daySlot9_3.id, item23.id);

    const item24 = await this.createMenuItem({
      chefId: chef9.id,
      title: "Oxtail Stew",
      description: "Slow-braised oxtail in a rich, savory gravy with butter beans, served over white rice.",
    });
    await this.createServingOption({ menuItemId: item24.id, servingSize: 1, label: "1 serving", price: 24.99, isDefault: 1 });
    await this.addItemIngredients(item24.id, [findIngredient("Beef"), findIngredient("Garlic"), findIngredient("Onions"), findIngredient("Rice"), findIngredient("Thyme")]);
    await this.assignItemToDaySlot(daySlot9_1.id, item24.id);
    await this.assignItemToDaySlot(daySlot9_2.id, item24.id);
    await this.assignItemToDaySlot(daySlot9_3.id, item24.id);

    // Chef 10 (Bobby) items - Comfort Food
    const item25 = await this.createMenuItem({
      chefId: chef10.id,
      title: "Classic Cheeseburger",
      description: "Double smash patty with American cheese, special sauce, lettuce, tomato, and pickles on a toasted bun.",
    });
    await this.createServingOption({ menuItemId: item25.id, servingSize: 1, label: "1 burger", price: 13.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item25.id, servingSize: 2, label: "2 burgers", price: 24.99, isDefault: 0 });
    await this.addItemAllergens(item25.id, [findAllergen("Milk"), findAllergen("Wheat")]);
    await this.addItemIngredients(item25.id, [findIngredient("Beef"), findIngredient("Cheese"), findIngredient("Bread"), findIngredient("Lettuce"), findIngredient("Tomatoes")]);
    await this.assignItemToDaySlot(daySlot10_1.id, item25.id);
    await this.assignItemToDaySlot(daySlot10_2.id, item25.id);
    await this.assignItemToDaySlot(daySlot10_3.id, item25.id);

    const item26 = await this.createMenuItem({
      chefId: chef10.id,
      title: "Chicken Pot Pie",
      description: "Flaky butter crust filled with tender chicken, peas, carrots, and creamy gravy. Baked to golden perfection.",
    });
    await this.createServingOption({ menuItemId: item26.id, servingSize: 1, label: "Individual pie", price: 16.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item26.id, servingSize: 4, label: "Family pie (4 servings)", price: 49.99, isDefault: 0 });
    await this.addItemAllergens(item26.id, [findAllergen("Milk"), findAllergen("Wheat"), findAllergen("Eggs")]);
    await this.addItemIngredients(item26.id, [findIngredient("Chicken"), findIngredient("Butter"), findIngredient("Flour"), findIngredient("Peas"), findIngredient("Carrots"), findIngredient("Cream")]);
    await this.assignItemToDaySlot(daySlot10_1.id, item26.id);
    await this.assignItemToDaySlot(daySlot10_2.id, item26.id);
    await this.assignItemToDaySlot(daySlot10_3.id, item26.id);

    // Chef 11 (Priya) items - Indian
    const item27 = await this.createMenuItem({
      chefId: chef11.id,
      title: "Butter Chicken",
      description: "Tender chicken in a rich, creamy tomato-butter sauce with aromatic spices. Served with basmati rice and naan.",
    });
    await this.createServingOption({ menuItemId: item27.id, servingSize: 1, label: "1 serving with rice & naan", price: 17.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item27.id, servingSize: 4, label: "Family size (4 servings)", price: 59.99, isDefault: 0 });
    await this.addItemAllergens(item27.id, [findAllergen("Milk"), findAllergen("Wheat")]);
    await this.addItemIngredients(item27.id, [findIngredient("Chicken"), findIngredient("Butter"), findIngredient("Cream"), findIngredient("Tomatoes"), findIngredient("Rice"), findIngredient("Garlic"), findIngredient("Ginger")]);
    await this.assignItemToDaySlot(daySlot11_1.id, item27.id);
    await this.assignItemToDaySlot(daySlot11_2.id, item27.id);
    await this.assignItemToDaySlot(daySlot11_3.id, item27.id);

    const item28 = await this.createMenuItem({
      chefId: chef11.id,
      title: "Vegetable Samosa Platter",
      description: "Crispy pastry pockets filled with spiced potatoes and peas, served with mint chutney and tamarind sauce.",
    });
    await this.createServingOption({ menuItemId: item28.id, servingSize: 6, label: "6 pieces", price: 10.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item28.id, servingSize: 12, label: "12 pieces (party size)", price: 18.99, isDefault: 0 });
    await this.addItemAllergens(item28.id, [findAllergen("Wheat")]);
    await this.addItemIngredients(item28.id, [findIngredient("Potatoes"), findIngredient("Peas"), findIngredient("Flour"), findIngredient("Cumin"), findIngredient("Turmeric")]);
    await this.assignItemToDaySlot(daySlot11_1.id, item28.id);
    await this.assignItemToDaySlot(daySlot11_2.id, item28.id);
    await this.assignItemToDaySlot(daySlot11_3.id, item28.id);

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

    // Seed orders for all chefs
    // Chef 1 (Maria) orders
    const order1 = await this.createOrder({
      chefId: chef1.id,
      buyerName: "Sarah Thompson",
      buyerEmail: "sarah.t@email.com",
      buyerPhone: "212-555-0142",
      totalAmount: 46.98,
      status: "pending",
      fulfillmentMethod: "delivery",
      deliveryAddress: "245 W 25th St, New York, NY 10001",
      deliveryLat: 40.7448,
      deliveryLong: -73.9946,
      notes: "Please ring apartment 4B. No buzzer.",
    });
    await this.createOrderItems([
      { orderId: order1.id, menuItemId: item1.id, quantity: 2, priceAtOrder: 16.99, itemTitle: "Chicken Enchiladas Verdes" },
      { orderId: order1.id, menuItemId: item2.id, quantity: 1, priceAtOrder: 14.99, itemTitle: "Vegetarian Tamales" },
    ]);

    const order2 = await this.createOrder({
      chefId: chef1.id,
      buyerName: "James Wilson",
      buyerEmail: "jwilson@email.com",
      buyerPhone: "212-555-0198",
      totalAmount: 34.99,
      status: "confirmed",
      fulfillmentMethod: "pickup",
      notes: "Will pick up around 6pm",
    });
    await this.createOrderItems([
      { orderId: order2.id, menuItemId: item3.id, quantity: 1, priceAtOrder: 34.99, itemTitle: "Carnitas Taco Platter" },
    ]);

    const order3 = await this.createOrder({
      chefId: chef1.id,
      buyerName: "Emily Chen",
      buyerEmail: "emily.chen@email.com",
      totalAmount: 29.99,
      status: "completed",
      fulfillmentMethod: "delivery",
      deliveryAddress: "180 W 20th St, New York, NY 10011",
      deliveryLat: 40.7416,
      deliveryLong: -73.9965,
    });
    await this.createOrderItems([
      { orderId: order3.id, menuItemId: item1.id, quantity: 1, priceAtOrder: 29.99, itemTitle: "Chicken Enchiladas Verdes" },
    ]);

    // Chef 2 (Antonio) orders
    const order4 = await this.createOrder({
      chefId: chef2.id,
      buyerName: "Michael Park",
      buyerEmail: "mpark@email.com",
      buyerPhone: "212-555-0234",
      totalAmount: 74.97,
      status: "pending",
      fulfillmentMethod: "delivery",
      deliveryAddress: "312 E 9th St, New York, NY 10003",
      deliveryLat: 40.7291,
      deliveryLong: -73.9891,
      notes: "Nut allergy - please double check ingredients",
    });
    await this.createOrderItems([
      { orderId: order4.id, menuItemId: item4.id, quantity: 1, priceAtOrder: 24.99, itemTitle: "Homemade Lasagna" },
      { orderId: order4.id, menuItemId: item5.id, quantity: 1, priceAtOrder: 32.99, itemTitle: "Fresh Fettuccine Alfredo" },
      { orderId: order4.id, menuItemId: item6.id, quantity: 1, priceAtOrder: 19.99, itemTitle: "Chicken Parmesan" },
    ]);

    const order5 = await this.createOrder({
      chefId: chef2.id,
      buyerName: "Lisa Martinez",
      buyerEmail: "lisa.m@email.com",
      buyerPhone: "212-555-0311",
      totalAmount: 94.98,
      status: "confirmed",
      fulfillmentMethod: "pickup",
      notes: "Picking up for a dinner party. Need by 5:30pm.",
    });
    await this.createOrderItems([
      { orderId: order5.id, menuItemId: item4.id, quantity: 1, priceAtOrder: 44.99, itemTitle: "Homemade Lasagna" },
      { orderId: order5.id, menuItemId: item7.id, quantity: 1, priceAtOrder: 49.99, itemTitle: "Tiramisu" },
    ]);

    const order6 = await this.createOrder({
      chefId: chef2.id,
      buyerName: "David Kim",
      buyerEmail: "dkim@email.com",
      totalAmount: 19.99,
      status: "preparing",
      fulfillmentMethod: "pickup",
    });
    await this.createOrderItems([
      { orderId: order6.id, menuItemId: item6.id, quantity: 1, priceAtOrder: 19.99, itemTitle: "Chicken Parmesan" },
    ]);

    const order7 = await this.createOrder({
      chefId: chef2.id,
      buyerName: "Rachel Green",
      buyerEmail: "rachel.g@email.com",
      totalAmount: 42.98,
      status: "completed",
      fulfillmentMethod: "delivery",
      deliveryAddress: "88 E 10th St, New York, NY 10003",
      deliveryLat: 40.7300,
      deliveryLong: -73.9910,
    });
    await this.createOrderItems([
      { orderId: order7.id, menuItemId: item5.id, quantity: 1, priceAtOrder: 32.99, itemTitle: "Fresh Fettuccine Alfredo" },
      { orderId: order7.id, menuItemId: item7.id, quantity: 1, priceAtOrder: 9.99, itemTitle: "Tiramisu" },
    ]);

    // Chef 3 (Mei Lin) orders
    const order8 = await this.createOrder({
      chefId: chef3.id,
      buyerName: "Alex Rivera",
      buyerEmail: "alex.r@email.com",
      buyerPhone: "212-555-0456",
      totalAmount: 55.97,
      status: "pending",
      fulfillmentMethod: "delivery",
      deliveryAddress: "150 Orchard St, New York, NY 10002",
      deliveryLat: 40.7201,
      deliveryLong: -73.9886,
      notes: "Leave at door, apartment 2A",
    });
    await this.createOrderItems([
      { orderId: order8.id, menuItemId: item8.id, quantity: 1, priceAtOrder: 21.99, itemTitle: "Teriyaki Salmon Bowl" },
      { orderId: order8.id, menuItemId: item9.id, quantity: 1, priceAtOrder: 16.99, itemTitle: "Pad Thai" },
      { orderId: order8.id, menuItemId: item10.id, quantity: 1, priceAtOrder: 17.99, itemTitle: "Thai Green Curry" },
    ]);

    const order9 = await this.createOrder({
      chefId: chef3.id,
      buyerName: "Priya Patel",
      buyerEmail: "priya.p@email.com",
      buyerPhone: "212-555-0523",
      totalAmount: 37.97,
      status: "confirmed",
      fulfillmentMethod: "delivery",
      deliveryAddress: "200 Allen St, New York, NY 10002",
      deliveryLat: 40.7220,
      deliveryLong: -73.9895,
    });
    await this.createOrderItems([
      { orderId: order9.id, menuItemId: item10.id, quantity: 1, priceAtOrder: 17.99, itemTitle: "Thai Green Curry" },
      { orderId: order9.id, menuItemId: item11.id, quantity: 1, priceAtOrder: 8.99, itemTitle: "Vegetable Spring Rolls" },
      { orderId: order9.id, menuItemId: item12.id, quantity: 1, priceAtOrder: 15.99, itemTitle: "Miso Glazed Tofu Bowl" },
    ]);

    const order10 = await this.createOrder({
      chefId: chef3.id,
      buyerName: "Tom Bradley",
      buyerEmail: "tbradley@email.com",
      totalAmount: 30.98,
      status: "pending",
      fulfillmentMethod: "delivery",
      deliveryAddress: "78 Rivington St, New York, NY 10002",
      deliveryLat: 40.7198,
      deliveryLong: -73.9903,
      notes: "No peanuts please - severe allergy",
    });
    await this.createOrderItems([
      { orderId: order10.id, menuItemId: item8.id, quantity: 1, priceAtOrder: 21.99, itemTitle: "Teriyaki Salmon Bowl" },
      { orderId: order10.id, menuItemId: item11.id, quantity: 1, priceAtOrder: 8.99, itemTitle: "Vegetable Spring Rolls" },
    ]);

    const order11 = await this.createOrder({
      chefId: chef3.id,
      buyerName: "Nina Simmons",
      buyerEmail: "nina.s@email.com",
      totalAmount: 59.99,
      status: "completed",
      fulfillmentMethod: "delivery",
      deliveryAddress: "55 Delancey St, New York, NY 10002",
      deliveryLat: 40.7184,
      deliveryLong: -73.9908,
    });
    await this.createOrderItems([
      { orderId: order11.id, menuItemId: item10.id, quantity: 1, priceAtOrder: 59.99, itemTitle: "Thai Green Curry" },
    ]);

    console.log("Database seeded successfully!");
  }
}

export const storage = new DatabaseStorage();
