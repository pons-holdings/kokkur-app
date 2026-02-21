CREATE TYPE "public"."fulfillment_method" AS ENUM('pickup', 'delivery', 'both');--> statement-breakpoint
CREATE TYPE "public"."menu_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('chef', 'buyer');--> statement-breakpoint
CREATE TABLE "allergens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "allergens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"icon" text,
	"description" text,
	CONSTRAINT "allergens_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "assignment_serving_options" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assignment_serving_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"assignment_id" integer NOT NULL,
	"serving_option_id" integer NOT NULL,
	"stock_quantity" integer,
	"stock_limited" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chef_profiles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chef_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"profile_image_url" text,
	"cuisine_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"location_lat" real NOT NULL,
	"location_long" real NOT NULL,
	"location_name" text,
	"service_radius" integer DEFAULT 10 NOT NULL,
	"fulfillment_method" "fulfillment_method" DEFAULT 'both' NOT NULL,
	"delivery_fee" real DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chef_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ingredient_allergens" (
	"ingredient_id" integer NOT NULL,
	"allergen_id" integer NOT NULL,
	CONSTRAINT "ingredient_allergens_ingredient_id_allergen_id_pk" PRIMARY KEY("ingredient_id","allergen_id")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ingredients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	CONSTRAINT "ingredients_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "item_allergens" (
	"menu_item_id" integer NOT NULL,
	"allergen_id" integer NOT NULL,
	CONSTRAINT "item_allergens_menu_item_id_allergen_id_pk" PRIMARY KEY("menu_item_id","allergen_id")
);
--> statement-breakpoint
CREATE TABLE "item_ingredients" (
	"menu_item_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	CONSTRAINT "item_ingredients_menu_item_id_ingredient_id_pk" PRIMARY KEY("menu_item_id","ingredient_id")
);
--> statement-breakpoint
CREATE TABLE "item_photos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "item_photos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"menu_item_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"is_cover" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_day_slots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menu_day_slots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chef_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"order_cutoff_date" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menu_item_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"day_slot_id" integer NOT NULL,
	"menu_item_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menu_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chef_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menus_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chef_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" "menu_status" DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"menu_item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"price_at_order" real NOT NULL,
	"item_title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chef_id" integer NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text,
	"buyer_phone" text,
	"total_amount" real NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"fulfillment_method" "fulfillment_method" NOT NULL,
	"delivery_address" text,
	"delivery_lat" real,
	"delivery_long" real,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "serving_options" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "serving_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"menu_item_id" integer NOT NULL,
	"serving_size" integer DEFAULT 1 NOT NULL,
	"label" text NOT NULL,
	"price" real NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_favorites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_favorites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chef_id" integer NOT NULL,
	"session_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignment_serving_options" ADD CONSTRAINT "assignment_serving_options_assignment_id_menu_item_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."menu_item_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_serving_options" ADD CONSTRAINT "assignment_serving_options_serving_option_id_serving_options_id_fk" FOREIGN KEY ("serving_option_id") REFERENCES "public"."serving_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_allergens" ADD CONSTRAINT "ingredient_allergens_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_allergens" ADD CONSTRAINT "ingredient_allergens_allergen_id_allergens_id_fk" FOREIGN KEY ("allergen_id") REFERENCES "public"."allergens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_allergens" ADD CONSTRAINT "item_allergens_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_allergens" ADD CONSTRAINT "item_allergens_allergen_id_allergens_id_fk" FOREIGN KEY ("allergen_id") REFERENCES "public"."allergens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_ingredients" ADD CONSTRAINT "item_ingredients_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_ingredients" ADD CONSTRAINT "item_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_photos" ADD CONSTRAINT "item_photos_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_day_slots" ADD CONSTRAINT "menu_day_slots_chef_id_chef_profiles_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chef_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_assignments" ADD CONSTRAINT "menu_item_assignments_day_slot_id_menu_day_slots_id_fk" FOREIGN KEY ("day_slot_id") REFERENCES "public"."menu_day_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_assignments" ADD CONSTRAINT "menu_item_assignments_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_chef_id_chef_profiles_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chef_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_chef_id_chef_profiles_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chef_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_chef_id_chef_profiles_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chef_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_options" ADD CONSTRAINT "serving_options_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_chef_id_chef_profiles_id_fk" FOREIGN KEY ("chef_id") REFERENCES "public"."chef_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_serving_options_assignment_id_idx" ON "assignment_serving_options" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "item_photos_menu_item_id_idx" ON "item_photos" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "day_slots_chef_id_idx" ON "menu_day_slots" USING btree ("chef_id");--> statement-breakpoint
CREATE INDEX "assignments_day_slot_id_idx" ON "menu_item_assignments" USING btree ("day_slot_id");--> statement-breakpoint
CREATE INDEX "assignments_menu_item_id_idx" ON "menu_item_assignments" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "assignments_day_slot_item_idx" ON "menu_item_assignments" USING btree ("day_slot_id","menu_item_id");--> statement-breakpoint
CREATE INDEX "menu_items_chef_id_idx" ON "menu_items" USING btree ("chef_id");--> statement-breakpoint
CREATE INDEX "menus_chef_id_idx" ON "menus" USING btree ("chef_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_chef_id_idx" ON "orders" USING btree ("chef_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "serving_options_menu_item_id_idx" ON "serving_options" USING btree ("menu_item_id");