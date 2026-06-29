"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useStore } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createArcanumStore,
  type ArcanumStore,
  type ArcanumState,
} from "@/store/arcanum-store";
import { createDb, type ArcanumDB } from "@/db/schema";
import { getSupabase, makeSyncClient } from "@/sync/client";
import { signIn, signUp, signOut, currentUser, onAuthChange } from "@/sync/auth";

export interface AuthResult {
  error?: string;
  info?: string;
}

interface ArcanumContext {
  store: ArcanumStore;
  syncAvailable: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  syncNow: () => void;
}

const Ctx = createContext<ArcanumContext | null>(null);

export function ArcanumProvider({
  children,
  db,
}: {
  children: React.ReactNode;
  db?: ArcanumDB;
}) {
  const [store] = useState<ArcanumStore>(() => createArcanumStore(db ?? createDb()));
  const [sb] = useState<SupabaseClient | null>(() => {
    try {
      return getSupabase();
    } catch {
      return null;
    }
  });
  const syncing = useRef(false);

  const syncNow = useCallback(() => {
    if (!sb || store.getState().authEmail === null || syncing.current) return;
    syncing.current = true;
    void store
      .getState()
      .sync(makeSyncClient(sb), Date.now())
      .finally(() => {
        syncing.current = false;
      });
  }, [sb, store]);

  useEffect(() => {
    void store.getState().hydrate(Date.now());
    void navigator.storage?.persist?.();

    let unsub: (() => void) | undefined;
    if (sb) {
      void currentUser(sb).then((user) => {
        if (user?.email) {
          void store.getState().setAuth(user.email).then(syncNow);
        }
      });
      unsub = onAuthChange(sb, (user) => {
        void store.getState().setAuth(user?.email ?? null).then(() => {
          if (user) syncNow();
        });
      });
    }

    const onFocus = () => {
      store.getState().refreshPresent(Date.now());
      syncNow();
    };
    const interval = window.setInterval(() => {
      store.getState().refreshPresent(Date.now());
      syncNow();
    }, 30_000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", syncNow);
    return () => {
      unsub?.();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", syncNow);
    };
  }, [store, sb, syncNow]);

  const value: ArcanumContext = {
    store,
    syncAvailable: sb !== null,
    syncNow,
    signIn: async (email, password) => {
      if (!sb) return { error: "Sync no disponible (sin configuración)." };
      const { error } = await signIn(sb, email, password);
      return error ? { error: error.message } : {};
    },
    signUp: async (email, password) => {
      if (!sb) return { error: "Sync no disponible (sin configuración)." };
      const { data, error } = await signUp(sb, email, password);
      if (error) return { error: error.message };
      if (!data.session) {
        return { info: "Cuenta creada. Revisa tu correo para confirmar, luego entra." };
      }
      return {};
    },
    signOut: async () => {
      if (sb) await signOut(sb);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useCtx(): ArcanumContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("must be used within ArcanumProvider");
  return ctx;
}

export function useArcanumStore(): ArcanumStore {
  return useCtx().store;
}

export function useArcanum<T>(selector: (s: ArcanumState) => T): T {
  return useStore(useCtx().store, selector);
}

export function useArcanumSync() {
  const { signIn, signUp, signOut, syncNow, syncAvailable } = useCtx();
  return { signIn, signUp, signOut, syncNow, syncAvailable };
}
