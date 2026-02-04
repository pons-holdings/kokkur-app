import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

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
      const ingredients = await storage.getIngredients();
      res.json(ingredients);
    } catch (error) {
      console.error("Error fetching ingredients:", error);
      res.status(500).json({ error: "Failed to fetch ingredients" });
    }
  });

  // Menu CRUD
  const createMenuSchema = z.object({
    chefId: z.number(),
    title: z.string().min(2),
    description: z.string().optional(),
    weekStartDate: z.string(), // Required: the Monday of the week
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
        weekStartDate: new Date(data.weekStartDate),
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
    weekStartDate: z.string().optional(),
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
      if (data.weekStartDate) data.weekStartDate = new Date(data.weekStartDate);
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
    menuId: z.number(),
    date: z.string(),
    orderCutoffDate: z.string(),
  });

  app.get("/api/menus/:menuId/day-slots", async (req, res) => {
    try {
      const menuId = parseInt(req.params.menuId);
      if (isNaN(menuId)) {
        return res.status(400).json({ error: "Invalid menu ID" });
      }
      const daySlots = await storage.getDaySlotsByMenuId(menuId);
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
        menuId: data.menuId,
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
      await storage.assignItemToDaySlot(daySlotId, itemId);
      res.status(201).json({ message: "Item assigned to day slot" });
    } catch (error) {
      console.error("Error assigning item to day slot:", error);
      res.status(500).json({ error: "Failed to assign item to day slot" });
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

  // Menu Items CRUD (items belong to chef, not menu)
  const createMenuItemSchema = z.object({
    chefId: z.number(),
    title: z.string().min(2),
    description: z.string().optional(),
    price: z.number().min(0.01),
    stockQuantity: z.number().min(1),
    unitType: z.string().min(1),
    imageUrl: z.string().optional(),
    allergenIds: z.array(z.number()).default([]),
    ingredientIds: z.array(z.number()).default([]),
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
        price: data.price,
        stockQuantity: data.stockQuantity,
        unitType: data.unitType,
        imageUrl: data.imageUrl,
      });
      
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
    price: z.number().min(0.01).optional(),
    stockQuantity: z.number().min(0).optional(),
    unitType: z.string().min(1).optional(),
    imageUrl: z.string().optional().nullable(),
    allergenIds: z.array(z.number()).optional(),
    ingredientIds: z.array(z.number()).optional(),
  });

  app.patch("/api/menu-items/:itemId", async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      
      const validated = updateMenuItemSchema.parse(req.body);
      const { allergenIds, ingredientIds, ...itemData } = validated;
      
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


  const createOrderSchema = z.object({
    chefId: z.number(),
    buyerName: z.string().min(2),
    buyerEmail: z.string().email().optional().nullable(),
    buyerPhone: z.string().optional().nullable(),
    totalAmount: z.number().min(0),
    fulfillmentMethod: z.enum(["pickup", "delivery"]),
    deliveryAddress: z.string().optional().nullable(),
    deliveryLat: z.number().optional().nullable(),
    deliveryLong: z.number().optional().nullable(),
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
      menuItemId: z.number(),
      quantity: z.number().min(1),
      priceAtOrder: z.number(),
      itemTitle: z.string(),
    })),
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
      
      for (const item of data.items) {
        await storage.updateMenuItemStock(item.menuItemId, item.quantity);
      }
      
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
      
      const orders = await storage.getOrdersByChefId(chefId);
      res.json(orders);
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
