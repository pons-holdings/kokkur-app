import { z } from "zod";
import type {
  ChefProfileWithDaySlots,
  Allergen,
  Ingredient,
  OrderWithItems,
  MenuItem,
  MenuItemWithDetails,
  MenuItemWithAssignment,
  ServingOption,
  AssignedServingOptionWithDetails,
  DaySlotWithItems,
} from "@shared/schema";
import type { ServingOptionInput } from "@/components/serving-options-editor";

export const servingOptionSchema = z.object({
  id: z.number().optional(),
  servingSize: z.number().min(1),
  label: z.string().min(1),
  price: z.number().min(0.01, "Price must be greater than 0"),
  isDefault: z.boolean(),
});

export const menuItemSchema = z.object({
  chefId: z.number(),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  allergenIds: z.array(z.number()).default([]),
  ingredientIds: z.array(z.number()).default([]),
  servingOptions: z.array(servingOptionSchema).min(1, "At least one serving option is required"),
});

export type MenuItemFormData = z.infer<typeof menuItemSchema>;

export const chefProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional().default(""),
  phone: z.string().optional().default(""),
  slug: z.string()
    .min(3, "URL must be at least 3 characters")
    .max(100, "URL must be 100 characters or less")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Only lowercase letters, numbers, and hyphens"),
  bio: z.string().optional().default(""),
  profileImageUrl: z.string().optional().default(""),
  locationLat: z.number(),
  locationLong: z.number(),
  locationName: z.string().optional().default(""),
  addressStreet: z.string().optional().default(""),
  addressUnit: z.string().optional().default(""),
  addressCity: z.string().optional().default(""),
  addressState: z.string().optional().default(""),
  addressZip: z.string().optional().default(""),
  serviceRadius: z.number().min(1, "Minimum 1 mile").max(100, "Maximum 100 miles"),
  fulfillmentMethod: z.enum(["pickup", "delivery", "both"]),
  deliveryFee: z.number().min(0).optional().default(0),
  cuisineTags: z.array(z.string()).default([]),
  paymentMethods: z.array(z.object({
    method: z.string().min(1),
    handle: z.string().min(1, "Handle is required"),
  })).default([]),
});

export type ChefProfileFormData = z.infer<typeof chefProfileSchema>;

export interface PrepListOrderDetail {
  orderId: number;
  buyerName: string;
  quantity: number;
}

export interface PrepListItem {
  menuItemId: number;
  itemTitle: string;
  totalQuantity: number;
  orderCount: number;
  orders: PrepListOrderDetail[];
}

export interface PrepListDayGroup {
  daySlotId: number | null;
  daySlotDate: string | null;
  items: PrepListItem[];
}

export const defaultServingOptions: ServingOptionInput[] = [
  { servingSize: 1, label: "1 serving", price: 0, isDefault: true },
];

export type ServingSizeSelection = {
  selected: boolean;
  stockLimited: boolean;
  stockQuantity: number;
};

// Re-export shared schema types for convenience
export type {
  ChefProfileWithDaySlots,
  Allergen,
  Ingredient,
  OrderWithItems,
  MenuItem,
  MenuItemWithDetails,
  MenuItemWithAssignment,
  ServingOption,
  AssignedServingOptionWithDetails,
  DaySlotWithItems,
};
