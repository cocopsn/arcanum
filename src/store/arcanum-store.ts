import { createStore, type StoreApi } from "zustand/vanilla";
import { project, applyEvents } from "@/core/projector";
import { present, type ViewModel } from "@/core/present";
import type { ReadModel } from "@/core/read-model";
import type { ArcanumEvent } from "@/core/event";
import type { ArcanumDB } from "@/db/schema";
import {
  appendEvent,
  appendEvents,
  getAllEvents,
  getUnsynced,
  saveReadModel,
} from "@/db/repo";
import { SEED_EVENTS } from "@/lib/seed";
import { syncWithRetry, type SyncClient } from "@/sync/sync";

const EMPTY_MODEL: ReadModel = project([]);

/** Real sync state — never faked. local: no session; synced: signed in + 0 pending. */
export type SyncState = "local" | "syncing" | "synced" | "error";

export interface ArcanumState {
  status: "loading" | "ready";
  readModel: ReadModel;
  viewModel: ViewModel;
  syncState: SyncState;
  /** unsynced local events (events not yet mirrored) */
  pendingCount: number;
  authEmail: string | null;

  hydrate: (now: number) => Promise<void>;
  dispatch: (event: ArcanumEvent, now: number) => Promise<void>;
  rebuild: (now: number) => Promise<void>;
  refreshPresent: (now: number) => void;
  /** Reflect the auth identity (null on sign-out → local). */
  setAuth: (email: string | null) => Promise<void>;
  /** Push/pull against Supabase, then re-fold. Sets syncState honestly. */
  sync: (client: SyncClient, now: number) => Promise<void>;
}

export type ArcanumStore = StoreApi<ArcanumState>;

export function createArcanumStore(db: ArcanumDB): ArcanumStore {
  return createStore<ArcanumState>((set, get) => ({
    status: "loading",
    readModel: EMPTY_MODEL,
    viewModel: present(EMPTY_MODEL, 0),
    syncState: "local",
    pendingCount: 0,
    authEmail: null,

    async hydrate(now) {
      let events = await getAllEvents(db);
      if (events.length === 0) {
        await appendEvents(db, SEED_EVENTS, 0);
        events = SEED_EVENTS;
      }
      const readModel = project(events);
      await saveReadModel(db, readModel);
      const pendingCount = (await getUnsynced(db)).length;
      set({ status: "ready", readModel, viewModel: present(readModel, now), pendingCount });
    },

    async dispatch(event, now) {
      await appendEvent(db, event, 0);
      const all = await getAllEvents(db);
      const { model } = applyEvents(get().readModel, [event], all);
      await saveReadModel(db, model);
      const pendingCount = (await getUnsynced(db)).length;
      set({ readModel: model, viewModel: present(model, now), pendingCount });
    },

    async rebuild(now) {
      const readModel = project(await getAllEvents(db));
      await saveReadModel(db, readModel);
      const pendingCount = (await getUnsynced(db)).length;
      set({ readModel, viewModel: present(readModel, now), pendingCount });
    },

    refreshPresent(now) {
      set({ viewModel: present(get().readModel, now) });
    },

    async setAuth(email) {
      const pendingCount = (await getUnsynced(db)).length;
      set({
        authEmail: email,
        pendingCount,
        syncState: email === null ? "local" : get().syncState === "local" ? "syncing" : get().syncState,
      });
    },

    async sync(client, now) {
      if (get().authEmail === null) return;
      set({ syncState: "syncing" });
      try {
        await syncWithRetry(db, client);
        const readModel = project(await getAllEvents(db));
        await saveReadModel(db, readModel);
        const pendingCount = (await getUnsynced(db)).length;
        set({
          readModel,
          viewModel: present(readModel, now),
          pendingCount,
          syncState: "synced",
        });
      } catch {
        const pendingCount = (await getUnsynced(db)).length;
        set({ syncState: "error", pendingCount });
      }
    },
  }));
}
