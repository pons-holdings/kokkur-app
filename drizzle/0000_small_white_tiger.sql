CREATE TABLE `allergens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `allergens_name_unique` ON `allergens` (`name`);--> statement-breakpoint
CREATE TABLE `chef_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`slug` text NOT NULL,
	`bio` text,
	`profile_image_url` text,
	`cuisine_tags` text,
	`location_lat` real NOT NULL,
	`location_long` real NOT NULL,
	`service_radius` integer DEFAULT 10 NOT NULL,
	`fulfillment_methods` text DEFAULT 'BOTH' NOT NULL,
	`delivery_fee` real DEFAULT 0,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chef_profiles_slug_unique` ON `chef_profiles` (`slug`);--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_name_unique` ON `ingredients` (`name`);--> statement-breakpoint
CREATE TABLE `item_allergens` (
	`item_id` integer NOT NULL,
	`allergen_id` integer NOT NULL,
	PRIMARY KEY(`item_id`, `allergen_id`),
	FOREIGN KEY (`item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`allergen_id`) REFERENCES `allergens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `item_ingredients` (
	`item_id` integer NOT NULL,
	`ingredient_id` integer NOT NULL,
	PRIMARY KEY(`item_id`, `ingredient_id`),
	FOREIGN KEY (`item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`menu_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`image_url` text,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`unit_type` text DEFAULT 'Per Meal' NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chef_profile_id` integer NOT NULL,
	`title` text NOT NULL,
	`order_cutoff_date` text NOT NULL,
	`fulfillment_date` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`chef_profile_id`) REFERENCES `chef_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`menu_item_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`price_at_time` real NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`buyer_id` integer NOT NULL,
	`chef_id` integer NOT NULL,
	`total_amount` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`fulfillment_method` text NOT NULL,
	`delivery_address` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chef_id`) REFERENCES `chef_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_favorites` (
	`buyer_id` integer NOT NULL,
	`chef_id` integer NOT NULL,
	PRIMARY KEY(`buyer_id`, `chef_id`),
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chef_id`) REFERENCES `chef_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);