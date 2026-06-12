"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  TrendingUp, 
  ShoppingBag, 
  Image as ImageIcon, 
  Settings as SettingsIcon,
  Plus,
  Save,
  CheckCircle,
  XCircle,
  Copy,
  AlertCircle,
  ClipboardList,
  Calendar,
  Users,
  Eye,
  Phone,
  Trash2,
  AlertTriangle,
  Layers,
  MapPin,
  Check,
  User,
  Clock,
  Pencil,
  Bike,
  Truck,
  Archive,
  Minus,
  RotateCcw,
} from "lucide-react";
import { MediaUpload } from "./MediaUpload";
import { SellerStoreTools } from "./SellerStoreTools";
import { SellerDeliverySettings } from "./SellerDeliverySettings";
import { SellerCouriers } from "./SellerCouriers";
import { AccessDeniedScreen } from "./AccessDeniedScreen";
import { miniAppFetch } from "@/lib/miniAppFetch";
import { BottomSheetPicker } from "@/components/ui/BottomSheetPicker";
import {
  formatOrderStatusRu,
  formatPaymentStatusRu,
  getBookingStatusLabel,
} from "@/lib/utils";

interface SellerHomeProps {
  session: any;
  businessId: string;
}

function paymentProofAiLabel(status: string) {
  if (status === "PENDING") return "ИИ проверяет чек";
  if (status === "LIKELY_VALID" || status === "likely_valid") return "Вероятно корректный";
  if (status === "LIKELY_INVALID" || status === "likely_invalid") return "Вероятно некорректный";
  if (status === "MANUAL_REVIEW" || status === "manual_review") return "Нужна ручная проверка";
  return "Нужна ручная проверка";
}

type ReceiptAnalysis = {
  extractedAmount: number | null;
  expectedAmount: number | null;
  amountMatches: boolean | null;
  extractedDate: string | null;
  extractedRecipient: string | null;
  expectedRecipient: string | null;
  recipientMatches: boolean | null;
  extractedBank: string | null;
  confidencePercent: number | null;
  status: string | null;
  reasonRu: string | null;
};

function receiptAnalysisFromOrder(order: any): ReceiptAnalysis | null {
  const value = order?.paymentProofAiResult;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return {
    extractedAmount: typeof value.extractedAmount === "number" ? value.extractedAmount : null,
    expectedAmount: typeof value.expectedAmount === "number" ? value.expectedAmount : null,
    amountMatches: typeof value.amountMatches === "boolean" ? value.amountMatches : null,
    extractedDate: typeof value.extractedDate === "string" ? value.extractedDate : null,
    extractedRecipient: typeof value.extractedRecipient === "string" ? value.extractedRecipient : null,
    expectedRecipient: typeof value.expectedRecipient === "string" ? value.expectedRecipient : null,
    recipientMatches: typeof value.recipientMatches === "boolean" ? value.recipientMatches : null,
    extractedBank: typeof value.extractedBank === "string" ? value.extractedBank : null,
    confidencePercent: typeof value.confidencePercent === "number" ? value.confidencePercent : null,
    status: typeof value.status === "string" ? value.status : null,
    reasonRu: typeof value.reasonRu === "string" ? value.reasonRu : null,
  };
}

function receiptMatchLabel(value: boolean | null) {
  if (value === true) return "Совпадает";
  if (value === false) return "Не совпадает";
  return "Не определено";
}

const ACTIVE_ORDER_STATUSES = new Set([
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "READY_FOR_PICKUP",
  "READY_FOR_DELIVERY",
  "COURIER_ASSIGNED",
  "PICKED_UP",
  "DELIVERING",
]);

