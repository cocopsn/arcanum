import Dexie, { type Table } from "dexie";
import type { ArcanumEvent } from "@/core/event";
import type { ReadModel } from "@/core/read-model";

/** The immutable log row. `synced` is LOCAL metadata, not part of the envelope. */
export interface StoredEvent extends ArcanumEvent {
  synced: 0 | 1;
}

export interface ProjectionRow {
  key: "current";
  model: ReadModel;
}

export interface SyncMetaRow {
  key: "sync";
  /** last server `seq` pulled */
  pullCursor: number;
}

export class ArcanumDB extends Dexie {
  events!: Table<StoredEvent, string>;
  projection!: Table<ProjectionRow, string>;
  sync_meta!: Table<SyncMetaRow, string>;

  constructor(name = "arcanum") {
    super(name);
    this.version(1).stores({
      events: "id, synced, ts",
      projection: "key",
      sync_meta: "key",
    });
  }
}

export function createDb(name?: string): ArcanumDB {
  return new ArcanumDB(name);
}
