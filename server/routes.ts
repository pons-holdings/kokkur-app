import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await storage.seedData();

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

  const createMenuItemSchema = z.object({
    menuId: z.number(),
    title: z.string().min(2),
    description: z.string().optional(),
    price: z.number().min(0.01),
    stockQuantity: z.number().min(1),
    unitType: z.string().min(1),
    allergenIds: z.array(z.number()).default([]),
    ingredientIds: z.array(z.number()).default([]),
  });

  app.post("/api/menu-items", async (req, res) => {
    try {
      const data = createMenuItemSchema.parse(req.body);
      
      const item = await storage.createMenuItem({
        menuId: data.menuId,
        title: data.title,
        description: data.description,
        price: data.price,
        stockQuantity: data.stockQuantity,
        unitType: data.unitType,
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
