import { 
  chefProfiles, menus, menuItems, ingredients, allergens,
  itemIngredients, itemAllergens, orders, orderItems, userFavorites,
  type ChefProfile, type InsertChefProfile,
  type Menu, type InsertMenu,
  type MenuItem, type InsertMenuItem,
  type Ingredient, type InsertIngredient,
  type Allergen, type InsertAllergen,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type InsertItemIngredient, type InsertItemAllergen,
  type MenuItemWithDetails, type MenuWithItems, type ChefProfileWithMenus, type OrderWithItems
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
  getMenusByChefId(chefId: number): Promise<MenuWithItems[]>;
  createMenu(menu: InsertMenu): Promise<Menu>;

  // Menu Items
  getMenuItemById(id: number): Promise<MenuItemWithDetails | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItemStock(id: number, quantity: number): Promise<void>;
  addItemIngredients(menuItemId: number, ingredientIds: number[]): Promise<void>;
  addItemAllergens(menuItemId: number, allergenIds: number[]): Promise<void>;

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

  async getMenusByChefId(chefId: number): Promise<MenuWithItems[]> {
    const menusData = await db.select().from(menus).where(eq(menus.chefId, chefId));
    
    const menusWithItems = await Promise.all(
      menusData.map(async (menu) => {
        const items = await db.select().from(menuItems).where(eq(menuItems.menuId, menu.id));
        
        const itemsWithDetails = await Promise.all(
          items.map(async (item) => {
            const ingredientsList = await this.getIngredientsByMenuItemId(item.id);
            const allergensList = await this.getAllergensByMenuItemId(item.id);
            return { ...item, ingredients: ingredientsList, allergens: allergensList };
          })
        );
        
        return { ...menu, items: itemsWithDetails };
      })
    );
    
    return menusWithItems;
  }

  async createMenu(menu: InsertMenu): Promise<Menu> {
    const [newMenu] = await db.insert(menus).values(menu).returning();
    return newMenu;
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
      orderCutoffDate: new Date("2026-02-05"),
      fulfillmentDate: new Date("2026-02-07"),
    });

    const menu2 = await this.createMenu({
      chefId: chef2.id,
      title: "Sunday Feast Menu",
      description: "Traditional Italian family-style dishes",
      status: "active",
      orderCutoffDate: new Date("2026-02-06"),
      fulfillmentDate: new Date("2026-02-08"),
    });

    const menu3 = await this.createMenu({
      chefId: chef3.id,
      title: "Lunar New Year Special",
      description: "Celebrate with authentic Asian flavors",
      status: "active",
      orderCutoffDate: new Date("2026-02-04"),
      fulfillmentDate: new Date("2026-02-06"),
    });

    const findAllergen = (name: string) => createdAllergens.find((a) => a.name === name)?.id || 0;
    const findIngredient = (name: string) => createdIngredients.find((i) => i.name === name)?.id || 0;

    const item1 = await this.createMenuItem({
      menuId: menu1.id,
      title: "Chicken Enchiladas Verdes",
      description: "Tender shredded chicken wrapped in corn tortillas, smothered in tangy tomatillo salsa verde and melted cheese. Served with rice and beans.",
      price: 16.99,
      stockQuantity: 20,
      unitType: "per meal",
    });
    await this.addItemAllergens(item1.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item1.id, [findIngredient("Chicken"), findIngredient("Cheese"), findIngredient("Onions"), findIngredient("Rice")]);

    const item2 = await this.createMenuItem({
      menuId: menu1.id,
      title: "Vegetarian Tamales",
      description: "Handmade masa tamales filled with roasted poblano peppers and queso fresco, wrapped in corn husks.",
      price: 14.99,
      stockQuantity: 15,
      unitType: "per dozen",
    });
    await this.addItemAllergens(item2.id, [findAllergen("Milk")]);
    await this.addItemIngredients(item2.id, [findIngredient("Cheese"), findIngredient("Bell Peppers")]);

    const item3 = await this.createMenuItem({
      menuId: menu1.id,
      title: "Carnitas Taco Platter",
      description: "Slow-braised pork carnitas with pickled onions, fresh cilantro, and homemade salsa. Includes 6 tacos.",
      price: 18.99,
      stockQuantity: 12,
      unitType: "per platter",
    });
    await this.addItemIngredients(item3.id, [findIngredient("Pork"), findIngredient("Onions"), findIngredient("Garlic")]);

    const item4 = await this.createMenuItem({
      menuId: menu2.id,
      title: "Homemade Lasagna",
      description: "Layers of fresh pasta, rich beef bolognese, creamy bechamel, and aged parmesan. A family recipe perfected over generations.",
      price: 24.99,
      stockQuantity: 8,
      unitType: "per tray",
    });
    await this.addItemAllergens(item4.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item4.id, [findIngredient("Beef"), findIngredient("Pasta"), findIngredient("Cheese"), findIngredient("Tomatoes")]);

    const item5 = await this.createMenuItem({
      menuId: menu2.id,
      title: "Fresh Fettuccine Alfredo",
      description: "Hand-cut fettuccine in a velvety parmesan cream sauce with fresh cracked pepper.",
      price: 17.99,
      stockQuantity: 18,
      unitType: "per meal",
    });
    await this.addItemAllergens(item5.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item5.id, [findIngredient("Pasta"), findIngredient("Butter"), findIngredient("Cream"), findIngredient("Cheese")]);

    const item6 = await this.createMenuItem({
      menuId: menu2.id,
      title: "Chicken Parmesan",
      description: "Crispy breaded chicken cutlet topped with marinara and melted mozzarella, served over spaghetti.",
      price: 19.99,
      stockQuantity: 15,
      unitType: "per meal",
    });
    await this.addItemAllergens(item6.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);
    await this.addItemIngredients(item6.id, [findIngredient("Chicken"), findIngredient("Pasta"), findIngredient("Tomatoes"), findIngredient("Cheese")]);

    const item7 = await this.createMenuItem({
      menuId: menu2.id,
      title: "Tiramisu",
      description: "Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream.",
      price: 9.99,
      stockQuantity: 20,
      unitType: "per piece",
    });
    await this.addItemAllergens(item7.id, [findAllergen("Milk"), findAllergen("Eggs"), findAllergen("Wheat")]);

    const item8 = await this.createMenuItem({
      menuId: menu3.id,
      title: "Teriyaki Salmon Bowl",
      description: "Glazed salmon over jasmine rice with pickled vegetables, edamame, and sesame seeds.",
      price: 21.99,
      stockQuantity: 12,
      unitType: "per meal",
    });
    await this.addItemAllergens(item8.id, [findAllergen("Fish"), findAllergen("Soy"), findAllergen("Sesame")]);
    await this.addItemIngredients(item8.id, [findIngredient("Salmon"), findIngredient("Rice"), findIngredient("Carrots")]);

    const item9 = await this.createMenuItem({
      menuId: menu3.id,
      title: "Pad Thai",
      description: "Stir-fried rice noodles with shrimp, tofu, bean sprouts, and crushed peanuts in tamarind sauce.",
      price: 16.99,
      stockQuantity: 20,
      unitType: "per meal",
    });
    await this.addItemAllergens(item9.id, [findAllergen("Shellfish"), findAllergen("Peanuts"), findAllergen("Soy"), findAllergen("Eggs")]);
    await this.addItemIngredients(item9.id, [findIngredient("Shrimp"), findIngredient("Tofu"), findIngredient("Rice")]);

    const item10 = await this.createMenuItem({
      menuId: menu3.id,
      title: "Thai Green Curry",
      description: "Aromatic coconut curry with vegetables and your choice of chicken or tofu. Served with jasmine rice.",
      price: 17.99,
      stockQuantity: 18,
      unitType: "per meal",
    });
    await this.addItemAllergens(item10.id, [findAllergen("Soy")]);
    await this.addItemIngredients(item10.id, [findIngredient("Chicken"), findIngredient("Coconut Milk"), findIngredient("Rice"), findIngredient("Broccoli")]);

    const item11 = await this.createMenuItem({
      menuId: menu3.id,
      title: "Vegetable Spring Rolls",
      description: "Crispy fried spring rolls filled with cabbage, carrots, and glass noodles. Served with sweet chili sauce.",
      price: 8.99,
      stockQuantity: 30,
      unitType: "per piece",
    });
    await this.addItemAllergens(item11.id, [findAllergen("Wheat"), findAllergen("Soy")]);
    await this.addItemIngredients(item11.id, [findIngredient("Carrots")]);

    const item12 = await this.createMenuItem({
      menuId: menu3.id,
      title: "Miso Glazed Tofu Bowl",
      description: "Crispy tofu with miso glaze, quinoa, roasted vegetables, and ginger dressing. Vegan and gluten-free.",
      price: 15.99,
      stockQuantity: 15,
      unitType: "per meal",
    });
    await this.addItemAllergens(item12.id, [findAllergen("Soy")]);
    await this.addItemIngredients(item12.id, [findIngredient("Tofu"), findIngredient("Quinoa"), findIngredient("Broccoli"), findIngredient("Carrots")]);

    console.log("Database seeded successfully!");
  }
}

export const storage = new DatabaseStorage();
