export type StorefrontItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  type: "PRODUCT" | "SERVICE";
  durationMinutes?: number | null;
  stock?: number | null;
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
};

export type StorefrontMode = "cart" | "booking";
export type StorefrontViewMode = "feed" | "grid";

export type StorefrontCartLine = {
  item: StorefrontItem;
  quantity: number;
};
