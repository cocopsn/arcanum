import { createStore, type StoreApi } from "zustand/vanilla";
import { project, applyEvents } from "@/core/projector";
import { present, type ViewModel } from "@/core/present";
import { gradesBetween, type GradeInfo } from "@/core/grade";
import type { ReadModel } from "@/core/read-model";
import type { ArcanumEvent } from "@/core/event";
import type { ArcanumDB } from "@/db/schema";
import {
  appendEvent,
  appendEvents,
  getAllEvents,
  getUnsynced,
  saveReadModel,
  getAckGrade,
  setAckGrade,
} from "@/db/repo";
import { SEED_EVENTS } from "@/lib/seed";
import { syncWithRetry, type SyncClient } from "@/sync/sync";

const EMPTY_MODEL: ReadModel = project([]);

export type SyncState = "local" | "syncing" | "synced" | "error";

export interface ArcanumState {
  status: "loading" | "ready";
  readModel: ReadModel;
  viewModel: ViewModel;
  syncState: SyncState;
  pendingCount: number;
  authEmail: string | null;
  /** grades awaiting their ascension ceremony (front first) */
  ceremonyQueue: GradeInfo[];
  /** highest grade index already celebrated (mirrors persisted ack) */
  ackGrade: number;

  hydrate: (now: number) => Promise<void>;
  dispatch: (event: ArcanumEvent, now: number) => Promise<void>;
  rebuild: (now: number) => Promise<void>;
  refreshPresent: (now: number) => void;
  setAuth: (email: string | null) => Promise<void>;
  sync: (client: SyncClient, now: number) => Promise<void>;
  /** Pop the front ceremony once shown. */
  dismissCeremony: () => void;
}

export type ArcanumStore = StoreApi<ArcanumState>;

export function createArcanumStore(db: ArcanumDB): ArcanumStore {
  return createStore<ArcanumState>((set, get) => {
    // Detect threshold crossings and enqueue ceremonies. Idempotent under
    // re-fold: ackGrade only advances, persisted, so the same grade is never
    // celebrated twice even when the read-model is rebuilt.
    async function detect(): Promise<void> {
      const current = get().readModel.stats.gradeIndex;
      const ack = get().ackGrade;
      if (current > ack) {
        await setAckGrade(db, current);
        set({
          ackGrade: current,
          ceremonyQueue: [...get().ceremonyQueue, ...gradesBetween(ack, current)],
        });
      }
    }

    return {
      status: "loading",
      readModel: EMPTY_MODEL,
      viewModel: present(EMPTY_MODEL, 0),
      syncState: "local",
      pendingCount: 0,
      authEmail: null,
      ceremonyQueue: [],
      ackGrade: 0,

      async hydrate(now) {
        let events = await getAllEvents(db);
        if (events.length === 0) {
          await appendEvents(db, SEED_EVENTS, 0);
          events = SEED_EVENTS;
        }
        const readModel = project(events);
        await saveReadModel(db, readModel);
        const pendingCount = (await getUnsynced(db)).length;
        const current = readModel.stats.gradeIndex;

        // Baseline on first ever load: acknowledge the starting grade (no backlog
        // ceremonies for grades earned before this device knew the log).
        const stored = await getAckGrade(db);
        let ackGrade = current;
        let ceremonyQueue: GradeInfo[] = [];
        if (stored === null) {
          await setAckGrade(db, current);
        } else if (current > stored) {
          ceremonyQueue = gradesBetween(stored, current);
          ackGrade = current;
          await setAckGrade(db, current);
        } else {
          ackGrade = stored;
        }

        set({
          status: "ready",
          readModel,
          viewModel: present(readModel, now),
          pendingCount,
          ceremonyQueue,
          ackGrade,
        });
      },

      async dispatch(event, now) {
        await appendEvent(db, event, 0);
        const all = await getAllEvents(db);
        const { model } = applyEvents(get().readModel, [event], all);
        await saveReadModel(db, model);
        const pendingCount = (await getUnsynced(db)).length;
        set({ readModel: model, viewModel: present(model, now), pendingCount });
        await detect();
      },

      async rebuild(now) {
        const readModel = project(await getAllEvents(db));
        await saveReadModel(db, readModel);
        const pendingCount = (await getUnsynced(db)).length;
        set({ readModel, viewModel: present(readModel, now), pendingCount });
        await detect();
      },

      refreshPresent(now) {
        set({ viewModel: present(get().readModel, now) });
      },

      async setAuth(email) {
        const pendingCount = (await getUnsynced(db)).length;
        set({
          authEmail: email,
          pendingCount,
          syncState:
            email === null ? "local" : get().syncState === "local" ? "syncing" : get().syncState,
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
          await detect();
        } catch {
          const pendingCount = (await getUnsynced(db)).length;
          set({ syncState: "error", pendingCount });
        }
      },

      dismissCeremony() {
        set({ ceremonyQueue: get().ceremonyQueue.slice(1) });
      },
    };
  });
}
