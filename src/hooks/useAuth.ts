import { useAuthStore } from "@/store/authStore";

export function useIsAdmin(): boolean {
  const user = useAuthStore((state) => state.user);
  return user?.role === "SUPER_ADMIN" || user?.role === "BUSINESS_OWNER";
}

export function useRole() {
  const user = useAuthStore((state) => state.user);
  return user?.role;
}

export function useBusinessId() {
  const user = useAuthStore((state) => state.user);
  return user?.businessId;
}
