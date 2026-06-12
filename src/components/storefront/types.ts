export type StorefrontItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  type: "PRODUCT" | "SERVICE";
  durationMinutes?: number | null;
  stock?: number | null;
  stockMode?: "SIMPLE_AVAILABILITY" | "TRACK_STOCK";
  isAvailable?: boolean;
  isPopular: boolean;
  category?: { id: string; name: string } | null;
};

export type StorefrontBusiness = {
  id: string;
  slug: string;
  name: string;
  type: string;
  templateKey: string;
  description?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  isOpen?: boolean;
  transferPaymentEnabled?: boolean;
  transferBankName?: string | null;
  transferPaymentPhone?: string | null;
  transferRecipientName?: string | null;
  transferPaymentCommentRequired?: boolean;
  transferPaymentInstructions?: string | null;
  settings?: {
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    minOrderAmount: number;
    pickupWaitHours: number;
    courierAcceptanceMinutes: number;
  } | null;
  deliveryZones?: Array<{
    id: string;
    name: string;
    cityArea: string;
    fee: number;
    estimatedMinutes?: number | null;
    isActive: boolean;
  }>;
};

export type StorefrontMode = "cart" | "booking";
export type StorefrontViewMode = "feed" | "grid";

export type StorefrontCartLine = {
  item: StorefrontItem;
  quantity: number;
};
