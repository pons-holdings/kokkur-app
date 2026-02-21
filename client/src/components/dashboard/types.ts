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

export interface PrepListItem {
  menuItemId: number;
  itemTitle: string;
  totalQuantity: number;
  orderCount: number;
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
