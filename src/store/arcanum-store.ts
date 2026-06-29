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
  saveReadModel,
} from "@/db/repo";
import { SEED_EVENTS } from "@/lib/seed";
import { syncWithRetry, type SyncClient } from "@/sync/sync";

const EMPTY_MODEL: ReadModel = project([]);

export interface ArcanumState {
  status: "loading" | "ready";
  readModel: ReadModel;
  viewModel: ViewModel;
  /** Load the log (seeding day-0 on an empty store), derive, and go ready. */
  hydrate: (now: number) => Promise<void>;
  /** Append one event and derive incrementally. */
  dispatch: (event: ArcanumEvent, now: number) => Promise<void>;
  /** Re-fold the entire log from scratch ("Reconstruir índice"). */
  rebuild: (now: number) => Promise<void>;
  /** Recompute the now-dependent view without new events. */
  refreshPresent: (now: number) => void;
  /** Push/pull against Supabase, then re-fold. */
  sync: (client: SyncClient, now: number) => Promise<void>;
}

export type ArcanumStore = StoreApi<ArcanumState>;

export function createArcanumStore(db: ArcanumDB): ArcanumStore {
  return createStore<ArcanumState>((set, get) => ({
    status: "loading",
    readModel: EMPTY_MODEL,
    viewModel: present(EMPTY_MODEL, 0),

    async hydrate(now) {
      let events = await getAllEvents(db);
      if (events.length === 0) {
        await appendEvents(db, SEED_EVENTS, 0);
        events = SEED_EVENTS;
      }
      const readModel = project(events);
      await saveReadModel(db, readModel);
      set({ status: "ready", readModel, viewModel: present(readModel, now) });
    },

    async dispatch(event, now) {
      await appendEvent(db, event, 0);
      const all = await getAllEvents(db);
      const { model } = applyEvents(get().readModel, [event], all);
      await saveReadModel(db, model);
      set({ readModel: model, viewModel: present(model, now) });
    },

    async rebuild(now) {
      const readModel = project(await getAllEvents(db));
      await saveReadModel(db, readModel);
      set({ readModel, viewModel: present(readModel, now) });
    },

    refreshPresent(now) {
      set({ viewModel: present(get().readModel, now) });
    },

    async sync(client, now) {
      await syncWithRetry(db, client);
      await get().rebuild(now);
    },
  }));
}