export function SellerHome({ session, businessId }: SellerHomeProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "DASHBOARD" | "ORDERS" | "BOOKINGS" | "ITEMS" | "DELIVERY" | "COURIERS" | "CLIENTS" | "MEDIA" | "SETTINGS"
  >("DASHBOARD");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayRevenue: 0,
    activeQueue: 0,
    totalItems: 0,
    orders: [] as any[],
    bookings: [] as any[],
  });

  const [businessData, setBusinessData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Catalog tab forms
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemType, setNewItemType] = useState<"PRODUCT" | "SERVICE">("PRODUCT");
  const [newItemImage, setNewItemImage] = useState("");
  const [newItemStockMode, setNewItemStockMode] = useState<"TRACKED" | "UNTRACKED">("UNTRACKED");
  const [newItemStock, setNewItemStock] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [itemAvailabilityFilter, setItemAvailabilityFilter] = useState<"ACTIVE" | "AVAILABLE" | "OUT_OF_STOCK" | "HIDDEN" | "ARCHIVED">("ACTIVE");
  
  // Category management inside catalog
  const [newCatName, setNewCatName] = useState("");
  const [showCatForm, setShowCatForm] = useState(false);
  const [showCategoryBottomSheet, setShowCategoryBottomSheet] = useState(false);

  // Settings State
  const [bizName, setBizName] = useState("");
  const [bizDesc, setBizDesc] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizIsOpen, setBizIsOpen] = useState(true);
  const [transferPaymentEnabled, setTransferPaymentEnabled] = useState(false);
  const [transferBankName, setTransferBankName] = useState("");
  const [transferPaymentPhone, setTransferPaymentPhone] = useState("");
  const [transferRecipientName, setTransferRecipientName] = useState("");
  const [transferPaymentCommentRequired, setTransferPaymentCommentRequired] = useState(false);
  const [transferPaymentInstructions, setTransferPaymentInstructions] = useState("");

  // Media state
  const [bizLogoUrl, setBizLogoUrl] = useState("");
  const [bizCoverUrl, setBizCoverUrl] = useState("");
  const [bizColor, setBizColor] = useState("#3B82F6");

  // Filters for orders and bookings
  const [orderFilter, setOrderFilter] = useState<string>("ALL");
  const [bookingFilter, setBookingFilter] = useState<string>("ALL");
  const [couriers, setCouriers] = useState<any[]>([]);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [assigningCourierId, setAssigningCourierId] = useState<string | null>(null);
  const assigningCourierRef = useRef<string | null>(null);

  const syncBusinessState = (bData: any) => {
    if (!bData || typeof bData !== "object") return false;
    setBusinessData(bData);
    setBizName(bData.name || "");
    setBizDesc(bData.description || "");
    setBizAddress(bData.address || "");
    setBizPhone(bData.phone || "");
    setBizIsOpen(bData.isOpen === undefined ? true : bData.isOpen);
    setTransferPaymentEnabled(Boolean(bData.transferPaymentEnabled));
    setTransferBankName(bData.transferBankName || "");
    setTransferPaymentPhone(bData.transferPaymentPhone || "");
    setTransferRecipientName(bData.transferRecipientName || "");
    setTransferPaymentCommentRequired(Boolean(bData.transferPaymentCommentRequired));
    setTransferPaymentInstructions(bData.transferPaymentInstructions || "");
    setBizLogoUrl(bData.logoUrl || "");
    setBizCoverUrl(bData.coverImageUrl || "");
    setBizColor(bData.primaryColor || "#3B82F6");
    return true;
  };

  useEffect(() => {
    fetchSellerData();
  }, [businessId]);

  const updateOrderInStats = (updatedOrder: any) => {
    setStats((current) => {
      const orders = current.orders.map((order) =>
        order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order
      );
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayRevenue = orders
        .filter((order: any) => new Date(order.createdAt) >= startOfDay)
        .filter((order: any) => ["COMPLETED", "DELIVERED"].includes(order.status))
        .reduce((sum: number, order: any) => sum + (order.totalPrice || 0), 0);
      const activeOrders = orders.filter((order: any) => ACTIVE_ORDER_STATUSES.has(order.status)).length;
      const activeBookings = current.bookings.filter((booking: any) =>
        booking.status === "PENDING" || booking.status === "NEW" || booking.status === "CONFIRMED"
      ).length;

      return {
        ...current,
        todayRevenue,
        activeQueue: activeOrders + activeBookings,
        orders,
      };
    });
  };

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Business Profile
      const bizRes = await miniAppFetch(`/api/admin/current-business?businessId=${encodeURIComponent(businessId)}`);
      const businessPayload = await bizRes.json().catch(() => ({}));
      if (!bizRes.ok || !syncBusinessState(businessPayload.data || businessPayload)) {
        setBusinessData(null);
        setError(businessPayload.error || "Бизнес недоступен. Обратитесь к администратору платформы.");
        return;
      }

      let fetchedItemsCount = 0;

      // 2. Fetch Catalog (Items & Categories)
      const catRes = await miniAppFetch(`/api/businesses/${businessId}/catalog`);
      if (catRes.ok) {
        const cData = await catRes.json();
        setCategories(cData.categories || []);
        if (cData.categories?.length > 0 && !newItemCategory) {
          setNewItemCategory(cData.categories[0].id);
        }
      }
      const itemsRes = await miniAppFetch(`/api/admin/items?businessId=${encodeURIComponent(businessId)}`);
      if (itemsRes.ok) {
        const itemData = await itemsRes.json();
        const sellerItems = Array.isArray(itemData.data) ? itemData.data.filter(Boolean) : [];
        setItems(sellerItems);
        fetchedItemsCount = sellerItems.filter((item: any) => !item.archivedAt).length;
      }

      // 3. Fetch CRM Customers
      const custRes = await miniAppFetch(`/api/admin/customers?businessId=${businessId}`);
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData.data || []);
      }

      const courierRes = await miniAppFetch(`/api/admin/couriers?businessId=${encodeURIComponent(businessId)}`);
      if (courierRes.ok) {
        const courierData = await courierRes.json();
        setCouriers((courierData.couriers || []).filter((courier: any) => courier.isActive));
      }

      // 4. Fetch Orders and Bookings
      const ordRes = await miniAppFetch(`/api/orders?businessId=${businessId}`);
      const bookRes = await miniAppFetch(`/api/bookings?businessId=${businessId}`);
      
      let ords = [] as any[];
      let bks = [] as any[];

      if (ordRes.ok) ords = await ordRes.json();
      if (bookRes.ok) bks = await bookRes.json();

      // Calculate today's stats
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayOrders = ords.filter((o: any) => new Date(o.createdAt) >= startOfDay);
      const revenue = todayOrders
        .filter((o: any) => ["COMPLETED", "DELIVERED"].includes(o.status))
        .reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);

      const activeOrds = ords.filter((o: any) => ACTIVE_ORDER_STATUSES.has(o.status)).length;
      const activeBks = bks.filter((b: any) => b.status === "PENDING" || b.status === "NEW" || b.status === "CONFIRMED").length;

      setStats({
        todayRevenue: revenue,
        activeQueue: activeOrds + activeBks,
        totalItems: fetchedItemsCount,
        orders: ords,
        bookings: bks,
      });

    } catch (e) {
      console.error(e);
      showError("Ошибка загрузки данных продавца");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;

    try {
      const res = await miniAppFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          name: newCatName,
          isActive: true,
        }),
      });

      if (res.ok) {
        showSuccess("Категория добавлена!");
        setNewCatName("");
        setShowCatForm(false);
        fetchSellerData();
      } else {
        const d = await res.json();
        showError(d.error || "Не удалось создать категорию");
      }
    } catch (err) {
      showError("Не удалось создать категорию. Проверьте соединение и попробуйте снова.");
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const category = categories.find((c: any) => c.id === categoryId);
    if (!category) return;
    if (!confirm(`Удалить категорию "${category.name}"? Товары останутся без категории.`)) return;

    try {
      const res = await miniAppFetch(`/api/categories?id=${categoryId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showSuccess("Категория удалена!");
        if (newItemCategory === categoryId) setNewItemCategory("");
        fetchSellerData();
      } else {
        const d = await res.json().catch(() => ({}));
        showError(d.error || "Не удалось удалить категорию");
      }
    } catch (err) {
      showError("Не удалось удалить категорию. Проверьте соединение и попробуйте снова.");
    }
  };

  const resetItemForm = () => {
    setEditingItemId(null);
    setNewItemName("");
    setNewItemPrice("");
    setNewItemCategory(categories[0]?.id || "");
    setNewItemDesc("");
    setNewItemType("PRODUCT");
    setNewItemImage("");
    setNewItemStockMode("UNTRACKED");
    setNewItemStock("");
  };

  const startEditItem = (item: any) => {
    setEditingItemId(item.id);
    setNewItemName(item.name || "");
    setNewItemPrice(item.price === undefined || item.price === null ? "" : String(item.price));
    setNewItemCategory(item.categoryId || item.category?.id || "");
    setNewItemDesc(item.description || "");
    setNewItemType(item.type === "SERVICE" ? "SERVICE" : "PRODUCT");
    setNewItemImage(item.imageUrl || "");
    setNewItemStockMode(item.stock === null || item.stock === undefined ? "UNTRACKED" : "TRACKED");
    setNewItemStock(item.stock === null || item.stock === undefined ? "" : String(item.stock));
    setActiveTab("ITEMS");
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) {
      showError("Заполните обязательные поля!");
      return;
    }

    try {
      const res = await miniAppFetch(editingItemId ? `/api/admin/items/${editingItemId}` : "/api/admin/items", {
        method: editingItemId ? "PATCH" : "POST",
        body: JSON.stringify({
          businessId,
          categoryId: newItemCategory || null,
          name: newItemName,
          price: parseFloat(newItemPrice),
          description: newItemDesc,
          type: newItemType,
          imageUrl: newItemImage || undefined,
          stock: newItemType === "PRODUCT" && newItemStockMode === "TRACKED" ? newItemStock : null,
          isAvailable: true,
        }),
      });

      if (res.ok) {
        showSuccess(editingItemId ? "Позиция обновлена!" : "Позиция успешно добавлена!");
        resetItemForm();
        fetchSellerData();
      } else {
        const rData = await res.json();
        showError(rData.error || (editingItemId ? "Не удалось изменить товар" : "Не удалось добавить товар"));
      }
    } catch (e) {
      showError(editingItemId ? "Не удалось изменить товар" : "Ошибка соединения с сервером");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Архивировать позицию? Она исчезнет из каталога, но останется в старых заказах.")) return;

    try {
      const res = await miniAppFetch(`/api/admin/items/${itemId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        showSuccess("Позиция архивирована!");
        fetchSellerData();
      } else {
        showError("Не удалось архивировать товар");
      }
    } catch (err) {
      showError("Не удалось архивировать товар. Проверьте соединение и попробуйте снова.");
    }
  };

  const patchSellerItem = async (item: any, patch: Record<string, unknown>, successMessage?: string) => {
    const res = await miniAppFetch(`/api/admin/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      showError(data.error || "Не удалось обновить позицию.");
      return;
    }
    setItems((current) => current.map((entry) => entry.id === item.id ? data.data : entry));
    if (successMessage) showSuccess(successMessage);
  };

  const setSellerItemStock = async (item: any, stock: number) => {
    if (!Number.isInteger(stock) || stock < 0) return;
    await patchSellerItem(item, { stock });
  };

  const promptSellerItemStock = async (item: any) => {
    const value = window.prompt("Количество в наличии", String(item.stock ?? 0));
    if (value === null) return;
    const stock = Number(value);
    if (!Number.isInteger(stock) || stock < 0) {
      showError("Количество должно быть целым числом не меньше нуля.");
      return;
    }
    await setSellerItemStock(item, stock);
  };

  const promptSellerItemPrice = async (item: any) => {
    const value = window.prompt("Новая цена, ₽", String(item.price));
    if (value === null) return;
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) {
      showError("Цена должна быть числом не меньше нуля.");
      return;
    }
    await patchSellerItem(item, { price }, "Цена обновлена.");
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    let finalStatus = newStatus;
    if (newStatus === "PROCESSING") {
      finalStatus = "ACCEPTED";
    }
    try {
      const res = await miniAppFetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: finalStatus }),
      });

      const d = await res.json();
      if (res.ok && d.ok) {
        showSuccess("Статус заказа обновлен!");
        if (d.data) updateOrderInStats(d.data);
      } else {
        showError(d.error || "Не удалось обновить статус заказа");
      }
    } catch (err) {
      showError("Не удалось обновить статус заказа. Проверьте соединение и попробуйте снова.");
    }
  };

  const handleConfirmPayment = async (orderId: string) => {
    try {
      const res = await miniAppFetch(`/api/seller/orders/${orderId}/confirm-payment`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        showSuccess("Оплата подтверждена.");
        fetchSellerData();
      } else {
        showError(data.error || "Не удалось подтвердить оплату.");
      }
    } catch (error) {
      showError("Не удалось подтвердить оплату. Проверьте соединение и попробуйте снова.");
    }
  };

  const handleRejectPayment = async (orderId: string) => {
    const reason = window.prompt("Причина отклонения оплаты", "Оплата не подтверждена продавцом.") || "";
    try {
      const res = await miniAppFetch(`/api/seller/orders/${orderId}/reject-payment`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        showSuccess("Оплата отклонена.");
        fetchSellerData();
      } else {
        showError(data.error || "Не удалось отклонить оплату.");
      }
    } catch (error) {
      showError("Не удалось отклонить оплату. Проверьте соединение и попробуйте снова.");
    }
  };

  const handleAssignCourier = async (orderId: string, courierId: string) => {
    if (assigningCourierRef.current) return;
    const courier = couriers.find((entry) => entry?.id === courierId);
    const previousOrder = stats.orders.find((entry) => entry?.id === orderId);
    if (!courier || !previousOrder) {
      showError("Не удалось назначить курьера. Попробуйте ещё раз.");
      return;
    }

    const optimisticOrder = {
      ...previousOrder,
      status: "COURIER_ASSIGNED",
      deliveryStatus: "ASSIGNED",
      deliveryAssignment: {
        ...(previousOrder.deliveryAssignment || {}),
        courierId,
        status: "ASSIGNED",
        courier,
      },
    };
    assigningCourierRef.current = courierId;
    setAssigningCourierId(courierId);
    updateOrderInStats(optimisticOrder);

    try {
      const res = await miniAppFetch(`/api/admin/orders/${orderId}/assign-courier`, {
        method: "POST",
        body: JSON.stringify({ courierId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Не удалось назначить курьера.");
      }
      setAssigningOrderId(null);
      if (data.order) updateOrderInStats(data.order);
      showSuccess(`Курьер ${courier.name} назначен`);
    } catch {
      updateOrderInStats(previousOrder);
      showError("Не удалось назначить курьера. Попробуйте ещё раз.");
    } finally {
      assigningCourierRef.current = null;
      setAssigningCourierId(null);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const res = await miniAppFetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        showSuccess("Статус записи изменен!");
        fetchSellerData();
      } else {
        const d = await res.json().catch(() => ({}));
        showError(d.error || "Не удалось обновить запись");
      }
    } catch (err) {
      showError("Не удалось обновить запись. Проверьте соединение и попробуйте снова.");
    }
  };

  const handleUpdateSettings = async () => {
    setError(null);
    try {
      const res = await miniAppFetch(`/api/admin/current-business`, {
        method: "PATCH",
        body: JSON.stringify({
          businessId,
          name: bizName,
          description: bizDesc,
          address: bizAddress,
          phone: bizPhone,
          isOpen: bizIsOpen,
          transferPaymentEnabled,
          transferBankName,
          transferPaymentPhone,
          transferRecipientName,
          transferPaymentCommentRequired,
          transferPaymentInstructions,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.data) syncBusinessState(data.data);
        showSuccess("Настройки сохранены!");
        await fetchSellerData();
      } else {
        const d = await res.json();
        showError(d.error || "Не удалось обновить настройки");
      }
    } catch (e) {
      showError("Ошибка сохранения");
    }
  };

  const handleUpdateMedia = async () => {
    setError(null);
    try {
      const res = await miniAppFetch(`/api/admin/current-business`, {
        method: "PATCH",
        body: JSON.stringify({
          businessId,
          logoUrl: bizLogoUrl,
          coverImageUrl: bizCoverUrl,
          primaryColor: bizColor,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.data) syncBusinessState(data.data);
        showSuccess("Оформление обновлено!");
        await fetchSellerData();
      } else {
        const d = await res.json();
        showError(d.error || "Не удалось сохранить оформление");
      }
    } catch (e) {
      showError("Ошибка сохранения");
    }
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const openStorefront = () => {
    if (businessData?.slug) {
      router.push(`/app/${businessData.slug}`);
    }
  };

  const filteredSellerItems = useMemo(() => {
    const needle = itemSearch.trim().toLowerCase();
    return items.filter(Boolean).filter((item: any) => {
      const searchMatches = !needle || String(item.name || "").toLowerCase().includes(needle) || String(item.description || "").toLowerCase().includes(needle);
      const availabilityMatches =
        itemAvailabilityFilter === "ARCHIVED" ? Boolean(item.archivedAt) :
        itemAvailabilityFilter === "HIDDEN" ? !item.archivedAt && !item.isAvailable :
        itemAvailabilityFilter === "OUT_OF_STOCK" ? !item.archivedAt && item.isAvailable && item.stock === 0 :
        itemAvailabilityFilter === "AVAILABLE" ? !item.archivedAt && item.isAvailable && (item.stock === null || item.stock === undefined || item.stock > 0) :
        !item.archivedAt;
      return searchMatches && availabilityMatches;
    });
  }, [items, itemSearch, itemAvailabilityFilter]);

  if (
    session?.role !== "SUPER_ADMIN" &&
    businessData &&
    (businessData.accessStatus === "BLOCKED" || businessData.subscriptionStatus === "BLOCKED")
  ) {
    return (
      <AccessDeniedScreen
        title="Доступ заблокирован"
        description={`${businessData.blockedReason || "Свяжитесь с администратором платформы."} История заказов и данные бизнеса сохранены.`}
        backUrl="/app"
        backText="Вернуться на главную"
      />
    );
  }

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mb-3" />
        <span className="text-xs font-black tracking-wider uppercase">Загрузка панели...</span>
      </div>
    );
  }

  if (!businessData) {
    return (
      <AccessDeniedScreen
        title="Бизнес недоступен"
        description={error || "Не удалось загрузить бизнес. Обновите экран или обратитесь к администратору платформы."}
        backUrl="/app"
        backText="Вернуться на главную"
      />
    );
  }

  return (
    <div className="pb-28 text-slate-900 min-h-screen bg-slate-50 relative">
      {/* Dynamic Header */}
      <section className="bg-slate-900 text-white px-4 pb-4.5 pt-5 relative shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Управление бизнесом</p>
            <h1 className="text-xl font-black truncate max-w-[200px]">{bizName || "Панель Продавца"}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black ${
              bizIsOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
            }`}>
              {bizIsOpen ? "• Открыто" : "• Закрыто"}
            </span>
            <button 
              onClick={openStorefront}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
              title="Предпросмотр витрины"
            >
              <Eye size={12} />
            </button>
          </div>
        </div>

        {/* Dynamic Nav tabs */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar mt-4 pt-1">
          {[
            { id: "DASHBOARD", label: "Главная", icon: <TrendingUp size={11} /> },
            { id: "ORDERS", label: "Заказы", icon: <ClipboardList size={11} /> },
            { id: "BOOKINGS", label: "Записи", icon: <Calendar size={11} /> },
            { id: "ITEMS", label: "Товары", icon: <ShoppingBag size={11} /> },
            { id: "DELIVERY", label: "Доставка", icon: <Truck size={11} /> },
            { id: "COURIERS", label: "Курьеры", icon: <Bike size={11} /> },
            { id: "CLIENTS", label: "Клиенты", icon: <Users size={11} /> },
            { id: "MEDIA", label: "Медиа", icon: <ImageIcon size={11} /> },
            { id: "SETTINGS", label: "Настройки", icon: <SettingsIcon size={11} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                activeTab === tab.id 
                  ? "bg-white text-slate-950 shadow-md shadow-slate-900/20" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Floating Notifications */}
      {error && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center gap-2 rounded-2xl bg-rose-600 p-3.5 text-xs font-black text-white shadow-xl animate-bounce">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="fixed top-4 inset-x-4 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 p-3.5 text-xs font-black text-white shadow-xl animate-fade-in">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Page Context render switcher */}
      <div className="p-4 max-w-md mx-auto">
        
        {/* Tab 1: Dashboard */}
        {activeTab === "DASHBOARD" && (
          <div className="space-y-4">
            
            {/* KPI metrics row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100/80">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">ВЫРУЧКА СЕГОДНЯ</span>
                <strong className="text-xl font-black text-slate-950 mt-1 block">{stats.todayRevenue} ₽</strong>
              </div>
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100/80">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">ОЧЕРЕДЬ ЗАПРОСОВ</span>
                <strong className="text-xl font-black text-slate-950 mt-1 block">{stats.activeQueue} шт.</strong>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100/80 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Быстрые действия</h3>
              <div className="grid grid-cols-2 gap-2 text-center text-[11px] font-black">
                <button 
                  onClick={() => { setActiveTab("ITEMS"); setNewItemType("PRODUCT"); }}
                  className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl hover:bg-indigo-100 transition active:scale-95 flex flex-col items-center gap-1.5"
                >
                  <Plus size={16} /> Добавить товар
                </button>
                <button 
                  onClick={() => { setActiveTab("ITEMS"); setNewItemType("SERVICE"); }}
                  className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl hover:bg-indigo-100 transition active:scale-95 flex flex-col items-center gap-1.5"
                >
                  <Plus size={16} /> Добавить услугу
                </button>
                <button 
                  onClick={() => setActiveTab("MEDIA")}
                  className="p-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition active:scale-95"
                >
                  Изменить логотип
                </button>
                <button 
                  onClick={openStorefront}
                  className="p-2.5 bg-slate-950 text-white rounded-xl hover:bg-slate-900 transition active:scale-95 flex items-center justify-center gap-1"
                >
                  Предпросмотр витрины <Eye size={10} />
                </button>
              </div>
            </div>

            <SellerStoreTools businessSlug={businessData?.slug || ""} />

            {/* Active/Today Orders */}
            <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100/80">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Новые заказы</h3>
                <button onClick={() => setActiveTab("ORDERS")} className="text-[10px] font-black text-indigo-600 hover:underline">
                  Все ({stats.orders.length}) →
                </button>
              </div>
              {stats.orders.filter(o => o.status === "NEW").length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400 font-medium">Новых заказов нет</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {stats.orders.filter(o => o.status === "NEW").slice(0, 4).map((o: any) => (
                    <div key={o.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <strong className="text-xs text-slate-800">Заказ #{o.id.slice(-5).toUpperCase()}</strong>
                        <span className="text-[9px] block text-slate-400 font-semibold">{o.customerName} · {o.customerPhone}</span>
                      </div>
                      <button 
                        onClick={() => handleUpdateOrderStatus(o.id, "ACCEPTED")}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3 py-1 rounded-lg"
                      >
                        Принять
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bookings shortcut */}
            {stats.bookings.filter(b => b.status === "NEW").length > 0 && (
              <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100/80">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Новые записи</h3>
                  <button onClick={() => setActiveTab("BOOKINGS")} className="text-[10px] font-black text-indigo-600 hover:underline">
                    Все →
                  </button>
                </div>
                <div className="space-y-2">
                  {stats.bookings.filter(b => b.status === "NEW").slice(0, 3).map((b: any) => (
                    <div key={b.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <strong className="text-xs text-slate-800">{b.customerName}</strong>
                        <span className="text-[9px] block text-slate-400 font-semibold">
                          📅 {new Date(b.startTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => handleUpdateBookingStatus(b.id, "CONFIRMED")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] px-2.5 py-1 rounded-lg"
                        >
                          Подтвердить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Orders Panel */}
        {activeTab === "ORDERS" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100/80">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5">Управление заказами</h3>
              
              {/* Filter statuses */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
                {["ALL", "NEW", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "READY_FOR_DELIVERY", "COURIER_ASSIGNED", "PICKED_UP", "DELIVERED", "COMPLETED", "CANCELLED", "EXPIRED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setOrderFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all ${
                      orderFilter === status 
                        ? "bg-indigo-600 text-white shadow-xs" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {status === "ALL" ? "Все" : formatOrderStatusRu(status)}
                  </button>
                ))}
              </div>

              {/* Orders List */}
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {stats.orders.filter(o => orderFilter === "ALL" || o.status === orderFilter).length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400 font-medium">Нет заказов с этим статусом</p>
                ) : (
                  stats.orders.filter(o => orderFilter === "ALL" || o.status === orderFilter).map((order: any) => (
                    <div key={order.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-xs text-slate-900 block font-extrabold">
                            Заказ #{order.id.slice(-6).toUpperCase()}
                          </strong>
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(order.createdAt).toLocaleString("ru-RU")}
                          </span>
                        </div>
                        <span className={`text-[9px] font-black rounded-full px-2 py-0.5 ${
                          order.status === "NEW" ? "bg-amber-100 text-amber-700" :
                          order.status === "ACCEPTED" ? "bg-indigo-100 text-indigo-700" :
                          order.status === "PREPARING" ? "bg-purple-100 text-purple-700" :
                          ["READY", "READY_FOR_PICKUP", "READY_FOR_DELIVERY"].includes(order.status) ? "bg-cyan-100 text-cyan-700" :
                          ["DELIVERING", "COURIER_ASSIGNED", "PICKED_UP"].includes(order.status) ? "bg-blue-100 text-blue-700" :
                          ["DELIVERED", "COMPLETED"].includes(order.status) ? "bg-emerald-100 text-emerald-700" :
                          order.status === "EXPIRED" ? "bg-slate-200 text-slate-700" :
                          "bg-slate-200 text-slate-500"
                        }`}>
                          {formatOrderStatusRu(order.status)}
                        </span>
                      </div>

                      {/* Info customer */}
                      <div className="text-xs text-slate-600 bg-white rounded-xl p-2.5 border border-slate-100/50 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-slate-400" />
                          <span className="font-bold">{order.customerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400" />
                          <a href={`tel:${order.customerPhone}`} className="text-indigo-600 underline font-semibold">
                            {order.customerPhone}
                          </a>
                        </div>
                        {order.customerAddress && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-slate-400" />
                            <span>{order.customerAddress}</span>
                          </div>
                        )}
                        {order.comment && (
                          <div className="text-[10px] text-slate-500 italic mt-1 border-t pt-1">
                            💬 "{order.comment}"
                          </div>
                        )}
                        {order.status === "EXPIRED" && (
                          <div className="text-[10px] text-slate-600 mt-1 border-t pt-1">
                            ⏱️ {order.expireReason || "Заказ самовывоза истёк."}
                          </div>
                        )}
                        {order.paymentMethod === "TRANSFER" && (
                          <div className="mt-2 space-y-1 rounded-xl border border-amber-100 bg-amber-50 p-2 text-[10px] font-bold text-amber-900">
                            <div className="flex items-center justify-between gap-2">
                              <span>Оплата переводом</span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-amber-700">
                                {formatPaymentStatusRu(order.paymentStatus)}
                              </span>
                            </div>
                            {order.paymentProofUrl && (
                              <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="inline-flex text-indigo-600 underline">
                                Открыть чек
                              </a>
                            )}
                            {order.paymentProofAiStatus && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span>ИИ:</span>
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                                  ["LIKELY_VALID", "likely_valid"].includes(order.paymentProofAiStatus) ? "bg-emerald-100 text-emerald-700" :
                                  ["MANUAL_REVIEW", "manual_review"].includes(order.paymentProofAiStatus) ? "bg-amber-100 text-amber-700" :
                                  ["LIKELY_INVALID", "likely_invalid"].includes(order.paymentProofAiStatus) ? "bg-rose-100 text-rose-700" :
                                  "bg-slate-100 text-slate-600"
                                }`}>
                                  {paymentProofAiLabel(order.paymentProofAiStatus)}
                                </span>
                                {typeof order.paymentProofAiConfidence === "number" && (
                                  <span>{order.paymentProofAiConfidence}%</span>
                                )}
                              </div>
                            )}
                            {order.paymentProofAiStatus && order.paymentProofAiStatus !== "PENDING" && (() => {
                              const analysis = receiptAnalysisFromOrder(order);
                              if (!analysis) {
                                return (
                                  <div className="rounded-lg bg-white/80 p-2 text-[10px] leading-relaxed text-slate-600">
                                    ИИ не смог прочитать чек. Проверьте его вручную.
                                  </div>
                                );
                              }

                              return (
                                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-2 gap-y-1 rounded-lg bg-white/80 p-2 text-[10px] font-semibold text-slate-600">
                                  <span className="text-slate-400">Сумма на чеке</span>
                                  <span>{analysis.extractedAmount === null ? "Не распознана" : `${analysis.extractedAmount} ₽`}</span>
                                  <span className="text-slate-400">Ожидалось</span>
                                  <span>{analysis.expectedAmount === null ? `${order.totalPrice} ₽` : `${analysis.expectedAmount} ₽`}</span>
                                  <span className="text-slate-400">Дата</span>
                                  <span>{analysis.extractedDate || "Не распознана"}</span>
                                  <span className="text-slate-400">Получатель</span>
                                  <span>
                                    {analysis.extractedRecipient || "Не распознан"}
                                    {analysis.expectedRecipient ? ` / ожидалось: ${analysis.expectedRecipient}` : ""}
                                  </span>
                                  <span className="text-slate-400">Банк</span>
                                  <span>{analysis.extractedBank || "Не распознан"}</span>
                                  <span className="text-slate-400">Совпадение</span>
                                  <span>
                                    Сумма: {receiptMatchLabel(analysis.amountMatches)}; получатель: {receiptMatchLabel(analysis.recipientMatches)}
                                  </span>
                                  <span className="text-slate-400">Уверенность</span>
                                  <span>{analysis.confidencePercent === null ? "Не определена" : `${analysis.confidencePercent}%`}</span>
                                  <span className="text-slate-400">Комментарий ИИ</span>
                                  <span>{analysis.reasonRu || order.paymentProofAiSummary || "Проверьте чек вручную."}</span>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        {order.deliveryCityArea && (
                          <div className="flex items-center gap-1.5">
                            <Truck size={12} className="text-slate-400" />
                            <span>
                              {order.deliveryZoneName || order.deliveryCityArea} · доставка{" "}
                              <span className="whitespace-nowrap">{order.deliveryFee || 0} ₽</span>
                            </span>
                          </div>
                        )}
                        {order.deliveryAssignment?.courier && (
                          <div className="rounded-xl bg-blue-50 p-2 text-[10px] font-bold text-blue-800">
                            Курьер: {order.deliveryAssignment.courier.name} · {order.deliveryAssignment.courier.phone}
                          </div>
                        )}
                      </div>

                      {/* Items Ordered */}
                      <div className="text-[11px] font-bold text-slate-500 space-y-1 pl-1">
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between">
                            <span>{item.name || item.item?.name} × {item.quantity}</span>
                            <span>{item.price * item.quantity} ₽</span>
                          </div>
                        ))}
                        <div className="border-t pt-1.5 flex justify-between font-bold text-slate-600">
                          <span>Товары:</span>
                          <span>{order.itemsSubtotal || order.totalPrice - (order.deliveryFee || 0)} ₽</span>
                        </div>
                        {order.deliveryType === "DELIVERY" && (
                          <div className="flex justify-between font-bold text-slate-600">
                            <span>Доставка:</span>
                            <span className="shrink-0 whitespace-nowrap">{order.deliveryFee || 0} ₽</span>
                          </div>
                        )}
                        <div className="flex justify-between font-black text-slate-900">
                          <span>Итого:</span>
                          <span className="shrink-0 whitespace-nowrap text-indigo-600">{order.totalPrice} ₽</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1 border-t border-slate-200/50">
                        {order.paymentMethod === "TRANSFER" && order.paymentStatus === "AWAITING_REVIEW" ? (
                          <>
                            <button
                              onClick={() => handleConfirmPayment(order.id)}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 rounded-xl transition"
                            >
                              Подтвердить оплату
                            </button>
                            <button
                              onClick={() => handleRejectPayment(order.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs px-3.5 py-2 rounded-xl transition"
                            >
                              Отклонить оплату
                            </button>
                          </>
                        ) : (
                          <>
                        {order.status === "NEW" && (
                          <>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "ACCEPTED")}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-2 rounded-xl transition"
                            >
                              Принять
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "CANCELLED")}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs px-3.5 py-2 rounded-xl transition"
                            >
                              Отклонить
                            </button>
                          </>
                        )}
                        {order.status === "ACCEPTED" && (
                          <>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "PREPARING")}
                              className="flex-1 bg-purple-600 hover:bg-purple-750 text-white font-black text-xs py-2 rounded-xl transition"
                            >
                              Начать готовку
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "READY")}
                              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs py-2 rounded-xl transition"
                            >
                              {order.deliveryType === "DELIVERY" ? "Готов к доставке" : "Готов к выдаче"}
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "CANCELLED")}
                              className="bg-slate-105 hover:bg-slate-200 text-slate-600 text-xs px-3 py-2 rounded-xl transition"
                            >
                              Отменить
                            </button>
                          </>
                        )}
                        {order.status === "PREPARING" && (
                          <>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "READY")}
                              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs py-2 rounded-xl transition"
                            >
                              {order.deliveryType === "DELIVERY" ? "Готов к доставке" : "Готов к выдаче"}
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "CANCELLED")}
                              className="bg-slate-105 hover:bg-slate-200 text-slate-600 text-xs px-3 py-2 rounded-xl transition"
                            >
                              Отменить
                            </button>
                          </>
                        )}
                        {order.status === "READY" && (
                          <>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "COMPLETED")}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <CheckCircle size={14} /> Выдан клиенту
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, "DELIVERING")}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition"
                            >
                              В доставку
                            </button>
                          </>
                        )}
                        {order.status === "DELIVERING" && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, "COMPLETED")}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle size={14} /> Доставлен и завершен
                          </button>
                        )}
                          </>
                        )}
                        {order.status === "READY_FOR_PICKUP" && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, "COMPLETED")}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle size={14} /> Выдан клиенту
                          </button>
                        )}
                        {order.status === "READY_FOR_DELIVERY" && (
                          <div className="grid w-full gap-2">
                            <div className="rounded-xl bg-cyan-50 p-2 text-center text-[10px] font-black text-cyan-700">
                              Заказ виден активным курьерам
                            </div>
                            <button
                              type="button"
                              onClick={() => setAssigningOrderId(order.id)}
                              disabled={couriers.length === 0}
                              className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"
                            >
                              Назначить курьера
                            </button>
                          </div>
                        )}
                        {order.status === "COURIER_ASSIGNED" && (
                          <div className="w-full rounded-xl bg-blue-50 p-2 text-center text-[10px] font-black text-blue-700">
                            Курьер назначен и должен забрать заказ
                          </div>
                        )}
                        {order.status === "PICKED_UP" && (
                          <div className="w-full rounded-xl bg-indigo-50 p-2 text-center text-[10px] font-black text-indigo-700">
                            Курьер забрал заказ и везёт клиенту
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Bookings Panel */}
        {activeTab === "BOOKINGS" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4.5 shadow-sm ring-1 ring-slate-100/80">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5">График записей</h3>

              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3">
                {["ALL", "PENDING", "NEW", "CONFIRMED", "COMPLETED", "CANCELLED", "EXPIRED", "NO_SHOW"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setBookingFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all ${
                      bookingFilter === status 
                        ? "bg-indigo-600 text-white shadow-xs" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {status === "ALL" ? "Все" : getBookingStatusLabel(status)}
                  </button>
                ))}
              </div>

              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {stats.bookings.filter(b => bookingFilter === "ALL" || b.status === bookingFilter).length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400 font-medium">Записей не обнаружено</p>
                ) : (
                  stats.bookings.filter(b => bookingFilter === "ALL" || b.status === bookingFilter).map((bk: any) => (
                    <div key={bk.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-xs text-slate-900 block font-extrabold">{bk.customerName}</strong>
                          <span className="text-[10px] font-bold text-indigo-600 block mt-0.5">
                            {bk.service?.name || "Услуга"}
                          </span>
                        </div>
                        <span className={`text-[9px] font-black rounded-full px-2 py-0.5 ${
                          bk.status === "NEW" ? "bg-amber-100 text-amber-700" :
                          bk.status === "PENDING" ? "bg-slate-100 text-slate-700" :
                          bk.status === "CONFIRMED" ? "bg-indigo-100 text-indigo-700" :
                          bk.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                          bk.status === "EXPIRED" ? "bg-slate-200 text-slate-700" :
                          bk.status === "NO_SHOW" ? "bg-rose-100 text-rose-700" :
                          "bg-slate-200 text-slate-500"
                        }`}>
                          {getBookingStatusLabel(bk.status)}
                        </span>
                      </div>

                      {/* Detail row */}
                      <div className="text-xs text-slate-600 bg-white rounded-xl p-2.5 border border-slate-100/50 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-slate-400" />
                          <span className="font-bold">
                            {new Date(bk.startTime).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400" />
                          <a href={`tel:${bk.customerPhone}`} className="text-indigo-600 underline font-semibold">
                            {bk.customerPhone}
                          </a>
                        </div>
                        {bk.staff?.name && (
                          <div className="flex items-center gap-1.5">
                            <User size={12} className="text-slate-400" />
                            <span>Мастер: {bk.staff.name}</span>
                          </div>
                        )}
                        {(bk.status === "NO_SHOW" || bk.status === "EXPIRED") && (
                          <div className="text-[10px] text-slate-600 border-t pt-1">
                            ⏱️ {bk.expireReason || "Запись автоматически снята."}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {bk.status === "NEW" && (
                          <>
                            <button
                              onClick={() => handleUpdateBookingStatus(bk.id, "CONFIRMED")}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-750 text-white font-black text-xs py-2 rounded-xl transition"
                            >
                              Подтвердить
                            </button>
                            <button
                              onClick={() => handleUpdateBookingStatus(bk.id, "CANCELLED")}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs px-3 py-2 rounded-xl transition"
                            >
                              Отменить
                            </button>
                          </>
                        )}
                        {bk.status === "CONFIRMED" && (
                          <button
                            onClick={() => handleUpdateBookingStatus(bk.id, "COMPLETED")}
                            className="w-full bg-emerald-600 hover:bg-emerald-755 text-white font-black text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5"
                          >
                            <Check size={14} /> Выполнено (Завершить)
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Items catalog management */}
        {activeTab === "ITEMS" && (
          <div className="space-y-4">
            
            {/* Toggle category form */}
            <div className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-slate-100/80">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Категории меню ({categories.length})</h3>
                <button 
                  onClick={() => setShowCatForm(!showCatForm)}
                  className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-0.5"
                >
                  <Plus size={10} /> Добавить
                </button>
              </div>

              {showCatForm && (
                <form onSubmit={handleCreateCategory} className="mt-3.5 flex gap-2">
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Например: Десерты"
                    className="flex-1 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none"
                    required
                  />
                  <button type="submit" className="rounded-xl bg-slate-900 text-white font-black text-xs px-4 py-2 hover:bg-indigo-600 transition">
                    Создать
                  </button>
                </form>
              )}
            </div>

            {/* Item add form */}
            <form onSubmit={handleAddItem} className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100/80 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  {editingItemId ? "Редактирование позиции" : "Быстрое добавление"}
                </h3>
                {editingItemId && (
                  <button
                    type="button"
                    onClick={resetItemForm}
                    className="text-[10px] font-black text-slate-400 hover:text-slate-900"
                  >
                    Отмена
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">ФОТО ТОВАРА</label>
                  <MediaUpload
                    key={editingItemId || "new-item"}
                    businessId={businessId}
                    type="gallery"
                    initialUrl={newItemImage}
                    onUploadComplete={setNewItemImage}
                  />
                </div>

                <div>
                  <input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Название позиции (например: Эспрессо)"
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="Цена в ₽"
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowCategoryBottomSheet(true)}
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none text-left flex justify-between items-center cursor-pointer"
                  >
                    <span className="truncate">
                      {categories.find((c: any) => c.id === newItemCategory)?.name || "Выбрать категорию"}
                    </span>
                    <span className="text-slate-400 text-[10px]">▼</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-100/50 p-1.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNewItemType("PRODUCT")}
                    className={`py-2 text-[10px] font-black rounded-lg transition-all ${
                      newItemType === "PRODUCT" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400"
                    }`}
                  >
                    🛍️ Товар
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItemType("SERVICE")}
                    className={`py-2 text-[10px] font-black rounded-lg transition-all ${
                      newItemType === "SERVICE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400"
                    }`}
                  >
                    💇 Услуга
                  </button>
                </div>

                <textarea
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="Описание состава, веса или особенностей..."
                  rows={2.5}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none resize-none"
                />

                {newItemType === "PRODUCT" && (
                  <div className="grid grid-cols-2 gap-3">
                    <BottomSheetPicker
                      title="Учёт остатков"
                      value={newItemStockMode}
                      onChange={(value) => {
                        const mode = value as "TRACKED" | "UNTRACKED";
                        setNewItemStockMode(mode);
                        setNewItemStock(mode === "TRACKED" ? (newItemStock || "0") : "");
                      }}
                      buttonClassName="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold outline-none"
                      options={[
                        {
                          value: "UNTRACKED",
                          label: "Просто в наличии / нет",
                          description: "Без точного количества",
                          icon: <CheckCircle size={16} />,
                        },
                        {
                          value: "TRACKED",
                          label: "Считать остатки",
                          description: "Указывать точное количество",
                          icon: <Layers size={16} />,
                        },
                      ]}
                    />
                    {newItemStockMode === "TRACKED" && (
                      <input
                        required
                        type="number"
                        min="0"
                        step="1"
                        value={newItemStock}
                        onChange={(e) => setNewItemStock(e.target.value)}
                        placeholder="Количество"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold outline-none"
                      />
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-xs font-black text-white hover:bg-indigo-650 transition"
                >
                  {editingItemId ? <Save size={14} /> : <Plus size={14} />}
                  {editingItemId ? "Сохранить изменения" : "Добавить на витрину"}
                </button>
              </div>
            </form>

            {/* Listing grid catalog */}
            <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100/80">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Витрина заведения ({filteredSellerItems.length})</h3>
              <div className="mb-3 grid grid-cols-[minmax(0,1fr)_minmax(130px,0.7fr)] gap-2">
                <input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Поиск товара"
                  className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none"
                />
                <BottomSheetPicker
                  title="Фильтр товаров"
                  value={itemAvailabilityFilter}
                  onChange={(value) => setItemAvailabilityFilter(value as typeof itemAvailabilityFilter)}
                  buttonClassName="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black"
                  options={[
                    { value: "ACTIVE", label: "Активные", icon: <CheckCircle size={16} /> },
                    { value: "AVAILABLE", label: "В наличии", icon: <ShoppingBag size={16} /> },
                    { value: "OUT_OF_STOCK", label: "Нет в наличии", icon: <Minus size={16} /> },
                    { value: "HIDDEN", label: "Скрытые", icon: <Eye size={16} /> },
                    { value: "ARCHIVED", label: "Архив", icon: <Archive size={16} /> },
                  ]}
                />
              </div>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {filteredSellerItems.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400 font-semibold">Ваш каталог пока пуст.</p>
                ) : (
                  filteredSellerItems.map((it) => (
                    <div key={it.id} className="rounded-2xl border border-slate-100 bg-slate-50/40 p-2">
                      <div className="flex gap-3 items-center justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                        <div className="h-11 w-11 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center text-slate-400">
                          {it.imageUrl ? (
                            <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon size={14} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <strong className="block truncate text-xs font-black text-slate-900">{it.name}</strong>
                          <span className="text-[10px] font-black text-indigo-600">{it.price} ₽</span>
                          {it.category?.name && (
                            <span className="text-[9px] font-bold text-slate-400 ml-1.5">
                              · {it.category.name}
                            </span>
                          )}
                        </div>
                      </div>
                        <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => startEditItem(it)}
                          className="p-2 rounded-xl text-indigo-600 hover:bg-indigo-50 active:scale-95 transition"
                          title="Изменить"
                        >
                          <Pencil size={13} />
                        </button>
                        {it.archivedAt ? (
                          <button onClick={() => patchSellerItem(it, { archived: false }, "Позиция восстановлена.")} className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50" title="Восстановить"><RotateCcw size={13} /></button>
                        ) : (
                          <button onClick={() => handleDeleteItem(it.id)} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50" title="В архив"><Archive size={13} /></button>
                        )}
                      </div>
                      </div>
                      {!it.archivedAt && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 text-[9px] font-black">
                          {it.stock === null || it.stock === undefined ? (
                            <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-700">Без учёта остатков</span>
                          ) : (
                            <>
                              <button onClick={() => setSellerItemStock(it, Math.max(0, it.stock - 1))} disabled={it.stock <= 0} className="grid h-7 w-7 place-items-center rounded-lg bg-white disabled:opacity-40"><Minus size={11} /></button>
                              <button onClick={() => promptSellerItemStock(it)} className="rounded-lg bg-white px-2 py-1.5">Остаток: {it.stock}</button>
                              <button onClick={() => setSellerItemStock(it, it.stock + 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white"><Plus size={11} /></button>
                            </>
                          )}
                          <button onClick={() => promptSellerItemPrice(it)} className="rounded-lg bg-indigo-50 px-2 py-1.5 text-indigo-700">Цена</button>
                          <button onClick={() => patchSellerItem(it, { isAvailable: !it.isAvailable })} className={`rounded-lg px-2 py-1.5 ${it.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            {it.isAvailable ? "В наличии" : "Скрыт"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "DELIVERY" && (
          <SellerDeliverySettings
            businessId={businessId}
            onMessage={(message, isError) => isError ? showError(message) : showSuccess(message)}
          />
        )}

        {activeTab === "COURIERS" && (
          <SellerCouriers
            businessId={businessId}
            onMessage={(message, isError) => isError ? showError(message) : showSuccess(message)}
          />
        )}

        {/* Tab 6: Customers List CRM */}
        {activeTab === "CLIENTS" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100/80">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3.5">База клиентов ({customers.length})</h3>

              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {customers.length === 0 ? (
                  <p className="text-center py-12 text-xs text-slate-400 font-medium">Клиенты пока не заказывали товары</p>
                ) : (
                  customers.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-xs font-black text-slate-900 block">{c.name || "Клиент"}</strong>
                          <span className="text-[9px] font-bold text-slate-400 font-mono">TG: @{c.username || "скрыт"}</span>
                        </div>
                        <a href={`tel:${c.phone}`} className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition">
                          <Phone size={11} />
                        </a>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold text-slate-500 bg-white p-2 rounded-xl border border-slate-100/50">
                        <div>
                          <p className="font-black text-xs text-slate-800">{c._count?.orders || 0}</p>
                          <p className="text-[8px] uppercase mt-0.5">Заказы</p>
                        </div>
                        <div className="border-l">
                          <p className="font-black text-xs text-slate-800">{c._count?.bookings || 0}</p>
                          <p className="text-[8px] uppercase mt-0.5">Записи</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Media Design Configurator */}
        {activeTab === "MEDIA" && (
          <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Медиа-оформление витрины</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">ЛОГОТИП ЗАВЕДЕНИЯ</label>
                <MediaUpload
                  businessId={businessId}
                  type="logo"
                  initialUrl={bizLogoUrl}
                  onUploadComplete={setBizLogoUrl}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">ОБЛОЖКА ВИТРИНЫ (COVER)</label>
                <MediaUpload
                  businessId={businessId}
                  type="cover"
                  initialUrl={bizCoverUrl}
                  onUploadComplete={setBizCoverUrl}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">ФИРМЕННЫЙ ЦВЕТ (HEX)</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={bizColor}
                    onChange={(e) => setBizColor(e.target.value)}
                    className="h-10 w-10 border rounded-xl outline-none cursor-pointer"
                  />
                  <input
                    value={bizColor}
                    onChange={(e) => setBizColor(e.target.value)}
                    placeholder="#3B82F6"
                    className="flex-1 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpdateMedia}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-xs font-black text-white hover:bg-indigo-650 transition mt-2 shadow-md shadow-indigo-600/5"
              >
                <Save size={14} /> Сохранить оформление
              </button>
            </div>
          </div>
        )}

        {/* Tab 8: Business Settings info */}
        {activeTab === "SETTINGS" && (
          <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-100/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Параметры заведения</h3>
            
            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">НАЗВАНИЕ</label>
                <input
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  placeholder="например: Кофейня Вкусняшка"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">ОПИСАНИЕ</label>
                <textarea
                  value={bizDesc}
                  onChange={(e) => setBizDesc(e.target.value)}
                  placeholder="Свежий кофе, десерты и хорошее настроение."
                  rows={2.5}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">АДРЕС</label>
                <input
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  placeholder="Москва, ул. Ленина, д. 10"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">ТЕЛЕФОН</label>
                <input
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-700">Работает сейчас?</span>
                <input
                  type="checkbox"
                  checked={bizIsOpen}
                  onChange={(e) => setBizIsOpen(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-350 text-indigo-600 outline-none cursor-pointer"
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-800">Оплата переводом</h4>
                    <p className="text-[10px] font-bold text-slate-400">Банк, СБП/телефон и инструкция для клиента</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={transferPaymentEnabled}
                    onChange={(e) => setTransferPaymentEnabled(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-350 text-indigo-600 outline-none cursor-pointer"
                  />
                </div>

                {transferPaymentEnabled && (
                  <div className="space-y-2">
                    <input
                      value={transferBankName}
                      onChange={(e) => setTransferBankName(e.target.value)}
                      placeholder="Банк, например Сбербанк"
                      className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white p-3 outline-none"
                    />
                    <input
                      value={transferPaymentPhone}
                      onChange={(e) => setTransferPaymentPhone(e.target.value)}
                      placeholder="Телефон/SBP для перевода"
                      className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white p-3 outline-none"
                    />
                    <input
                      value={transferRecipientName}
                      onChange={(e) => setTransferRecipientName(e.target.value)}
                      placeholder="Получатель, например Андрей Е."
                      className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white p-3 outline-none"
                    />
                    <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700">
                      <span>Комментарий к платежу обязателен</span>
                      <input
                        type="checkbox"
                        checked={transferPaymentCommentRequired}
                        onChange={(e) => setTransferPaymentCommentRequired(e.target.checked)}
                        className="h-4 w-4"
                      />
                    </label>
                    <textarea
                      value={transferPaymentInstructions}
                      onChange={(e) => setTransferPaymentInstructions(e.target.value)}
                      placeholder="Инструкция для клиента: переведите точную сумму и загрузите чек."
                      rows={3}
                      className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white p-3 outline-none resize-none"
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleUpdateSettings}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-xs font-black text-white hover:bg-indigo-650 transition mt-2 shadow-md shadow-indigo-600/5"
              >
                <Save size={14} /> Сохранить настройки
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Premium Category Picker Bottom Sheet */}
      {showCategoryBottomSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-300">
          <div className="absolute inset-0" onClick={() => setShowCategoryBottomSheet(false)} />
          <div className="relative w-full max-w-[480px] bg-white rounded-t-[32px] p-6 space-y-4 animate-slide-up shadow-2xl pb-10">
            <div className="flex justify-between items-center pb-2 border-b">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Выберите категорию</h4>
              <button
                onClick={() => setShowCategoryBottomSheet(false)}
                className="text-[10px] font-black text-slate-400 hover:text-slate-800"
              >
                Закрыть
              </button>
            </div>
            
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 no-scrollbar">
              {categories.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setNewItemCategory("");
                    setShowCategoryBottomSheet(false);
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700"
                >
                  • Основное (будет создано автоматически)
                </button>
              ) : (
                categories.map((c: any) => (
                  <div key={c.id} className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewItemCategory(c.id);
                        setShowCategoryBottomSheet(false);
                      }}
                      className={`min-w-0 flex-1 text-left p-3.5 rounded-2xl text-xs font-bold transition flex justify-between items-center ${
                        newItemCategory === c.id
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-805 border border-slate-100"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {newItemCategory === c.id && <span>✓</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(c.id)}
                      className="grid w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100"
                      title="Удалить категорию"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <button
              type="button"
              onClick={() => {
                setShowCategoryBottomSheet(false);
                setShowCatForm(true);
              }}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-[10px] font-black text-slate-700 transition"
            >
              + Создать новую категорию
            </button>
          </div>
        </div>
      )}

      {assigningOrderId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Закрыть"
            disabled={Boolean(assigningCourierId)}
            onClick={() => setAssigningOrderId(null)}
          />
          <section className="relative w-full max-w-[480px] rounded-t-[32px] bg-white p-6 pb-10 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900">Назначить курьера</h4>
                <p className="mt-1 text-[10px] font-bold text-slate-400">Курьер получит Telegram-уведомление и подтвердит доставку.</p>
              </div>
              <button
                type="button"
                disabled={Boolean(assigningCourierId)}
                onClick={() => setAssigningOrderId(null)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black disabled:opacity-40"
              >
                Закрыть
              </button>
            </div>
            <div className="grid max-h-[55vh] gap-2 overflow-y-auto">
              {couriers.map((courier) => (
                <button
                  key={courier.id}
                  type="button"
                  disabled={Boolean(assigningCourierId)}
                  onClick={() => handleAssignCourier(assigningOrderId, courier.id)}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-slate-100 disabled:opacity-60"
                >
                  <span>
                    <span className="block text-xs font-black text-slate-900">{courier.name}</span>
                    <span className="mt-1 block text-[10px] font-bold text-slate-400">{courier.cityArea || "Все зоны"} · {courier.phone}</span>
                  </span>
                  {assigningCourierId === courier.id ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                  ) : (
                    <Check size={15} className="text-indigo-600" />
                  )}
                </button>
              ))}
              {couriers.length === 0 && <p className="py-8 text-center text-xs font-bold text-slate-400">Нет активных курьеров.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
