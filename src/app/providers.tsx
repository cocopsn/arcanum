"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import {
  createArcanumStore,
  type ArcanumStore,
  type ArcanumState,
} from "@/store/arcanum-store";
import { createDb, type ArcanumDB } from "@/db/schema";

const StoreCtx = createContext<ArcanumStore | null>(null);

export function ArcanumProvider({
  children,
  db,
}: {
  children: React.ReactNode;
  db?: ArcanumDB;
}) {
  const [store] = useState<ArcanumStore>(() => createArcanumStore(db ?? createDb()));

  useEffect(() => {
    void store.getState().hydrate(Date.now());
    void navigator.storage?.persist?.();

    const tick = () => store.getState().refreshPresent(Date.now());
    const interval = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", tick);
    };
  }, [store]);

  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}

export function useArcanumStore(): ArcanumStore {
  const store = useContext(StoreCtx);
  if (!store) throw new Error("useArcanumStore must be used within ArcanumProvider");
  return store;
}

export function useArcanum<T>(selector: (s: ArcanumState) => T): T {
  return useStore(useArcanumStore(), selector);
}
