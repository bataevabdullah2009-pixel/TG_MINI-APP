import { z } from "zod";

// Auth
export const TelegramInitDataSchema = z.object({
  query_id: z.string().optional(),
  user: z.object({
    id: z.number(),
    is_bot: z.boolean(),
    first_name: z.string(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
  }).optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Business
export const BusinessSlugSchema = z.object({
  slug: z.string().min(1, "Business slug is required"),
});

// Orders
export const CreateOrderSchema = z.object({
  businessId: z.string().uuid(),
  customerName: z.string().min(2, "Name is required"),
  customerPhone: z.string().min(10, "Valid phone is required"),
  customerAddress: z.string().optional(),
  items: z.array(
    z.object({
      itemId: z.string().uuid(),
      quantity: z.number().min(1),
      price: z.number().positive(),
      name: z.string(),
    })
  ).min(1, "At least one item is required"),
  deliveryType: z.enum(["DELIVERY", "PICKUP", "NONE"]),
  comment: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// Bookings
export const CreateBookingSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  customerName: z.string().min(2),
  customerPhone: z.string().min(10),
  startTime: z.string().datetime(),
  comment: z.string().optional(),
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

// Categories
export const CreateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

// Items
export const CreateItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  type: z.enum(["PRODUCT", "SERVICE"]),
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  oldPrice: z.number().positive().optional(),
  imageUrl: z.string().url().optional(),
  durationMinutes: z.number().min(5).optional(),
  stock: z.number().min(0).optional(),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().default(false),
});

export type CreateItemInput = z.infer<typeof CreateItemSchema>;

export const UpdateItemSchema = CreateItemSchema.extend({
  id: z.string().uuid(),
});

export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;
