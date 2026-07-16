import { createStore, type StoreApi } from "zustand/vanilla";
import { project, applyEvents } from "@/core/projector";
import { present, type ViewModel } from "@/core/present";
import { gradesBetween, type GradeInfo } from "@/core/grade";
import type { ReadModel } from "@/core/read-model";
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { getDeviceId } from "@/lib/device";
import type { ArcanumDB } from "@/db/schema";
import {
  appendEvent,
  appendEvents,
  getAllEvents,
  getUnsynced,
  saveReadModel,
  getAckGrade,
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

  hydrate: (now: number) => Promise<void>;
  dispatch: (event: ArcanumEvent, now: number) => Promise<void>;
  rebuild: (now: number) => Promise<void>;
  refreshPresent: (now: number) => void;
  setAuth: (email: string | null) => Promise<void>;
  sync: (client: SyncClient, now: number) => Promise<void>;
  /** Pop the front ceremony once shown. */
  dismissCeremony: () => void;
  /** Raw log (for the Sleep Cycle's 24h fold). */
  getEvents: () => Promise<ArcanumEvent[]>;
}

export type ArcanumStore = StoreApi<ArcanumState>;

export function createArcanumStore(db: ArcanumDB): ArcanumStore {
  return createStore<ArcanumState>((set, get) => {
    // Record a grade's ceremony as ACKNOWLEDGED in the log (grade.celebrated). The
    // event syncs, so every device sees the grade as celebrated — exactly once in
    // the universe. xpBase is 0, so it never shifts the grade (no loop). Folds in
    // immediately so celebratedGrade advances.
    async function emitCelebrated(now: number, index: number): Promise<void> {
      const ev = makeEvent("grade.celebrated", { index }, { ts: now, deviceId: getDeviceId() });
      await appendEvent(db, ev, 0);
      const all = await getAllEvents(db);
      const { model } = applyEvents(get().readModel, [ev], all);
      await saveReadModel(db, model);
      const pendingCount = (await getUnsynced(db)).length;
      set({ readModel: model, viewModel: present(model, now), pendingCount });
    }

    // Enqueue ceremonies for any genuine grade crossing, then record it. Idempotent
    // under re-fold: celebratedGrade (derived from the log, null → baseline 0) only
    // advances, so the same grade is never celebrated twice — across rebuilds OR
    // devices. The grade ladder is monotonic, so current never goes backwards.
    async function reconcileCeremonies(now: number): Promise<void> {
      const rm = get().readModel;
      const current = rm.stats.gradeIndex;
      const celebrated = rm.celebratedGrade ?? 0; // null (none yet) → starting grade 0
      if (current > celebrated) {
        const queue = gradesBetween(celebrated, current);
        await emitCelebrated(now, current);
        set({ ceremonyQueue: [...get().ceremonyQueue, ...queue] });
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

      async hydrate(now) {
        let events = await getAllEvents(db);
        // Apply only the seed events this log is MISSING (fixed uuids → set difference by id). This is
        // what lets the seed EVOLVE: an existing device receives just the genuinely-new events (e.g.
        // the paths block) while its history is left byte-identical. Seeding only-when-empty would
        // have stranded every existing log on the old structure; bulkPut-ing the whole seed every
        // hydrate would clobber the `synced` flag of already-pushed rows and re-upload them forever.
        const have = new Set(events.map((e) => e.id));
        const missing = SEED_EVENTS.filter((e) => !have.has(e.id));
        if (missing.length > 0) {
          await appendEvents(db, missing, 0);
          events = await getAllEvents(db);
        }
        const readModel = project(events);
        await saveReadModel(db, readModel);
        const pendingCount = (await getUnsynced(db)).length;
        set({ status: "ready", readModel, viewModel: present(readModel, now), pendingCount });

        // One-time migration: an OLD universe used a device-local ackGrade (sync_meta).
        // If the log has no grade.celebrated yet but a prior ack exists, seed the
        // baseline into the log so we don't re-celebrate grades earned long ago.
        if (readModel.celebratedGrade === null) {
          const oldAck = await getAckGrade(db);
          if (oldAck !== null && oldAck > 0) await emitCelebrated(now, oldAck);
        }
        // Show ceremonies for any genuine crossing the log records (none on a fresh
        // universe at grade 0 → no baseline event is written, log stays clean).
        await reconcileCeremonies(now);
      },

      async dispatch(event, now) {
        await appendEvent(db, event, 0);
        const all = await getAllEvents(db);
        const { model } = applyEvents(get().readModel, [event], all);
        await saveReadModel(db, model);
        const pendingCount = (await getUnsynced(db)).length;
        set({ readModel: model, viewModel: present(model, now), pendingCount });
        await reconcileCeremonies(now);
      },

      async rebuild(now) {
        const readModel = project(await getAllEvents(db));
        await saveReadModel(db, readModel);
        const pendingCount = (await getUnsynced(db)).length;
        set({ readModel, viewModel: present(readModel, now), pendingCount });
        await reconcileCeremonies(now);
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
          await reconcileCeremonies(now);
        } catch {
          const pendingCount = (await getUnsynced(db)).length;
          set({ syncState: "error", pendingCount });
        }
      },

      dismissCeremony() {
        set({ ceremonyQueue: get().ceremonyQueue.slice(1) });
      },

      getEvents() {
        return getAllEvents(db);
      },
    };
  });
}
