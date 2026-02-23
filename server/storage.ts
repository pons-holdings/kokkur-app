import {
  chefProfiles, menus, menuDaySlots, menuItems, menuItemAssignments, ingredients, allergens,
  itemIngredients, itemAllergens, orders, orderItems, userFavorites,
  servingOptions, itemPhotos, ingredientAllergens, assignmentServingOptions,
  buyerProfiles, buyerAllergens,
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
  type AssignedServingOptionWithDetails,
  type BuyerProfile, type InsertBuyerProfile, type BuyerProfileWithAllergens,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // Chefs
  getChefs(): Promise<ChefProfileWithDaySlots[]>;
  getChefBySlug(slug: string): Promise<ChefProfileWithDaySlots | undefined>;
  getChefById(id: number): Promise<ChefProfile | undefined>;
  createChef(chef: InsertChefProfile): Promise<ChefProfile>;
  updateChef(id: number, chef: Partial<InsertChefProfile>): Promise<ChefProfile | undefined>;

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

  // Buyer Profiles
  getBuyerProfileBySessionId(sessionId: string): Promise<BuyerProfileWithAllergens | undefined>;
  createBuyerProfile(profile: InsertBuyerProfile): Promise<BuyerProfile>;
  updateBuyerProfile(id: number, profile: Partial<InsertBuyerProfile>): Promise<BuyerProfile | undefined>;
  setBuyerAllergens(buyerProfileId: number, allergenIds: number[]): Promise<void>;

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

    const result = chefsData.map(chef => ({
      ...chef,
      daySlots: slotsByChefId.get(chef.id) || [],
    }));

    return result;
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

  async updateChef(id: number, chef: Partial<InsertChefProfile>): Promise<ChefProfile | undefined> {
    const [updated] = await db.update(chefProfiles).set(chef).where(eq(chefProfiles.id, id)).returning();
    return updated;
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

  // Buyer Profiles
  async getBuyerProfileBySessionId(sessionId: string): Promise<BuyerProfileWithAllergens | undefined> {
    const [profile] = await db.select().from(buyerProfiles).where(eq(buyerProfiles.sessionId, sessionId));
    if (!profile) return undefined;

    const result = await db
      .select({ allergen: allergens })
      .from(buyerAllergens)
      .innerJoin(allergens, eq(buyerAllergens.allergenId, allergens.id))
      .where(eq(buyerAllergens.buyerProfileId, profile.id));

    return {
      ...profile,
      allergens: result.map(r => r.allergen),
    };
  }

  async createBuyerProfile(profile: InsertBuyerProfile): Promise<BuyerProfile> {
    const [newProfile] = await db.insert(buyerProfiles).values(profile).returning();
    return newProfile;
  }

  async updateBuyerProfile(id: number, profile: Partial<InsertBuyerProfile>): Promise<BuyerProfile | undefined> {
    const [updated] = await db
      .update(buyerProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(buyerProfiles.id, id))
      .returning();
    return updated;
  }

  async setBuyerAllergens(buyerProfileId: number, allergenIds: number[]): Promise<void> {
    await db.delete(buyerAllergens).where(eq(buyerAllergens.buyerProfileId, buyerProfileId));
    if (allergenIds.length > 0) {
      await db.insert(buyerAllergens).values(
        allergenIds.map(allergenId => ({ buyerProfileId, allergenId }))
      );
    }
  }

  async seedData(): Promise<void> {
   try {
    // Skip if data already exists
    const [existing] = await db.select({ count: sql<number>`count(*)` }).from(chefProfiles);
    if (existing.count > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    // Clear all tables in dependency order (for fresh seed)
    await db.delete(assignmentServingOptions);
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(menuItemAssignments);
    await db.delete(itemAllergens);
    await db.delete(itemIngredients);
    await db.delete(itemPhotos);
    await db.delete(ingredientAllergens);
    await db.delete(servingOptions);
    await db.delete(menuItems);
    await db.delete(menuDaySlots);
    await db.delete(menus);
    await db.delete(allergens);
    await db.delete(ingredients);
    await db.delete(userFavorites);
    await db.delete(chefProfiles);

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
      slug: "maria-rodriguez",
      firstName: "Maria",
      lastName: "Rodriguez",
      bio: "Bringing authentic Mexican flavors to your table. Family recipes passed down through generations, made with love and the freshest local ingredients.",
      cuisineTags: ["Mexican", "Latin American", "Vegetarian-Friendly"],
      locationLat: 40.7484,
      locationLong: -73.9967,
      locationName: "Chelsea, Manhattan",
      serviceRadius: 8,
      fulfillmentMethod: "both",
      deliveryFee: 5.99,
      profileImageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
    });

    const chef2 = await this.createChef({
      slug: "antonio-russo",
      firstName: "Antonio",
      lastName: "Russo",
      bio: "Italian home cooking at its finest. From fresh pasta to wood-fired pizzas, every dish is crafted with passion and tradition.",
      cuisineTags: ["Italian", "Mediterranean", "Pasta"],
      locationLat: 40.7282,
      locationLong: -73.9942,
      locationName: "East Village, Manhattan",
      serviceRadius: 6,
      fulfillmentMethod: "both",
      deliveryFee: 4.99,
      profileImageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
    });

    const chef3 = await this.createChef({
      slug: "mei-lin",
      firstName: "Mei",
      lastName: "Lin",
      bio: "Fusion cuisine blending Asian traditions with modern techniques. Healthy, flavorful, and beautifully presented dishes for any occasion.",
      cuisineTags: ["Asian Fusion", "Japanese", "Thai", "Healthy"],
      locationLat: 40.7193,
      locationLong: -73.9951,
      locationName: "Lower East Side, Manhattan",
      serviceRadius: 7,
      fulfillmentMethod: "delivery",
      deliveryFee: 6.99,
      profileImageUrl: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&h=400&fit=crop&crop=face",
    });

    const chef4 = await this.createChef({
      slug: "luna-reyes",
      firstName: "Luna",
      lastName: "Reyes",
      bio: "100% plant-based meals that prove vegan food can be bold, satisfying, and delicious. Zero compromise on flavor.",
      cuisineTags: ["Vegan", "Plant-Based", "Healthy"],
      locationLat: 40.7340,
      locationLong: -74.0054,
      locationName: "West Village, Manhattan",
      serviceRadius: 5,
      fulfillmentMethod: "both",
      deliveryFee: 4.99,
      profileImageUrl: "https://images.unsplash.com/photo-1607631568010-a87245c0daf8?w=400&h=400&fit=crop&crop=face",
    });

    const chef5 = await this.createChef({
      slug: "kenji-tanaka",
      firstName: "Kenji",
      lastName: "Tanaka",
      bio: "Authentic Japanese comfort food — from rich tonkotsu ramen to hand-rolled sushi, made with traditional techniques.",
      cuisineTags: ["Japanese", "Ramen", "Sushi"],
      locationLat: 40.7527,
      locationLong: -73.9735,
      locationName: "Midtown East, Manhattan",
      serviceRadius: 6,
      fulfillmentMethod: "pickup",
      profileImageUrl: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=400&fit=crop&crop=face",
    });

    const chef6 = await this.createChef({
      slug: "sophie-martin",
      firstName: "Sophie",
      lastName: "Martin",
      bio: "Parisian-trained pastry chef bringing artisan croissants, tarts, and cakes to your doorstep.",
      cuisineTags: ["Baked Goods", "French", "Pastry"],
      locationLat: 40.7654,
      locationLong: -73.9857,
      locationName: "Hell's Kitchen, Manhattan",
      serviceRadius: 5,
      fulfillmentMethod: "both",
      deliveryFee: 3.99,
      profileImageUrl: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400&h=400&fit=crop&crop=face",
    });

    const chef7 = await this.createChef({
      slug: "marcus-williams",
      firstName: "Marcus",
      lastName: "Williams",
      bio: "Low-and-slow smoked meats with homemade rubs and sauces. Texas-style BBQ, Brooklyn soul.",
      cuisineTags: ["BBQ", "Southern", "Smoked Meats"],
      locationLat: 40.7128,
      locationLong: -73.9566,
      locationName: "Williamsburg, Brooklyn",
      serviceRadius: 8,
      fulfillmentMethod: "both",
      deliveryFee: 5.99,
      profileImageUrl: "https://images.unsplash.com/photo-1560807707-8cc77767d783?w=400&h=400&fit=crop&crop=face",
    });

    const chef8 = await this.createChef({
      slug: "denise-jackson",
      firstName: "Denise",
      lastName: "Jackson",
      bio: "Harlem soul food rooted in family tradition. Collard greens, fried chicken, and mac & cheese like grandma made.",
      cuisineTags: ["Soul Food", "Southern", "Comfort Food"],
      locationLat: 40.8116,
      locationLong: -73.9465,
      locationName: "Harlem, Manhattan",
      serviceRadius: 10,
      fulfillmentMethod: "delivery",
      deliveryFee: 6.99,
      profileImageUrl: "https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=400&h=400&fit=crop&crop=face",
    });

    const chef9 = await this.createChef({
      slug: "nadine-baptiste",
      firstName: "Nadine",
      lastName: "Baptiste",
      bio: "Island flavors from Jamaica and Haiti. Jerk chicken, oxtail stew, and plantains that transport you to the Caribbean.",
      cuisineTags: ["Caribbean", "Jamaican", "Haitian"],
      locationLat: 40.6694,
      locationLong: -73.9422,
      locationName: "Crown Heights, Brooklyn",
      serviceRadius: 7,
      fulfillmentMethod: "both",
      deliveryFee: 5.99,
      profileImageUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&crop=face",
    });

    const chef10 = await this.createChef({
      slug: "bobby-hayes",
      firstName: "Bobby",
      lastName: "Hayes",
      bio: "Classic American comfort food done right. Burgers, meatloaf, and milkshakes — honest food, no fuss.",
      cuisineTags: ["Comfort Food", "American", "Diner"],
      locationLat: 40.7720,
      locationLong: -73.9303,
      locationName: "Astoria, Queens",
      serviceRadius: 8,
      fulfillmentMethod: "pickup",
      profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    });

    const chef11 = await this.createChef({
      slug: "priya-sharma",
      firstName: "Priya",
      lastName: "Sharma",
      bio: "Vibrant Indian home cooking. From butter chicken to dosas, every spice blend is ground fresh daily.",
      cuisineTags: ["Indian", "Curry", "Vegetarian-Friendly"],
      locationLat: 40.7497,
      locationLong: -73.8831,
      locationName: "Jackson Heights, Queens",
      serviceRadius: 10,
      fulfillmentMethod: "delivery",
      deliveryFee: 7.99,
      profileImageUrl: "https://images.unsplash.com/photo-1611432579699-484f7990b127?w=400&h=400&fit=crop&crop=face",
    });

    // Use relative dates so seed data always shows upcoming offerings
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const futureDate = (daysFromNow: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + daysFromNow);
      return d;
    };

    const findAllergen = (name: string) => createdAllergens.find((a) => a.name === name)?.id || 0;
    const findIngredient = (name: string) => createdIngredients.find((i) => i.name === name)?.id || 0;

    // ── Chef 1 (Maria) items ──
    const item1 = await this.createMenuItem({
      chefId: chef1.id,
      title: "Chicken Enchiladas Verdes",
      description: "Tender shredded chicken wrapped in corn tortillas, smothered in tangy tomatillo salsa verde and melted cheese. Served with rice and beans.",
    });
    await this.createServingOption({ menuItemId: item1.id, servingSize: 1, label: "1 serving", price: 16.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item1.id, servingSize: 2, label: "2 servings", price: 29.99, isDefault: 0 });
    await this.addItemAllergens(item1.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item1.id, [findIngredient("Chicken"), findIngredient("Cheese"), findIngredient("Onions"), findIngredient("Rice")]);
    await this.createItemPhoto({ menuItemId: item1.id, imageUrl: "https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=800&h=600&fit=crop", isCover: 1 });

    const item2 = await this.createMenuItem({
      chefId: chef1.id,
      title: "Vegetarian Tamales",
      description: "Handmade masa tamales filled with roasted poblano peppers and queso fresco, wrapped in corn husks.",
    });
    await this.createServingOption({ menuItemId: item2.id, servingSize: 6, label: "Half dozen", price: 14.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item2.id, servingSize: 12, label: "Full dozen", price: 26.99, isDefault: 0 });
    await this.addItemAllergens(item2.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item2.id, [findIngredient("Cheese"), findIngredient("Bell Peppers")]);
    await this.createItemPhoto({ menuItemId: item2.id, imageUrl: "https://images.unsplash.com/photo-1630409351241-e90e7f5e434d?w=800&h=600&fit=crop", isCover: 1 });

    const item3 = await this.createMenuItem({
      chefId: chef1.id,
      title: "Carnitas Taco Platter",
      description: "Slow-braised pork carnitas with pickled onions, fresh cilantro, and homemade salsa. Includes 6 tacos.",
    });
    await this.createServingOption({ menuItemId: item3.id, servingSize: 1, label: "6 tacos", price: 18.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item3.id, servingSize: 2, label: "12 tacos (party size)", price: 34.99, isDefault: 0 });
    await this.addItemIngredients(item3.id, [findIngredient("Pork"), findIngredient("Onions"), findIngredient("Garlic")]);
    await this.createItemPhoto({ menuItemId: item3.id, imageUrl: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=800&h=600&fit=crop", isCover: 1 });

    // ── Chef 2 (Antonio) items ──
    const item4 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Homemade Lasagna",
      description: "Layers of fresh pasta, rich beef bolognese, creamy bechamel, and aged parmesan. A family recipe perfected over generations.",
    });
    await this.createServingOption({ menuItemId: item4.id, servingSize: 2, label: "Half tray (2-3 servings)", price: 24.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item4.id, servingSize: 4, label: "Full tray (4-6 servings)", price: 44.99, isDefault: 0 });
    await this.addItemAllergens(item4.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item4.id, [findIngredient("Beef"), findIngredient("Pasta"), findIngredient("Cheese"), findIngredient("Tomatoes")]);
    await this.createItemPhoto({ menuItemId: item4.id, imageUrl: "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&h=600&fit=crop", isCover: 1 });

    const item5 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Fresh Fettuccine Alfredo",
      description: "Hand-cut fettuccine in a velvety parmesan cream sauce with fresh cracked pepper.",
    });
    await this.createServingOption({ menuItemId: item5.id, servingSize: 1, label: "1 serving", price: 17.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item5.id, servingSize: 2, label: "2 servings", price: 32.99, isDefault: 0 });
    await this.addItemAllergens(item5.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item5.id, [findIngredient("Pasta"), findIngredient("Butter"), findIngredient("Cream"), findIngredient("Cheese")]);
    await this.createItemPhoto({ menuItemId: item5.id, imageUrl: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=800&h=600&fit=crop", isCover: 1 });

    const item6 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Chicken Parmesan",
      description: "Crispy breaded chicken cutlet topped with marinara and melted mozzarella, served over spaghetti.",
    });
    await this.createServingOption({ menuItemId: item6.id, servingSize: 1, label: "1 serving", price: 19.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item6.id, servingSize: 4, label: "Family size (4 servings)", price: 69.99, isDefault: 0 });
    await this.addItemAllergens(item6.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item6.id, [findIngredient("Chicken"), findIngredient("Pasta"), findIngredient("Tomatoes"), findIngredient("Cheese")]);
    await this.createItemPhoto({ menuItemId: item6.id, imageUrl: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=800&h=600&fit=crop", isCover: 1 });

    const item7 = await this.createMenuItem({
      chefId: chef2.id,
      title: "Tiramisu",
      description: "Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream.",
    });
    await this.createServingOption({ menuItemId: item7.id, servingSize: 1, label: "1 slice", price: 9.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item7.id, servingSize: 6, label: "Whole cake (6-8 slices)", price: 49.99, isDefault: 0 });
    await this.addItemAllergens(item7.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.createItemPhoto({ menuItemId: item7.id, imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&h=600&fit=crop", isCover: 1 });

    // ── Chef 3 (Mei Lin) items ──
    const item8 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Teriyaki Salmon Bowl",
      description: "Glazed salmon over jasmine rice with pickled vegetables, edamame, and sesame seeds.",
    });
    await this.createServingOption({ menuItemId: item8.id, servingSize: 1, label: "1 bowl", price: 21.99, isDefault: 1 });
    await this.addItemAllergens(item8.id, [findAllergen("Fish"), findAllergen("Soy"), findAllergen("Sesame")]);
    await this.addItemIngredients(item8.id, [findIngredient("Salmon"), findIngredient("Rice"), findIngredient("Carrots")]);
    await this.createItemPhoto({ menuItemId: item8.id, imageUrl: "https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=800&h=600&fit=crop", isCover: 1 });

    const item9 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Pad Thai",
      description: "Stir-fried rice noodles with shrimp, tofu, bean sprouts, and crushed peanuts in tamarind sauce.",
    });
    await this.createServingOption({ menuItemId: item9.id, servingSize: 1, label: "1 serving", price: 16.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item9.id, servingSize: 2, label: "2 servings", price: 30.99, isDefault: 0 });
    await this.addItemAllergens(item9.id, [findAllergen("Shellfish"), findAllergen("Peanuts"), findAllergen("Soy"), findAllergen("Eggs")]);
    await this.addItemIngredients(item9.id, [findIngredient("Shrimp"), findIngredient("Tofu"), findIngredient("Rice")]);
    await this.createItemPhoto({ menuItemId: item9.id, imageUrl: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800&h=600&fit=crop", isCover: 1 });

    const item10 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Thai Green Curry",
      description: "Aromatic coconut curry with vegetables and your choice of chicken or tofu. Served with jasmine rice.",
    });
    await this.createServingOption({ menuItemId: item10.id, servingSize: 1, label: "1 serving", price: 17.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item10.id, servingSize: 4, label: "Family size (4 servings)", price: 59.99, isDefault: 0 });
    await this.addItemAllergens(item10.id, [findAllergen("Soy")]);
    await this.addItemIngredients(item10.id, [findIngredient("Chicken"), findIngredient("Coconut Milk"), findIngredient("Rice"), findIngredient("Broccoli")]);
    await this.createItemPhoto({ menuItemId: item10.id, imageUrl: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=800&h=600&fit=crop", isCover: 1 });

    const item11 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Vegetable Spring Rolls",
      description: "Crispy fried spring rolls filled with cabbage, carrots, and glass noodles. Served with sweet chili sauce.",
    });
    await this.createServingOption({ menuItemId: item11.id, servingSize: 4, label: "4 pieces", price: 8.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item11.id, servingSize: 8, label: "8 pieces", price: 15.99, isDefault: 0 });
    await this.addItemAllergens(item11.id, [findAllergen("Wheat"), findAllergen("Soy")]);
    await this.addItemIngredients(item11.id, [findIngredient("Carrots")]);
    await this.createItemPhoto({ menuItemId: item11.id, imageUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&h=600&fit=crop", isCover: 1 });

    const item12 = await this.createMenuItem({
      chefId: chef3.id,
      title: "Miso Glazed Tofu Bowl",
      description: "Crispy tofu with miso glaze, quinoa, roasted vegetables, and ginger dressing. Vegan and gluten-free.",
    });
    await this.createServingOption({ menuItemId: item12.id, servingSize: 1, label: "1 bowl", price: 15.99, isDefault: 1 });
    await this.addItemAllergens(item12.id, [findAllergen("Soy")]);
    await this.addItemIngredients(item12.id, [findIngredient("Tofu"), findIngredient("Quinoa"), findIngredient("Broccoli"), findIngredient("Carrots")]);
    await this.createItemPhoto({ menuItemId: item12.id, imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop", isCover: 1 });

    // ── Chef 4 (Luna) items — Vegan ──
    const item13 = await this.createMenuItem({
      chefId: chef4.id,
      title: "Quinoa Buddha Bowl",
      description: "Roasted sweet potato, avocado, chickpeas, kale, and tahini dressing over fluffy quinoa. 100% plant-based.",
    });
    await this.createServingOption({ menuItemId: item13.id, servingSize: 1, label: "1 bowl", price: 15.99, isDefault: 1 });
    await this.addItemAllergens(item13.id, [findAllergen("Sesame")]);
    await this.addItemIngredients(item13.id, [findIngredient("Quinoa"), findIngredient("Kale"), findIngredient("Olive Oil")]);
    await this.createItemPhoto({ menuItemId: item13.id, imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop", isCover: 1 });

    const item14 = await this.createMenuItem({
      chefId: chef4.id,
      title: "Jackfruit Tacos",
      description: "Smoky pulled jackfruit with pickled red onion, cilantro lime crema (cashew-based), and fresh salsa on corn tortillas.",
    });
    await this.createServingOption({ menuItemId: item14.id, servingSize: 1, label: "3 tacos", price: 14.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item14.id, servingSize: 2, label: "6 tacos", price: 26.99, isDefault: 0 });
    await this.addItemAllergens(item14.id, [findAllergen("Tree Nuts")]);
    await this.addItemIngredients(item14.id, [findIngredient("Onions"), findIngredient("Cilantro"), findIngredient("Cashews")]);
    await this.createItemPhoto({ menuItemId: item14.id, imageUrl: "https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=800&h=600&fit=crop", isCover: 1 });

    const item_luna3 = await this.createMenuItem({
      chefId: chef4.id,
      title: "Mushroom Lentil Bolognese",
      description: "Hearty lentil and mushroom ragu over fresh pappardelle. Rich, savory, 100% plant-based.",
    });
    await this.createServingOption({ menuItemId: item_luna3.id, servingSize: 1, label: "1 serving", price: 16.99, isDefault: 1 });
    await this.addItemAllergens(item_luna3.id, [findAllergen("Wheat")]);
    await this.addItemIngredients(item_luna3.id, [findIngredient("Mushrooms"), findIngredient("Tomatoes"), findIngredient("Pasta"), findIngredient("Garlic")]);
    await this.createItemPhoto({ menuItemId: item_luna3.id, imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=600&fit=crop", isCover: 1 });

    const item_luna4 = await this.createMenuItem({
      chefId: chef4.id,
      title: "Roasted Cauliflower Steak",
      description: "Thick-cut cauliflower steak with chimichurri, roasted chickpeas, and quinoa pilaf.",
    });
    await this.createServingOption({ menuItemId: item_luna4.id, servingSize: 1, label: "1 plate", price: 17.99, isDefault: 1 });
    await this.addItemIngredients(item_luna4.id, [findIngredient("Quinoa"), findIngredient("Olive Oil"), findIngredient("Garlic"), findIngredient("Parsley")]);
    await this.createItemPhoto({ menuItemId: item_luna4.id, imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop", isCover: 1 });

    const item_luna5 = await this.createMenuItem({
      chefId: chef4.id,
      title: "Vegan Chocolate Mousse",
      description: "Silky avocado-based chocolate mousse with coconut cream and fresh raspberries.",
    });
    await this.createServingOption({ menuItemId: item_luna5.id, servingSize: 1, label: "1 cup", price: 8.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item_luna5.id, servingSize: 4, label: "4 cups", price: 29.99, isDefault: 0 });
    await this.addItemIngredients(item_luna5.id, [findIngredient("Coconut Milk"), findIngredient("Coconut")]);
    await this.createItemPhoto({ menuItemId: item_luna5.id, imageUrl: "https://images.unsplash.com/photo-1541783245831-57d6fb0926d3?w=800&h=600&fit=crop", isCover: 1 });

    // ── Chef 5 (Kenji) items — Japanese ──
    const item15 = await this.createMenuItem({
      chefId: chef5.id,
      title: "Tonkotsu Ramen",
      description: "Rich, creamy pork bone broth simmered 12 hours, with chashu pork, soft-boiled egg, nori, and fresh noodles.",
    });
    await this.createServingOption({ menuItemId: item15.id, servingSize: 1, label: "1 bowl", price: 18.99, isDefault: 1 });
    await this.addItemAllergens(item15.id, [findAllergen("Wheat"), findAllergen("Eggs"), findAllergen("Soy")]);
    await this.addItemIngredients(item15.id, [findIngredient("Pork"), findIngredient("Eggs"), findIngredient("Noodles"), findIngredient("Soy Sauce")]);
    await this.createItemPhoto({ menuItemId: item15.id, imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&h=600&fit=crop", isCover: 1 });

    const item16 = await this.createMenuItem({
      chefId: chef5.id,
      title: "Chirashi Sushi Bowl",
      description: "Assorted fresh sashimi over seasoned sushi rice with pickled ginger, wasabi, and soy sauce.",
    });
    await this.createServingOption({ menuItemId: item16.id, servingSize: 1, label: "1 bowl", price: 22.99, isDefault: 1 });
    await this.addItemAllergens(item16.id, [findAllergen("Fish"), findAllergen("Soy"), findAllergen("Sesame")]);
    await this.addItemIngredients(item16.id, [findIngredient("Salmon"), findIngredient("Tuna"), findIngredient("Rice"), findIngredient("Soy Sauce")]);
    await this.createItemPhoto({ menuItemId: item16.id, imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&h=600&fit=crop", isCover: 1 });

    const item_kenji3 = await this.createMenuItem({
      chefId: chef5.id,
      title: "Chicken Katsu Curry",
      description: "Crispy panko-crusted chicken cutlet with rich Japanese curry sauce, steamed rice, and pickled vegetables.",
    });
    await this.createServingOption({ menuItemId: item_kenji3.id, servingSize: 1, label: "1 plate", price: 19.99, isDefault: 1 });
    await this.addItemAllergens(item_kenji3.id, [findAllergen("Wheat"), findAllergen("Eggs")]);
    await this.addItemIngredients(item_kenji3.id, [findIngredient("Chicken"), findIngredient("Breadcrumbs"), findIngredient("Rice"), findIngredient("Carrots")]);
    await this.createItemPhoto({ menuItemId: item_kenji3.id, imageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&h=600&fit=crop", isCover: 1 });

    const item_kenji4 = await this.createMenuItem({
      chefId: chef5.id,
      title: "Gyoza Platter",
      description: "Pan-fried pork and vegetable dumplings with dipping sauce. Hand-folded to order.",
    });
    await this.createServingOption({ menuItemId: item_kenji4.id, servingSize: 8, label: "8 pieces", price: 12.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item_kenji4.id, servingSize: 16, label: "16 pieces", price: 22.99, isDefault: 0 });
    await this.addItemAllergens(item_kenji4.id, [findAllergen("Wheat"), findAllergen("Soy"), findAllergen("Sesame")]);
    await this.addItemIngredients(item_kenji4.id, [findIngredient("Pork"), findIngredient("Cabbage"), findIngredient("Ginger"), findIngredient("Soy Sauce")]);
    await this.createItemPhoto({ menuItemId: item_kenji4.id, imageUrl: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800&h=600&fit=crop", isCover: 1 });

    // ── Chef 6 (Sophie) items — Baked Goods ──
    const item17 = await this.createMenuItem({
      chefId: chef6.id,
      title: "Butter Croissant Box",
      description: "Flaky, golden croissants made with French butter. Baked fresh the morning of your order.",
    });
    await this.createServingOption({ menuItemId: item17.id, servingSize: 4, label: "Box of 4", price: 12.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item17.id, servingSize: 8, label: "Box of 8", price: 22.99, isDefault: 0 });
    await this.addItemAllergens(item17.id, [findAllergen("Wheat"), findAllergen("Milk"), findAllergen("Eggs")]);
    await this.addItemIngredients(item17.id, [findIngredient("Butter"), findIngredient("Flour"), findIngredient("Eggs")]);
    await this.createItemPhoto({ menuItemId: item17.id, imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop", isCover: 1 });

    const item18 = await this.createMenuItem({
      chefId: chef6.id,
      title: "Mixed Berry Tart",
      description: "Buttery shortcrust pastry filled with vanilla pastry cream and topped with fresh seasonal berries.",
    });
    await this.createServingOption({ menuItemId: item18.id, servingSize: 1, label: "1 slice", price: 8.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item18.id, servingSize: 8, label: "Whole tart (8 slices)", price: 44.99, isDefault: 0 });
    await this.addItemAllergens(item18.id, [findAllergen("Wheat"), findAllergen("Milk"), findAllergen("Eggs")]);
    await this.addItemIngredients(item18.id, [findIngredient("Butter"), findIngredient("Flour"), findIngredient("Cream"), findIngredient("Eggs")]);
    await this.createItemPhoto({ menuItemId: item18.id, imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&h=600&fit=crop", isCover: 1 });

    const item_sophie3 = await this.createMenuItem({
      chefId: chef6.id,
      title: "Chocolate Eclair Box",
      description: "Choux pastry filled with vanilla custard and topped with rich chocolate ganache. A Parisian classic.",
    });
    await this.createServingOption({ menuItemId: item_sophie3.id, servingSize: 4, label: "Box of 4", price: 16.99, isDefault: 1 });
    await this.addItemAllergens(item_sophie3.id, [findAllergen("Wheat"), findAllergen("Milk"), findAllergen("Eggs")]);
    await this.addItemIngredients(item_sophie3.id, [findIngredient("Butter"), findIngredient("Flour"), findIngredient("Eggs"), findIngredient("Cream")]);
    await this.createItemPhoto({ menuItemId: item_sophie3.id, imageUrl: "https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=800&h=600&fit=crop", isCover: 1 });

    const item_sophie4 = await this.createMenuItem({
      chefId: chef6.id,
      title: "Quiche Lorraine",
      description: "Savory French tart with bacon, Gruyere cheese, and a silky egg custard in buttery pastry.",
    });
    await this.createServingOption({ menuItemId: item_sophie4.id, servingSize: 1, label: "1 slice", price: 10.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item_sophie4.id, servingSize: 8, label: "Whole quiche (8 slices)", price: 39.99, isDefault: 0 });
    await this.addItemAllergens(item_sophie4.id, [findAllergen("Wheat"), findAllergen("Milk"), findAllergen("Eggs")]);
    await this.addItemIngredients(item_sophie4.id, [findIngredient("Butter"), findIngredient("Flour"), findIngredient("Eggs"), findIngredient("Cheese"), findIngredient("Cream")]);
    await this.createItemPhoto({ menuItemId: item_sophie4.id, imageUrl: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&h=600&fit=crop", isCover: 1 });

    const item_sophie5 = await this.createMenuItem({
      chefId: chef6.id,
      title: "Lemon Madeleines",
      description: "Delicate shell-shaped cakes with fresh lemon zest and a light dusting of powdered sugar.",
    });
    await this.createServingOption({ menuItemId: item_sophie5.id, servingSize: 6, label: "Box of 6", price: 9.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item_sophie5.id, servingSize: 12, label: "Box of 12", price: 17.99, isDefault: 0 });
    await this.addItemAllergens(item_sophie5.id, [findAllergen("Wheat"), findAllergen("Milk"), findAllergen("Eggs")]);
    await this.addItemIngredients(item_sophie5.id, [findIngredient("Butter"), findIngredient("Flour"), findIngredient("Eggs")]);
    await this.createItemPhoto({ menuItemId: item_sophie5.id, imageUrl: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800&h=600&fit=crop", isCover: 1 });

    // ── Chef 7 (Marcus) items — BBQ ──
    const item19 = await this.createMenuItem({
      chefId: chef7.id,
      title: "Smoked Brisket Plate",
      description: "14-hour smoked beef brisket with house-made BBQ sauce, coleslaw, cornbread, and baked beans.",
    });
    await this.createServingOption({ menuItemId: item19.id, servingSize: 1, label: "1 plate", price: 22.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item19.id, servingSize: 4, label: "Family platter (4 servings)", price: 79.99, isDefault: 0 });
    await this.addItemIngredients(item19.id, [findIngredient("Beef"), findIngredient("Corn")]);
    await this.createItemPhoto({ menuItemId: item19.id, imageUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&h=600&fit=crop", isCover: 1 });

    const item20 = await this.createMenuItem({
      chefId: chef7.id,
      title: "Pulled Pork Sandwich",
      description: "Slow-smoked pulled pork on a brioche bun with tangy vinegar slaw and pickles.",
    });
    await this.createServingOption({ menuItemId: item20.id, servingSize: 1, label: "1 sandwich", price: 14.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item20.id, servingSize: 2, label: "2 sandwiches", price: 26.99, isDefault: 0 });
    await this.addItemAllergens(item20.id, [findAllergen("Wheat")]);
    await this.addItemIngredients(item20.id, [findIngredient("Pork"), findIngredient("Bread")]);
    await this.createItemPhoto({ menuItemId: item20.id, imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&h=600&fit=crop", isCover: 1 });

    const item_marcus3 = await this.createMenuItem({
      chefId: chef7.id,
      title: "Smoked Chicken Wings",
      description: "Dry-rubbed and smoked wings with Alabama white sauce. Crispy skin, juicy inside.",
    });
    await this.createServingOption({ menuItemId: item_marcus3.id, servingSize: 1, label: "10 wings", price: 15.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item_marcus3.id, servingSize: 2, label: "20 wings", price: 28.99, isDefault: 0 });
    await this.addItemAllergens(item_marcus3.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item_marcus3.id, [findIngredient("Chicken"), findIngredient("Paprika")]);
    await this.createItemPhoto({ menuItemId: item_marcus3.id, imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop", isCover: 1 });

    const item_marcus4 = await this.createMenuItem({
      chefId: chef7.id,
      title: "BBQ Ribs Half Rack",
      description: "St. Louis-style pork ribs with Memphis dry rub and house-made BBQ sauce. Fall-off-the-bone tender.",
    });
    await this.createServingOption({ menuItemId: item_marcus4.id, servingSize: 1, label: "Half rack", price: 24.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item_marcus4.id, servingSize: 2, label: "Full rack", price: 44.99, isDefault: 0 });
    await this.addItemIngredients(item_marcus4.id, [findIngredient("Pork"), findIngredient("Paprika"), findIngredient("Garlic")]);
    await this.createItemPhoto({ menuItemId: item_marcus4.id, imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop", isCover: 1 });

    // ── Chef 8 (Denise) items — Soul Food ──
    const item21 = await this.createMenuItem({
      chefId: chef8.id,
      title: "Southern Fried Chicken",
      description: "Buttermilk-brined, crispy fried chicken with honey-hot sauce drizzle. Served with collard greens and cornbread.",
    });
    await this.createServingOption({ menuItemId: item21.id, servingSize: 1, label: "2 piece dinner", price: 18.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item21.id, servingSize: 2, label: "4 piece dinner", price: 32.99, isDefault: 0 });
    await this.addItemAllergens(item21.id, [findAllergen("Milk"), findAllergen("Wheat"), findAllergen("Eggs")]);
    await this.addItemIngredients(item21.id, [findIngredient("Chicken"), findIngredient("Butter"), findIngredient("Flour")]);
    await this.createItemPhoto({ menuItemId: item21.id, imageUrl: "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800&h=600&fit=crop", isCover: 1 });

    const item22 = await this.createMenuItem({
      chefId: chef8.id,
      title: "Mac & Cheese",
      description: "Creamy three-cheese baked macaroni with a crispy breadcrumb topping. The ultimate comfort side.",
    });
    await this.createServingOption({ menuItemId: item22.id, servingSize: 1, label: "Side portion", price: 12.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item22.id, servingSize: 4, label: "Family size", price: 22.99, isDefault: 0 });
    await this.addItemAllergens(item22.id, [findAllergen("Milk"), findAllergen("Wheat")]);
    await this.addItemIngredients(item22.id, [findIngredient("Pasta"), findIngredient("Cheese"), findIngredient("Butter"), findIngredient("Cream")]);
    await this.createItemPhoto({ menuItemId: item22.id, imageUrl: "https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=800&h=600&fit=crop", isCover: 1 });

    const item_denise3 = await this.createMenuItem({
      chefId: chef8.id,
      title: "Collard Greens & Cornbread",
      description: "Slow-cooked collard greens with smoked turkey and a side of sweet honey cornbread.",
    });
    await this.createServingOption({ menuItemId: item_denise3.id, servingSize: 1, label: "1 serving", price: 10.99, isDefault: 1 });
    await this.addItemIngredients(item_denise3.id, [findIngredient("Turkey"), findIngredient("Corn"), findIngredient("Butter")]);
    await this.createItemPhoto({ menuItemId: item_denise3.id, imageUrl: "https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=800&h=600&fit=crop", isCover: 1 });

    const item_denise4 = await this.createMenuItem({
      chefId: chef8.id,
      title: "Shrimp & Grits",
      description: "Creamy stone-ground grits topped with sauteed shrimp, andouille sausage, and Cajun gravy.",
    });
    await this.createServingOption({ menuItemId: item_denise4.id, servingSize: 1, label: "1 bowl", price: 19.99, isDefault: 1 });
    await this.addItemAllergens(item_denise4.id, [findAllergen("Shellfish"), findAllergen("Milk")]);
    await this.addItemIngredients(item_denise4.id, [findIngredient("Shrimp"), findIngredient("Butter"), findIngredient("Cream"), findIngredient("Corn")]);
    await this.createItemPhoto({ menuItemId: item_denise4.id, imageUrl: "https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=800&h=600&fit=crop", isCover: 1 });

    // ── Chef 9 (Nadine) items — Caribbean ──
    const item23 = await this.createMenuItem({
      chefId: chef9.id,
      title: "Jerk Chicken Plate",
      description: "Marinated and grilled jerk chicken with rice and peas, fried plantains, and festival bread.",
    });
    await this.createServingOption({ menuItemId: item23.id, servingSize: 1, label: "1 plate", price: 17.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item23.id, servingSize: 2, label: "2 plates", price: 32.99, isDefault: 0 });
    await this.addItemIngredients(item23.id, [findIngredient("Chicken"), findIngredient("Rice"), findIngredient("Garlic"), findIngredient("Thyme")]);
    await this.createItemPhoto({ menuItemId: item23.id, imageUrl: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&h=600&fit=crop", isCover: 1 });

    const item24 = await this.createMenuItem({
      chefId: chef9.id,
      title: "Oxtail Stew",
      description: "Slow-braised oxtail in a rich, savory gravy with butter beans, served over white rice.",
    });
    await this.createServingOption({ menuItemId: item24.id, servingSize: 1, label: "1 serving", price: 24.99, isDefault: 1 });
    await this.addItemIngredients(item24.id, [findIngredient("Beef"), findIngredient("Garlic"), findIngredient("Onions"), findIngredient("Rice"), findIngredient("Thyme")]);
    await this.createItemPhoto({ menuItemId: item24.id, imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=600&fit=crop", isCover: 1 });

    const item_nadine3 = await this.createMenuItem({
      chefId: chef9.id,
      title: "Curry Goat",
      description: "Tender goat slow-cooked in Caribbean curry with potatoes and scotch bonnet peppers. Served with rice and peas.",
    });
    await this.createServingOption({ menuItemId: item_nadine3.id, servingSize: 1, label: "1 plate", price: 21.99, isDefault: 1 });
    await this.addItemIngredients(item_nadine3.id, [findIngredient("Lamb"), findIngredient("Potatoes"), findIngredient("Rice"), findIngredient("Onions"), findIngredient("Garlic")]);
    await this.createItemPhoto({ menuItemId: item_nadine3.id, imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop", isCover: 1 });

    const item_nadine4 = await this.createMenuItem({
      chefId: chef9.id,
      title: "Fried Plantains & Black Bean Bowl",
      description: "Sweet fried plantains with seasoned black beans, avocado, pickled slaw, and scotch bonnet sauce.",
    });
    await this.createServingOption({ menuItemId: item_nadine4.id, servingSize: 1, label: "1 bowl", price: 13.99, isDefault: 1 });
    await this.addItemIngredients(item_nadine4.id, [findIngredient("Onions"), findIngredient("Garlic"), findIngredient("Rice")]);
    await this.createItemPhoto({ menuItemId: item_nadine4.id, imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&h=600&fit=crop", isCover: 1 });

    // ── Chef 10 (Bobby) items — Comfort Food ──
    const item25 = await this.createMenuItem({
      chefId: chef10.id,
      title: "Classic Cheeseburger",
      description: "Double smash patty with American cheese, special sauce, lettuce, tomato, and pickles on a toasted bun.",
    });
    await this.createServingOption({ menuItemId: item25.id, servingSize: 1, label: "1 burger", price: 13.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item25.id, servingSize: 2, label: "2 burgers", price: 24.99, isDefault: 0 });
    await this.addItemAllergens(item25.id, [findAllergen("Milk"), findAllergen("Wheat")]);
    await this.addItemIngredients(item25.id, [findIngredient("Beef"), findIngredient("Cheese"), findIngredient("Bread"), findIngredient("Lettuce"), findIngredient("Tomatoes")]);
    await this.createItemPhoto({ menuItemId: item25.id, imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop", isCover: 1 });

    const item26 = await this.createMenuItem({
      chefId: chef10.id,
      title: "Chicken Pot Pie",
      description: "Flaky butter crust filled with tender chicken, peas, carrots, and creamy gravy. Baked to golden perfection.",
    });
    await this.createServingOption({ menuItemId: item26.id, servingSize: 1, label: "Individual pie", price: 16.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item26.id, servingSize: 4, label: "Family pie (4 servings)", price: 49.99, isDefault: 0 });
    await this.addItemAllergens(item26.id, [findAllergen("Milk"), findAllergen("Wheat"), findAllergen("Eggs")]);
    await this.addItemIngredients(item26.id, [findIngredient("Chicken"), findIngredient("Butter"), findIngredient("Flour"), findIngredient("Peas"), findIngredient("Carrots"), findIngredient("Cream")]);
    await this.createItemPhoto({ menuItemId: item26.id, imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=600&fit=crop", isCover: 1 });

    const item_bobby3 = await this.createMenuItem({
      chefId: chef10.id,
      title: "Loaded Fries",
      description: "Crispy fries topped with cheddar cheese sauce, bacon bits, sour cream, and chives.",
    });
    await this.createServingOption({ menuItemId: item_bobby3.id, servingSize: 1, label: "Regular", price: 10.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item_bobby3.id, servingSize: 2, label: "Large", price: 16.99, isDefault: 0 });
    await this.addItemAllergens(item_bobby3.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item_bobby3.id, [findIngredient("Potatoes"), findIngredient("Cheese"), findIngredient("Sour Cream")]);
    await this.createItemPhoto({ menuItemId: item_bobby3.id, imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&h=600&fit=crop", isCover: 1 });

    const item_bobby4 = await this.createMenuItem({
      chefId: chef10.id,
      title: "Philly Cheesesteak",
      description: "Thinly sliced ribeye with melted provolone, sauteed onions and peppers on a hoagie roll.",
    });
    await this.createServingOption({ menuItemId: item_bobby4.id, servingSize: 1, label: "1 sandwich", price: 15.99, isDefault: 1 });
    await this.addItemAllergens(item_bobby4.id, [findAllergen("Milk"), findAllergen("Wheat")]);
    await this.addItemIngredients(item_bobby4.id, [findIngredient("Beef"), findIngredient("Cheese"), findIngredient("Onions"), findIngredient("Bell Peppers"), findIngredient("Bread")]);
    await this.createItemPhoto({ menuItemId: item_bobby4.id, imageUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&h=600&fit=crop", isCover: 1 });

    // ── Chef 11 (Priya) items — Indian ──
    const item27 = await this.createMenuItem({
      chefId: chef11.id,
      title: "Butter Chicken",
      description: "Tender chicken in a rich, creamy tomato-butter sauce with aromatic spices. Served with basmati rice and naan.",
    });
    await this.createServingOption({ menuItemId: item27.id, servingSize: 1, label: "1 serving with rice & naan", price: 17.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item27.id, servingSize: 4, label: "Family size (4 servings)", price: 59.99, isDefault: 0 });
    await this.addItemAllergens(item27.id, [findAllergen("Milk"), findAllergen("Wheat")]);
    await this.addItemIngredients(item27.id, [findIngredient("Chicken"), findIngredient("Butter"), findIngredient("Cream"), findIngredient("Tomatoes"), findIngredient("Rice"), findIngredient("Garlic"), findIngredient("Ginger")]);
    await this.createItemPhoto({ menuItemId: item27.id, imageUrl: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&h=600&fit=crop", isCover: 1 });

    const item28 = await this.createMenuItem({
      chefId: chef11.id,
      title: "Vegetable Samosa Platter",
      description: "Crispy pastry pockets filled with spiced potatoes and peas, served with mint chutney and tamarind sauce.",
    });
    await this.createServingOption({ menuItemId: item28.id, servingSize: 6, label: "6 pieces", price: 10.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item28.id, servingSize: 12, label: "12 pieces (party size)", price: 18.99, isDefault: 0 });
    await this.addItemAllergens(item28.id, [findAllergen("Wheat")]);
    await this.addItemIngredients(item28.id, [findIngredient("Potatoes"), findIngredient("Peas"), findIngredient("Flour"), findIngredient("Cumin"), findIngredient("Turmeric")]);
    await this.createItemPhoto({ menuItemId: item28.id, imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&h=600&fit=crop", isCover: 1 });

    const item_priya3 = await this.createMenuItem({
      chefId: chef11.id,
      title: "Paneer Tikka Masala",
      description: "Marinated paneer cubes in a smoky, creamy tomato gravy. Served with basmati rice and garlic naan.",
    });
    await this.createServingOption({ menuItemId: item_priya3.id, servingSize: 1, label: "1 serving with rice & naan", price: 16.99, isDefault: 1 });
    await this.addItemAllergens(item_priya3.id, [findAllergen("Milk"), findAllergen("Wheat")]);
    await this.addItemIngredients(item_priya3.id, [findIngredient("Cheese"), findIngredient("Cream"), findIngredient("Tomatoes"), findIngredient("Rice"), findIngredient("Ginger"), findIngredient("Garlic")]);
    await this.createItemPhoto({ menuItemId: item_priya3.id, imageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&h=600&fit=crop", isCover: 1 });

    const item_priya4 = await this.createMenuItem({
      chefId: chef11.id,
      title: "Lamb Biryani",
      description: "Fragrant basmati rice layered with spiced lamb, saffron, and fried onions. Sealed and slow-cooked in a clay pot.",
    });
    await this.createServingOption({ menuItemId: item_priya4.id, servingSize: 1, label: "1 serving", price: 21.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item_priya4.id, servingSize: 4, label: "Family size (4 servings)", price: 69.99, isDefault: 0 });
    await this.addItemAllergens(item_priya4.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item_priya4.id, [findIngredient("Lamb"), findIngredient("Rice"), findIngredient("Onions"), findIngredient("Yogurt"), findIngredient("Ginger"), findIngredient("Garlic")]);
    await this.createItemPhoto({ menuItemId: item_priya4.id, imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&h=600&fit=crop", isCover: 1 });

    const item_priya5 = await this.createMenuItem({
      chefId: chef11.id,
      title: "Masala Dosa",
      description: "Crispy fermented rice and lentil crepe filled with spiced potato masala. Served with coconut chutney and sambar.",
    });
    await this.createServingOption({ menuItemId: item_priya5.id, servingSize: 1, label: "1 dosa", price: 12.99, isDefault: 1 });
    await this.createServingOption({ menuItemId: item_priya5.id, servingSize: 2, label: "2 dosas", price: 22.99, isDefault: 0 });
    await this.addItemIngredients(item_priya5.id, [findIngredient("Rice"), findIngredient("Potatoes"), findIngredient("Onions"), findIngredient("Coconut"), findIngredient("Turmeric")]);
    await this.createItemPhoto({ menuItemId: item_priya5.id, imageUrl: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=800&h=600&fit=crop", isCover: 1 });

    // ── Programmatic day slot generation (~100 days) ──
    const chefSlotConfigs = [
      { chef: chef1, items: [item1, item2, item3], interval: 3, offset: 1 },
      { chef: chef2, items: [item4, item5, item6, item7], interval: 3, offset: 2 },
      { chef: chef3, items: [item8, item9, item10, item11, item12], interval: 2, offset: 1 },
      { chef: chef4, items: [item13, item14, item_luna3, item_luna4, item_luna5], interval: 3, offset: 2 },
      { chef: chef5, items: [item15, item16, item_kenji3, item_kenji4], interval: 3, offset: 1 },
      { chef: chef6, items: [item17, item18, item_sophie3, item_sophie4, item_sophie5], interval: 3, offset: 3 },
      { chef: chef7, items: [item19, item20, item_marcus3, item_marcus4], interval: 3, offset: 2 },
      { chef: chef8, items: [item21, item22, item_denise3, item_denise4], interval: 3, offset: 1 },
      { chef: chef9, items: [item23, item24, item_nadine3, item_nadine4], interval: 3, offset: 3 },
      { chef: chef10, items: [item25, item26, item_bobby3, item_bobby4], interval: 3, offset: 2 },
      { chef: chef11, items: [item27, item28, item_priya3, item_priya4, item_priya5], interval: 3, offset: 1 },
    ];

    const MAX_DAYS = 100;

    for (const config of chefSlotConfigs) {
      for (let day = config.offset; day <= MAX_DAYS; day += config.interval) {
        const slot = await this.createDaySlot({
          chefId: config.chef.id,
          date: futureDate(day),
          orderCutoffDate: futureDate(day - 1),
        });
        // Rotate items: not all items every day
        const itemsForSlot = config.items.filter((_, i) => (day + i) % 2 === 0 || i === 0);
        for (const item of itemsForSlot) {
          await this.assignItemToDaySlot(slot.id, item.id);
        }
      }
    }

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

    // Verify seed data completeness
    const [chefCount] = await db.select({ count: sql<number>`count(*)` }).from(chefProfiles);
    const [itemCount] = await db.select({ count: sql<number>`count(*)` }).from(menuItems);
    const [photoCount] = await db.select({ count: sql<number>`count(*)` }).from(itemPhotos);
    const [slotCount] = await db.select({ count: sql<number>`count(*)` }).from(menuDaySlots);
    const [assignmentCount] = await db.select({ count: sql<number>`count(*)` }).from(menuItemAssignments);
    console.log(`Seed complete: ${chefCount.count} chefs, ${itemCount.count} items, ${photoCount.count} photos, ${slotCount.count} slots, ${assignmentCount.count} assignments`);

    // Log a sample photo to verify URLs are stored
    const samplePhotos = await db.select().from(itemPhotos).limit(2);
    console.log("Sample photos:", samplePhotos.map(p => ({ id: p.id, menuItemId: p.menuItemId, isCover: p.isCover, url: p.imageUrl?.substring(0, 60) })));
   } catch (error) {
    console.error("SEED DATA FAILED:", error);
    throw error;
   }
  }
}

export const storage = new DatabaseStorage();
