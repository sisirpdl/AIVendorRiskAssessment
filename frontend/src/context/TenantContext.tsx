import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getTenants } from "@/lib/api";
import type { Tenant } from "@/lib/types";

interface TenantContextValue {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  setActiveTenantId: (id: string) => void;
  loading: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const STORAGE_KEY = "activeTenantId";

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getTenants().then((t) => {
      if (!mounted) return;
      setTenants(t);
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const initial = stored && t.find((x) => x.id === stored) ? stored : t[0]?.id ?? null;
      setActiveId(initial);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setActiveTenantId = useCallback((id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenants,
      activeTenant: tenants.find((t) => t.id === activeId) ?? null,
      setActiveTenantId,
      loading,
    }),
    [tenants, activeId, setActiveTenantId, loading],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
