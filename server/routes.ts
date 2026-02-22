import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

function parsePagination(query: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 50));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await storage.seedData();

  registerObjectStorageRoutes(app);

  app.get("/api/chefs", async (req, res) => {
    try {
      const chefs = await storage.getChefs();
      res.json(chefs);
    } catch (error) {
      console.error("Error fetching chefs:", error);
      res.status(500).json({ error: "Failed to fetch chefs" });
    }
  });

  app.get("/api/chefs/:slug", async (req, res) => {
    try {
      const chef = await storage.getChefBySlug(req.params.slug);
      if (!chef) {
        return res.status(404).json({ error: "Chef not found" });
      }
      res.json(chef);
    } catch (error) {
      console.error("Error fetching chef:", error);
      res.status(500).json({ error: "Failed to fetch chef" });
    }
  });

  const updateChefSchema = z.object({
    name: z.string().min(2).optional(),
    bio: z.string().nullable().optional(),
    profileImageUrl: z.string().nullable().optional(),
    cuisineTags: z.array(z.string()).optional(),
    locationLat: z.number().optional(),
    locationLong: z.number().optional(),
    locationName: z.string().nullable().optional(),
    serviceRadius: z.number().min(1).max(100).optional(),
    fulfillmentMethod: z.enum(["pickup", "delivery", "both"]).optional(),
    deliveryFee: z.number().min(0).nullable().optional(),
    paymentMethods: z.array(z.object({
      method: z.string(),
      handle: z.string(),
    })).nullable().optional(),
  });

  app.patch("/api/chefs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid chef ID" });
      }
      const data = updateChefSchema.parse(req.body);
      const updated = await storage.updateChef(id, data);
      if (!updated) {
        return res.status(404).json({ error: "Chef not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating chef:", error);
      res.status(500).json({ error: "Failed to update chef" });
    }
  });

  app.get("/api/allergens", async (req, res) => {
    try {
      const allergens = await storage.getAllergens();
      res.json(allergens);
    } catch (error) {
      console.error("Error fetching allergens:", error);
      res.status(500).json({ error: "Failed to fetch allergens" });
    }
  });

  app.get("/api/ingredients", async (req, res) => {
    try {
      const query = req.query.search as string;
      // Validate search query length
      if (query && query.length > 100) {
        return res.status(400).json({ error: "Search query too long (max 100 characters)" });
      }
      const ingredients = query
        ? await storage.searchIngredients(query)
        : await storage.getIngredients();
      res.json(ingredients);
    } catch (error) {
      console.error("Error fetching ingredients:", error);
      res.status(500).json({ error: "Failed to fetch ingredients" });
    }
  });

  // Create new ingredient
  app.post("/api/ingredients", async (req, res) => {
    try {
      const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
      const ingredient = await storage.createIngredient({ name });
      res.status(201).json(ingredient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating ingredient:", error);
      res.status(500).json({ error: "Failed to create ingredient" });
    }
  });

  // Get ingredients with their associated allergens
  app.get("/api/ingredients-with-allergens", async (req, res) => {
    try {
      const ingredients = await storage.getIngredientsWithAllergens();
      res.json(ingredients);
    } catch (error) {
      console.error("Error fetching ingredients with allergens:", error);
      res.status(500).json({ error: "Failed to fetch ingredients with allergens" });
    }
  });

  // Menu CRUD
  const createMenuSchema = z.object({
    chefId: z.number().int().positive(),
    title: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    startDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date format" }),
    endDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date format" }),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
  });

  app.get("/api/menus/chef/:chefId", async (req, res) => {
    try {
      const chefId = parseInt(req.params.chefId);
      if (isNaN(chefId)) {
        return res.status(400).json({ error: "Invalid chef ID" });
      }
      const menus = await storage.getMenusByChefId(chefId);
      res.json(menus);
    } catch (error) {
      console.error("Error fetching menus:", error);
      res.status(500).json({ error: "Failed to fetch menus" });
    }
  });

  app.post("/api/menus", async (req, res) => {
    try {
      const data = createMenuSchema.parse(req.body);
      const menu = await storage.createMenu({
        chefId: data.chefId,
        title: data.title,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: data.status,
      });
      res.status(201).json(menu);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating menu:", error);
      res.status(500).json({ error: "Failed to create menu" });
    }
  });

  const updateMenuSchema = z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
  });

  app.patch("/api/menus/:menuId", async (req, res) => {
    try {
      const menuId = parseInt(req.params.menuId);
      if (isNaN(menuId)) {
        return res.status(400).json({ error: "Invalid menu ID" });
      }
      const validated = updateMenuSchema.parse(req.body);
      const data: any = { ...validated };
      if (data.startDate) data.startDate = new Date(data.startDate);
      if (data.endDate) data.endDate = new Date(data.endDate);
      const menu = await storage.updateMenu(menuId, data);
      if (!menu) {
        return res.status(404).json({ error: "Menu not found" });
      }
      res.json(menu);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating menu:", error);
      res.status(500).json({ error: "Failed to update menu" });
    }
  });

  app.delete("/api/menus/:menuId", async (req, res) => {
    try {
      const menuId = parseInt(req.params.menuId);
      if (isNaN(menuId)) {
        return res.status(400).json({ error: "Invalid menu ID" });
      }
      const deleted = await storage.deleteMenu(menuId);
      if (!deleted) {
        return res.status(404).json({ error: "Menu not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting menu:", error);
      res.status(500).json({ error: "Failed to delete menu" });
    }
  });

  // Day Slot CRUD
  const createDaySlotSchema = z.object({
    chefId: z.number().int().positive(),
    date: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date format" }),
    orderCutoffDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date format" }),
  });

  // Get day slots by chef ID
  app.get("/api/chefs/:chefId/day-slots", async (req, res) => {
    try {
      const chefId = parseInt(req.params.chefId);
      if (isNaN(chefId)) {
        return res.status(400).json({ error: "Invalid chef ID" });
      }
      const daySlots = await storage.getDaySlotsByChefId(chefId);
      res.json(daySlots);
    } catch (error) {
      console.error("Error fetching day slots:", error);
      res.status(500).json({ error: "Failed to fetch day slots" });
    }
  });

  app.post("/api/day-slots", async (req, res) => {
    try {
      const data = createDaySlotSchema.parse(req.body);
      const daySlot = await storage.createDaySlot({
        chefId: data.chefId,
        date: new Date(data.date),
        orderCutoffDate: new Date(data.orderCutoffDate),
      });
      res.status(201).json(daySlot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating day slot:", error);
      res.status(500).json({ error: "Failed to create day slot" });
    }
  });

  const updateDaySlotSchema = z.object({
    date: z.string().optional(),
    orderCutoffDate: z.string().optional(),
  });

  app.patch("/api/day-slots/:daySlotId", async (req, res) => {
    try {
      const daySlotId = parseInt(req.params.daySlotId);
      if (isNaN(daySlotId)) {
        return res.status(400).json({ error: "Invalid day slot ID" });
      }
      const validated = updateDaySlotSchema.parse(req.body);
      const data: any = { ...validated };
      if (data.date) data.date = new Date(data.date);
      if (data.orderCutoffDate) data.orderCutoffDate = new Date(data.orderCutoffDate);
      const daySlot = await storage.updateDaySlot(daySlotId, data);
      if (!daySlot) {
        return res.status(404).json({ error: "Day slot not found" });
      }
      res.json(daySlot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating day slot:", error);
      res.status(500).json({ error: "Failed to update day slot" });
    }
  });

  app.delete("/api/day-slots/:daySlotId", async (req, res) => {
    try {
      const daySlotId = parseInt(req.params.daySlotId);
      if (isNaN(daySlotId)) {
        return res.status(400).json({ error: "Invalid day slot ID" });
      }
      const deleted = await storage.deleteDaySlot(daySlotId);
      if (!deleted) {
        return res.status(404).json({ error: "Day slot not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting day slot:", error);
      res.status(500).json({ error: "Failed to delete day slot" });
    }
  });

  // Item assignment to day slots
  app.post("/api/day-slots/:daySlotId/items/:itemId", async (req, res) => {
    try {
      const daySlotId = parseInt(req.params.daySlotId);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(daySlotId) || isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid day slot or item ID" });
      }
      const assignment = await storage.assignItemToDaySlot(daySlotId, itemId);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning item to day slot:", error);
      res.status(500).json({ error: "Failed to assign item to day slot" });
    }
  });

  // Get assignment info
  app.get("/api/day-slots/:daySlotId/items/:itemId", async (req, res) => {
    try {
      const daySlotId = parseInt(req.params.daySlotId);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(daySlotId) || isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid day slot or item ID" });
      }
      const assignment = await storage.getAssignmentForDaySlot(daySlotId, itemId);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      console.error("Error fetching assignment:", error);
      res.status(500).json({ error: "Failed to fetch assignment" });
    }
  });

  app.delete("/api/day-slots/:daySlotId/items/:itemId", async (req, res) => {
    try {
      const daySlotId = parseInt(req.params.daySlotId);
      const itemId = parseInt(req.params.itemId);
      if (isNaN(daySlotId) || isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid day slot or item ID" });
      }
      await storage.removeItemFromDaySlot(daySlotId, itemId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing item from day slot:", error);
      res.status(500).json({ error: "Failed to remove item from day slot" });
    }
  });
  
  // Assignment Serving Options - per-serving-size stock tracking
  const assignmentServingOptionSchema = z.object({
    servingOptionId: z.number(),
    stockLimited: z.boolean().default(false),
    stockQuantity: z.number().optional(),
  });
  
  // Add serving option to assignment
  app.post("/api/assignments/:assignmentId/serving-options", async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      if (isNaN(assignmentId)) {
        return res.status(400).json({ error: "Invalid assignment ID" });
      }
      const { servingOptionId, stockLimited, stockQuantity } = assignmentServingOptionSchema.parse(req.body);
      const option = await storage.addAssignmentServingOption(assignmentId, servingOptionId, stockLimited, stockQuantity);
      res.status(201).json(option);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error adding assignment serving option:", error);
      res.status(500).json({ error: "Failed to add serving option" });
    }
  });
  
  // Update assignment serving option stock
  app.patch("/api/assignment-serving-options/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      const { stockLimited, stockQuantity } = z.object({
        stockLimited: z.boolean(),
        stockQuantity: z.number().optional(),
      }).parse(req.body);
      await storage.updateAssignmentServingOption(id, stockLimited, stockQuantity);
      res.json({ message: "Updated successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating assignment serving option:", error);
      res.status(500).json({ error: "Failed to update serving option" });
    }
  });
  
  // Remove serving option from assignment
  app.delete("/api/assignment-serving-options/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      await storage.removeAssignmentServingOption(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing assignment serving option:", error);
      res.status(500).json({ error: "Failed to remove serving option" });
    }
  });
  
  // Get serving options for assignment
  app.get("/api/assignments/:assignmentId/serving-options", async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      if (isNaN(assignmentId)) {
        return res.status(400).json({ error: "Invalid assignment ID" });
      }
      const options = await storage.getAssignmentServingOptions(assignmentId);
      res.json(options);
    } catch (error) {
      console.error("Error fetching assignment serving options:", error);
      res.status(500).json({ error: "Failed to fetch serving options" });
    }
  });

  // Serving option schema for nested creation
  const servingOptionInputSchema = z.object({
    servingSize: z.number().min(1),
    label: z.string().min(1),
    price: z.number().min(0.01),
    isDefault: z.boolean().default(false),
  });

  // Menu Items CRUD (items belong to chef, not menu)
  const createMenuItemSchema = z.object({
    chefId: z.number(),
    title: z.string().min(2),
    description: z.string().optional(),
    allergenIds: z.array(z.number()).default([]),
    ingredientIds: z.array(z.number()).default([]),
    servingOptions: z.array(servingOptionInputSchema).optional(),
  });

  app.get("/api/menu-items/chef/:chefId", async (req, res) => {
    try {
      const chefId = parseInt(req.params.chefId);
      if (isNaN(chefId)) {
        return res.status(400).json({ error: "Invalid chef ID" });
      }
      const items = await storage.getMenuItemsByChefId(chefId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      res.status(500).json({ error: "Failed to fetch menu items" });
    }
  });

  app.post("/api/menu-items", async (req, res) => {
    try {
      const data = createMenuItemSchema.parse(req.body);
      
      const item = await storage.createMenuItem({
        chefId: data.chefId,
        title: data.title,
        description: data.description,
      });
      
      // Create serving options
      if (data.servingOptions && data.servingOptions.length > 0) {
        for (const opt of data.servingOptions) {
          await storage.createServingOption({
            menuItemId: item.id,
            servingSize: opt.servingSize,
            label: opt.label,
            price: opt.price,
            isDefault: opt.isDefault ? 1 : 0,
          });
        }
      }
      
      if (data.allergenIds.length > 0) {
        await storage.addItemAllergens(item.id, data.allergenIds);
      }
      
      if (data.ingredientIds.length > 0) {
        await storage.addItemIngredients(item.id, data.ingredientIds);
      }
      
      const itemWithDetails = await storage.getMenuItemById(item.id);
      res.status(201).json(itemWithDetails);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating menu item:", error);
      res.status(500).json({ error: "Failed to create menu item" });
    }
  });

  const updateMenuItemSchema = z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional().nullable(),
    allergenIds: z.array(z.number()).optional(),
    ingredientIds: z.array(z.number()).optional(),
    servingOptions: z.array(servingOptionInputSchema).optional(),
  });

  app.patch("/api/menu-items/:itemId", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      
      const validated = updateMenuItemSchema.parse(req.body);
      const { allergenIds, ingredientIds, servingOptions, ...itemData } = validated;
      
      const item = await storage.updateMenuItem(itemId, itemData);
      if (!item) {
        return res.status(404).json({ error: "Menu item not found" });
      }
      
      if (allergenIds !== undefined) {
        await storage.clearItemAllergens(itemId);
        if (allergenIds.length > 0) {
          await storage.addItemAllergens(itemId, allergenIds);
        }
      }
      
      if (ingredientIds !== undefined) {
        await storage.clearItemIngredients(itemId);
        if (ingredientIds.length > 0) {
          await storage.addItemIngredients(itemId, ingredientIds);
        }
      }

      // Replace serving options if provided
      if (servingOptions !== undefined) {
        await storage.clearServingOptions(itemId);
        for (const opt of servingOptions) {
          await storage.createServingOption({
            menuItemId: itemId,
            servingSize: opt.servingSize,
            label: opt.label,
            price: opt.price,
            isDefault: opt.isDefault ? 1 : 0,
          });
        }
      }
      
      const itemWithDetails = await storage.getMenuItemById(itemId);
      res.json(itemWithDetails);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating menu item:", error);
      res.status(500).json({ error: "Failed to update menu item" });
    }
  });

  app.delete("/api/menu-items/:itemId", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      const deleted = await storage.deleteMenuItem(itemId);
      if (!deleted) {
        return res.status(404).json({ error: "Menu item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting menu item:", error);
      res.status(500).json({ error: "Failed to delete menu item" });
    }
  });

  // Item Photos
  const createPhotoSchema = z.object({
    imageUrl: z.string().url(),
    isCover: z.boolean().default(false),
    sortOrder: z.number().default(0),
  });

  app.get("/api/menu-items/:itemId/photos", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      const photos = await storage.getPhotosByMenuItemId(itemId);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching photos:", error);
      res.status(500).json({ error: "Failed to fetch photos" });
    }
  });

  app.post("/api/menu-items/:itemId/photos", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      const data = createPhotoSchema.parse(req.body);
      const photo = await storage.createItemPhoto({
        menuItemId: itemId,
        imageUrl: data.imageUrl,
        isCover: data.isCover ? 1 : 0,
        sortOrder: data.sortOrder,
      });
      res.status(201).json(photo);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating photo:", error);
      res.status(500).json({ error: "Failed to create photo" });
    }
  });

  app.delete("/api/photos/:photoId", async (req, res) => {
    try {
      const photoId = parseInt(req.params.photoId);
      if (isNaN(photoId)) {
        return res.status(400).json({ error: "Invalid photo ID" });
      }
      const deleted = await storage.deleteItemPhoto(photoId);
      if (!deleted) {
        return res.status(404).json({ error: "Photo not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting photo:", error);
      res.status(500).json({ error: "Failed to delete photo" });
    }
  });

  app.post("/api/menu-items/:itemId/photos/:photoId/set-cover", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const photoId = parseInt(req.params.photoId);
      if (isNaN(itemId) || isNaN(photoId)) {
        return res.status(400).json({ error: "Invalid item or photo ID" });
      }
      await storage.setCoverPhoto(itemId, photoId);
      res.json({ message: "Cover photo set" });
    } catch (error) {
      console.error("Error setting cover photo:", error);
      res.status(500).json({ error: "Failed to set cover photo" });
    }
  });

  const createOrderSchema = z.object({
    chefId: z.number().int().positive(),
    buyerName: z.string().min(2).max(200),
    buyerEmail: z.string().email().max(254).optional().nullable(),
    buyerPhone: z.string().max(20).optional().nullable(),
    totalAmount: z.number().min(0.01),
    fulfillmentMethod: z.enum(["pickup", "delivery"]),
    deliveryAddress: z.string().max(500).optional().nullable(),
    deliveryLat: z.number().min(-90).max(90).optional().nullable(),
    deliveryLong: z.number().min(-180).max(180).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    items: z.array(z.object({
      menuItemId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(100),
      priceAtOrder: z.number().min(0),
      itemTitle: z.string().max(200),
    })).min(1),
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const data = createOrderSchema.parse(req.body);
      
      const order = await storage.createOrder({
        chefId: data.chefId,
        buyerName: data.buyerName,
        buyerEmail: data.buyerEmail,
        buyerPhone: data.buyerPhone,
        totalAmount: data.totalAmount,
        fulfillmentMethod: data.fulfillmentMethod,
        deliveryAddress: data.deliveryAddress,
        deliveryLat: data.deliveryLat,
        deliveryLong: data.deliveryLong,
        notes: data.notes,
        status: "pending",
      });
      
      const orderItemsData = data.items.map((item) => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        priceAtOrder: item.priceAtOrder,
        itemTitle: item.itemTitle,
      }));
      
      await storage.createOrderItems(orderItemsData);
      
      // Note: Stock is now tracked at the day-slot assignment level
      // Future enhancement: decrement assignment stock when orders are placed
      
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.get("/api/orders/chef/:chefId", async (req, res) => {
    try {
      const chefId = parseInt(req.params.chefId);
      if (isNaN(chefId)) {
        return res.status(400).json({ error: "Invalid chef ID" });
      }

      const statusFilter = req.query.status as string | undefined;
      const orders = await storage.getOrdersByChefId(chefId);

      // Filter by status if provided
      const filtered = statusFilter
        ? orders.filter(o => o.status === statusFilter)
        : orders;

      res.json(filtered);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  const updateOrderStatusSchema = z.object({
    status: z.enum(["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]),
  });

  app.patch("/api/orders/:orderId", async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) {
        return res.status(400).json({ error: "Invalid order ID" });
      }
      
      const data = updateOrderStatusSchema.parse(req.body);
      const order = await storage.updateOrderStatus(orderId, data.status);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating order:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  return httpServer;
}
