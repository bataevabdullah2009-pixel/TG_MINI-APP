// Shared types
export type Role = "SUPER_ADMIN" | "BUSINESS_OWNER" | "MANAGER" | "CUSTOMER";

export type BusinessType = "CAFE" | "BARBERSHOP" | "CARWASH" | "SHOP" | "COURSES" | "CUSTOM";

export type OrderStatus = "NEW" | "ACCEPTED" | "PREPARING" | "READY" | "DELIVERING" | "COMPLETED" | "CANCELLED" | "EXPIRED";

export type BookingStatus = "PENDING" | "NEW" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "NO_SHOW";

export type ItemType = "PRODUCT" | "SERVICE";

export interface User {
  id: string;
  email: string | null;
  username: string | null;
  telegramId: bigint | null;
  role: Role;
  businessId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Business {
  id: string;
  slug: string;
  name: string;
  type: BusinessType;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  accentColor: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  telegramUrl: string | null;
  whatsappUrl: string | null;
  instagramUrl: string | null;
  telegramBotToken?: string | null;
  telegramBotUsername?: string | null;
  telegramAdminChatId?: bigint | null;
  currency: string;
  language: string;
  timezone?: string;
  modulesEnabled: string;
  subscriptionStatus?: string;
  transferPaymentEnabled?: boolean;
  transferBankName?: string | null;
  transferPaymentPhone?: string | null;
  transferRecipientName?: string | null;
  transferPaymentCommentRequired?: boolean;
  transferPaymentInstructions?: string | null;
  isActive: boolean;
  isOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
  workingHours?: WorkingHours[];
  settings?: BusinessSettings;
}

export interface WorkingHours {
  id: string;
  businessId: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface BusinessSettings {
  id: string;
  businessId: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  bookingEnabled: boolean;
  reviewsEnabled: boolean;
  loyaltyEnabled: boolean;
  minOrderAmount: number;
  deliveryFee: number;
  deliveryTime: number | null;
  notificationsEnabled: boolean;
  reminderTime: number;
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Item {
  id: string;
  businessId: string;
  categoryId: string | null;
  category?: Category | null;
  type: ItemType;
  name: string;
  description: string | null;
  price: number;
  oldPrice: number | null;
  imageUrl: string | null;
  // legacy alias used in some components
  image?: string | null;
  durationMinutes: number | null;
  // legacy alias
  duration?: number | null;
  stock: number | null;
  isAvailable: boolean;
  isPopular: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Staff {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  role: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffSchedule {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
}

export interface Customer {
  id: string;
  businessId: string;
  telegramUserId: bigint;
  name: string | null;
  phone: string | null;
  username: string | null;
  address: string | null;
  totalOrders: number;
  totalSpent: number;
  bonusBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  businessId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  totalPrice: number;
  status: OrderStatus;
  deliveryType: "DELIVERY" | "PICKUP" | "NONE";
  paymentMethod?: "CASH" | "TRANSFER" | "TELEGRAM_STARS" | "YOOKASSA" | "MANUAL";
  paymentStatus?: "PENDING" | "AWAITING_REVIEW" | "PAID" | "REJECTED" | "FAILED" | "REFUNDED";
  paymentProofUrl?: string | null;
  paymentProofAiStatus?: string | null;
  paymentProofAiSummary?: string | null;
  paymentProofAiConfidence?: number | null;
  paymentReviewedAt?: Date | null;
  paymentReviewedBy?: string | null;
  paymentRejectReason?: string | null;
  comment: string | null;
  internalNotes?: string | null;
  expiredAt?: Date | null;
  expireReason?: string | null;
  items?: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  itemId: string | null;
  name: string;
  price: number;
  quantity: number;
}

export interface Booking {
  id: string;
  businessId: string;
  customerId: string | null;
  serviceId: string | null;
  service?: Pick<Item, "id" | "name" | "price" | "durationMinutes"> | null;
  staffId: string | null;
  staff?: Pick<Staff, "id" | "name"> | null;
  customerName: string;
  customerPhone: string;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  comment: string | null;
  internalNotes?: string | null;
  expiredAt?: Date | null;
  expireReason?: string | null;
  reminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  type?: ItemType;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  maxItems: number;
  maxOrdersPerMonth: number;
  maxStaff: number;
  features: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  businessId: string;
  type: string;
  recipientId: bigint;
  title: string;
  message: string;
  data: string | null;
  sent: boolean;
  sentAt: Date | null;
  createdAt: Date;
}
