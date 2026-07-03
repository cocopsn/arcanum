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
import { signOut, currentUser, onAuthChange } from "@/sync/auth";
import { requestPersist } from "@/lib/storage";
import { seedBooks } from "@/lib/seed-books";

interface ArcanumContext {
  store: ArcanumStore;
  syncAvailable: boolean;
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
    void seedBooks(); // populate the offline reader with the bundled seed books (idempotent, best-effort)
    // Ask for durable storage on the FIRST user gesture — iOS grants persist far more reliably once
    // the PWA is engaged than on a cold load. One-shot (self-removes after the first gesture).
    const askPersist = () => {
      void requestPersist();
      window.removeEventListener("pointerdown", askPersist);
      window.removeEventListener("keydown", askPersist);
    };
    window.addEventListener("pointerdown", askPersist);
    window.addEventListener("keydown", askPersist);

    let unsub: (() => void) | undefined;
    if (sb) {
      void currentUser(sb).then(async (user) => {
        if (user?.email) {
          void store.getState().setAuth(user.email).then(syncNow);
          return;
        }
        // ONE login: past the env-gate but with no Supabase session yet (e.g. the gate login
        // predated the service_role being set) → SELF-HEAL. Mint the session server-side from the
        // gate cookie and adopt it; onAuthChange then sets authEmail + syncs. No password, no sheet.
        // Stays local (honest) if the gate isn't configured or the service_role isn't set.
        try {
          const s = await fetch("/api/session", { cache: "no-store" }).then((r) => r.json());
          if (!s?.authed) return;
          const r = await fetch("/api/session/refresh", { method: "POST" }).then((r) => r.json());
          if (r?.ok && r.supabase?.access_token && r.supabase?.refresh_token) {
            await sb.auth.setSession({ access_token: r.supabase.access_token, refresh_token: r.supabase.refresh_token });
          }
        } catch {
          /* offline / not configured → stays local, no error */
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
      window.removeEventListener("pointerdown", askPersist);
      window.removeEventListener("keydown", askPersist);
    };
  }, [store, sb, syncNow]);

  const value: ArcanumContext = {
    store,
    syncAvailable: sb !== null,
    syncNow,
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
  const { signOut, syncNow, syncAvailable } = useCtx();
  return { signOut, syncNow, syncAvailable };
}
