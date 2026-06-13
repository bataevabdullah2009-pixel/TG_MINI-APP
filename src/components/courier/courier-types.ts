export type CourierInfo = {
  id: string;
  name: string;
  phone: string;
  cityArea?: string | null;
};

export type CourierOrderItem = {
  id: string;
  name?: string | null;
  quantity: number;
  price: number;
};

export type CourierOrder = {
  id: string;
  status: string;
  deliveryStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  deliveryCityArea?: string | null;
  deliveryZoneName?: string | null;
  itemsSubtotal?: number | null;
  deliveryFee?: number | null;
  totalPrice: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
  business: {
    id: string;
    slug: string;
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  items?: CourierOrderItem[] | null;
  deliveryAssignment?: {
    status: string;
    deliveredAt?: string | null;
    courier?: CourierInfo | null;
  } | null;
};

export type CourierDashboardData = {
  ok?: boolean;
  courier: CourierInfo | null;
  available: CourierOrder[];
  assigned: CourierOrder[];
  completed: CourierOrder[];
};

export type CourierAction = "TAKE" | "ACCEPT" | "PICKED_UP" | "DELIVERING" | "DELIVERED";
